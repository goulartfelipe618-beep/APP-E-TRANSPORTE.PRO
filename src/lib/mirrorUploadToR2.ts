import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_R2_BUCKETS, r2PublicMediaUrl } from "@/lib/r2PublicUrl";

export async function uploadFileToR2(bucket: string, path: string, file: File | Blob): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão inválida para enviar ao R2.");
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !anon) throw new Error("Supabase URL em falta.");
  const form = new FormData();
  form.set("bucket", bucket);
  form.set("path", path.replace(/^\/+/, ""));
  const blob = file instanceof File ? file : new File([file], path.split("/").pop() || "file");
  form.set("file", blob);
  const res = await fetch(`${base}/functions/v1/r2-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t.slice(0, 240) || `Falha no upload R2 (${res.status}).`);
  }
  const clean = path.replace(/^\/+/, "");
  if (PUBLIC_R2_BUCKETS.has(bucket)) return r2PublicMediaUrl(bucket, clean);
  return clean;
}

/** @deprecated use uploadFileToR2 — mantido para call sites antigos. */
export async function mirrorUploadToR2(bucket: string, path: string, file: File | Blob): Promise<void> {
  await uploadFileToR2(bucket, path, file);
}
