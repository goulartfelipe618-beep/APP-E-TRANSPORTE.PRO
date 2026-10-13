import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fundirMensagens, type ChatMensagem } from "../../supabase/functions/_shared/uazapiChat";
import {
  ROTULO_STATUS,
  ligarEventos,
  linhaParaMensagem,
  listarConversas,
  listarMensagens,
  mensagemVisivel,
  pedirHistorico,
  type ChatConversa,
  type HistoricoPedido,
} from "@/lib/uazapiChatApi";

function hora(ms: number | null): string {
  if (ms == null) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch {
    return "";
  }
}

function textoHistorico(h: HistoricoPedido | null): string | null {
  if (!h) return null;
  if (h.historyAccess === "unavailable") return "A UAZAPI informou que o restante do histórico não está acessível.";
  if (h.error === "history_access_unavailable") return "A UAZAPI informou que o restante do histórico não está acessível.";
  if (h.status === "blocked") return "O celular não entregou a página seguinte do histórico.";
  if (h.status === "timeout" || h.timedOut) return "O histórico ainda não chegou. A UAZAPI pode concluí-lo em seguida.";
  if (h.status === "pending") return "O pedido de histórico continua na UAZAPI.";
  if (h.hasMore === false && h.status === "completed") return "A UAZAPI confirmou o início desta conversa.";
  return null;
}

