import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import { listReservaMotoristasExtra, type ReservaKind } from "@/lib/reservaMotoristasExtra";
import { motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";
import {
  interpolarTextoComunicar,
  persistirTextoComunicar,
} from "@/lib/comunicarPlaceholders";
import {
  buildComunicadorSnapshot,
  buildN8nEnvioWhatsappCampos,
  coletarTelefoneDestinoDoRegistro,
  dispatchComunicarWebhook,
  fetchMotoristaPainelSnapshot,
  jsonSafeRecord,
  type WebhookComunicacaoTipo,
} from "@/lib/n8nComunicarWebhook";
import {
  dadosRegistroComunicarParaWebhook,
  formatComunicarValorCampo,
} from "@/lib/comunicarFieldFormat";
import {
  COMUNICAR_CLIENTE_CHAVES_CONFIDENCIAIS,
  COMUNICAR_META_KEYS,
  lerComunicarMotoristaIds,
  lerComunicarReservaIds,
} from "@/lib/comunicarReservaCliente";
import { sendUazapiWhatsappCard } from "@/lib/evolutionApi";

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
  categoria_veiculo: "Categoria do Veículo",
  trajetos: "Trajetos / paradas",
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
  embarque_retorno: "Embarque (Retorno)",
  destino_retorno: "Destino (Retorno)",
  por_hora_endereco_inicio: "Endereço Início",
  por_hora_ponto_encerramento: "Ponto Encerramento",
  por_hora_data: "Data (Por Hora)",
  por_hora_hora: "Hora (Por Hora)",
  por_hora_qtd_horas: "Qtd. Horas",
  por_hora_itinerario: "Itinerário",
};

const ignoredKeys = [
  "id",
  "user_id",
  "created_at",
  "updated_at",
  "veiculo_id",
  "motorista_id",
  "solicitacao_id",
  ...COMUNICAR_CLIENTE_CHAVES_CONFIDENCIAIS,
  ...COMUNICAR_META_KEYS,
];

function chaveFiltroComunicar(tipo: string | null): string {
  return `comunicar-filtro-vars:${tipo ?? "geral"}`;
}

function lerFiltroComunicar(tipo: string | null): string[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(chaveFiltroComunicar(tipo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((key): key is string => typeof key === "string");
  } catch {
    return null;
  }
}

function gravarFiltroComunicar(tipo: string | null, keys: Iterable<string>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(chaveFiltroComunicar(tipo), JSON.stringify([...keys]));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
}

type AlvoComunicar = "cliente" | "motorista";

type RascunhoComunicar = { acima: string; abaixo: string; vars: string[] };

type MotoristaOpcao = { id: string; nome: string; telefone: string };

function chaveConfigAlvo(tipo: string | null, alvo: AlvoComunicar): string {
  return `comunicar-config:${tipo ?? "geral"}:${alvo}`;
}

function chaveAlvosComunicar(tipo: string | null): string {
  return `comunicar-alvos:${tipo ?? "geral"}`;
}

function lerConfigAlvo(tipo: string | null, alvo: AlvoComunicar): RascunhoComunicar | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(chaveConfigAlvo(tipo, alvo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RascunhoComunicar>;
    return {
      acima: typeof parsed.acima === "string" ? parsed.acima : "",
      abaixo: typeof parsed.abaixo === "string" ? parsed.abaixo : "",
      vars: Array.isArray(parsed.vars) ? parsed.vars.filter((key): key is string => typeof key === "string") : [],
    };
  } catch {
    return null;
  }
}

function gravarConfigAlvo(tipo: string | null, alvo: AlvoComunicar, rascunho: RascunhoComunicar) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(chaveConfigAlvo(tipo, alvo), JSON.stringify(rascunho));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
}

