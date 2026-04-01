import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquare, FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";
import { formatPhoneBrDisplay } from "@/lib/evolutionApi";
import {
  buildComunicadorSnapshot,
  fetchMotoristaPainelSnapshot,
  jsonSafeRecord,
  postMotoristaComunicarWebhook,
  type OrigemComunicarMotorista,
} from "@/lib/n8nComunicarWebhook";

interface ComunicarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: Record<string, any>;
  telefone: string | null;
  titulo: string;
  onGerarPDF?: () => void;
  /**
   * Só solicitações Transfer / Grupo: envia ao webhook n8n e pré-preenche textos.
   * Reservas não usam este prop (outro fluxo/webhook).
   */
  origemMotoristaWebhook?: OrigemComunicarMotorista | null;
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

function sufixoCanal(canal: CanalEnvio, temOficial: boolean, temProprio: boolean): string {
  if (temOficial && temProprio) {
    return canal === "oficial"
      ? "\n\n_Enviado pela linha oficial E-Transporte.pro._"
      : "\n\n_Enviado pelo meu WhatsApp (motorista)._";
  }
  if (temOficial && !temProprio) return "\n\n_Enviado pela linha oficial E-Transporte.pro._";
  if (!temOficial && temProprio) return "\n\n_Enviado pelo meu WhatsApp (motorista)._";
  return "";
}

