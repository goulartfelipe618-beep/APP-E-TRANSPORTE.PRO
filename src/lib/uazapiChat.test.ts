import { describe, expect, it } from "vitest";
import {
  escolherStatus,
  fundirMensagens,
  lerHistorico,
  normalizarConversa,
  normalizarMensagem,
  paginacao,
  pedidoHistoricoSeguro,
} from "../../supabase/functions/_shared/uazapiChat";

const base = {
  chave: "MSG1",
  id: "interno",
  messageid: "MSG1",
  chatid: "5511888888888@s.whatsapp.net",
  fromMe: true as boolean | null,
  texto: "Olá",
  tipo: "Conversation",
  status: "Sent" as const,
  remetente: null,
  remetenteNome: null,
  enviadaPelaApi: true as boolean | null,
  erro: null,
  timestampMs: 1_700_000_000_000,
};

describe("uazapi chat", () => {
  it("não inventa status fora da lista da API", () => {
    expect(normalizarMensagem({ id: "1", messageid: "1", chatid: "a@s.whatsapp.net", status: "blue" })?.status).toBeNull();
  });

  it("deduplica pelo messageid e não regride a leitura", () => {
    const primeira = fundirMensagens([], [base]);
    const deNovo = fundirMensagens(primeira, [{ ...base, texto: "Olá", status: "Read" }]);
    const atrasado = fundirMensagens(deNovo, [{ ...base, status: "Sent", texto: "" }]);
    expect(atrasado).toHaveLength(1);
    expect(atrasado[0].status).toBe("Read");
    expect(atrasado[0].texto).toBe("Olá");
  });

  it("falha confirmada não apaga um envio já entregue", () => {
    expect(escolherStatus("Delivered", "Failed")).toBe("Delivered");
    expect(escolherStatus("Queued", "Failed")).toBe("Failed");
  });

  it("ordena por horário mesmo se a página veio invertida", () => {
    const lista = fundirMensagens(
      [],
      [
        { ...base, chave: "b", messageid: "b", timestampMs: 2000 },
        { ...base, chave: "a", messageid: "a", timestampMs: 1000 },
      ],
    );
    expect(lista.map((m) => m.chave)).toEqual(["a", "b"]);
  });

  it("só aceita o next_request do mesmo chat", () => {
    const chat = "5511888888888@s.whatsapp.net";
    expect(pedidoHistoricoSeguro({ number: "outro@s.whatsapp.net", messageid: "x" }, chat)).toBeNull();
    const ok = pedidoHistoricoSeguro({ number: chat, messageid: "3EB0", count: 50, token: "segredo" }, chat);
    expect(ok).toEqual({ number: chat, messageid: "3EB0", count: 50 });
  });

  it("guarda o limite real do histórico", () => {
    const h = lerHistorico(
      { status: "blocked", has_more: true, history_access: "unavailable", error: "history_access_unavailable", messages: [] },
      "5511888888888@s.whatsapp.net",
    );
    expect(h.historyAccess).toBe("unavailable");
    expect(h.hasMore).toBe(true);
  });

  it("pagina pelo total quando a API não manda hasMore", () => {
    expect(paginacao({ pagination: { totalRecords: 12, limit: 5, offset: 0 } })).toEqual({
      hasMore: true,
      nextOffset: 5,
    });
    expect(paginacao({ pagination: { hasMore: false, nextOffset: 0 } }).hasMore).toBe(false);
  });

  it("usa o nome que a conversa traz", () => {
    expect(normalizarConversa({ wa_chatid: "1@s.whatsapp.net", wa_contactName: "Ana" })?.titulo).toBe("Ana");
    expect(normalizarConversa({ wa_chatid: "1@s.whatsapp.net" })?.titulo).toBe("1@s.whatsapp.net");
  });
});
