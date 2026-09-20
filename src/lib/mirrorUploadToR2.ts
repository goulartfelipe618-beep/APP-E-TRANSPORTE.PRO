import { supabase } from "@/integrations/supabase/client";

/** Cópia extra para o R2; falhas não bloqueiam o upload no Supabase. */
export async function mirrorUploadToR2(bucket: string, path: string, file: File | Blob): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!base || !anon) return;
    const form = new FormData();
    form.set("bucket", bucket);
    form.set("path", path.replace(/^\/+/, ""));
    const blob = file instanceof File ? file : new File([file], path.split("/").pop() || "file");
    form.set("file", blob);
    await fetch(`${base}/functions/v1/r2-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: form,
    });
  } catch {
    /* origem no Storage Supabase permanece */
  }
}
