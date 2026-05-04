import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import type { Database } from "@/integrations/supabase/types";
import { getAppPublicOrigin, getMotoristaVerificacaoAppOrigin } from "@/lib/appPublicUrl";

export const MOTORISTA_FROTA_DOCS_BUCKET = "motorista-frota-docs" as const;

const MAX_BYTES = 5 * 1024 * 1024;

export const DOC_PATH_KEYS = {
  perfil: "doc_perfil_path",
  cnhFrente: "doc_cnh_frente_path",
  cnhVerso: "doc_cnh_verso_path",
  residencia: "doc_comprovante_residencia_path",
} as const;

export type MotoristaFrotaDocSlug = keyof typeof DOC_PATH_KEYS;

/** URLs assinadas (bucket privado); válidas até expirarem. */
export type MotoristaFrotaDocSignedUrls = Partial<Record<MotoristaFrotaDocSlug, string>>;

/** share = domínio da app (abrir/copiar); preview = Edge Function (img/PDF). */
export type MotoristaFrotaDocUrlBundle = {
  share: MotoristaFrotaDocSignedUrls;
  preview: MotoristaFrotaDocSignedUrls;
};

function storagePath(userId: string, motoristaId: string, slug: string, ext: string): string {
  return `${userId}/${motoristaId}/${slug}.${ext}`;
}

/**
 * Envia os anexos do cadastro de frota para o Storage e devolve entradas a fundir em `dados_webhook`.
 * O path começa sempre por `user_id` do dono — alinhado às políticas RLS do bucket.
 */
export async function uploadMotoristaFrotaDocs(
  supabase: SupabaseClient<Database>,
  userId: string,
  motoristaId: string,
  files: Partial<Record<MotoristaFrotaDocSlug, File>>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const entries = Object.entries(files) as [MotoristaFrotaDocSlug, File | undefined][];
  for (const [slug, file] of entries) {
    if (!file) continue;
    const { mime } = await assertUploadMagicBytes(file, "raster-or-pdf", MAX_BYTES);
    const ext = extensionForDetectedMime(mime);
    const path = storagePath(userId, motoristaId, slug, ext);
    const { error } = await supabase.storage.from(MOTORISTA_FROTA_DOCS_BUCKET).upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: mime,
    });
    if (error) throw new Error(error.message);
    const key = DOC_PATH_KEYS[slug];
    out[key] = path;
  }
  return out;
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

/**
 * Extrai o path do objeto dentro do bucket a partir de URLs do Supabase Storage (públicas, assinadas ou malformadas).
 */
export function extractMotoristaFrotaDocObjectPath(rawUrl: string): string | null {
  const u = rawUrl.trim();
  const bucket = MOTORISTA_FROTA_DOCS_BUCKET;
  const markers = [
    `/object/public/${bucket}/`,
    `/object/sign/${bucket}/`,
    `/object/authenticated/${bucket}/`,
    `/object/${bucket}/`,
  ];
  for (const m of markers) {
    const i = u.indexOf(m);
    if (i === -1) continue;
    let tail = u.slice(i + m.length);
    const q = tail.indexOf("?");
    if (q !== -1) tail = tail.slice(0, q);
    try {
      return decodeURIComponent(tail);
    } catch {
      return tail;
    }
  }
  return null;
}