export default function ChatPage() {
  const { setActivePage } = useActivePage();
  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [chatid, setChatid] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [proximaPagina, setProximaPagina] = useState<number | null>(null);
  const [proximoHistorico, setProximoHistorico] = useState<Record<string, unknown> | null>(null);
  const [avisoHistorico, setAvisoHistorico] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [historicoBusy, setHistoricoBusy] = useState(false);
  const [quando, setQuando] = useState<Date | null>(null);
  const chatRef = useRef<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  chatRef.current = chatid;

  const ativa = useMemo(() => conversas.find((c) => c.chatid === chatid) ?? null, [conversas, chatid]);
  const visiveis = useMemo(() => mensagens.filter(mensagemVisivel), [mensagens]);

  const carregarConversas = useCallback(async () => {
    const res = await listarConversas(0);
    if (res.code === "not_connected") {
      setSemConexao(true);
      setErro(null);
      return;
    }
    setSemConexao(false);
    if (res.falhaRede || res.ok === false) {
      setErro(res.falhaRede || res.error || "Não foi possível sincronizar.");
      return;
    }
    setErro(null);
    setConversas(res.chats || []);
    setQuando(new Date());
  }, []);

  const carregarMensagens = useCallback(async (id: string, juntar: boolean) => {
    const res = await listarMensagens(id, 0);
    if (chatRef.current !== id) return;
    if (res.code === "not_connected") {
      setSemConexao(true);
      return;
    }
    if (res.falhaRede || res.ok === false) {
      setErro(res.falhaRede || res.error || "Não foi possível ler as mensagens.");
      return;
    }
    setErro(null);
    setProximaPagina(res.hasMore && res.nextOffset != null ? res.nextOffset : null);
    setMensagens((prev) => (juntar ? fundirMensagens(prev, res.messages || []) : fundirMensagens([], res.messages || [])));
    setQuando(new Date());
  }, []);

  useEffect(() => {
    let parado = false;
    setSincronizando(true);
    void (async () => {
      await carregarConversas();
      if (!parado) await ligarEventos();
      if (!parado) setSincronizando(false);
    })();
    const timer = window.setInterval(() => {
      void carregarConversas();
      const aberto = chatRef.current;
      if (aberto) void carregarMensagens(aberto, true);
    }, 8000);
    return () => {
      parado = true;
      window.clearInterval(timer);
    };
  }, [carregarConversas, carregarMensagens]);

  useEffect(() => {
    if (!chatid) return;
    setMensagens([]);
    setProximaPagina(null);
    setProximoHistorico(null);
    setAvisoHistorico(null);
    setSincronizando(true);
    void carregarMensagens(chatid, false).finally(() => setSincronizando(false));
  }, [chatid, carregarMensagens]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [visiveis.length, chatid]);

  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let ativo = true;
    void supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !ativo) return;
      canal = supabase
        .channel(`uazapi-chat-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "uazapi_chat_mensagens", filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new;
            if (!row || typeof row !== "object") return;
            const msg = linhaParaMensagem(row as Record<string, unknown>);
            if (!msg || msg.chatid !== chatRef.current) return;
            setMensagens((prev) => fundirMensagens(prev, [msg]));
            setQuando(new Date());
          },
        )
        .subscribe();
    });
    return () => {
      ativo = false;
      if (canal) void supabase.removeChannel(canal);
    };
  }, []);

  const maisAntigas = async () => {
    if (!chatid || proximaPagina == null) return;
    const res = await listarMensagens(chatid, proximaPagina);
    if (res.ok === false || res.falhaRede) {
      setErro(res.falhaRede || res.error || "Não foi possível paginar.");
      return;
    }
    setProximaPagina(res.hasMore && res.nextOffset != null ? res.nextOffset : null);
    setMensagens((prev) => fundirMensagens(prev, res.messages || []));
  };

  const historico = async () => {
    if (!chatid) return;
    setHistoricoBusy(true);
    const res = await pedirHistorico(chatid, proximoHistorico);
    setHistoricoBusy(false);
    if (res.code === "not_connected") {
      setSemConexao(true);
      return;
    }
    if (res.falhaRede || res.ok === false) {
      setErro(res.falhaRede || res.error || "A UAZAPI não devolveu o histórico.");
      return;
    }
    setProximoHistorico(res.historico?.nextRequest ?? null);
    setAvisoHistorico(textoHistorico(res.historico || null));
    setMensagens((prev) => fundirMensagens(prev, res.messages || []));
    void carregarMensagens(chatid, true);
  };

  return (
    <div className="flex h-[min(760px,calc(100dvh-8rem))] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
      <aside className={cn("flex w-full min-w-0 flex-col border-border md:w-80 md:border-r", chatid && "hidden md:flex")}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Chat</h1>
            <p className="text-xs text-muted-foreground">
              {sincronizando ? "Sincronizando com a UAZAPI…" : quando ? `Atualizado ${hora(quando.getTime())}` : "Aguardando a UAZAPI"}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Sincronizar" onClick={() => void carregarConversas()}>
            <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
          </Button>
        </div>
        {erro && <p className="border-b border-border px-4 py-2 text-xs text-destructive">{erro}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {semConexao ? (
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>O WhatsApp desta conta não está conectado. O chat só mostra o que a UAZAPI devolver.</p>
              <Button type="button" variant="outline" onClick={() => setActivePage("sistema/comunicador")}>
                Abrir Comunicador
              </Button>
            </div>
          ) : conversas.length === 0 && !sincronizando ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa disponível nesta instância.</p>
          ) : (
            conversas.map((c) => (
              <button
                key={c.chatid}
                type="button"
                onClick={() => setChatid(c.chatid)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 border-b border-border/70 px-4 py-3 text-left hover:bg-muted/50",
                  c.chatid === chatid && "bg-muted",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{c.titulo}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{hora(c.timestampMs)}</span>
                </span>
                {c.previa && <span className="line-clamp-1 text-xs text-muted-foreground">{c.previa}</span>}
                {c.naoLidas != null && c.naoLidas > 0 && (
                  <span className="text-[11px] text-primary">{c.naoLidas} não lidas</span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={cn("min-w-0 flex-1 flex-col", chatid ? "flex" : "hidden md:flex")}>
        {!ativa ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8" />
            <p>Selecione uma conversa para ver o histórico que a UAZAPI tem salvo.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <Button type="button" variant="ghost" className="md:hidden" onClick={() => setChatid(null)}>
                Voltar
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{ativa.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{ativa.chatid}</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {proximaPagina != null && (
                <div className="flex justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => void maisAntigas()}>
                    Mensagens anteriores salvas
                  </Button>
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={historicoBusy} onClick={() => void historico()}>
                  {historicoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Buscar histórico anterior na UAZAPI
                </Button>
                {avisoHistorico && <p className="text-center text-xs text-muted-foreground">{avisoHistorico}</p>}
              </div>
              {visiveis.length === 0 && !sincronizando ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Esta conversa não tem mensagens salvas na UAZAPI.
                </p>
              ) : (
                visiveis.map((m) => <Bolha key={m.chave} mensagem={m} />)
              )}
              <div ref={fimRef} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Bolha({ mensagem }: { mensagem: ChatMensagem }) {
  const minha = mensagem.fromMe === true;
  const recebida = mensagem.fromMe === false;
  return (
    <div className={cn("flex", minha ? "justify-end" : recebida ? "justify-start" : "justify-center")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", minha ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
        {recebida && mensagem.remetenteNome && (
          <p className="mb-1 text-[11px] font-medium opacity-80">{mensagem.remetenteNome}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{mensagem.texto || mensagem.tipo}</p>
        {mensagem.erro && <p className="mt-1 text-xs opacity-80">{mensagem.erro}</p>}
        <p className={cn("mt-1 flex flex-wrap gap-2 text-[11px]", minha ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {mensagem.timestampMs != null && <span>{hora(mensagem.timestampMs)}</span>}
          {mensagem.status && <span>{ROTULO_STATUS[mensagem.status]}</span>}
          {mensagem.enviadaPelaApi === true && <span>Pela API</span>}
        </p>
      </div>
    </div>
  );
}