export default function ComunicarDialog({
  open,
  onOpenChange,
  dados,
  telefone,
  titulo,
  onGerarPDF,
  origemMotoristaWebhook = null,
}: ComunicarDialogProps) {
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  const { sistema, own, loading: loadingCanais } = useComunicadoresEvolution();
  const sistemaRef = useRef<ComunicadorRow | null>(null);
  const ownRef = useRef<ComunicadorRow | null>(null);
  const canalRef = useRef<CanalEnvio>("oficial");
  sistemaRef.current = sistema;
  ownRef.current = own;
  const [msgAcima, setMsgAcima] = useState("");
  const [msgAbaixo, setMsgAbaixo] = useState("");
  const [selectedVars, setSelectedVars] = useState<Set<string>>(new Set());
  const [canal, setCanal] = useState<CanalEnvio>("oficial");

  const telOficial = sistema?.telefone_conectado?.trim() || null;
  const telProprio = own?.telefone_conectado?.trim() || null;
  const temOficial = Boolean(telOficial);
  const temProprio = Boolean(telProprio);

  const availableVars = useMemo(
    () =>
      Object.entries(dados)
        .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
        .map(([key, value]) => ({ key, label: labelMap[key] || key, value: String(value) })),
    [dados],
  );

  /** Evita re-selecionar tudo a cada render do pai; só quando abre ou troca o registro */
  const dadosFingerprint = useMemo(() => {
    const rowId = (dados as { id?: string }).id;
    if (rowId != null && rowId !== "") return `id:${rowId}`;
    return availableVars.map((v) => `${v.key}=${v.value}`).join("\u0001");
  }, [dados, availableVars]);

  useEffect(() => {
    if (!open) return;
    if (temProprio && temOficial) setCanal("proprio");
    else if (temProprio) setCanal("proprio");
    else if (temOficial) setCanal("oficial");
  }, [open, temProprio, temOficial]);

  useEffect(() => {
    canalRef.current = canal;
  }, [canal]);

  /** Clique em Comunicar: notifica n8n com todos os dados + motorista + comunicador (canal após hidratar) */
  const abertoWebhookDoneRef = useRef<string | null>(null);
  const abertoWebhookScheduledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      abertoWebhookDoneRef.current = null;
      abertoWebhookScheduledRef.current = null;
      return;
    }
    if (!origemMotoristaWebhook) return;
    /** Reservas: apenas um envio ao confirmar (sem WhatsApp), não dispara ao abrir o modal */
    if (origemMotoristaWebhook === "transfer_reserva" || origemMotoristaWebhook === "grupo_reserva") {
      return;
    }

    const key = `${origemMotoristaWebhook}:${dadosFingerprint}`;
    if (abertoWebhookDoneRef.current === key || abertoWebhookScheduledRef.current === key) return;
    abertoWebhookScheduledRef.current = key;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled || !origemMotoristaWebhook) return;
      try {
        const motorista = await fetchMotoristaPainelSnapshot();
        await postMotoristaComunicarWebhook({
          evento: "comunicar_dialogo_aberto",
          origem: origemMotoristaWebhook,
          momento: new Date().toISOString(),
          titulo_modal: titulo,
          telefone_cliente: telefone?.replace(/\D/g, "") || null,
          dados_registro: jsonSafeRecord(dadosRef.current as Record<string, unknown>),
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
  }, [open, origemMotoristaWebhook, dadosFingerprint, titulo, telefone]);

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
    const o = origemMotoristaWebhook;
    if (o !== "transfer_solicitacao" && o !== "grupo_solicitacao") return;

    const key = `${o}:${dadosFingerprint}`;
    if (solicitacaoPresetKeyRef.current === key) return;
    solicitacaoPresetKeyRef.current = key;

    const nomeCliente = String((dadosRef.current as { nome_cliente?: string }).nome_cliente || "").trim() || "Cliente";
    setMsgAcima(
      `Olá ${nomeCliente}, recebemos a sua solicitação de viagem!\n\ndetalhes da viagem:`,
    );
    setMsgAbaixo("Em breve um de nossos motoristas entrerá em contato!");
  }, [open, origemMotoristaWebhook, dadosFingerprint]);

  const isSolicitacaoN8n =
    origemMotoristaWebhook === "transfer_solicitacao" || origemMotoristaWebhook === "grupo_solicitacao";

  /** Reservas oficiais: só envio ao webhook n8n, sem abrir WhatsApp */
  const isReservaN8n =
    origemMotoristaWebhook === "transfer_reserva" || origemMotoristaWebhook === "grupo_reserva";

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
      parts.push(""); // empty line
      for (const v of availableVars) {
        if (selectedVars.has(v.key)) {
          parts.push(`*${v.label}:* ${v.value}`);
        }
      }
    }

    if (msgAbaixo.trim()) {
      parts.push(""); // empty line
      parts.push(msgAbaixo.trim());
    }

    return parts.join("\n");
  };

  const handleEnviar = () => {
    void (async () => {
      const base = buildMessage();
      if (!base.trim()) {
        toast.error("Escreva uma mensagem ou selecione variáveis.");
        return;
      }

      const phone = telefone?.replace(/\D/g, "") || "";
      const suffix = sufixoCanal(canal, temOficial, temProprio);
      const message = base + suffix;

      if (origemMotoristaWebhook) {
        try {
          const motorista = await fetchMotoristaPainelSnapshot();
          await postMotoristaComunicarWebhook({
            evento: isReservaN8n ? "comunicar_reserva_webhook" : "comunicar_envio_whatsapp",
            origem: origemMotoristaWebhook,
            momento: new Date().toISOString(),
            titulo_modal: titulo,
            telefone_cliente: phone || null,
            telefone_cliente_disponivel: Boolean(phone),
            dados_registro: jsonSafeRecord(dadosRef.current as Record<string, unknown>),
            variaveis_chaves_incluidas: [...selectedVars],
            mensagem_whatsapp_completa: message,
            mensagem_partes: {
              inicial: msgAcima,
              final: msgAbaixo,
              sufixo_canal: suffix,
            },
            motorista_painel: motorista,
            comunicador: buildComunicadorSnapshot(canal, sistema, own),
          });
        } catch (e) {
          console.error(e);
          toast.error("Falha ao notificar o n8n.");
          return;
        }
      }

      if (isReservaN8n) {
        toast.success("Dados da reserva enviados ao n8n.");
        onOpenChange(false);
        return;
      }

      if (phone) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
      } else if (origemMotoristaWebhook) {
        toast.message("Dados enviados ao n8n.", {
          description: "Não há telefone do cliente neste registro para abrir o WhatsApp.",
        });
      } else {
        toast.error("Telefone não disponível.");
        return;
      }

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
          {/* Sempre no topo: escolha do comunicador */}
          <div className="space-y-3 rounded-lg border border-primary/25 bg-muted/30 p-3">
            <Label className="text-foreground text-base">Comunicador</Label>
            {loadingCanais ? (
              <p className="text-sm text-muted-foreground">Carregando canais…</p>
            ) : temOficial && temProprio ? (
              <RadioGroup value={canal} onValueChange={(v) => setCanal(v as CanalEnvio)} className="grid gap-3">
                <div className="flex items-start gap-3 rounded-md border border-transparent px-1 py-0.5 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="proprio" id="canal-proprio" className="mt-1" />
                  <Label htmlFor="canal-proprio" className="cursor-pointer font-normal leading-snug">
                    <span className="font-medium text-foreground">Meu WhatsApp</span>
                    <span className="block text-xs text-muted-foreground font-mono">{formatPhoneBrDisplay(telProprio!)}</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-md border border-transparent px-1 py-0.5 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="oficial" id="canal-oficial" className="mt-1" />
                  <Label htmlFor="canal-oficial" className="cursor-pointer font-normal leading-snug">
                    <span className="font-medium text-foreground">Linha oficial da plataforma</span>
                    <span className="block text-xs text-muted-foreground font-mono">{formatPhoneBrDisplay(telOficial!)}</span>
                  </Label>
                </div>
              </RadioGroup>
            ) : temOficial || temProprio ? (
              <p className="text-sm text-muted-foreground">
                {temOficial && (
                  <>
                    <span className="font-medium text-foreground">Linha oficial</span> — {formatPhoneBrDisplay(telOficial!)}
                  </>
                )}
                {temOficial && temProprio ? <span className="mx-1">·</span> : null}
                {temProprio && (
                  <>
                    <span className="font-medium text-foreground">Meu WhatsApp</span> — {formatPhoneBrDisplay(telProprio!)}
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum número de comunicador sincronizado. Configure em <strong className="text-foreground">Sistema → Comunicador</strong>. A mensagem será enviada sem rodapé de canal.
              </p>
            )}
            {(temOficial || temProprio) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                O link abre a conversa com o <strong className="text-foreground">cliente</strong>. Use o WhatsApp já logado na linha escolhida.
              </p>
            )}
          </div>

          {/* Message above */}
          <div className="space-y-1.5">
            <Label>Mensagem inicial {isSolicitacaoN8n ? "(acima das variáveis)" : ""}</Label>
            {isSolicitacaoN8n ? (
              <p className="text-xs text-muted-foreground">
                Texto sugerido com o nome do cliente; você pode editar ou apagar por completo.
              </p>
            ) : null}
            <Textarea
              placeholder={
                isSolicitacaoN8n
                  ? "Saudação e introdução antes dos detalhes…"
                  : "Escreva uma saudação ou mensagem inicial…"
              }
              value={msgAcima}
              onChange={(e) => setMsgAcima(e.target.value)}
              rows={isSolicitacaoN8n ? 5 : 3}
            />
          </div>

          {/* Variable selector — todas marcadas ao abrir; clique para retirar da mensagem */}
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

          {/* Message below */}
          <div className="space-y-1.5">
            <Label>Mensagem final {isSolicitacaoN8n ? "(abaixo das variáveis)" : ""}</Label>
            {isSolicitacaoN8n ? (
              <p className="text-xs text-muted-foreground">
                Texto sugerido de encerramento; você pode editar ou apagar por completo.
              </p>
            ) : null}
            <Textarea
              placeholder={
                isSolicitacaoN8n ? "Encerramento da mensagem…" : "Escreva uma mensagem de encerramento…"
              }
              value={msgAbaixo}
              onChange={(e) => setMsgAbaixo(e.target.value)}
              rows={isSolicitacaoN8n ? 4 : 3}
            />
          </div>

          {/* Preview */}
          {(msgAcima || selectedVars.size > 0 || msgAbaixo) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {buildMessage() + sufixoCanal(canal, temOficial, temProprio)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            {onGerarPDF && (
              <Button variant="outline" onClick={onGerarPDF} className="flex-1">
                <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
              </Button>
            )}
            <Button onClick={handleEnviar} className="flex-1" disabled={loadingCanais}>
              <Send className="h-4 w-4 mr-2" />{" "}
              {isReservaN8n ? "Enviar ao n8n" : "Enviar via WhatsApp"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
