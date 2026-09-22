import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useComunicadoresEvolution, qrSrc } from "@/hooks/useComunicadoresEvolution";
import { isOwnEvolutionConnected } from "@/lib/evolutionConnection";
import {
  fetchEvolutionMotoristaDeleteFromServer,
  fetchEvolutionMotoristaQrFromServer,
  fetchEvolutionMotoristaSyncFromServer,
} from "@/lib/evolutionApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Smartphone } from "lucide-react";

const QR_SESSION_MS = 10 * 60 * 1000;
const POLL_MS = 3000;
const CONNECTED_STATUS = new Set(["open", "conectado", "connected", "online"]);

function isConfirmedSyncConnected(sync: { connected: boolean; phone: string | null; state: string | null }): boolean {
  if (!sync.connected) return false;
  if (sync.phone?.trim()) return true;
  return CONNECTED_STATUS.has((sync.state || "").trim().toLowerCase());
}

function formatMmSs(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ComunicadorWhatsappPage() {
  const { own, loading, reload, setOwn } = useComunicadoresEvolution();
  const [qrSession, setQrSession] = useState(false);
  const [sessionDeadline, setSessionDeadline] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [sessionQrBase64, setSessionQrBase64] = useState<string | null>(null);
  const [busyQr, setBusyQr] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

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
        rotulo: "WhatsApp UAZAPI",
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
      setRemainingMs(0);
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
    setRemainingMs(Math.max(0, sessionDeadline - Date.now()));

    tickRef.current = setInterval(() => {
      const left = Math.max(0, sessionDeadline - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !expiryNotifiedRef.current) {
        expiryNotifiedRef.current = true;
        void endQrSessionRef.current({ connected: false });
        toast.message("Tempo do QR expirou. Toque em Conectar para gerar outro.");
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
      setRemainingMs(QR_SESSION_MS);
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

  const handleDesconectar = useCallback(async () => {
    setBusyDelete(true);
    try {
      const del = await fetchEvolutionMotoristaDeleteFromServer();
      if (!del.ok) {
        toast.error(del.detail || "Não foi possível desconectar o WhatsApp.");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("comunicadores_evolution").delete().eq("escopo", "usuario").eq("user_id", user.id);
      if (error) {
        toast.error(error.message || "Erro ao limpar registro local.");
        return;
      }
      setOwn(null);
      await reload();
      wasConnectedRef.current = false;
      setQrSession(false);
      setSessionQrBase64(null);
      toast.success("WhatsApp desconectado.");
    } finally {
      setBusyDelete(false);
    }
  }, [reload, setOwn]);

  const qrImg = qrSrc(sessionQrBase64 || own?.qr_code_base64 || null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Alert className="border-[#FF6600]/50 bg-[#FF6600]/10 text-foreground">
        <ShieldAlert className="h-4 w-4 text-[#FF6600]" />
        <AlertTitle className="text-foreground">Recomendação importante</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          A plataforma recomenda fortemente que utilize um <strong className="text-foreground">número de WhatsApp alternativo</strong>{" "}
          (não o seu contacto principal ou o WhatsApp Business oficial da empresa) para esta integração. O envio de
          mensagens utiliza uma API <strong className="text-foreground">não oficial da Meta</strong>, sem garantias da
          Meta/WhatsApp, com riscos de bloqueio ou indisponibilidade.
        </AlertDescription>
      </Alert>

      {ownConnected ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp conectado</CardTitle>
            <CardDescription>
              Os envios em Comunicar usam este número. Não é necessário colar URL ou token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {own?.telefone_conectado ? (
              <p className="font-mono text-lg font-semibold text-foreground">{own.telefone_conectado}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sessão ativa.</p>
            )}
            <Button type="button" variant="destructive" onClick={() => void handleDesconectar()} disabled={busyDelete}>
              {busyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desconectar
            </Button>
          </CardContent>
        </Card>
      ) : qrSession && qrImg ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Conectar com QR Code</CardTitle>
            <CardDescription>
              Escaneie no WhatsApp. Expira em <span className="font-mono text-foreground">{formatMmSs(remainingMs)}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-52 w-52 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
              <img src={qrImg} alt="QR Code WhatsApp" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                WhatsApp → Aparelhos ligados → Ligar um aparelho e aponte a câmara para o QR.
              </p>
              <Button type="button" variant="outline" onClick={() => void handleDesconectar()} disabled={busyDelete}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Conectar WhatsApp</CardTitle>
            <CardDescription>
              Uma instância é criada automaticamente na plataforma. Basta ler o QR — sem URL e sem token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
              onClick={() => void handleConectar()}
              disabled={busyQr || loading}
            >
              {busyQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
              Conectar com QR Code
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
