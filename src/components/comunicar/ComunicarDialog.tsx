import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";
import {
  buildComunicadorSnapshot,
  dispatchComunicarWebhook,
  fetchMotoristaPainelSnapshot,
  jsonSafeRecord,
  type WebhookComunicacaoTipo,
} from "@/lib/n8nComunicarWebhook";
import {
  dadosRegistroComunicarParaWebhook,
  formatComunicarValorCampo,
} from "@/lib/comunicarFieldFormat";

interface ComunicarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: Record<string, unknown>;
  telefone: string | null;
  titulo: string;
  onGerarPDF?: () => void;
  /** Destino do envio conforme painel Admin Master → Comunicador (obrigatório para envio). */
  webhookTipo: WebhookComunicacaoTipo | null;
  /**
   * Gera o PDF de confirmação da reserva (Transfer/Grupo) em base64 para anexar ao mesmo payload do webhook.
   */
  getConfirmacaoReservaPdfBase64?: () => Promise<{ base64: string; filename: string } | null>;
}

const labelMap: Record<string, string> = {
  nome_cliente: "Nome do Cliente",
  nome_completo: "Nome Completo",
  nome: "Nome",
  email: "Email",
  telefone: "Telefone",
  contato: "Contato",
  whatsapp: "WhatsApp",
  cpf: "CPF",
  cpf_cnpj: "CPF/CNPJ",
  cnh: "CNH",
  cidade: "Cidade",
  tipo: "Tipo",
  tipo_viagem: "Tipo de Viagem",
  tipo_veiculo: "Tipo de Veículo",
  embarque: "Embarque",
  desembarque: "Desembarque",
  ida_embarque: "Embarque (Ida)",
  ida_desembarque: "Desembarque (Ida)",
  destino: "Destino",
  data_viagem: "Data da Viagem",
  data_ida: "Data de Ida",
  data_retorno: "Data de Retorno",
  hora_viagem: "Hora da Viagem",
  hora_ida: "Hora de Ida",
  hora_retorno: "Hora de Retorno",
  num_passageiros: "Passageiros",
  ida_passageiros: "Passageiros (Ida)",
  mensagem: "Mensagem",
  observacoes: "Observações",
  observacoes_viagem: "Observações",
  cupom: "Cupom",
  status: "Status",
  valor_base: "Valor Base",
  valor_total: "Valor Total",
  desconto: "Desconto",
  metodo_pagamento: "Método de Pagamento",
  nome_motorista: "Nome do Motorista",
  telefone_motorista: "Tel. Motorista",
  numero_reserva: "Nº Reserva",
  quem_viaja: "Quem Viaja",
  volta_embarque: "Embarque (Volta)",
  volta_desembarque: "Desembarque (Volta)",
  volta_data: "Data (Volta)",
  volta_hora: "Hora (Volta)",
  por_hora_endereco_inicio: "Endereço Início",
  por_hora_ponto_encerramento: "Ponto Encerramento",
  por_hora_data: "Data (Por Hora)",
  por_hora_hora: "Hora (Por Hora)",
  por_hora_qtd_horas: "Qtd. Horas",
  por_hora_itinerario: "Itinerário",
};

const ignoredKeys = ["id", "user_id", "created_at", "updated_at", "veiculo_id", "motorista_id", "solicitacao_id"];

type CanalEnvio = "oficial" | "proprio";

function nomeClienteParaComunicar(dados: Record<string, unknown>): string {
  const d = dados as { nome_cliente?: string; nome_completo?: string; nome?: string };
  const raw =
    String(d.nome_completo ?? d.nome_cliente ?? d.nome ?? "").trim() || "Cliente";
  return raw;
}

