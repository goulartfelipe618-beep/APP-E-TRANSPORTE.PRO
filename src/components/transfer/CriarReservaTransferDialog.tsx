import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { computeClienteProfilePercent } from "@/lib/clienteCompleteness";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import { RESERVA_STATUS_OPTIONS } from "@/lib/reservaStatus";

function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toTimeInput(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export interface TransferInitialData {
  nome_completo?: string;
  contato?: string;
  email?: string;
  tipo?: string;
  embarque?: string;
  desembarque?: string;
  data_viagem?: string;
  hora_viagem?: string;
  num_passageiros?: number | null;
  mensagem?: string;
  cupom?: string;
  // Volta
  volta_embarque?: string;
  volta_desembarque?: string;
  volta_data?: string;
  volta_hora?: string;
  volta_passageiros?: number | null;
  volta_mensagem?: string;
  volta_cupom?: string;
  // Por hora
  por_hora_endereco_inicio?: string;
  por_hora_ponto_encerramento?: string;
  por_hora_data?: string;
  por_hora_hora?: string;
  por_hora_passageiros?: number | null;
  por_hora_qtd_horas?: number | null;
  por_hora_cupom?: string;
  por_hora_itinerario?: string;
  solicitacao_id?: string;
}

interface CriarReservaTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialData?: TransferInitialData | null;
  reservaEdicao?: Tables<"reservas_transfer"> | null;
}

type TipoViagem = "somente_ida" | "ida_volta" | "por_hora";
type QuemViaja = "motorista" | "eu_mesmo";

type ClienteReservaOpt = {
  id: string;
  nome_exibicao: string;
  email: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  cpf_cnpj: string | null;
};

