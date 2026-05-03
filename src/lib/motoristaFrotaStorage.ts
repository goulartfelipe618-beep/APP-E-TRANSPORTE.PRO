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
 * Resolve URLs assinadas (bucket privado) ou URLs legadas gravadas no JSON.
 */
export async function signMotoristaFrotaDocUrls(
  supabase: SupabaseClient<Database>,
  dadosWebhook: unknown,
  expiresSec = 3600,
): Promise<MotoristaFrotaDocSignedUrls> {
  const dw = parseDadosWebhook(dadosWebhook);
  const result: MotoristaFrotaDocSignedUrls = {};

  const signPath = async (slug: MotoristaFrotaDocSlug, pathRaw: string) => {
    const path = pathRaw.trim();
    if (!path) return;
    const { data, error } = await supabase.storage
      .from(MOTORISTA_FROTA_DOCS_BUCKET)
      .createSignedUrl(path, expiresSec);
    if (!error && data?.signedUrl) result[slug] = data.signedUrl;
  };

  const pPerfil = pickStr(dw, DOC_PATH_KEYS.perfil, "doc_foto_perfil_path");
  const pFrente = pickStr(dw, DOC_PATH_KEYS.cnhFrente);
  const pVerso = pickStr(dw, DOC_PATH_KEYS.cnhVerso);
  const pRes = pickStr(dw, DOC_PATH_KEYS.residencia);

  if (pPerfil && !isHttpUrl(pPerfil)) await signPath("perfil", pPerfil);
  else if (isHttpUrl(pickStr(dw, "doc_perfil_url", "foto_perfil_url"))) {
    result.perfil = pickStr(dw, "doc_perfil_url", "foto_perfil_url").trim();
  }

  if (pFrente && !isHttpUrl(pFrente)) await signPath("cnhFrente", pFrente);
  else if (isHttpUrl(pickStr(dw, "doc_cnh_frente_url"))) result.cnhFrente = pickStr(dw, "doc_cnh_frente_url").trim();

  if (pVerso && !isHttpUrl(pVerso)) await signPath("cnhVerso", pVerso);
  else if (isHttpUrl(pickStr(dw, "doc_cnh_verso_url"))) result.cnhVerso = pickStr(dw, "doc_cnh_verso_url").trim();

  if (pRes && !isHttpUrl(pRes)) await signPath("residencia", pRes);
  else if (isHttpUrl(pickStr(dw, "doc_comprovante_residencia_url")))
    result.residencia = pickStr(dw, "doc_comprovante_residencia_url").trim();

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
