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

/** URLs para pré-visualização (bucket público com path opaco) ou URLs legadas normalizadas. */
export type MotoristaFrotaDocSignedUrls = Partial<Record<MotoristaFrotaDocSlug, string>>;

function storagePath(userId: string, motoristaId: string, slug: string, ext: string): string {
  return `${userId}/${motoristaId}/${slug}.${ext}`;
}

/**
 * Envia os anexos do cadastro de frota para o Storage e devolve entradas a fundir em `dados_webhook`.
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
 * Corrige URLs do tipo …/object/{bucket}/… (sem `public`) que devolvem 400 em browsers.
 */
export function normalizeMotoristaFrotaStorageHttpUrl(url: string): string {
  const u = url.trim();
  if (u.includes("/object/sign/")) return u;
  const bucket = MOTORISTA_FROTA_DOCS_BUCKET;
  const wrong = `/storage/v1/object/${bucket}/`;
  const right = `/storage/v1/object/public/${bucket}/`;
  if (u.includes(wrong) && !u.includes(`/object/public/${bucket}/`)) {
    return u.replace(wrong, right);
  }
  return u;
}

function publicUrlForStoragePath(supabase: SupabaseClient<Database>, objectPath: string): string | undefined {
  const path = objectPath.trim();
  if (!path || isHttpUrl(path)) return undefined;
  const { data } = supabase.storage.from(MOTORISTA_FROTA_DOCS_BUCKET).getPublicUrl(path);
  return data?.publicUrl;
}

function resolveOneViewUrl(supabase: SupabaseClient<Database>, pathOrUrl: string | undefined): string | undefined {
  const raw = (pathOrUrl || "").trim();
  if (!raw) return undefined;
  if (isHttpUrl(raw)) {
    return normalizeMotoristaFrotaStorageHttpUrl(raw);
  }
  return publicUrlForStoragePath(supabase, raw);
}

/**
 * Resolve URLs de visualização para documentos da frota (bucket público + path relativo em `dados_webhook`).
 * @deprecated O parâmetro `expiresSec` é ignorado; mantido para compatibilidade de chamadas antigas.
 */
export function resolveMotoristaFrotaDocViewUrls(
  supabase: SupabaseClient<Database>,
  dadosWebhook: unknown,
  _expiresSec?: number,
): MotoristaFrotaDocSignedUrls {
  const dw = parseDadosWebhook(dadosWebhook);
  const result: MotoristaFrotaDocSignedUrls = {};

  const pPerfil = pickStr(dw, DOC_PATH_KEYS.perfil, "doc_foto_perfil_path");
  const pFrente = pickStr(dw, DOC_PATH_KEYS.cnhFrente);
  const pVerso = pickStr(dw, DOC_PATH_KEYS.cnhVerso);
  const pRes = pickStr(dw, DOC_PATH_KEYS.residencia);

  const uPerfil = resolveOneViewUrl(supabase, pPerfil) ?? resolveOneViewUrl(supabase, pickStr(dw, "doc_perfil_url", "foto_perfil_url"));
  if (uPerfil) result.perfil = uPerfil;

  const uFrente = resolveOneViewUrl(supabase, pFrente) ?? resolveOneViewUrl(supabase, pickStr(dw, "doc_cnh_frente_url"));
  if (uFrente) result.cnhFrente = uFrente;

  const uVerso = resolveOneViewUrl(supabase, pVerso) ?? resolveOneViewUrl(supabase, pickStr(dw, "doc_cnh_verso_url"));
  if (uVerso) result.cnhVerso = uVerso;

  const uRes = resolveOneViewUrl(supabase, pRes) ?? resolveOneViewUrl(supabase, pickStr(dw, "doc_comprovante_residencia_url"));
  if (uRes) result.residencia = uRes;

  return result;
}

/** @deprecated Use `resolveMotoristaFrotaDocViewUrls` (síncrono). */
export const signMotoristaFrotaDocUrls = resolveMotoristaFrotaDocViewUrls;

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
