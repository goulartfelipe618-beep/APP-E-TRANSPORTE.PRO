import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadFileToR2 } from "@/lib/mirrorUploadToR2";

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
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    "r2-private-media" as never,
    { body: { bucket: CADASTRO_CLIENTES_BUCKET, path } },
  );
  if (error || !data?.url) return null;
  return data.url;
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
    try {
      await uploadFileToR2(CADASTRO_CLIENTES_BUCKET, path, file);
      paths[safeSlug] = path;
    } catch {
      /* skip this file */
    }
  }
  return paths;
}
