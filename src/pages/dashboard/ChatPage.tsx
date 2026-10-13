import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, FileText, Loader2, MessageCircle, Paperclip, Send, Smile } from "lucide-react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fundirMensagens, type ChatMensagem } from "../../../supabase/functions/_shared/uazapiChat";
import {
  ROTULO_STATUS,
  baixarArquivo,
  enviarMidia,
  enviarTexto,
  fotoDoContato,
  ligarEventos,
  listarConversas,
  listarMensagens,
  mensagemVisivel,
  type ChatConversa,
} from "@/lib/uazapiChatApi";

const EMOJIS = ["😀", "😁", "😂", "😊", "😍", "🤝", "👍", "🙏", "👏", "✅", "❤️", "🔥", "🎉", "📍", "🚗", "📞"];
const LIMITE_ARQUIVO = 3 * 1024 * 1024;

function hora(ms: number | null): string {
  if (ms == null) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch {
    return "";
  }
}

function classeMidia(tipo: string | null): "image" | "video" | "audio" | "document" | null {
  const t = (tipo || "").toLowerCase();
  if (!t || t === "conversation" || t === "extendedtextmessage" || t === "text") return null;
  if (t.includes("image") || t.includes("sticker")) return "image";
  if (t.includes("video") || t === "ptv") return "video";
  if (t.includes("audio") || t.includes("ptt")) return "audio";
  if (t.includes("document")) return "document";
  return null;
}

function tipoDoArquivo(file: File): "image" | "video" | "audio" | "document" {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "video/mp4") return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function fundirConversas(atual: ChatConversa[], novas: ChatConversa[]): ChatConversa[] {
  const mapa = new Map(atual.map((c) => [c.chatid, c]));
  for (const n of novas) {
    const anterior = mapa.get(n.chatid);
    mapa.set(
      n.chatid,
      anterior
        ? {
            ...anterior,
            ...n,
            titulo: n.titulo || anterior.titulo,
            previa: n.previa || anterior.previa,
            foto: n.foto || anterior.foto,
            timestampMs: n.timestampMs ?? anterior.timestampMs,
          }
        : n,
    );
  }
  return [...mapa.values()].sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}

