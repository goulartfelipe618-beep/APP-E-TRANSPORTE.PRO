import type { SupabaseClient } from "@supabase/supabase-js";

export const CADASTRO_CLIENTES_BUCKET = "cadastro-clientes-docs";

/** Chave reservada em `documentos` (JSON) para o caminho no Storage da foto de perfil. */
export const FOTO_PERFIL_DOC_KEY = "foto_perfil";

export function getFotoPerfilPathFromDocumentos(documentos: unknown): string | null {
  if (!documentos || typeof documentos !== "object" || Array.isArray(documentos)) return null;
  const v = (documentos as Record<string, unknown>)[FOTO_PERFIL_DOC_KEY];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export async function getCadastroClienteSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CADASTRO_CLIENTES_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadCadastroClienteDocs(
  supabase: SupabaseClient,
  userId: string,
  clienteId: string,
  files: { slug: string; file: File }[],
): Promise<Record<string, string>> {
  const paths: Record<string, string> = {};
  for (const { slug, file } of files) {
    const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "doc";
    const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    const path = `${userId}/${clienteId}/${safeSlug}.${ext}`;
    const { error } = await supabase.storage.from(CADASTRO_CLIENTES_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (!error) paths[safeSlug] = path;
  }
  return paths;
}
