import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useComunicadoresEvolution, qrSrc } from "@/hooks/useComunicadoresEvolution";
import { isOwnEvolutionConnected } from "@/lib/evolutionConnection";
import {
  fetchEvolutionMotoristaQrFromServer,
  fetchEvolutionMotoristaSyncFromServer,
} from "@/lib/evolutionApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const QR_SESSION_MS = 10 * 60 * 1000;
const POLL_MS = 3000;
const CONNECTED_STATUS = new Set(["open", "conectado", "connected", "online"]);

function isConfirmedSyncConnected(sync: { connected: boolean; phone: string | null; state: string | null }): boolean {
  if (!sync.connected) return false;
  if (sync.phone?.trim()) return true;
  return CONNECTED_STATUS.has((sync.state || "").trim().toLowerCase());
}

export default function ComunicadorWhatsappPage() {
  const { own, loading, reload } = useComunicadoresEvolution();
  const [qrSession, setQrSession] = useState(false);
  const [sessionDeadline, setSessionDeadline] = useState<number | null>(null);
  const [sessionQrBase64, setSessionQrBase64] = useState<string | null>(null);
  const [busyQr, setBusyQr] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trySyncRef = useRef<() => Promise<void>>(async () => {});
  const endQrSessionRef = useRef<(opts?: { connected: boolean }) => Promise<void>>(async () => {});
  const expiryNotifiedRef = useRef(false);
  const wasConnectedRef = useRef(false);

  const ownConnected = useMemo(() => isOwnEvolutionConnected(own), [own]);
  useEffect(() => {
    wasConnectedRef.current = isOwnEvolutionConnected(own);
  }, [own]);

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const persistOwnPatch = useCallback(async (patch: Record<string, unknown>) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }
    const { data: existing, error: selErr } = await supabase
      .from("comunicadores_evolution")
      .select("id")
      .eq("escopo", "usuario")
      .eq("user_id", user.id)
      .maybeSingle();
    if (selErr) {
      toast.error(selErr.message || "Erro ao ler comunicador.");
      return;
    }
    if (existing?.id) {
      const { error } = await supabase.from("comunicadores_evolution").update(patch).eq("id", existing.id);
      if (error) {
        toast.error(error.message || "Erro ao atualizar comunicador.");
        return;
      }
    } else {
      const { error } = await supabase.from("comunicadores_evolution").insert({
        escopo: "usuario",
        user_id: user.id,
        rotulo: "WhatsApp",
        connection_status: "desconectado",
        ...patch,
      });
      if (error) {
        toast.error(error.message || "Erro ao criar comunicador.");
        return;
      }
    }
    await reload();
  }, [reload]);

  const endQrSession = useCallback(
    async (opts?: { connected: boolean }) => {
      clearTimers();
      expiryNotifiedRef.current = false;
      setQrSession(false);
      setSessionDeadline(null);
      setSessionQrBase64(null);
      if (!opts?.connected) {
        await persistOwnPatch({
          qr_code_base64: null,
          connection_status: "desconectado",
        });
      }
    },
    [clearTimers, persistOwnPatch],
  );

  const trySync = useCallback(async () => {
    const sync = await fetchEvolutionMotoristaSyncFromServer();
    if (sync.detail && !sync.connected) return;
    if (!isConfirmedSyncConnected(sync)) return;
    const prevConn = wasConnectedRef.current;
    await persistOwnPatch({
      telefone_conectado: sync.phone ?? own?.telefone_conectado ?? null,
      connection_status: "conectado",
      nome_dispositivo: sync.profileName?.trim() || own?.nome_dispositivo || null,
      foto_perfil_url: sync.profilePicUrl ?? own?.foto_perfil_url ?? null,
      qr_code_base64: null,
      ...(!prevConn ? { inbox_sessao_conectado_em: new Date().toISOString() } : {}),
    });
    wasConnectedRef.current = true;
    await endQrSession({ connected: true });
    toast.success("WhatsApp conectado. Os envios em Comunicar usam este número.");
  }, [persistOwnPatch, endQrSession, own?.nome_dispositivo, own?.foto_perfil_url, own?.telefone_conectado]);

  trySyncRef.current = trySync;
  endQrSessionRef.current = endQrSession;

  useEffect(() => {
    if (!qrSession || !sessionDeadline) {
      clearTimers();
      return;
    }
    expiryNotifiedRef.current = false;
    tickRef.current = setInterval(() => {
      const left = Math.max(0, sessionDeadline - Date.now());
      if (left <= 0 && !expiryNotifiedRef.current) {
        expiryNotifiedRef.current = true;
        void endQrSessionRef.current({ connected: false });
        toast.message("Tempo do QR expirou. Toque em Comunicar para gerar outro.");
      }
    }, 1000);

    pollRef.current = setInterval(() => {
      void trySyncRef.current();
    }, POLL_MS);

    return () => {
      clearTimers();
    };
  }, [qrSession, sessionDeadline, clearTimers]);

  const handleConectar = useCallback(async () => {
    setBusyQr(true);
    try {
      const pack = await fetchEvolutionMotoristaQrFromServer();
      if (!pack.base64) {
        const detail = (pack.detail || "").toLowerCase();
        if (pack.code === "already_connected" || detail.includes("already in use")) {
          await trySync();
          if (!isOwnEvolutionConnected(own)) {
            toast.message("Instância já existe. Desconecte para criar um novo vínculo.");
          }
          return;
        }
        toast.error(pack.detail || "Não foi possível gerar o QR Code.");
        return;
      }
      setSessionQrBase64(pack.base64);
      setSessionDeadline(Date.now() + QR_SESSION_MS);
      setQrSession(true);
      await persistOwnPatch({
        instance_name: pack.instanceName ?? undefined,
        qr_code_base64: pack.base64,
        connection_status: "aguardando_qr",
      });
      void trySync();
    } finally {
      setBusyQr(false);
    }
  }, [persistOwnPatch, trySync, own]);

  const qrImg = ownConnected ? null : qrSrc(sessionQrBase64);

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <Button
        type="button"
        className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
        onClick={() => void handleConectar()}
        disabled={busyQr || loading}
      >
        {busyQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Comunicar
      </Button>
      {qrSession && qrImg ? (
        <img src={qrImg} alt="QR Code WhatsApp" className="h-52 w-52 object-contain" />
      ) : null}
    </div>
  );
}
