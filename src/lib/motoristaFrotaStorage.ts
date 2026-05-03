import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import type { Database } from "@/integrations/supabase/types";

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

/**
 * URLs assinadas para pré-visualização / PDF. Requer sessão do **dono** do ficheiro (RLS no Storage).
 * @param expiresSeg TTL em segundos (ex.: 3600 na ficha, 7200 no PDF).
 */
export async function signMotoristaFrotaDocUrls(
  supabase: SupabaseClient<Database>,
  dadosWebhook: unknown,
  expiresSeg = 3600,
): Promise<MotoristaFrotaDocSignedUrls> {
  const dw = parseDadosWebhook(dadosWebhook);
  const result: MotoristaFrotaDocSignedUrls = {};

  const signPath = async (pathRaw: string): Promise<string | undefined> => {
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
        .createSignedUrl(extracted, expiresSeg);
      if (error || !data?.signedUrl) return undefined;
      return data.signedUrl;
    }
    const { data, error } = await supabase.storage
      .from(MOTORISTA_FROTA_DOCS_BUCKET)
      .createSignedUrl(path, expiresSeg);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  };

  const pPerfil = pickStr(dw, DOC_PATH_KEYS.perfil, "doc_foto_perfil_path");
  const pFrente = pickStr(dw, DOC_PATH_KEYS.cnhFrente);
  const pVerso = pickStr(dw, DOC_PATH_KEYS.cnhVerso);
  const pRes = pickStr(dw, DOC_PATH_KEYS.residencia);

  const perfil = await signPath(pPerfil);
  if (perfil) result.perfil = perfil;
  else {
    const leg = pickStr(dw, "doc_perfil_url", "foto_perfil_url");
    const s = await signPath(leg);
    if (s) result.perfil = s;
  }

  const cnhFrente = await signPath(pFrente);
  if (cnhFrente) result.cnhFrente = cnhFrente;
  else {
    const s = await signPath(pickStr(dw, "doc_cnh_frente_url"));
    if (s) result.cnhFrente = s;
  }

  const cnhVerso = await signPath(pVerso);
  if (cnhVerso) result.cnhVerso = cnhVerso;
  else {
    const s = await signPath(pickStr(dw, "doc_cnh_verso_url"));
    if (s) result.cnhVerso = s;
  }

  const residencia = await signPath(pRes);
  if (residencia) result.residencia = residencia;
  else {
    const s = await signPath(pickStr(dw, "doc_comprovante_residencia_url"));
    if (s) result.residencia = s;
  }

  return result;
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
