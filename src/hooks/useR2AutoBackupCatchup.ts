import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

function dateFolderSp(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(new Date());
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${pick("day")}.${pick("month")}.${pick("year")}`;
}

/** Se o AUTO BACK-UP estiver ligado e ainda não houver cópia de hoje, dispara uma vez. */
export function useR2AutoBackupCatchup() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const today = dateFolderSp();
    const kick = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id;
      if (!uid) return;
      const storageKey = `etp_r2_backup_kick_${uid}_${today}`;
      if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey) === "1") return;

      const { data, error } = await supabase.from("r2_auto_backup_status" as never).select("*").maybeSingle();
      if (error || !data) return;
      const st = data as { enabled?: boolean; last_run_date_sp?: string | null };
      if (!st.enabled) return;
      if (st.last_run_date_sp === today) {
        localStorage.setItem(storageKey, "1");
        return;
      }
      const { error: fnErr } = await supabase.functions.invoke("r2-auto-backup", { body: { mode: "manual" } });
      if (!fnErr) localStorage.setItem(storageKey, "1");
    };
    void kick();
  }, []);
}
