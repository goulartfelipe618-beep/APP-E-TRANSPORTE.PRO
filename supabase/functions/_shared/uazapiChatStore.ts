import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatMensagem, escolherStatus, statusUazapi, type StatusUazapi } from "./uazapiChat.ts";

function linha(userId: string, m: ChatMensagem) {
  return {
    user_id: userId,
    chave: m.chave.slice(0, 200),
    chatid: m.chatid.slice(0, 200),
    messageid: m.messageid,
    id_uazapi: m.id,
    from_me: m.fromMe,
    texto: m.texto,
    status: m.status,
    remetente: m.remetente,
    remetente_nome: m.remetenteNome,
    tipo: m.tipo,
    enviada_pela_api: m.enviadaPelaApi,
    erro: m.erro,
    message_timestamp: m.timestampMs,
    atualizado_em: new Date().toISOString(),
  };
}

export async function gravarMensagens(
  supabaseAdmin: SupabaseClient,
  userId: string,
  mensagens: ChatMensagem[],
): Promise<void> {
  if (!mensagens.length) return;
  const chaves = [...new Set(mensagens.map((m) => m.chave))].slice(0, 500);
  const { data } = await supabaseAdmin
    .from("uazapi_chat_mensagens")
    .select("chave, status, texto, from_me, tipo, remetente, remetente_nome, enviada_pela_api, erro, message_timestamp, messageid, id_uazapi")
    .eq("user_id", userId)
    .in("chave", chaves);
  const atual = new Map<string, Record<string, unknown>>();
  for (const row of data || []) {
    if (row && typeof row === "object" && typeof (row as { chave?: string }).chave === "string") {
      atual.set((row as { chave: string }).chave, row as Record<string, unknown>);
    }
  }
  const pronto = mensagens.slice(0, 500).map((m) => {
    const prev = atual.get(m.chave);
    if (!prev) return linha(userId, m);
    const status = escolherStatus(statusUazapi(prev.status), m.status);
    return linha(userId, {
      ...m,
      texto: m.texto || (typeof prev.texto === "string" ? prev.texto : null),
      tipo: m.tipo || (typeof prev.tipo === "string" ? prev.tipo : null),
      fromMe: m.fromMe ?? (prev.from_me === true || prev.from_me === false ? prev.from_me : null),
      remetente: m.remetente || (typeof prev.remetente === "string" ? prev.remetente : null),
      remetenteNome: m.remetenteNome || (typeof prev.remetente_nome === "string" ? prev.remetente_nome : null),
      enviadaPelaApi: m.enviadaPelaApi ?? (prev.enviada_pela_api === true || prev.enviada_pela_api === false ? prev.enviada_pela_api : null),
      erro: m.erro || (typeof prev.erro === "string" ? prev.erro : null),
      timestampMs: m.timestampMs ?? (typeof prev.message_timestamp === "number" ? prev.message_timestamp : null),
      messageid: m.messageid || (typeof prev.messageid === "string" ? prev.messageid : null),
      id: m.id || (typeof prev.id_uazapi === "string" ? prev.id_uazapi : null),
      status,
    });
  });
  const { error } = await supabaseAdmin.from("uazapi_chat_mensagens").upsert(pronto, { onConflict: "user_id,chave" });
  if (error) throw new Error("Não foi possível gravar as mensagens.");
}

export async function aplicarStatus(
  supabaseAdmin: SupabaseClient,
  userId: string,
  ids: string[],
  novo: StatusUazapi | null,
): Promise<void> {
  if (!novo || !ids.length) return;
  const chaves = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  const { data } = await supabaseAdmin
    .from("uazapi_chat_mensagens")
    .select("chave, status")
    .eq("user_id", userId)
    .in("chave", chaves);
  for (const row of data || []) {
    const chave = String((row as { chave?: string }).chave || "");
    const status = escolherStatus(statusUazapi((row as { status?: unknown }).status), novo);
    if (!chave || status === statusUazapi((row as { status?: unknown }).status)) continue;
    await supabaseAdmin
      .from("uazapi_chat_mensagens")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("chave", chave);
  }
}