export default function CriarReservaTransferDialog({
  open,
  onOpenChange,
  onCreated,
  initialData,
  reservaEdicao = null,
}: CriarReservaTransferDialogProps) {
  const [tipoViagem, setTipoViagem] = useState<TipoViagem>("somente_ida");
  const [quemViaja, setQuemViaja] = useState<QuemViaja>("motorista");
  const [valorBase, setValorBase] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [saving, setSaving] = useState(false);

  // Form fields
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [idaEmbarque, setIdaEmbarque] = useState("");
  const [idaDesembarque, setIdaDesembarque] = useState("");
  const [idaData, setIdaData] = useState("");
  const [idaHora, setIdaHora] = useState("");
  const [idaPassageiros, setIdaPassageiros] = useState("");
  const [idaCupom, setIdaCupom] = useState("");
  const [idaMensagem, setIdaMensagem] = useState("");
  const [voltaEmbarque, setVoltaEmbarque] = useState("");
  const [voltaDesembarque, setVoltaDesembarque] = useState("");
  const [voltaData, setVoltaData] = useState("");
  const [voltaHora, setVoltaHora] = useState("");
  const [voltaPassageiros, setVoltaPassageiros] = useState("");
  const [voltaCupom, setVoltaCupom] = useState("");
  const [voltaMensagem, setVoltaMensagem] = useState("");
  const [porHoraEnderecoInicio, setPorHoraEnderecoInicio] = useState("");
  const [porHoraPontoEncerramento, setPorHoraPontoEncerramento] = useState("");
  const [porHoraData, setPorHoraData] = useState("");
  const [porHoraHora, setPorHoraHora] = useState("");
  const [porHoraPassageiros, setPorHoraPassageiros] = useState("");
  const [porHoraQtdHoras, setPorHoraQtdHoras] = useState("");
  const [porHoraCupom, setPorHoraCupom] = useState("");
  const [porHoraItinerario, setPorHoraItinerario] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [statusOperacional, setStatusOperacional] = useState("pendente");
  const [repasseMotorista, setRepasseMotorista] = useState("");
  const [motoristasFrota, setMotoristasFrota] = useState<{ id: string; nome: string; portal_auth_user_id: string }[]>([]);
  const [motoristaAtribUid, setMotoristaAtribUid] = useState<string>("");
  const [modoClienteReserva, setModoClienteReserva] = useState<"novo" | "cadastrado">("novo");
  const [clientesReservaOpts, setClientesReservaOpts] = useState<ClienteReservaOpt[]>([]);
  const [cadastroClienteIdReserva, setCadastroClienteIdReserva] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const clientesFiltrados = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const list = clientesReservaOpts;
    if (!q) return list;
    return list.filter((c) => c.nome_exibicao.toLowerCase().includes(q));
  }, [clientSearch, clientesReservaOpts]);

  const valorTotalNum = useMemo(() => {
    const base = parseFloat(valorBase) || 0;
    const desc = parseFloat(desconto) || 0;
    return base - (base * desc / 100);
  }, [valorBase, desconto]);

  const valorTotalFormatted = valorTotalNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Pre-fill from edição, solicitação ou reset
  useEffect(() => {
    if (!open) return;

    if (reservaEdicao) {
      const row = reservaEdicao;
      setNomeCompleto(row.nome_completo ?? "");
      setCpfCnpj(row.cpf_cnpj ?? "");
      setEmail(row.email ?? "");
      setTelefone(row.telefone ?? "");
      const tv = row.tipo_viagem;
      setTipoViagem(tv === "ida_volta" || tv === "por_hora" ? tv : "somente_ida");
      setQuemViaja(row.quem_viaja === "eu_mesmo" ? "eu_mesmo" : "motorista");
      setIdaEmbarque(row.ida_embarque ?? "");
      setIdaDesembarque(row.ida_desembarque ?? "");
      setIdaData(toDateInput(row.ida_data));
      setIdaHora(toTimeInput(row.ida_hora));
      setIdaPassageiros(row.ida_passageiros != null ? String(row.ida_passageiros) : "");
      setIdaCupom(row.ida_cupom ?? "");
      setIdaMensagem(row.ida_mensagem ?? "");
      setVoltaEmbarque(row.volta_embarque ?? "");
      setVoltaDesembarque(row.volta_desembarque ?? "");
      setVoltaData(toDateInput(row.volta_data));
      setVoltaHora(toTimeInput(row.volta_hora));
      setVoltaPassageiros(row.volta_passageiros != null ? String(row.volta_passageiros) : "");
      setVoltaCupom(row.volta_cupom ?? "");
      setVoltaMensagem(row.volta_mensagem ?? "");
      setPorHoraEnderecoInicio(row.por_hora_endereco_inicio ?? "");
      setPorHoraPontoEncerramento(row.por_hora_ponto_encerramento ?? "");
      setPorHoraData(toDateInput(row.por_hora_data));
      setPorHoraHora(toTimeInput(row.por_hora_hora));
      setPorHoraPassageiros(row.por_hora_passageiros != null ? String(row.por_hora_passageiros) : "");
      setPorHoraQtdHoras(row.por_hora_qtd_horas != null ? String(row.por_hora_qtd_horas) : "");
      setPorHoraCupom(row.por_hora_cupom ?? "");
      setPorHoraItinerario(row.por_hora_itinerario ?? "");
      setValorBase(String(row.valor_base ?? 0));
      setDesconto(String(row.desconto ?? 0));
      setMetodoPagamento(row.metodo_pagamento ?? "");
      setObservacoes(row.observacoes ?? "");
      const st = (row.status ?? "pendente").trim();
      setStatusOperacional(
        RESERVA_STATUS_OPTIONS.some((o) => o.value === st) ? st : "pendente",
      );
      setRepasseMotorista(
        row.repasse_motorista != null && Number(row.repasse_motorista) > 0 ? String(row.repasse_motorista) : "",
      );
      const mid = (row.motorista_id ?? "").trim();
      setMotoristaAtribUid(mid);
      const cid = (row as { cadastro_cliente_id?: string | null }).cadastro_cliente_id;
      if (cid) {
        setModoClienteReserva("cadastrado");
        setCadastroClienteIdReserva(String(cid));
      } else {
        setModoClienteReserva("novo");
        setCadastroClienteIdReserva("");
      }
      return;
    }

    if (initialData) {
      setNomeCompleto(initialData.nome_completo || "");
      setTelefone(initialData.contato || "");
      setEmail(initialData.email || "");
      setIdaEmbarque(initialData.embarque || "");
      setIdaDesembarque(initialData.desembarque || "");
      setIdaData(initialData.data_viagem || "");
      setIdaHora(initialData.hora_viagem || "");
      setIdaPassageiros(initialData.num_passageiros?.toString() || "");
      setIdaCupom(initialData.cupom || "");
      setIdaMensagem(initialData.mensagem || "");
      setObservacoes(initialData.mensagem || "");
      setVoltaEmbarque(initialData.volta_embarque || "");
      setVoltaDesembarque(initialData.volta_desembarque || "");
      setVoltaData(initialData.volta_data || "");
      setVoltaHora(initialData.volta_hora || "");
      setVoltaPassageiros(initialData.volta_passageiros?.toString() || "");
      setVoltaCupom(initialData.volta_cupom || "");
      setVoltaMensagem(initialData.volta_mensagem || "");
      setPorHoraEnderecoInicio(initialData.por_hora_endereco_inicio || "");
      setPorHoraPontoEncerramento(initialData.por_hora_ponto_encerramento || "");
      setPorHoraData(initialData.por_hora_data || "");
      setPorHoraHora(initialData.por_hora_hora || "");
      setPorHoraPassageiros(initialData.por_hora_passageiros?.toString() || "");
      setPorHoraQtdHoras(initialData.por_hora_qtd_horas?.toString() || "");
      setPorHoraCupom(initialData.por_hora_cupom || "");
      setPorHoraItinerario(initialData.por_hora_itinerario || "");

      if (initialData.tipo) {
        const tipoMap: Record<string, TipoViagem> = { ida: "somente_ida", somente_ida: "somente_ida", ida_volta: "ida_volta", por_hora: "por_hora" };
        setTipoViagem(tipoMap[initialData.tipo] || "somente_ida");
      }
      setModoClienteReserva("novo");
      setCadastroClienteIdReserva("");
      return;
    }

    resetForm();
  }, [open, initialData, reservaEdicao]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMotoristasFrota([]);
        return;
      }
      const [{ data }, { data: cli }] = await Promise.all([
        supabase
          .from("solicitacoes_motoristas")
          .select("id, nome, portal_auth_user_id")
          .eq("user_id", auth.user.id)
          .eq("status", "cadastrado")
          .not("portal_auth_user_id", "is", null),
        supabase
          .from("cadastro_clientes")
          .select("id,nome_exibicao,email,telefone_1,telefone_2,cpf_cnpj")
          .eq("user_id", auth.user.id)
          .order("nome_exibicao", { ascending: true }),
      ]);
      const rows = (data ?? []) as { id: string; nome: string; portal_auth_user_id: string | null }[];
      setMotoristasFrota(
        rows.filter((r) => r.portal_auth_user_id != null).map((r) => ({
          id: r.id,
          nome: r.nome,
          portal_auth_user_id: r.portal_auth_user_id as string,
        })),
      );
      setClientesReservaOpts((cli ?? []) as ClienteReservaOpt[]);
    })();
  }, [open]);

  const resetForm = () => {
    setNomeCompleto(""); setCpfCnpj(""); setEmail(""); setTelefone("");
    setTipoViagem("somente_ida"); setQuemViaja("motorista");
    setIdaEmbarque(""); setIdaDesembarque(""); setIdaData(""); setIdaHora("");
    setIdaPassageiros(""); setIdaCupom(""); setIdaMensagem("");
    setVoltaEmbarque(""); setVoltaDesembarque(""); setVoltaData(""); setVoltaHora("");
    setVoltaPassageiros(""); setVoltaCupom(""); setVoltaMensagem("");
    setPorHoraEnderecoInicio(""); setPorHoraPontoEncerramento(""); setPorHoraData("");
    setPorHoraHora(""); setPorHoraPassageiros(""); setPorHoraQtdHoras("");
    setPorHoraCupom(""); setPorHoraItinerario("");
    setValorBase("0"); setDesconto("0"); setMetodoPagamento(""); setObservacoes("");
    setStatusOperacional("pendente"); setRepasseMotorista("");
    setMotoristaAtribUid("");
    setModoClienteReserva("novo");
    setCadastroClienteIdReserva("");
    setClientSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Você precisa estar logado."); setSaving(false); return; }

    if (modoClienteReserva === "cadastrado" && !cadastroClienteIdReserva.trim()) {
      toast.error("Selecione um cliente cadastrado ou mude para NOVO CLIENTE.");
      setSaving(false);
      return;
    }

    let cadastroClienteIdOut: string | null = null;
    let novoClientePct: number | null = null;

    if (modoClienteReserva === "cadastrado") {
      cadastroClienteIdOut = cadastroClienteIdReserva.trim() || null;
    } else if (reservaEdicao?.id) {
      cadastroClienteIdOut =
        (reservaEdicao as { cadastro_cliente_id?: string | null }).cadastro_cliente_id ?? null;
    } else {
      const digits = cpfCnpj.replace(/\D/g, "");
      const tipoCliente: "pf" | "pj" = digits.length > 11 ? "pj" : "pf";
      const { data: novoCli, error: cliErr } = await supabase
        .from("cadastro_clientes")
        .insert({
          user_id: user.id,
          tipo: tipoCliente,
          nome_exibicao: nomeCompleto.trim(),
          cpf_cnpj: cpfCnpj.trim() || null,
          email: email.trim() || null,
          telefone_1: telefone.trim() || null,
          telefone_2: null,
          enderecos: [],
          documentos: {},
        })
        .select("id,nome_exibicao,cpf_cnpj,email,telefone_1,telefone_2,enderecos,documentos")
        .single();
      if (cliErr || !novoCli) {
        toast.error(cliErr?.message || "Não foi possível criar o cliente no cadastro.");
        setSaving(false);
        return;
      }
      cadastroClienteIdOut = String(novoCli.id);
      novoClientePct = computeClienteProfilePercent({
        nome_exibicao: String(novoCli.nome_exibicao),
        cpf_cnpj: novoCli.cpf_cnpj as string | null,
        email: novoCli.email as string | null,
        telefone_1: novoCli.telefone_1 as string | null,
        telefone_2: novoCli.telefone_2 as string | null,
        enderecos: novoCli.enderecos as Json,
        documentos: novoCli.documentos as Json,
      });
    }

    const rowPayload = {
      nome_completo: nomeCompleto,
      cpf_cnpj: cpfCnpj,
      email,
      telefone,
      tipo_viagem: tipoViagem,
      quem_viaja: quemViaja,
      ida_embarque: idaEmbarque || null,
      ida_desembarque: idaDesembarque || null,
      ida_data: idaData || null,
      ida_hora: idaHora || null,
      ida_passageiros: idaPassageiros ? parseInt(idaPassageiros, 10) : null,
      ida_cupom: idaCupom || null,
      ida_mensagem: idaMensagem || null,
      volta_embarque: voltaEmbarque || null,
      volta_desembarque: voltaDesembarque || null,
      volta_data: voltaData || null,
      volta_hora: voltaHora || null,
      volta_passageiros: voltaPassageiros ? parseInt(voltaPassageiros, 10) : null,
      volta_cupom: voltaCupom || null,
      volta_mensagem: voltaMensagem || null,
      por_hora_endereco_inicio: porHoraEnderecoInicio || null,
      por_hora_ponto_encerramento: porHoraPontoEncerramento || null,
      por_hora_data: porHoraData || null,
      por_hora_hora: porHoraHora || null,
      por_hora_passageiros: porHoraPassageiros ? parseInt(porHoraPassageiros, 10) : null,
      por_hora_qtd_horas: porHoraQtdHoras ? parseInt(porHoraQtdHoras, 10) : null,
      por_hora_cupom: porHoraCupom || null,
      por_hora_itinerario: porHoraItinerario || null,
      valor_base: parseFloat(valorBase) || 0,
      desconto: parseFloat(desconto) || 0,
      valor_total: valorTotalNum,
      metodo_pagamento: metodoPagamento || null,
      observacoes: observacoes || null,
      status: statusOperacional,
      repasse_motorista: (() => {
        const r = parseFloat(String(repasseMotorista).replace(",", "."));
        return Number.isFinite(r) && r > 0 ? r : null;
      })(),
      motorista_id:
        quemViaja === "motorista" && motoristaAtribUid.trim() !== "" ? motoristaAtribUid.trim() : null,
      cadastro_cliente_id: cadastroClienteIdOut,
    };

    const { error } = reservaEdicao?.id
      ? await supabase.from("reservas_transfer").update(rowPayload).eq("id", reservaEdicao.id)
      : await supabase.from("reservas_transfer").insert({ user_id: user.id, ...rowPayload });

    setSaving(false);
    if (error) {
      toast.error(reservaEdicao?.id ? "Erro ao atualizar reserva: " + error.message : "Erro ao criar reserva: " + error.message);
    } else {
      if (novoClientePct != null) {
        toast.success(`Reserva criada. Novo cliente no menu Clientes — perfil ${novoClientePct}% (complete dados quando quiser).`);
      } else {
        toast.success(reservaEdicao?.id ? "Reserva atualizada com sucesso!" : "Reserva criada com sucesso!");
      }
      resetForm();
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservaEdicao ? "Editar reserva" : "Criar Nova Reserva"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {reservaEdicao ? "Altere os campos e guarde as alterações." : "Preencha os dados para criar uma nova reserva manual."}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
            <div className="mb-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <Label className="text-xs text-muted-foreground">Origem do cliente</Label>
              <RadioGroup
                value={modoClienteReserva}
                onValueChange={(v) => {
                  const m = v as "novo" | "cadastrado";
                  setModoClienteReserva(m);
                  if (m === "novo") {
                    setCadastroClienteIdReserva("");
                    setClientSearch("");
                  } else {
                    setClientSearch("");
                  }
                }}
                className="flex flex-wrap gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="cadastrado" id="cli-cad" />
                  Cliente cadastrado
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="novo" id="cli-novo" />
                  NOVO CLIENTE
                </label>
              </RadioGroup>
              {modoClienteReserva === "cadastrado" ? (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs">Buscar e selecionar</Label>
                  <Input
                    placeholder="Digite as primeiras letras do nome…"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="h-9"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
                    {clientesReservaOpts.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente — cadastre no menu Clientes.</p>
                    ) : clientesFiltrados.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Sem resultados.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {clientesFiltrados.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-muted/80",
                                cadastroClienteIdReserva === c.id && "bg-muted font-medium",
                              )}
                              onClick={() => {
                                setCadastroClienteIdReserva(c.id);
                                setNomeCompleto(c.nome_exibicao);
                                setEmail(c.email ?? "");
                                setTelefone(c.telefone_1 ?? "");
                                setCpfCnpj(c.cpf_cnpj ?? "");
                              }}
                            >
                              {c.nome_exibicao}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome Completo *</Label>
                <Input required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ *</Label>
                <Input placeholder="000.000.000-00" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input required value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Detalhes da Viagem */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Detalhes da Viagem</h3>
            <div className="space-y-4">
              <div className="w-1/2 space-y-1.5">
                <Label>Tipo de Viagem *</Label>
                <Select value={tipoViagem} onValueChange={(v) => setTipoViagem(v as TipoViagem)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="somente_ida">Somente Ida</SelectItem>
                    <SelectItem value="ida_volta">Ida e Volta</SelectItem>
                    <SelectItem value="por_hora">Por Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(tipoViagem === "somente_ida" || tipoViagem === "ida_volta") && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">→ Ida</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Local de Embarque (IDA) *</Label><Input placeholder="Digite o endereço..." required value={idaEmbarque} onChange={(e) => setIdaEmbarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Local de Desembarque (IDA) *</Label><Input placeholder="Digite o endereço..." required value={idaDesembarque} onChange={(e) => setIdaDesembarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data do Embarque (IDA) *</Label><Input type="date" required value={idaData} onChange={(e) => setIdaData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={idaHora} onChange={(e) => setIdaHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Número de Passageiros *</Label><Input type="number" min="1" required value={idaPassageiros} onChange={(e) => setIdaPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Cupom</Label><Input value={idaCupom} onChange={(e) => setIdaCupom(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Mensagem / Observações</Label><Textarea value={idaMensagem} onChange={(e) => setIdaMensagem(e.target.value)} /></div>
                </div>
              )}

              {tipoViagem === "ida_volta" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⇆ Volta</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Local de Embarque (Volta)</Label><Input placeholder="Digite o endereço..." value={voltaEmbarque} onChange={(e) => setVoltaEmbarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Local de Desembarque (Volta)</Label><Input placeholder="Digite o endereço..." value={voltaDesembarque} onChange={(e) => setVoltaDesembarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={voltaData} onChange={(e) => setVoltaData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={voltaHora} onChange={(e) => setVoltaHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Passageiros</Label><Input type="number" min="1" value={voltaPassageiros} onChange={(e) => setVoltaPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Cupom</Label><Input value={voltaCupom} onChange={(e) => setVoltaCupom(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Mensagem / Observações</Label><Textarea value={voltaMensagem} onChange={(e) => setVoltaMensagem(e.target.value)} /></div>
                </div>
              )}

              {tipoViagem === "por_hora" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⏱ Por Hora</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Endereço de Início</Label><Input placeholder="Digite o endereço..." value={porHoraEnderecoInicio} onChange={(e) => setPorHoraEnderecoInicio(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Ponto de Encerramento</Label><Input placeholder="Digite o endereço..." value={porHoraPontoEncerramento} onChange={(e) => setPorHoraPontoEncerramento(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={porHoraData} onChange={(e) => setPorHoraData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={porHoraHora} onChange={(e) => setPorHoraHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Passageiros</Label><Input type="number" min="1" value={porHoraPassageiros} onChange={(e) => setPorHoraPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Qtd. Horas</Label><Input type="number" min="1" value={porHoraQtdHoras} onChange={(e) => setPorHoraQtdHoras(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Cupom</Label><Input value={porHoraCupom} onChange={(e) => setPorHoraCupom(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Itinerário / Observações</Label><Textarea value={porHoraItinerario} onChange={(e) => setPorHoraItinerario(e.target.value)} /></div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Veículo e Motorista */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Veículo e Motorista</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Quem fará a viagem? *</Label>
                <Select value={quemViaja} onValueChange={(v) => setQuemViaja(v as QuemViaja)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="eu_mesmo">Eu mesmo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {quemViaja === "motorista" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Motorista da frota *</Label>
                    <Select
                      value={motoristaAtribUid || "__none__"}
                      onValueChange={(v) => setMotoristaAtribUid(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione quem executa a viagem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não atribuir ainda —</SelectItem>
                        {motoristasFrota.map((m) => (
                          <SelectItem key={m.id} value={m.portal_auth_user_id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Só aparecem motoristas com <strong className="text-foreground">portal activo</strong> (definiram senha pelo link). Atribua a reserva para ela surgir na agenda dele.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Valores e Pagamento */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Valores e Pagamento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Valor Base *</Label><Input type="number" min="0" step="0.01" value={valorBase} onChange={(e) => setValorBase(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Método de Pagamento</Label><Input placeholder="Ex: Dinheiro, Cartão, PIX" value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-4 py-2">
              <span className="text-sm font-medium text-primary">Valor Total (a receber do cliente)</span>
              <span className="text-lg font-bold text-foreground">{valorTotalFormatted}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Status da reserva</Label>
                <Select value={statusOperacional} onValueChange={setStatusOperacional}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVA_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Em <strong className="text-foreground">Concluída</strong>, com repasse &gt; 0, gera automaticamente uma{" "}
                  <strong className="text-foreground">despesa</strong> no Financeiro (contas a pagar ao motorista).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Repasse ao motorista (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={repasseMotorista}
                  onChange={(e) => setRepasseMotorista(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Valor a pagar ao motorista após a viagem concluída (margem = total − repasse).</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Observações</h3>
            <Textarea placeholder="Observações adicionais sobre a reserva..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
              {reservaEdicao ? "Guardar alterações" : "Criar Reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
