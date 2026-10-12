import { supabase } from "@/integrations/supabase/client";

type SnapshotPage = {
  ok?: boolean;
  error?: string | null;
  done?: boolean;
  table?: string;
  offset?: number;
  written?: number;
  skipped?: string;
};

/** Regrava só o arquivo deste registro. Não interrompe o salvamento se a Cloudflare falhar. */
export function syncR2Record(table: string, id: string): void {
  if (!table || !id) return;
  void supabase.functions
    .invoke<SnapshotPage>("r2-auto-backup", { body: { mode: "upsert", table, id } })
    .then(({ data, error }) => {
      if (error || data?.ok === false) {
        console.warn("r2 registro:", error?.message || data?.error || table);
      }
    })
    .catch((e: unknown) => {
      console.warn("r2 registro:", e);
    });
}

/** Apaga só o arquivo deste registro e, se houver, os objetos dentro da pasta dele. */
export async function purgeR2Record(table: string, id: string): Promise<void> {
  if (!table || !id) return;
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("r2-auto-backup", {
    body: { mode: "purge", table, id },
  });
  if (error) throw new Error(error.message);
  if (data?.ok === false) throw new Error(data.error || "Falha ao apagar o arquivo na Cloudflare.");
}

/** Cópia inicial, uma página por vez. Se já foi feita, o servidor não reenvia nada. */
export async function runInitialR2Snapshot(onProgress?: (label: string) => void): Promise<void> {
  let table: string | undefined;
  let offset = 0;
  for (let step = 0; step < 500; step++) {
    const { data, error } = await supabase.functions.invoke<SnapshotPage>("r2-auto-backup", {
      body: { mode: "snapshot", table, offset },
    });
    if (error) throw new Error(error.message);
    if (!data || data.ok === false) throw new Error(data?.error || "Falha na cópia inicial.");
    if (data.done) return;
    table = data.table;
    offset = data.offset ?? 0;
    onProgress?.(`${data.table ?? "registros"}: ${data.written ?? 0} enviado(s)`);
  }
  throw new Error("A cópia inicial não terminou. Pode clicar de novo para continuar de onde parou.");
}