export default function ComunicarDialog({
  open,
  onOpenChange,
  dados,
  telefone,
  titulo,
  onGerarPDF,
  webhookTipo = null,
  getConfirmacaoReservaPdfBase64,
}: ComunicarDialogProps) {
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  const [enviando, setEnviando] = useState(false);

  const { sistema, own } = useComunicadoresEvolution();
  const sistemaRef = useRef<ComunicadorRow | null>(null);
  const ownRef = useRef<ComunicadorRow | null>(null);
  const canalRef = useRef<CanalEnvio>("oficial");
  sistemaRef.current = sistema;
  ownRef.current = own;

  const telOficial = sistema?.telefone_conectado?.trim() || null;
  const telProprio = own?.telefone_conectado?.trim() || null;
  const temOficial = Boolean(telOficial);
  const temProprio = Boolean(telProprio);

  useEffect(() => {
    if (temProprio && temOficial) canalRef.current = "proprio";
    else if (temProprio) canalRef.current = "proprio";
    else if (temOficial) canalRef.current = "oficial";
  }, [temProprio, temOficial]);

  const [msgAcima, setMsgAcima] = useState("");
  const [msgAbaixo, setMsgAbaixo] = useState("");
  const [selectedVars, setSelectedVars] = useState<Set<string>>(new Set());

  const availableVars = useMemo(
    () =>
      Object.entries(dados)
        .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
        .map(([key, value]) => ({
          key,
          label: labelMap[key] || key,
          value: formatComunicarValorCampo(key, value),
        })),
    [dados],
  );

  const dadosFingerprint = useMemo(() => {
    const rowId = (dados as { id?: string }).id;
    if (rowId != null && rowId !== "") return `id:${rowId}`;
    return availableVars.map((v) => `${v.key}=${v.value}`).join("\u0001");
  }, [dados, availableVars]);

  const abertoWebhookDoneRef = useRef<string | null>(null);
  const abertoWebhookScheduledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      abertoWebhookDoneRef.current = null;
      abertoWebhookScheduledRef.current = null;
      return;
    }
    if (!webhookTipo) return;
    if (webhookTipo === "transfer_reserva" || webhookTipo === "grupo_reserva") {
      return;
    }

    const key = `${webhookTipo}:${dadosFingerprint}`;
    if (abertoWebhookDoneRef.current === key || abertoWebhookScheduledRef.current === key) return;
    abertoWebhookScheduledRef.current = key;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled || !webhookTipo) return;
      try {
        const motorista = await fetchMotoristaPainelSnapshot();
        await dispatchComunicarWebhook(webhookTipo, {
          evento: "comunicar_dialogo_aberto",
          webhook_tipo: webhookTipo,
          origem: webhookTipo,
          momento: new Date().toISOString(),
          titulo_modal: titulo,
          telefone_cliente: telefone?.replace(/\D/g, "") || null,
          dados_registro: dadosRegistroComunicarParaWebhook(
            jsonSafeRecord(dadosRef.current as Record<string, unknown>) as Record<string, unknown>,
          ),
          variaveis_disponiveis: Object.entries(dadosRef.current)
            .filter(([k, v]) => !ignoredKeys.includes(k) && v != null && v !== "")
            .map(([k]) => k),
          motorista_painel: motorista,
          comunicador: buildComunicadorSnapshot(canalRef.current, sistemaRef.current, ownRef.current),
        });
        abertoWebhookDoneRef.current = key;
      } catch (e) {
        console.error(e);
        abertoWebhookScheduledRef.current = null;
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, webhookTipo, dadosFingerprint, titulo, telefone]);

  useEffect(() => {
    if (!open) return;
    const keys = Object.entries(dadosRef.current)
      .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
      .map(([key]) => key);
    setSelectedVars(new Set(keys));
  }, [open, dadosFingerprint]);

  const solicitacaoPresetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      solicitacaoPresetKeyRef.current = null;
      return;
    }
    const o = webhookTipo;
    if (o !== "transfer_solicitacao" && o !== "grupo_solicitacao") return;

    const key = `${o}:${dadosFingerprint}`;
    if (solicitacaoPresetKeyRef.current === key) return;
    solicitacaoPresetKeyRef.current = key;

    const nomeCliente = nomeClienteParaComunicar(dadosRef.current as Record<string, unknown>);
    setMsgAcima(
      `Olá ${nomeCliente}, recebemos a sua solicitação de viagem!\n\ndetalhes da viagem:`,
    );
    setMsgAbaixo("Em breve um de nossos motoristas entrerá em contato!");
  }, [open, webhookTipo, dadosFingerprint]);

  const reservaPresetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      reservaPresetKeyRef.current = null;
      return;
    }
    const o = webhookTipo;
    if (o !== "transfer_reserva" && o !== "grupo_reserva") return;

    const key = `${o}:${dadosFingerprint}`;
    if (reservaPresetKeyRef.current === key) return;
    reservaPresetKeyRef.current = key;

    const nome = nomeClienteParaComunicar(dadosRef.current as Record<string, unknown>);
    setMsgAcima(
      `Olá ${nome}, a sua reserva está confirmada!\nDetalhes da reserva:`,
    );
    setMsgAbaixo("Em breve o motorista entrará em contato!");
  }, [open, webhookTipo, dadosFingerprint]);

  const isSolicitacaoN8n =
    webhookTipo === "transfer_solicitacao" || webhookTipo === "grupo_solicitacao";

  const isReservaN8n = webhookTipo === "transfer_reserva" || webhookTipo === "grupo_reserva";

  const hasTextoPrePreenchido = isSolicitacaoN8n || isReservaN8n;

  const toggleVar = (key: string) => {
    setSelectedVars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buildMessage = () => {
    const parts: string[] = [];
    if (msgAcima.trim()) parts.push(msgAcima.trim());

    if (selectedVars.size > 0) {
      parts.push("");
      for (const v of availableVars) {
        if (selectedVars.has(v.key)) {
          parts.push(`*${v.label}:* ${v.value}`);
        }
      }
    }

    if (msgAbaixo.trim()) {
      parts.push("");
      parts.push(msgAbaixo.trim());
    }

    return parts.join("\n");
  };

  const handleEnviar = () => {
    void (async () => {
      if (!webhookTipo) {
        toast.error("Tipo de webhook não definido para esta tela.");
        return;
      }

      const base = buildMessage();
      if (!base.trim()) {
        toast.error("Escreva uma mensagem ou selecione variáveis.");
        return;
      }

      const phone = telefone?.replace(/\D/g, "") || "";
      const message = base;

      setEnviando(true);
      try {
        let confirmacaoPdf: { base64: string; filename: string; mime_type: string } | null = null;
        if (isReservaN8n && getConfirmacaoReservaPdfBase64) {
          const pdf = await getConfirmacaoReservaPdfBase64();
          if (!pdf?.base64) {
            toast.error("Não foi possível gerar o PDF de confirmação da reserva.");
            return;
          }
          confirmacaoPdf = {
            base64: pdf.base64,
            filename: pdf.filename,
            mime_type: "application/pdf",
          };
        }

        const motorista = await fetchMotoristaPainelSnapshot();
        await dispatchComunicarWebhook(webhookTipo, {
          evento: isReservaN8n ? "comunicar_reserva_webhook" : "comunicar_envio_webhook",
          webhook_tipo: webhookTipo,
          origem: webhookTipo,
          momento: new Date().toISOString(),
          titulo_modal: titulo,
          telefone_cliente: phone || null,
          telefone_cliente_disponivel: Boolean(phone),
          dados_registro: dadosRegistroComunicarParaWebhook(
            jsonSafeRecord(dadosRef.current as Record<string, unknown>) as Record<string, unknown>,
          ),
          variaveis_chaves_incluidas: [...selectedVars],
          mensagem_completa: message,
          mensagem_partes: {
            inicial: msgAcima,
            final: msgAbaixo,
          },
          motorista_painel: motorista,
          comunicador: buildComunicadorSnapshot(canalRef.current, sistema, own),
          confirmacao_reserva_pdf: confirmacaoPdf,
        });
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Falha ao enviar ao webhook.");
        return;
      } finally {
        setEnviando(false);
      }

      toast.success(isReservaN8n ? "Dados da reserva enviados." : "Dados enviados.");
      onOpenChange(false);
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/40 p-3">
            O envio é feito apenas para o webhook configurado pelo administrador master. Nenhum aplicativo externo (como
            WhatsApp) será aberto.
          </p>

          {isReservaN8n && getConfirmacaoReservaPdfBase64 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-primary/25 bg-primary/5 p-3">
              Ao clicar em Enviar, o <strong className="text-foreground">PDF de confirmação da reserva</strong> (o mesmo
              gerado em &quot;Gerar PDF&quot;) será incluído no payload do webhook em{" "}
              <span className="font-mono text-xs">base64</span>, para o n8n ou outro destino processar.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Mensagem inicial {hasTextoPrePreenchido ? "(acima das variáveis)" : ""}</Label>
            {hasTextoPrePreenchido ? (
              <p className="text-xs text-muted-foreground">
                Texto sugerido com o nome do cliente; você pode editar ou apagar por completo.
              </p>
            ) : null}
            <Textarea
              placeholder={
                hasTextoPrePreenchido
                  ? "Saudação e introdução antes dos detalhes…"
                  : "Escreva uma saudação ou mensagem inicial…"
              }
              value={msgAcima}
              onChange={(e) => setMsgAcima(e.target.value)}
              rows={hasTextoPrePreenchido ? 5 : 3}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Variáveis do registro</Label>
              <p className="text-xs text-muted-foreground">Todas vêm incluídas; clique num chip para excluir da mensagem.</p>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto rounded-lg border border-border p-3 bg-muted/30">
              {availableVars.map((v) => (
                <Badge
                  key={v.key}
                  variant={selectedVars.has(v.key) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => toggleVar(v.key)}
                >
                  {v.label}: <span className="font-normal ml-1 max-w-[100px] truncate">{v.value}</span>
                </Badge>
              ))}
              {availableVars.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma variável disponível.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem final {hasTextoPrePreenchido ? "(abaixo das variáveis)" : ""}</Label>
            {hasTextoPrePreenchido ? (
              <p className="text-xs text-muted-foreground">
                Texto sugerido de encerramento; você pode editar ou apagar por completo.
              </p>
            ) : null}
            <Textarea
              placeholder={
                hasTextoPrePreenchido ? "Encerramento da mensagem…" : "Escreva uma mensagem de encerramento…"
              }
              value={msgAbaixo}
              onChange={(e) => setMsgAbaixo(e.target.value)}
              rows={hasTextoPrePreenchido ? 4 : 3}
            />
          </div>

          {(msgAcima || selectedVars.size > 0 || msgAbaixo) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {buildMessage()}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            {onGerarPDF && (
              <Button variant="outline" onClick={onGerarPDF} className="flex-1">
                <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
              </Button>
            )}
            <Button
              onClick={handleEnviar}
              className="flex-1"
              disabled={!webhookTipo || enviando}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {enviando ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