function lerAlvosComunicar(tipo: string | null): AlvoComunicar[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(chaveAlvosComunicar(tipo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((alvo): alvo is AlvoComunicar => alvo === "cliente" || alvo === "motorista");
  } catch {
    return null;
  }
}

function gravarAlvosComunicar(tipo: string | null, alvos: Iterable<AlvoComunicar>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(chaveAlvosComunicar(tipo), JSON.stringify([...alvos]));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
}

type RascunhoUi = { acima: string; abaixo: string; vars: Set<string> };

function textosPadrao(
  alvo: AlvoComunicar,
  tipo: WebhookComunicacaoTipo | null,
): { acima: string; abaixo: string } | null {
  if (alvo === "motorista") {
    return {
      acima: "Olá {{nome_motorista}}, você tem uma nova reserva!\nDetalhes da reserva:",
      abaixo: "",
    };
  }
  if (tipo === "transfer_solicitacao" || tipo === "grupo_solicitacao") {
    return {
      acima: "Olá {{nome_cliente}}, recebemos a sua solicitação de viagem!\n\ndetalhes da viagem:",
      abaixo: "Em breve um de nossos motoristas entrará em contato!",
    };
  }
  if (tipo === "transfer_reserva" || tipo === "grupo_reserva") {
    return {
      acima: "Olá {{nome_cliente}}, a sua reserva está confirmada!\nDetalhes da reserva:",
      abaixo: "Em breve o motorista entrará em contato!",
    };
  }
  return null;
}

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
  const [editando, setEditando] = useState<AlvoComunicar>("cliente");
  const [alvos, setAlvos] = useState<Set<AlvoComunicar>>(new Set(["cliente"]));
  const [rascunhos, setRascunhos] = useState<Record<AlvoComunicar, RascunhoUi>>({
    cliente: { acima: "", abaixo: "", vars: new Set() },
    motorista: { acima: "", abaixo: "", vars: new Set() },
  });
  const [motoristas, setMotoristas] = useState<MotoristaOpcao[]>([]);

  const { sistema, own } = useComunicadoresEvolution();

  const availableVars = useMemo(
    () =>
      Object.entries(dados)
        .filter(([key, value]) => {
          if (ignoredKeys.includes(key) || value == null || value === "") return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return formatComunicarValorCampo(key, value) !== "";
        })
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

  const isSolicitacaoN8n =
    webhookTipo === "transfer_solicitacao" || webhookTipo === "grupo_solicitacao";
  const isReservaN8n = webhookTipo === "transfer_reserva" || webhookTipo === "grupo_reserva";
  const hasTextoPrePreenchido = isSolicitacaoN8n || isReservaN8n;
  const atual = rascunhos[editando];
  const nomesComunicar = useMemo(
    () => ({
      cliente: nomeClienteParaComunicar(dados),
      motorista: motoristas[0]?.nome?.trim() || "Motorista",
    }),
    [dados, motoristas],
  );

  useEffect(() => {
    if (!open) return;
    const keys = Object.entries(dadosRef.current)
      .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
      .map(([key]) => key);
    const montar = (alvo: AlvoComunicar): RascunhoUi => {
      const saved = lerConfigAlvo(webhookTipo, alvo);
      const padrao = textosPadrao(alvo, webhookTipo);
      const legado = alvo === "cliente" ? lerFiltroComunicar(webhookTipo) : null;
      const lista = saved?.vars ?? legado;
      const vars = lista ? new Set(keys.filter((key) => lista.includes(key))) : new Set(keys);
      return {
        acima: persistirTextoComunicar(saved?.acima ?? padrao?.acima ?? "", {
          cliente: nomeClienteParaComunicar(dadosRef.current as Record<string, unknown>),
          motorista: "Motorista",
        }),
        abaixo: persistirTextoComunicar(saved?.abaixo ?? padrao?.abaixo ?? "", {
          cliente: nomeClienteParaComunicar(dadosRef.current as Record<string, unknown>),
          motorista: "Motorista",
        }),
        vars,
      };
    };
    setRascunhos({ cliente: montar("cliente"), motorista: montar("motorista") });
    const salvos = lerAlvosComunicar(webhookTipo);
    const podeMotorista = webhookTipo === "transfer_reserva" || webhookTipo === "grupo_reserva";
    const proximos = (salvos ?? ["cliente"]).filter(
      (alvo) => alvo === "cliente" || (alvo === "motorista" && podeMotorista),
    );
    const escolhidos = new Set<AlvoComunicar>(proximos.length > 0 ? proximos : ["cliente"]);
    setAlvos(escolhidos);
    setEditando(escolhidos.has("cliente") ? "cliente" : "motorista");
  }, [open, dadosFingerprint, webhookTipo]);

  useEffect(() => {
    if (!open || !isReservaN8n) {
      setMotoristas([]);
      return;
    }
    let cancel = false;
    void (async () => {
      const row = dadosRef.current as Record<string, unknown>;
      const userId = String(row.user_id ?? "").trim();
      const reservaIds = lerComunicarReservaIds(row);
      const primaryIds = lerComunicarMotoristaIds(row);
      const kind: ReservaKind = webhookTipo === "grupo_reserva" ? "grupo" : "transfer";
      const extrasPorReserva = await Promise.all(reservaIds.map((id) => listReservaMotoristasExtra(kind, id)));
      const ids = [...new Set([...primaryIds, ...extrasPorReserva.flat()].map((id) => id.trim()).filter(Boolean))];
      if (!userId || ids.length === 0) {
        if (!cancel) {
          setMotoristas([]);
        }
        return;
      }
      const { data } = await supabase
        .from("solicitacoes_motoristas")
        .select("id, nome, telefone, portal_auth_user_id")
        .eq("user_id", userId);
      const lista = (data ?? []) as {
        id: string;
        nome: string;
        telefone: string | null;
        portal_auth_user_id: string | null;
      }[];
      const opcoes = ids.map((assignment) => {
        const hit = lista.find((item) => motoristaMatchesAssignment(assignment, item));
        if (!hit) return { id: assignment, nome: "Motorista atribuído", telefone: "" };
        return { id: assignment, nome: hit.nome || "Motorista", telefone: (hit.telefone ?? "").trim() };
      });
      if (cancel) return;
      setMotoristas(opcoes);
    })();
    return () => {
      cancel = true;
    };
  }, [open, dadosFingerprint, webhookTipo, isReservaN8n]);

  useEffect(() => {
    if (alvos.has(editando)) return;
    if (alvos.has("cliente")) setEditando("cliente");
    else if (alvos.has("motorista")) setEditando("motorista");
  }, [alvos, editando]);

  const atualizarRascunho = (alvo: AlvoComunicar, patch: Partial<RascunhoUi>) => {
    setRascunhos((prev) => ({ ...prev, [alvo]: { ...prev[alvo], ...patch } }));
  };

  const toggleAlvo = (alvo: AlvoComunicar) => {
    setAlvos((prev) => {
      const next = new Set(prev);
      if (next.has(alvo)) next.delete(alvo);
      else next.add(alvo);
      return next;
    });
    setEditando(alvo);
  };

  const toggleVar = (key: string) => {
    setRascunhos((prev) => {
      const vars = new Set(prev[editando].vars);
      if (vars.has(key)) vars.delete(key);
      else vars.add(key);
      return { ...prev, [editando]: { ...prev[editando], vars } };
    });
  };

  const buildMessage = (rascunho: RascunhoUi, nomes = nomesComunicar) => {
    const parts: string[] = [];
    const acima = interpolarTextoComunicar(rascunho.acima, nomes).trim();
    const abaixo = interpolarTextoComunicar(rascunho.abaixo, nomes).trim();
    if (acima) parts.push(acima);

    if (rascunho.vars.size > 0) {
      parts.push("");
      for (const v of availableVars) {
        if (rascunho.vars.has(v.key)) {
          parts.push(`*${v.label}:* ${v.value}`);
        }
      }
    }

    if (abaixo) {
      parts.push("");
      parts.push(abaixo);
    }

    return parts.join("\n");
  };

  const handleEnviar = () => {
    void (async () => {
      if (!webhookTipo) {
        toast.error("Tipo de webhook não definido para esta tela.");
        return;
      }

      const destinos: AlvoComunicar[] = isReservaN8n ? [...alvos] : ["cliente"];
      if (destinos.length === 0) {
        toast.error("Selecione o cliente, o motorista ou os dois.");
        return;
      }

      const row = jsonSafeRecord(dadosRef.current as Record<string, unknown>) as Record<string, unknown>;
      const phoneCliente = (coletarTelefoneDestinoDoRegistro(telefone, row).replace(/\D/g, "") || "");
      if (destinos.includes("cliente") && !phoneCliente) {
        toast.error("Informe o WhatsApp do cliente.");
        return;
      }
      const motoristasComWhatsapp = motoristas.filter((item) => item.telefone.replace(/\D/g, ""));
      if (destinos.includes("motorista")) {
        if (motoristas.length === 0) {
          toast.error("Esta reserva não tem motorista atribuído.");
          return;
        }
        if (motoristasComWhatsapp.length === 0) {
          toast.error("Os motoristas atribuídos não têm WhatsApp cadastrado.");
          return;
        }
      }

      for (const alvo of destinos) {
        if (!buildMessage(rascunhos[alvo]).trim()) {
          toast.error(alvo === "motorista" ? "Escreva a mensagem do motorista." : "Escreva a mensagem do cliente.");
          return;
        }
      }

      setEnviando(true);
      let enviados = 0;
      try {
        let confirmacaoPdf: { base64: string; filename: string; mime_type: string } | null = null;
        if (destinos.includes("cliente") && isReservaN8n && getConfirmacaoReservaPdfBase64) {
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

        const motoristaPainel = await fetchMotoristaPainelSnapshot();
        const comunicadorSnap = buildComunicadorSnapshot(sistema, own);

        for (const alvo of destinos) {
          const rascunho = rascunhos[alvo];
          const destinatarios =
            alvo === "cliente"
              ? [{ id: "cliente", nome: nomesComunicar.cliente, telefone: phoneCliente }]
              : motoristasComWhatsapp;
          const pdfDeste = alvo === "cliente" ? confirmacaoPdf : null;
          for (const dest of destinatarios) {
            const nomes = {
              cliente: nomesComunicar.cliente,
              motorista: dest.id === "cliente" ? nomesComunicar.motorista : dest.nome,
            };
            const message = buildMessage(rascunho, nomes);
            const phone = dest.telefone.replace(/\D/g, "");
            const sent = await sendUazapiWhatsappCard({
              number: phone,
              text: message,
              title: titulo,
              buttons: [
                { id: "recebido", text: "✅ Recebido" },
                { id: "duvidas", text: "❓ Dúvidas" },
              ],
              pdf: pdfDeste ? { base64: pdfDeste.base64, filename: pdfDeste.filename } : null,
            });
            if (!sent.ok) {
              toast.error(sent.error || (alvo === "motorista" ? "Não foi possível enviar ao motorista." : "Não foi possível enviar ao cliente."));
              return;
            }
            if (sent.warning) toast.message(sent.warning);
            try {
              await dispatchComunicarWebhook(webhookTipo, {
                evento: isReservaN8n ? "comunicar_reserva_webhook" : "comunicar_envio_webhook",
                webhook_tipo: webhookTipo,
                origem: webhookTipo,
                destino: alvo,
                momento: new Date().toISOString(),
                titulo_modal: titulo,
                telefone_cliente: phone || null,
                telefone_cliente_disponivel: Boolean(phone),
                dados_registro: dadosRegistroComunicarParaWebhook(row),
                variaveis_chaves_incluidas: [...rascunho.vars],
                mensagem_completa: message,
                mensagem_partes: {
                  inicial: interpolarTextoComunicar(rascunho.acima, nomes),
                  final: interpolarTextoComunicar(rascunho.abaixo, nomes),
                },
                motorista_painel: motoristaPainel,
                motorista_destino: alvo === "motorista" ? dest : null,
                comunicador: comunicadorSnap,
                confirmacao_reserva_pdf: pdfDeste,
                ...buildN8nEnvioWhatsappCampos(comunicadorSnap, phone, {
                  mensagem: message,
                  tipo: webhookTipo,
                }),
                ...(pdfDeste ? { pdf_base64: pdfDeste.base64, pdf_filename: pdfDeste.filename } : {}),
              });
            } catch (webhookErr) {
              console.warn(webhookErr);
            }
            enviados += 1;
          }
          gravarConfigAlvo(webhookTipo, alvo, {
            acima: persistirTextoComunicar(rascunho.acima, nomesComunicar),
            abaixo: persistirTextoComunicar(rascunho.abaixo, nomesComunicar),
            vars: [...rascunho.vars],
          });
          if (alvo === "cliente") gravarFiltroComunicar(webhookTipo, rascunho.vars);
        }
        if (isReservaN8n) gravarAlvosComunicar(webhookTipo, destinos);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Falha ao enviar no WhatsApp.");
        return;
      } finally {
        setEnviando(false);
      }

      if (enviados === 0) return;
      toast.success(enviados > 1 ? "Mensagens enviadas no WhatsApp." : "Mensagem enviada no WhatsApp.");
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
            Escolha o cliente, o motorista ou os dois. A configuração (texto e chips) é a última gravada;
            os valores são sempre desta reserva. Conecte o WhatsApp em <strong className="text-foreground">Comunicador</strong> antes do primeiro envio.
          </p>

          {isReservaN8n ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={alvos.has("cliente") ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => toggleAlvo("cliente")}
                >
                  Cliente
                </Button>
                <Button
                  type="button"
                  variant={alvos.has("motorista") ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => toggleAlvo("motorista")}
                >
                  Motorista
                </Button>
              </div>
              {alvos.has("motorista") ? (
                motoristas.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    <Label>Motoristas atribuídos nesta reserva</Label>
                    <ul className="mt-1 space-y-1 text-sm">
                      {motoristas.map((item) => (
                        <li key={item.id}>
                          {item.nome}
                          {item.telefone ? ` · ${item.telefone}` : " · sem WhatsApp"}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      A reserva já aparece no mini painel destes motoristas. O envio WhatsApp vai para todos os que têm número.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum motorista vinculado a esta reserva.</p>
                )
              ) : null}
              {alvos.size > 1 ? (
                <div className="flex gap-2">
                  <Button type="button" variant={editando === "cliente" ? "secondary" : "ghost"} onClick={() => setEditando("cliente")}>
                    Mensagem do cliente
                  </Button>
                  <Button type="button" variant={editando === "motorista" ? "secondary" : "ghost"} onClick={() => setEditando("motorista")}>
                    Mensagem do motorista
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {isReservaN8n && getConfirmacaoReservaPdfBase64 && alvos.has("cliente") ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-primary/25 bg-primary/5 p-3">
              O PDF de confirmação vai apenas para o cliente. O motorista recebe só a mensagem.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>
              Mensagem inicial {hasTextoPrePreenchido ? "(acima das variáveis)" : ""}
              {isReservaN8n ? ` — ${editando === "motorista" ? "motorista" : "cliente"}` : ""}
            </Label>
            {hasTextoPrePreenchido ? (
              <p className="text-xs text-muted-foreground">
                {editando === "motorista"
                  ? "Texto que o motorista recebe. Você pode editar ou apagar por completo."
                  : "Texto sugerido com o nome do cliente; você pode editar ou apagar por completo."}
              </p>
            ) : null}
            <Textarea
              placeholder={
                hasTextoPrePreenchido
                  ? "Saudação e introdução antes dos detalhes…"
                  : "Escreva uma saudação ou mensagem inicial…"
              }
              value={interpolarTextoComunicar(atual.acima, nomesComunicar)}
              onChange={(e) =>
                atualizarRascunho(editando, { acima: persistirTextoComunicar(e.target.value, nomesComunicar) })
              }
              rows={hasTextoPrePreenchido ? 5 : 3}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Variáveis do registro</Label>
              <p className="text-xs text-muted-foreground">
                Clique num chip para incluir ou excluir. Os valores são desta reserva. Só o conjunto de chips fica na última configuração.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto rounded-lg border border-border p-3 bg-muted/30">
              {availableVars.map((v) => (
                <Badge
                  key={v.key}
                  variant={atual.vars.has(v.key) ? "default" : "outline"}
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
                Texto de encerramento; você pode editar ou apagar por completo.
              </p>
            ) : null}
            <Textarea
              placeholder={
                hasTextoPrePreenchido ? "Encerramento da mensagem…" : "Escreva uma mensagem de encerramento…"
              }
              value={interpolarTextoComunicar(atual.abaixo, nomesComunicar)}
              onChange={(e) =>
                atualizarRascunho(editando, { abaixo: persistirTextoComunicar(e.target.value, nomesComunicar) })
              }
              rows={hasTextoPrePreenchido ? 4 : 3}
            />
          </div>

          {(atual.acima || atual.vars.size > 0 || atual.abaixo) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Pré-visualização {isReservaN8n ? (editando === "motorista" ? "do motorista" : "do cliente") : ""}
              </Label>
              <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {buildMessage(atual)}
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