function buildMotoristaFrotaDocViewerUrl(token: string): string {
  const base = getMotoristaVerificacaoAppOrigin() || getAppPublicOrigin();
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/motorista-frota-doc?t=${encodeURIComponent(token)}`;
}

function buildMotoristaFrotaDocEdgeUrl(token: string): string {
  const u = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!u) return "";
  return `${u.replace(/\/$/, "")}/functions/v1/motorista-frota-doc-link?t=${encodeURIComponent(token)}`;
}

/**
 * URLs para pré-visualização (preview) e partilha (share = domínio app).
 * Usa Edge Function `motorista-frota-doc-link` quando disponível; fallback para CreateSignedUrl.
 */
export async function signMotoristaFrotaDocUrls(
  supabase: SupabaseClient<Database>,
  dadosWebhook: unknown,
  _expiresSeg = 3600,
): Promise<MotoristaFrotaDocUrlBundle> {
  const dw = parseDadosWebhook(dadosWebhook);
  const share: MotoristaFrotaDocSignedUrls = {};
  const preview: MotoristaFrotaDocSignedUrls = {};

  const signPathLegacy = async (pathRaw: string): Promise<string | undefined> => {
    const path = pathRaw.trim();
    if (!path) return undefined;
    if (isHttpUrl(path)) {
      if (!path.includes("supabase.co") || !path.includes(MOTORISTA_FROTA_DOCS_BUCKET)) {
        return path;
      }
      const extracted = extractMotoristaFrotaDocObjectPath(path);
      if (!extracted) return undefined;
      const { data, error } = await supabase.storage
        .from(MOTORISTA_FROTA_DOCS_BUCKET)
        .createSignedUrl(extracted, 3600);
      if (error || !data?.signedUrl) return undefined;
      return data.signedUrl;
    }
    const { data, error } = await supabase.storage
      .from(MOTORISTA_FROTA_DOCS_BUCKET)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  };

  /** Path relativo no bucket ou null se for URL externa / vazio. */
  const toBucketPath = (raw: string | undefined): string | null => {
    if (!raw || !String(raw).trim()) return null;
    const s = String(raw).trim();
    if (isHttpUrl(s)) {
      if (!s.includes(MOTORISTA_FROTA_DOCS_BUCKET)) return null;
      return extractMotoristaFrotaDocObjectPath(s);
    }
    return s;
  };

  const pathPerfil =
    toBucketPath(pickStr(dw, DOC_PATH_KEYS.perfil, "doc_foto_perfil_path")) ??
    toBucketPath(pickStr(dw, "doc_perfil_url", "foto_perfil_url"));
  const pathFrente =
    toBucketPath(pickStr(dw, DOC_PATH_KEYS.cnhFrente)) ??
    toBucketPath(pickStr(dw, "doc_cnh_frente_url"));
  const pathVerso =
    toBucketPath(pickStr(dw, DOC_PATH_KEYS.cnhVerso)) ??
    toBucketPath(pickStr(dw, "doc_cnh_verso_url"));
  const pathRes =
    toBucketPath(pickStr(dw, DOC_PATH_KEYS.residencia)) ??
    toBucketPath(pickStr(dw, "doc_comprovante_residencia_url"));

  const slugToPath: Partial<Record<MotoristaFrotaDocSlug, string>> = {};
  if (pathPerfil) slugToPath.perfil = pathPerfil;
  if (pathFrente) slugToPath.cnhFrente = pathFrente;
  if (pathVerso) slugToPath.cnhVerso = pathVerso;
  if (pathRes) slugToPath.residencia = pathRes;

  const uniquePaths = [...new Set(Object.values(slugToPath).filter(Boolean))] as string[];

  let tokens: Record<string, string> = {};
  if (uniquePaths.length > 0) {
    const { data, error } = await supabase.functions.invoke("motorista-frota-doc-link" as never, {
      body: { paths: uniquePaths },
    });
    if (!error && data && typeof data === "object" && data !== null && "tokens" in data) {
      const t = (data as { tokens?: Record<string, string> }).tokens;
      if (t && typeof t === "object") tokens = t;
    }
  }

  const fillSlug = async (slug: MotoristaFrotaDocSlug, bucketPath: string | null) => {
    if (!bucketPath) {
      let raw = "";
      if (slug === "perfil") {
        raw =
          pickStr(dw, DOC_PATH_KEYS.perfil, "doc_foto_perfil_path") ||
          pickStr(dw, "doc_perfil_url", "foto_perfil_url");
      } else if (slug === "cnhFrente") {
        raw = pickStr(dw, DOC_PATH_KEYS.cnhFrente) || pickStr(dw, "doc_cnh_frente_url");
      } else if (slug === "cnhVerso") {
        raw = pickStr(dw, DOC_PATH_KEYS.cnhVerso) || pickStr(dw, "doc_cnh_verso_url");
      } else {
        raw = pickStr(dw, DOC_PATH_KEYS.residencia) || pickStr(dw, "doc_comprovante_residencia_url");
      }
      const leg = await signPathLegacy(raw);
      if (leg) {
        share[slug] = leg;
        preview[slug] = leg;
      }
      return;
    }

    const tok = tokens[bucketPath];
    if (tok) {
      const sUrl = buildMotoristaFrotaDocViewerUrl(tok);
      const pUrl = buildMotoristaFrotaDocEdgeUrl(tok);
      if (sUrl) share[slug] = sUrl;
      if (pUrl) preview[slug] = pUrl;
    } else {
      const leg = await signPathLegacy(bucketPath);
      if (leg) {
        share[slug] = leg;
        preview[slug] = leg;
      }
    }
  };

  await fillSlug("perfil", pathPerfil);
  await fillSlug("cnhFrente", pathFrente);
  await fillSlug("cnhVerso", pathVerso);
  await fillSlug("residencia", pathRes);

  return { share, preview };
}

export function hasMotoristaDocAttachment(dadosWebhook: unknown, slug: MotoristaFrotaDocSlug): boolean {
  const dw = parseDadosWebhook(dadosWebhook);
  const pathKey = DOC_PATH_KEYS[slug];
  if (pickStr(dw, pathKey)) return true;
  if (slug === "perfil" && pickStr(dw, "doc_foto_perfil_path", "doc_perfil_url", "foto_perfil_url")) return true;
  if (slug === "cnhFrente" && pickStr(dw, "doc_cnh_frente_url")) return true;
  if (slug === "cnhVerso" && pickStr(dw, "doc_cnh_verso_url")) return true;
  if (slug === "residencia" && pickStr(dw, "doc_comprovante_residencia_url")) return true;
  return false;
}
