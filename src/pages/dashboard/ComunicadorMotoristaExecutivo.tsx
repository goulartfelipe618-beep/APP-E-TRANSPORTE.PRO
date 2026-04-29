import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import { useComunicadoresEvolution, qrSrc, type ComunicadorRow } from "@/hooks/useComunicadoresEvolution";
import {
  fetchEvolutionMotoristaDeleteFromServer,
  fetchEvolutionMotoristaQrFromServer,
  fetchEvolutionMotoristaSyncFromServer,
  formatPhoneBrDisplay,
} from "@/lib/evolutionApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Info, Loader2, Smartphone } from "lucide-react";

const QR_SESSION_MS = 10 * 60 * 1000;
const POLL_MS = 3000;

const CONNECTED_STATUS = new Set(["open", "conectado", "connected", "online"]);

function isOwnWhatsAppConnected(row: ComunicadorRow | null): boolean {
  if (!row) return false;
  if (row.telefone_conectado?.trim()) return true;
  const s = (row.connection_status || "").trim().toLowerCase();
  return CONNECTED_STATUS.has(s);
}

function formatMmSs(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ComunicadorMotoristaExecutivoPage() {
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const { sistema, own, loading, reload, setOwn } = useComunicadoresEvolution();

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

  const ownConnected = useMemo(() => isOwnWhatsAppConnected(own), [own]);

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
        rotulo: "WhatsApp do motorista",
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
    if (sync.detail && !sync.connected) {
      return;
    }
    if (sync.connected) {
      await persistOwnPatch({
        telefone_conectado: sync.phone ?? own?.telefone_conectado ?? null,
        connection_status: "conectado",
        nome_dispositivo: sync.profileName?.trim() || own?.nome_dispositivo || null,
        foto_perfil_url: sync.profilePicUrl ?? own?.foto_perfil_url ?? null,
        qr_code_base64: null,
      });
      await endQrSession({ connected: true });
      toast.success("WhatsApp conectado. Os envios em Comunicar passam a usar o seu número quando estiver ativo.");
    }
  }, [persistOwnPatch, endQrSession, own?.nome_dispositivo, own?.foto_perfil_url]);

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
      if (left <= 0) {
        if (!expiryNotifiedRef.current) {
          expiryNotifiedRef.current = true;
          void endQrSessionRef.current({ connected: false });
          toast.message("Tempo do QR expirou. Toque em Conectar agora para gerar outro.");
        }
      }
    }, 1000);

    pollRef.current = setInterval(() => {
      void trySyncRef.current();
    }, POLL_MS);

    return () => {
      clearTimers();
    };
  }, [qrSession, sessionDeadline, clearTimers]);

  const handleConectarAgora = useCallback(async () => {
    setBusyQr(true);
    try {
      const pack = await fetchEvolutionMotoristaQrFromServer();
      if (!pack.base64) {
        const detail = (pack.detail || "").toLowerCase();
        // Evita spam quando a instância já existe/conectou fora deste fluxo.
        if (pack.code === "already_connected" || detail.includes("already in use")) {
          await trySync();
          if (!isOwnWhatsAppConnected(own)) {
            toast.message("Instância já existe. Desconecte para criar um novo vínculo.");
          }
          return;
        }
        toast.error(pack.detail || "Não foi possível gerar o QR Code.");
        return;
      }
      setSessionQrBase64(pack.base64);
      const deadline = Date.now() + QR_SESSION_MS;
      setSessionDeadline(deadline);
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

  const handleRemoverOwn = useCallback(async () => {
    setBusyDelete(true);
    try {
      const del = await fetchEvolutionMotoristaDeleteFromServer();
      if (!del.ok) {
        toast.error(del.detail || "Não foi possível remover a instância na Evolution.");
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
      toast.success("WhatsApp próprio desconectado.");
    } finally {
      setBusyDelete(false);
    }
  }, [reload, setOwn]);

  if (painelComunicadorReady && !painelMotoristaEvolutionAtivo) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">Integração Evolution (WhatsApp)</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Funcionalidade indisponível</AlertTitle>
          <AlertDescription className="text-sm">
            O administrador desativou o Comunicador Evolution no painel dos motoristas. Quando for reativado, o menu
            voltará a aparecer em Sistema.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que foi desligado?</CardTitle>
            <CardDescription>
              A página de referência ao canal oficial da plataforma deixa de ser oferecida neste painel até nova
              liberação.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const qrImg = qrSrc(sessionQrBase64 || own?.qr_code_base64 || null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-pretty text-muted-foreground">
            A plataforma mantém o <strong className="text-foreground">WhatsApp oficial</strong> para referência. Se
            desejar, pode <strong className="text-foreground">ligar o seu próprio número</strong> por QR Code: quando
            estiver conectado, os envios em <strong className="text-foreground">Comunicar</strong> usam o seu WhatsApp;
            caso contrário, usam a linha oficial.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {sistema?.telefone_conectado ? (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="space-y-2 pb-6 pt-6 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Número oficial da plataforma</p>
            {sistema.nome_dispositivo ? (
              <p className="text-base font-medium text-foreground">{sistema.nome_dispositivo}</p>
            ) : null}
            <p className="break-all font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {formatPhoneBrDisplay(sistema.telefone_conectado)}
            </p>
            <p className="mx-auto max-w-md pt-2 text-xs text-muted-foreground">
              Use este WhatsApp para comunicação oficial com clientes quando a política da sua operação assim exigir.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ComunicadorEvolutionSection
        title="Comunicador oficial E-Transporte.pro"
        description="Linha oficial da plataforma (sincronizada via n8n / backend). Referência para todos os motoristas."
        row={sistema}
        readOnly
        loading={loading}
        busy={false}
        onRefresh={() => void reload()}
        onGerarQr={() => {}}
        evolutionCreds={undefined}
        hideQr
      />

      {ownConnected ? (
        <div className="space-y-3">
          <ComunicadorEvolutionSection
            title="Seu WhatsApp (linha própria)"
            description="Conectado. Os envios em Comunicar usam este número enquanto a conexão estiver ativa."
            row={own}
            readOnly={false}
            loading={loading}
            busy={busyDelete}
            onRefresh={() => void reload()}
            onGerarQr={() => {}}
            evolutionCreds={undefined}
            hideQr
            motoristaOwn
            showRemover
            onRemover={handleRemoverOwn}
          />
          <div className="flex justify-end">
            <Button type="button" variant="destructive" onClick={() => void handleRemoverOwn()} disabled={busyDelete}>
              {busyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              DESCONECTAR
            </Button>
          </div>
        </div>
      ) : qrSession && qrImg ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Conectar o seu WhatsApp</CardTitle>
            <CardDescription>
              Escaneie o QR Code no telemóvel com o WhatsApp. Este código expira em{" "}
              <span className="font-mono text-foreground">{formatMmSs(remainingMs)}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
            <div className="flex h-52 w-52 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
              <img src={qrImg} alt="QR Code WhatsApp" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="max-w-md space-y-2 text-sm text-muted-foreground">
              <p>
                Abra o WhatsApp no telemóvel → Definições → Aparelhos ligados → Ligar um aparelho →{" "}
                <strong className="text-foreground">Ligar com número de telemóvel</strong> e aponte a câmara para o QR.
              </p>
              <p className="text-xs">
                Se o tempo acabar sem leitura, voltará a aparecer o botão para gerar um novo QR (válido por 10
                minutos).
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleRemoverOwn()}
                  disabled={busyDelete}
                >
                  {busyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  DESCONECTAR
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp próprio</CardTitle>
            <CardDescription>
              Clique no botão abaixo para abrir o QR Code e conectar seu WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              O QR será exibido nesta tela e ficará válido por{" "}
              <strong className="text-foreground">10 minutos</strong>.
            </p>
            <Button
              type="button"
              className="shrink-0 bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
              onClick={() => void handleConectarAgora()}
              disabled={busyQr || loading}
            >
              {busyQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
              CONECTAR O QR CODE
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
