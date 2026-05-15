import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import { useActivePage } from "@/contexts/ActivePageContext";
import { isOwnEvolutionConnected } from "@/lib/evolutionConnection";
import { inboxFetchChats, inboxDeleteForEveryone, inboxFetchMessages, inboxSendAudio, inboxSendMedia, inboxSendText } from "@/lib/evolutionInboxApi";
import { normalizeEvolutionChatRow, normalizeEvolutionMessageRow, type UiMsg } from "@/lib/evolutionInboxParse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  SendHorizonal,
  Square,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function storageKeyHiddenMsgs(jid: string) {
  return `motora-evolution-inbox-hide:v1:${jid}`;
}

function loadHiddenMessageIds(jid: string | null): string[] {
  if (!jid || typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKeyHiddenMsgs(jid));
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHiddenMessageIds(jid: string, ids: string[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(storageKeyHiddenMsgs(jid), JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

function snippetEvolutionBody(bodyText: unknown, max = 160): string {
  if (typeof bodyText !== "string" || !bodyText.trim()) return "";
  const t = bodyText.trim().slice(0, max);
  try {
    const j = JSON.parse(bodyText) as unknown;
    if (j && typeof j === "object" && typeof (j as { message?: string }).message === "string") {
      return String((j as { message: string }).message).slice(0, max);
    }
  } catch {
    /* ignore */
  }
  return t;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type ChatItem = { remoteJid: string; title: string; tsMs: number | null };

function jidToDigits(jid: string): string {
  return jid.split("@")[0]?.replace(/\D/g, "") ?? "";
}

function formatTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return "";
  }
}

export default function WhatsAppInboxPage() {
  const { own, loading: comLoading, reload } = useComunicadoresEvolution();
  const { setActivePage } = useActivePage();
  const connected = isOwnEvolutionConnected(own);

  const sessionSinceMs = useMemo(() => {
    const raw = (own as { inbox_sessao_conectado_em?: string | null } | null)?.inbox_sessao_conectado_em;
    if (!raw?.trim()) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }, [own]);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatsBusy, setChatsBusy] = useState(false);
  const [activeJid, setActiveJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [msgBusy, setMsgBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);

  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [everyoneConfirmMsg, setEveryoneConfirmMsg] = useState<UiMsg | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const activeChat = useMemo(() => chats.find((c) => c.remoteJid === activeJid) ?? null, [chats, activeJid]);
  const sendDigits = activeJid ? jidToDigits(activeJid) : "";
  const isGroupChat = Boolean(activeJid?.includes("@g.us"));

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenSet.has(m.id)),
    [messages, hiddenSet],
  );

  useEffect(() => {
    setHiddenIds(loadHiddenMessageIds(activeJid));
  }, [activeJid]);

  const hideMessageForMeLocally = useCallback(
    (m: UiMsg) => {
      if (!activeJid) return;
      setHiddenIds((prev) => {
        if (prev.includes(m.id)) return prev;
        const next = [...prev, m.id];
        saveHiddenMessageIds(activeJid, next);
        return next;
      });
      toast.success("Mensagem oculta só para si neste painel.", {
        description:
          "Para outras pessoas nada muda. O armazenamento local do navegador guarda esta lista; limpar dados pode mostrar a mensagem outra vez.",
      });
    },
    [activeJid],
  );

  const loadChats = useCallback(async () => {
    if (!connected) return;
    setChatsBusy(true);
    try {
      const res = await inboxFetchChats();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const rawArr = Array.isArray(res.chats) ? res.chats : [];
      const next: ChatItem[] = [];
      for (const r of rawArr) {
        const n = normalizeEvolutionChatRow(r);
        if (!n) continue;
        if (sessionSinceMs != null && n.tsMs != null && n.tsMs < sessionSinceMs) continue;
        next.push({
          remoteJid: n.remoteJid,
          title: n.title,
          tsMs: n.tsMs,
        });
      }
      next.sort((a, b) => (b.tsMs ?? 0) - (a.tsMs ?? 0));
      setChats(next);
    } finally {
      setChatsBusy(false);
    }
  }, [connected, sessionSinceMs]);

  const loadMessages = useCallback(
    async (jid: string) => {
      if (!connected || !jid) return;
      setMsgBusy(true);
      try {
        const res = await inboxFetchMessages(jid, 120);
        if ("error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        const rawArr = Array.isArray(res.messages) ? res.messages : [];
        const mapped: UiMsg[] = [];
        for (const m of rawArr) {
          const u = normalizeEvolutionMessageRow(m);
          if (!u) continue;
          if (sessionSinceMs != null && u.tsMs < sessionSinceMs) continue;
          mapped.push(u);
        }
        mapped.sort((a, b) => a.tsMs - b.tsMs);
        setMessages(mapped);
      } finally {
        setMsgBusy(false);
      }
    },
    [connected, sessionSinceMs],
  );

  const runDeleteForEveryone = useCallback(async () => {
    const m = everyoneConfirmMsg;
    if (!m || !activeJid || deleteBusy) return;
    if (!m.fromMe) {
      toast.error("Só pode apagar para todos as mensagens que enviou.");
      setEveryoneConfirmMsg(null);
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await inboxDeleteForEveryone({
        remoteJid: m.remoteJid,
        messageId: m.id,
        fromMe: m.fromMe,
        participant: m.participant,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const httpStatus = res.httpStatus;
      if (httpStatus !== undefined && (httpStatus < 200 || httpStatus >= 300)) {
        const hint = snippetEvolutionBody((res as { bodyText?: unknown }).bodyText);
        toast.error(hint || "A Evolution não conseguiu apagar a mensagem (verifique tempo limite do WhatsApp ou ligação).");
        return;
      }
      toast.success("Pedido de apagar para todos enviado.");
      setHiddenIds((prev) => {
        if (prev.includes(m.id)) return prev;
        const next = [...prev, m.id];
        saveHiddenMessageIds(activeJid, next);
        return next;
      });
      setEveryoneConfirmMsg(null);
      await loadMessages(activeJid);
      void loadChats();
    } finally {
      setDeleteBusy(false);
    }
  }, [activeJid, deleteBusy, everyoneConfirmMsg, loadChats, loadMessages]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    const t = setInterval(() => {
      void loadChats();
    }, 8000);
    return () => clearInterval(t);
  }, [loadChats]);

  useEffect(() => {
    if (!activeJid) return;
    void loadMessages(activeJid);
    const t = setInterval(() => void loadMessages(activeJid), 5000);
    return () => clearInterval(t);
  }, [activeJid, loadMessages]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length, activeJid]);

  const sendText = async () => {
    const t = draft.trim();
    if (!t || !sendDigits || sendDigits.length < 10) return;
    const res = await inboxSendText(sendDigits, t);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if (res.httpStatus && (res.httpStatus < 200 || res.httpStatus >= 300)) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setDraft("");
    void loadMessages(activeJid!);
    void loadChats();
  };

  const onPickFile = async (f: File | null) => {
    if (!f || !sendDigits || sendDigits.length < 10) return;
    const buf = await f.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    const mime = f.type || "application/octet-stream";
    let mediatype: "image" | "video" | "document" = "document";
    if (mime.startsWith("image/")) mediatype = "image";
    else if (mime.startsWith("video/")) mediatype = "video";
    const res = await inboxSendMedia(sendDigits, {
      base64: b64,
      mimetype: mime,
      fileName: f.name || "ficheiro",
      mediatype,
      caption: "",
    });
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Ficheiro enviado.");
    void loadMessages(activeJid!);
    void loadChats();
  };

  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    setRec(null);
  }, [rec]);

  const startRecording = async () => {
    if (!sendDigits || sendDigits.length < 10) {
      toast.message("Escolha uma conversa primeiro.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      recChunks.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) recChunks.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks.current, { type: mr.mimeType || "audio/webm" });
        const buf = await blob.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        const res = await inboxSendAudio(sendDigits, b64);
        if ("error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Áudio enviado.");
        void loadMessages(activeJid!);
        void loadChats();
      };
      mr.start();
      setRec(mr);
    } catch {
      toast.error("Microfone não autorizado ou indisponível.");
    }
  };

  const openNewConversation = () => {
    const d = newPhone.replace(/\D/g, "");
    if (d.length < 10 || d.length > 15) {
      toast.error("Indique um número válido com DDI (ex.: 5511987654321).");
      return;
    }
    const jid = `${d}@s.whatsapp.net`;
    setChats((prev) => {
      if (prev.some((p) => p.remoteJid === jid)) return prev;
      return [{ remoteJid: jid, title: d, tsMs: Date.now() }, ...prev];
    });
    setActiveJid(jid);
    setNewOpen(false);
    setNewPhone("");
  };

  if (comLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6 text-center">
        <MessageCircle className="mx-auto h-14 w-14 text-[#FF6600]" />
        <h1 className="text-xl font-semibold text-foreground">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conecte o seu número em <span className="font-medium text-foreground">Sistema → Comunicador</span> ao
          escanear o QR Code. A partir daí, os envios em &quot;Comunicar&quot; e este chat usam a sua instância.
        </p>
        <Button className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90" onClick={() => setActivePage("sistema/comunicador")}>
          Ir para Comunicador
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] min-h-[420px] w-full max-w-[1600px] overflow-hidden rounded-lg border border-border bg-[#0b141a] shadow-lg sm:h-[calc(100svh-6rem)]">
      {/* Lista estilo WhatsApp Web */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-[#2a3942] bg-[#111b21] sm:w-[360px]",
          activeJid ? "hidden sm:flex" : "flex",
        )}
      >
        <header className="flex items-center justify-between gap-2 bg-[#202c33] px-3 py-3">
          <div className="flex items-center gap-2 text-[#e9edef]">
            <MessageCircle className="h-6 w-6 text-[#FF6600]" />
            <span className="font-semibold">WhatsApp</span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-[#aebac1] hover:bg-[#2a3942] hover:text-[#FF6600]"
            onClick={() => setNewOpen(true)}
            aria-label="Nova conversa"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </header>
        <div className="border-b border-[#2a3942] bg-[#111b21] px-2 py-2">
          <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-[#8696a0]">
            Só conversas e mensagens após ligar o QR nesta sessão
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {chatsBusy && chats.length === 0 ? (
              <div className="flex justify-center py-8 text-[#8696a0]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : chats.length === 0 ? (
              <p className="p-4 text-center text-sm text-[#8696a0]">Nenhuma conversa ainda. Envie uma mensagem ou aguarde contactos.</p>
            ) : (
              chats.map((c) => (
                <button
                  key={c.remoteJid}
                  type="button"
                  onClick={() => setActiveJid(c.remoteJid)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-[#2a3942] px-3 py-3 text-left transition-colors hover:bg-[#2a3942]",
                    activeJid === c.remoteJid && "bg-[#2a3942]",
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6b7c85] text-lg font-semibold text-white">
                    {c.title.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate font-medium text-[#e9edef]">{c.title}</span>
                      {c.tsMs != null && <span className="shrink-0 text-[11px] text-[#8696a0]">{formatTime(c.tsMs)}</span>}
                    </div>
                    <div className="truncate text-xs text-[#8696a0]">{c.remoteJid.includes("@g.us") ? "Grupo" : jidToDigits(c.remoteJid)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Conversa */}
      <div className={cn("flex flex-1 flex-col bg-[#0b141a]", !activeJid && "hidden sm:flex")}>
        {activeJid && activeChat ? (
          <>
            <header className="flex items-center gap-3 bg-[#202c33] px-2 py-2 sm:px-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="sm:hidden text-[#aebac1] hover:bg-[#2a3942]"
                onClick={() => setActiveJid(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6b7c85] font-semibold text-white">
                {activeChat.title.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-[#e9edef]">{activeChat.title}</div>
                <div className="truncate text-xs text-[#8696a0]">{isGroupChat ? "Grupo WhatsApp" : sendDigits || "—"}</div>
              </div>
            </header>

            <ScrollArea className="flex-1 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23182229\' fill-opacity=\'0.35\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] px-3 py-2">
              <div className="flex min-h-[200px] flex-col gap-1 pb-3">
                {msgBusy && messages.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#8696a0]" />
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-[#8696a0]">
                    Nenhuma mensagem visível nesta conversa nesta vista (filtro de sessão ou mensagens ocultas).
                  </p>
                ) : (
                  visibleMessages.map((m) => (
                    <div key={m.id} className={cn("group relative flex w-full", m.fromMe ? "justify-end" : "justify-start")}>
                      <div className={cn("relative max-w-[85%] sm:max-w-[70%]", m.fromMe ? "pr-1" : "pl-1")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute -right-0.5 -top-0.5 z-10 h-7 w-7 shrink-0 text-[#e9edef] opacity-75 hover:bg-[#000]/20 hover:text-[#FF6600] sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                              aria-label="Opções da mensagem"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-border bg-popover text-popover-foreground"
                            collisionPadding={8}
                          >
                            <DropdownMenuItem
                              disabled={!m.fromMe}
                              title={m.fromMe ? undefined : "Apenas para mensagens que enviou"}
                              className={cn(!m.fromMe && "text-muted-foreground")}
                              onSelect={(ev) => {
                                ev.preventDefault();
                                if (!m.fromMe) return;
                                setTimeout(() => setEveryoneConfirmMsg(m), 0);
                              }}
                            >
                              Apagar para todos (WhatsApp)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(ev) => {
                                ev.preventDefault();
                                hideMessageForMeLocally(m);
                              }}
                            >
                              Ocultar só para mim neste painel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div
                          className={cn(
                            "rounded-lg px-2 py-1.5 pr-7 shadow-sm",
                            m.fromMe ? "rounded-br-none bg-[#005c4b] text-[#e9edef]" : "rounded-bl-none bg-[#202c33] text-[#e9edef]",
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words text-sm">{m.text || (m.kind === "unknown" ? "…" : "")}</div>
                          {m.kind === "audio" && m.mediaUrl && (
                            <audio controls src={m.mediaUrl} className="mt-1 max-w-full rounded" preload="none">
                              <track kind="captions" />
                            </audio>
                          )}
                          {m.kind === "media" && m.mediaUrl && m.mimetype?.startsWith("image/") && (
                            <img src={m.mediaUrl} alt="" className="mt-1 max-h-64 rounded object-contain" />
                          )}
                          {m.kind === "media" && m.mediaUrl && !m.mimetype?.startsWith("image/") && (
                            <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-[#FF6600] underline">
                              Abrir {m.fileName ?? "ficheiro"}
                            </a>
                          )}
                          <div className="mt-1 text-right text-[10px] opacity-70">{formatTime(m.tsMs)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={listEndRef} />
              </div>
            </ScrollArea>

            <footer className="bg-[#202c33] px-2 py-2">
              {isGroupChat ? (
                <p className="rounded-lg bg-[#2a3942] px-3 py-2 text-center text-xs text-[#8696a0]">
                  Leitura de grupo: pode ouvir áudios e ver ficheiros. Envio pelo painel (texto/anexo/voz) aplica-se a conversas
                  individuais.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <label className="shrink-0 cursor-pointer rounded-full p-2 text-[#aebac1] hover:bg-[#2a3942]">
                    <Paperclip className="h-5 w-5" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.zip"
                      onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {rec ? (
                    <Button type="button" variant="destructive" size="icon" className="shrink-0 rounded-full" onClick={stopRecording}>
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-[#aebac1] hover:bg-[#2a3942]" onClick={startRecording}>
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Mensagem"
                    rows={1}
                    className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border-0 bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#FF6600]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendText();
                      }
                    }}
                  />
                  <Button type="button" size="icon" className="shrink-0 rounded-full bg-[#FF6600] text-white hover:bg-[#FF6600]/90" onClick={() => void sendText()}>
                    <SendHorizonal className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-[#8696a0] sm:flex">
            <Phone className="h-16 w-16 opacity-40" />
            <p className="text-center text-lg text-[#e9edef]">WhatsApp Web no painel</p>
            <p className="max-w-md text-center text-sm">Escolha uma conversa à esquerda ou inicie uma nova.</p>
            <Button variant="outline" className="border-[#FF6600] text-[#FF6600]" onClick={() => void reload()}>
              Actualizar estado
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={everyoneConfirmMsg !== null} onOpenChange={(open) => !open && !deleteBusy && setEveryoneConfirmMsg(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação pede à Evolution que revogue a mensagem no WhatsApp para todos os participantes. Mensagens antigas ou já
              vistas podem estar sujeitas aos limites habituais da aplicação oficial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(ev) => {
                ev.preventDefault();
                void runDeleteForEveryone();
              }}
            >
              {deleteBusy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>Indique o número com código do país, só dígitos (ex.: 5511987654321).</DialogDescription>
          </DialogHeader>
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5511987654321" className="font-mono" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#FF6600] hover:bg-[#FF6600]/90" onClick={openNewConversation}>
              Conversar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