export default function ChatPage() {
  const { setActivePage } = useActivePage();
  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [chatid, setChatid] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [emojis, setEmojis] = useState(false);
  const [anexos, setAnexos] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const chatRef = useRef<string | null>(null);
  const listaVoo = useRef(false);
  const geracaoLista = useRef(0);
  const msgSeq = useRef(0);
  const primeiraLista = useRef(true);
  const pedidosMidia = useRef(new Map<string, number>());
  const midiaEmVoo = useRef(0);
  const fotosPedidas = useRef(new Set<string>());
  const fimRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(true);
  const fotoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  chatRef.current = chatid;

  const ativa = useMemo(() => conversas.find((c) => c.chatid === chatid) ?? null, [conversas, chatid]);
  const visiveis = useMemo(() => mensagens.filter(mensagemVisivel), [mensagens]);

  const carregarConversas = useCallback(async () => {
    if (listaVoo.current) return;
    const voo = ++geracaoLista.current;
    listaVoo.current = true;
    const limite = window.setTimeout(() => {
      if (geracaoLista.current !== voo) return;
      listaVoo.current = false;
      setPronto(true);
    }, 12000);
    try {
      const res = await listarConversas(0);
      if (geracaoLista.current !== voo) return;
      if (res.code === "not_connected") {
        if (primeiraLista.current) setSemConexao(true);
        return;
      }
      if (res.falhaRede || res.ok === false) {
        if (primeiraLista.current) setErro(res.falhaRede || res.error || "Não foi possível sincronizar.");
        return;
      }
      setSemConexao(false);
      setErro(null);
      setConversas((prev) => fundirConversas(prev, res.chats || []));
    } catch (e) {
      if (geracaoLista.current === voo && primeiraLista.current) {
        setErro(e instanceof Error ? e.message : "Não foi possível sincronizar.");
      }
    } finally {
      window.clearTimeout(limite);
      if (geracaoLista.current === voo) {
        listaVoo.current = false;
        primeiraLista.current = false;
        setPronto(true);
      }
    }
  }, []);

  const atualizarMensagens = useCallback(async (id: string, substituir: boolean) => {
    const seq = ++msgSeq.current;
    const res = await listarMensagens(id, 0);
    if (seq !== msgSeq.current || chatRef.current !== id) return;
    if (res.code === "not_connected") {
      if (substituir) setSemConexao(true);
      setCarregandoChat(false);
      return;
    }
    if (res.falhaRede || res.ok === false) {
      if (substituir) setErro(res.falhaRede || res.error || "Não foi possível ler as mensagens.");
      setCarregandoChat(false);
      return;
    }
    setErro(null);
    setMensagens((prev) => fundirMensagens(substituir ? [] : prev, res.messages || []));
    setCarregandoChat(false);
  }, []);

  useEffect(() => {
    void carregarConversas().then(() => ligarEventos());
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let espera: number | null = null;
    let escondido = false;
    const atualizarUmaVez = () => {
      if (document.visibilityState !== "visible") return;
      if (espera != null) return;
      espera = window.setTimeout(() => {
        espera = null;
        void carregarConversas();
        const aberto = chatRef.current;
        if (aberto) void atualizarMensagens(aberto, false);
      }, 1500);
    };
    const aoMudarAba = () => {
      if (document.visibilityState === "hidden") escondido = true;
      if (document.visibilityState === "visible" && escondido) {
        escondido = false;
        atualizarUmaVez();
      }
    };
    let cancelado = false;
    document.addEventListener("visibilitychange", aoMudarAba);
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelado) return;
      const uid = data.session?.user.id;
      if (!uid) return;
      canal = supabase
        .channel(`chat-aviso:${uid}`)
        .on("broadcast", { event: "nova" }, () => atualizarUmaVez())
        .subscribe();
    });
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoMudarAba);
      if (espera != null) window.clearTimeout(espera);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [atualizarMensagens, carregarConversas]);

  useEffect(() => {
    if (!chatid) return;
    setMensagens([]);
    setCarregandoChat(true);
    setEmojis(false);
    setAnexos(false);
    pertoDoFim.current = true;
    void atualizarMensagens(chatid, true);
  }, [atualizarMensagens, chatid]);

  useEffect(() => {
    if (pertoDoFim.current) fimRef.current?.scrollIntoView({ block: "end" });
  }, [visiveis.length, chatid]);

  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;

  useEffect(() => {
    if (!pronto) return;
    let cancelado = false;
    void (async () => {
      for (;;) {
        if (cancelado) return;
        if (listaVoo.current) {
          await new Promise((resolver) => window.setTimeout(resolver, 500));
          continue;
        }
        const alvo = conversasRef.current.find((c) => !c.foto && !fotosPedidas.current.has(c.chatid));
        if (!alvo) return;
        fotosPedidas.current.add(alvo.chatid);
        const res = await fotoDoContato(alvo.chatid);
        if (cancelado || !res.url?.startsWith("https://")) continue;
        setConversas((prev) => prev.map((item) => (item.chatid === alvo.chatid ? { ...item, foto: res.url as string } : item)));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pronto, conversas.length]);

  useEffect(() => {
    if (midiaEmVoo.current >= 1) return;
    const proxima = visiveis.find((m) => classeMidia(m.tipo) && !m.arquivo && !urls[m.chave] && (m.id || m.messageid) && (pedidosMidia.current.get(m.chave) ?? 0) < 2);
    if (!proxima) return;
    const id = proxima.id || proxima.messageid;
    if (!id) return;
    midiaEmVoo.current += 1;
    void baixarArquivo(id, proxima.messageid && proxima.messageid !== id ? proxima.messageid : null).then((res) => {
      midiaEmVoo.current = Math.max(0, midiaEmVoo.current - 1);
      if (res.fileURL?.startsWith("https://")) {
        pedidosMidia.current.set(proxima.chave, 2);
        setUrls((prev) => (prev[proxima.chave] ? prev : { ...prev, [proxima.chave]: res.fileURL as string }));
        return;
      }
      pedidosMidia.current.set(proxima.chave, (pedidosMidia.current.get(proxima.chave) ?? 0) + 1);
    });
  }, [urls, visiveis]);

  const confirmarEnvio = async (res: Awaited<ReturnType<typeof enviarTexto>>) => {
    if (res.code === "not_connected") {
      setSemConexao(true);
      return false;
    }
    if (res.falhaRede || res.ok === false) {
      setErro(res.falhaRede || res.error || "A UAZAPI não confirmou o envio.");
      return false;
    }
    setErro(null);
    if (res.message) setMensagens((prev) => fundirMensagens(prev, [res.message as ChatMensagem]));
    else if (chatid) void atualizarMensagens(chatid, false);
    return true;
  };

  const enviar = async () => {
    if (!chatid || enviando) return;
    const file = arquivo;
    const caption = texto.trim();
    if (!file && !caption) return;
    setEnviando(true);
    setEmojis(false);
    setAnexos(false);
    try {
      if (file) {
        if (file.size > LIMITE_ARQUIVO) {
          setErro("O arquivo precisa ter até 3 MB.");
          return;
        }
        const dataUrl = await lerArquivo(file);
        const local = URL.createObjectURL(file);
        const resposta = await enviarMidia(chatid, tipoDoArquivo(file), dataUrl, {
          text: caption || undefined,
          docName: file.name,
          mimetype: file.type || undefined,
        });
        const ok = await confirmarEnvio(resposta);
        if (!ok) {
          URL.revokeObjectURL(local);
          return;
        }
        const chave = resposta.message?.chave;
        if (chave) setUrls((prev) => ({ ...prev, [chave]: local }));
      } else {
        const ok = await confirmarEnvio(await enviarTexto(chatid, caption));
        if (!ok) return;
      }
      setTexto("");
      setArquivo(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-[min(760px,calc(100dvh-8rem))] min-h-[480px] overflow-hidden rounded-xl border border-[#222d34] bg-[#111b21] text-[#e9edef]">
      <aside className={cn("flex w-full min-w-0 flex-col border-[#222d34] md:w-80 md:border-r", chatid && "hidden md:flex")}>
        <div className="border-b border-[#222d34] bg-[#202c33] px-4 py-3">
          <h1 className="text-base font-semibold">Conversas</h1>
        </div>
        {erro && !chatid && <p className="px-4 py-2 text-xs text-red-300">{erro}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!pronto ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#8696a0]" />
            </div>
          ) : semConexao ? (
            <div className="space-y-3 p-4 text-sm text-[#8696a0]">
              <p>O WhatsApp desta conta não está conectado.</p>
              <Button type="button" variant="outline" onClick={() => setActivePage("sistema/comunicador")}>
                Abrir Comunicador
              </Button>
            </div>
          ) : conversas.length === 0 ? (
            <p className="p-4 text-sm text-[#8696a0]">Nenhuma conversa nesta conta.</p>
          ) : (
            conversas.map((c) => (
              <button
                key={c.chatid}
                type="button"
                onClick={() => setChatid(c.chatid)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[#202c33]",
                  c.chatid === chatid && "bg-[#2a3942]",
                )}
              >
                <Avatar nome={c.titulo} foto={c.foto} tamanho="h-11 w-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.titulo}</span>
                    <span className="shrink-0 text-[11px] text-[#8696a0]">{hora(c.timestampMs)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs text-[#8696a0]">{c.previa || c.chatid}</span>
                    {c.naoLidas != null && c.naoLidas > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00a884] px-1.5 text-[11px] font-medium text-[#111b21]">
                        {c.naoLidas}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={cn("min-w-0 flex-1 flex-col bg-[#0b141a]", chatid ? "flex" : "hidden md:flex")}
        style={{
          backgroundImage:
            "radial-gradient(circle at 20px 20px, rgba(255,255,255,0.035) 1.5px, transparent 1.6px)",
          backgroundSize: "48px 48px",
        }}
      >
        {!ativa ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[#8696a0]">
            <MessageCircle className="h-8 w-8" />
            <p>Selecione uma conversa.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-[#202c33] px-3 py-2.5">
              <Button type="button" variant="ghost" className="text-[#e9edef] md:hidden" onClick={() => setChatid(null)}>
                Voltar
              </Button>
              <Avatar nome={ativa.titulo} foto={ativa.foto} tamanho="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ativa.titulo}</p>
                <p className="truncate text-xs text-[#8696a0]">{ativa.chatid}</p>
              </div>
            </div>
            {erro && <p className="bg-[#202c33] px-4 py-1 text-xs text-red-300">{erro}</p>}
            <div
              ref={caixaRef}
              className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
              onScroll={(e) => {
                const el = e.currentTarget;
                pertoDoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
            >
              {carregandoChat && visiveis.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#8696a0]" />
                </div>
              ) : (
                visiveis.map((m) => <Bolha key={m.chave} mensagem={m} url={m.arquivo || urls[m.chave]} />)
              )}
              <div ref={fimRef} />
            </div>
            <form
              className="flex items-end gap-2 bg-[#202c33] px-2 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#8696a0] hover:bg-[#2a3942]"
                  aria-label="Emojis"
                  onClick={() => {
                    setEmojis((v) => !v);
                    setAnexos(false);
                  }}
                >
                  <Smile className="h-5 w-5" />
                </button>
                {emojis && (
                  <div className="absolute bottom-12 left-0 z-10 grid w-56 grid-cols-8 gap-1 rounded-lg bg-[#233138] p-2 shadow-lg">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded p-1 text-lg hover:bg-[#2a3942]"
                        onClick={() => setTexto((atual) => `${atual}${emoji}`)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#8696a0] hover:bg-[#2a3942]"
                  aria-label="Anexar"
                  onClick={() => {
                    setAnexos((v) => !v);
                    setEmojis(false);
                  }}
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                {anexos && (
                  <div className="absolute bottom-12 left-0 z-10 w-44 overflow-hidden rounded-lg bg-[#233138] text-sm shadow-lg">
                    <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#2a3942]" onClick={() => fotoRef.current?.click()}>
                      Foto ou vídeo
                    </button>
                    <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#2a3942]" onClick={() => docRef.current?.click()}>
                      Documento
                    </button>
                  </div>
                )}
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*,video/mp4,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setAnexos(false);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={docRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setAnexos(false);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                {arquivo && (
                  <p className="mb-1 truncate px-2 text-xs text-[#00a884]">
                    {arquivo.name}
                    <button type="button" className="ml-2 text-[#8696a0]" onClick={() => setArquivo(null)}>
                      remover
                    </button>
                  </p>
                )}
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Mensagem"
                  disabled={enviando}
                  className="h-10 w-full rounded-lg bg-[#2a3942] px-3 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                />
              </div>
              <button
                type="submit"
                disabled={enviando || (!texto.trim() && !arquivo)}
                aria-label="Enviar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Avatar({ nome, foto, tamanho }: { nome: string; foto: string | null; tamanho: string }) {
  const [falhou, setFalhou] = useState(false);
  if (foto && !falhou) {
    return <img src={foto} alt="" className={cn(tamanho, "shrink-0 rounded-full object-cover")} onError={() => setFalhou(true)} />;
  }
  return (
    <span className={cn(tamanho, "flex shrink-0 items-center justify-center rounded-full bg-[#6b7c85] text-sm font-semibold text-white")}>
      {(nome || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function Bolha({ mensagem, url }: { mensagem: ChatMensagem; url?: string }) {
  const minha = mensagem.fromMe === true;
  const recebida = mensagem.fromMe === false;
  const midia = classeMidia(mensagem.tipo);
  return (
    <div className={cn("flex", minha ? "justify-end" : recebida ? "justify-start" : "justify-center")}>
      <div
        className={cn(
          "max-w-[min(85%,420px)] rounded-lg px-2 py-1 text-sm shadow-sm",
          minha ? "bg-[#005c4b]" : "bg-[#202c33]",
        )}
      >
        {recebida && mensagem.remetenteNome && (
          <p className="px-1 text-[11px] font-medium text-[#53bdeb]">{mensagem.remetenteNome}</p>
        )}
        {midia === "image" && url && <img src={url} alt="" className="mb-1 max-h-64 rounded-md" />}
        {midia === "video" && url && <video src={url} controls className="mb-1 max-h-64 rounded-md" />}
        {midia === "audio" && url && <audio src={url} controls className="mb-1 w-56" />}
        {midia === "document" && (
          url ? (
            <a href={url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-md bg-black/20 px-2 py-2">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate">{mensagem.texto || "Documento"}</span>
            </a>
          ) : (
            <p className="mb-1 flex items-center gap-2 px-1 text-xs text-[#8696a0]">
              <FileText className="h-4 w-4" />
              Documento
            </p>
          )
        )}
        {midia && midia !== "document" && !url && (
          <p className="px-1 text-xs text-[#8696a0]">{midia === "image" ? "Imagem" : midia === "video" ? "Vídeo" : "Áudio"}</p>
        )}
        {mensagem.texto && !(midia === "document" && mensagem.texto) && (
          <p className="whitespace-pre-wrap break-words px-1">{mensagem.texto}</p>
        )}
        {mensagem.erro && <p className="px-1 text-xs text-red-200">{mensagem.erro}</p>}
        <p className="flex items-center justify-end gap-1 px-1 text-[11px] text-[#ffffff99]">
          {mensagem.timestampMs != null && <span>{hora(mensagem.timestampMs)}</span>}
          {minha && mensagem.status && <StatusIcone status={mensagem.status} />}
        </p>
      </div>
    </div>
  );
}

function StatusIcone({ status }: { status: NonNullable<ChatMensagem["status"]> }) {
  if (status === "Failed" || status === "Canceled") {
    return <span className="text-red-200">{ROTULO_STATUS[status]}</span>;
  }
  if (status === "Queued") return <span>{ROTULO_STATUS[status]}</span>;
  const lida = status === "Read" || status === "Played";
  if (status === "Sent") return <Check className="h-3.5 w-3.5" aria-label={ROTULO_STATUS[status]} />;
  return <CheckCheck className={cn("h-3.5 w-3.5", lida && "text-[#53bdeb]")} aria-label={ROTULO_STATUS[status]} />;
}
