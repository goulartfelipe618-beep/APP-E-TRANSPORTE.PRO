import { supabase } from "@/integrations/supabase/client";

type InboxResp<T = unknown> =
  | (T & { error?: undefined })
  | { error: string; code?: string; httpStatus?: number };

async function invokeInbox<B extends Record<string, unknown>>(body: B): Promise<InboxResp> {
  const { data, error } = await supabase.functions.invoke<Record<string, unknown>>("evolution-motorista-inbox", {
    body,
  });
  if (error) {
    return { error: error.message };
  }
  const d = data as Record<string, unknown> | null;
  if (d && typeof d.error === "string" && d.error) {
    return { error: d.error, code: typeof d.code === "string" ? d.code : undefined };
  }
  return { ...(d ?? {}) };
}

export async function inboxFetchChats(): Promise<InboxResp<{ chats?: unknown[]; httpStatus?: number }>> {
  const r = await invokeInbox({ action: "chats" });
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ chats?: unknown[]; httpStatus?: number }>;
}

export async function inboxFetchMessages(
  remoteJid: string,
  limit?: number,
): Promise<InboxResp<{ messages?: unknown[]; httpStatus?: number }>> {
  const r = await invokeInbox({ action: "messages", remoteJid, limit });
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ messages?: unknown[]; httpStatus?: number }>;
}

export async function inboxSendText(
  numberDigits: string,
  text: string,
): Promise<InboxResp<{ httpStatus?: number; bodyText?: string }>> {
  const r = await invokeInbox({ action: "send_text", number: numberDigits.replace(/\D/g, ""), text });
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ httpStatus?: number; bodyText?: string }>;
}

export async function inboxSendAudio(
  numberDigits: string,
  audioBase64: string,
): Promise<InboxResp<{ httpStatus?: number; bodyText?: string }>> {
  const r = await invokeInbox({
    action: "send_audio",
    number: numberDigits.replace(/\D/g, ""),
    audioBase64,
  });
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ httpStatus?: number; bodyText?: string }>;
}

export async function inboxSendMedia(
  numberDigits: string,
  media: {
    base64: string;
    mimetype: string;
    fileName: string;
    mediatype: "image" | "video" | "document";
    caption?: string;
  },
): Promise<InboxResp<{ httpStatus?: number; bodyText?: string }>> {
  const r = await invokeInbox({
    action: "send_media",
    number: numberDigits.replace(/\D/g, ""),
    media,
  });
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ httpStatus?: number; bodyText?: string }>;
}

export async function inboxDeleteForEveryone(params: {
  remoteJid: string;
  messageId: string;
  fromMe: boolean;
  participant?: string;
}): Promise<InboxResp<{ httpStatus?: number; bodyText?: string }>> {
  const payload: Record<string, unknown> = {
    action: "delete_for_everyone",
    remoteJid: params.remoteJid,
    messageId: params.messageId,
    fromMe: params.fromMe,
  };
  if (params.participant?.trim()) {
    payload.participant = params.participant.trim();
  }
  const r = await invokeInbox(payload);
  if ("error" in r && r.error) return r;
  return r as InboxResp<{ httpStatus?: number; bodyText?: string }>;
}
