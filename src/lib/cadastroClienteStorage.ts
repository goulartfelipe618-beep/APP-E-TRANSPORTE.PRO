import type { SupabaseClient } from "@supabase/supabase-js";

export const CADASTRO_CLIENTES_BUCKET = "cadastro-clientes-docs";

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
