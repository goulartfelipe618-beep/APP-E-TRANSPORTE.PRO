import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useComunicadoresEvolution, qrSrc } from "@/hooks/useComunicadoresEvolution";
import { isOwnEvolutionConnected } from "@/lib/evolutionConnection";
import {
  fetchEvolutionMotoristaDeleteFromServer,
  fetchEvolutionMotoristaQrFromServer,
  fetchEvolutionMotoristaSyncFromServer,
  formatPhoneBrDisplay,
} from "@/lib/evolutionApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, QrCode, Smartphone } from "lucide-react";

const QR_SESSION_MS = 10 * 60 * 1000;
const POLL_MS = 3000;
const CONNECTED_STATUS = new Set(["open", "conectado", "connected", "online"]);

function isConfirmedSyncConnected(sync: { connected: boolean; phone: string | null; state: string | null }): boolean {
  if (!sync.connected) return false;
  if (sync.phone?.trim()) return true;
  return CONNECTED_STATUS.has((sync.state || "").trim().toLowerCase());
}

function instanciaDestaConta(
  row: { user_id?: string | null; instance_name?: string | null } | null,
  userId: string | null,
): boolean {
  if (!row || !userId || row.user_id !== userId) return false;
  const nome = (row.instance_name || "").toLowerCase();
  if (!nome) return false;
  return nome.includes(userId.replace(/-/g, "").slice(0, 16));
}

export default function ComunicadorWhatsappPage() {
  const { own, sessionUserId, loading, reload } = useComunicadoresEvolution();
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
        toast.message("O QR expirou. Toque em Escanear QR Code para gerar outro.");
      }
    }, 1000);

    pollRef.current = setInterval(() => {
      void trySyncRef.current();
    }, POLL_MS);

    return () => {
      clearTimers();
    };
  }, [qrSession, sessionDeadline, clearTimers]);

  const handleDesconectar = useCallback(async () => {
    setBusyQr(true);
    try {
      clearTimers();
      setQrSession(false);
      setSessionDeadline(null);
      setSessionQrBase64(null);
      const res = await fetchEvolutionMotoristaDeleteFromServer({ target: "own" });
      if (!res.ok) {
        toast.error(res.detail || "Não foi possível excluir a instância do WhatsApp.");
        return;
      }
      wasConnectedRef.current = false;
      await persistOwnPatch({
        instance_name: null,
        qr_code_base64: null,
        connection_status: "desconectado",
        telefone_conectado: null,
        nome_dispositivo: null,
        foto_perfil_url: null,
      });
      toast.success("WhatsApp desconectado desta conta.");
    } finally {
      setBusyQr(false);
    }
  }, [clearTimers, persistOwnPatch]);

  const handleConectar = useCallback(async () => {
    setBusyQr(true);
    try {
      const pack = await fetchEvolutionMotoristaQrFromServer();
      if (!pack.base64) {
        const detail = (pack.detail || "").toLowerCase();
        if (pack.code === "already_connected" || detail.includes("already in use")) {
          await trySync();
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

  const qrImg = qrSrc(sessionQrBase64);
  const meuWhatsapp = instanciaDestaConta(own, sessionUserId) && Boolean(own?.telefone_conectado?.trim());
  const numero = meuWhatsapp && own?.telefone_conectado ? formatPhoneBrDisplay(own.telefone_conectado) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 sm:py-14">
      <section className="rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF6600]/15 text-[#FF6600]">
          {numero ? <Smartphone className="h-7 w-7" /> : <QrCode className="h-7 w-7" />}
        </div>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-foreground">Comunicador</h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          {numero
            ? "Este número envia as mensagens desta conta. Nenhuma outra empresa vê esta ligação."
            : "Esta conta começa sem WhatsApp. Toque no botão para gerar o QR Code e conectar o seu número."}
        </p>

        {numero ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-center text-sm text-muted-foreground">WhatsApp desta conta</p>
            <p className="text-center text-lg font-medium text-foreground">{numero}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDesconectar()}
              disabled={busyQr || loading}
            >
              {busyQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desconectar
            </Button>
          </div>
        ) : qrSession && qrImg ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <img src={qrImg} alt="QR Code para conectar o WhatsApp" className="h-56 w-56 object-contain" />
            </div>
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              No celular, abra o WhatsApp, toque em Aparelhos conectados e leia este código.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <Button
              type="button"
              className="h-11 bg-[#FF6600] px-6 text-white hover:bg-[#FF6600]/90"
              onClick={() => void handleConectar()}
              disabled={busyQr || loading}
            >
              {busyQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Escanear QR Code
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
