import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, FileText, CreditCard, ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import type { MotoristaInitialData } from "@/lib/motoristaFromSolicitacao";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  fetchIbgeEstados,
  fetchIbgeMunicipiosPorEstadoId,
  findEstadoIdPorSigla,
  type IbgeEstado,
  type IbgeMunicipio,
} from "@/lib/ibgeLocalidades";
import { fetchViaCep } from "@/lib/viaCep";

const CNH_CATEGORIAS = ["A", "ACC", "B", "C", "D", "E", "AB", "AD", "AE"] as const;

const TABS = [
  { label: "Pessoal", icon: User },
  { label: "Documentos", icon: FileText },
  { label: "Pagamento", icon: CreditCard },
];

type MotoristaInsert = Database["public"]["Tables"]["solicitacoes_motoristas"]["Insert"];

function FileRow({
  label,
  required,
  file,
  onFile,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 transition-colors hover:bg-muted">
        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{file ? file.name : "Selecionar (máx. 5MB)"}</span>
        <input
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialData?: MotoristaInitialData | null;
}

export default function CadastrarMotoristaDialog({ open, onOpenChange, onCreated, initialData }: Props) {
  const [tabIndex, setTabIndex] = useState(0);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailField, setEmailField] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estadoUf, setEstadoUf] = useState("");
  const [municipioIbgeId, setMunicipioIbgeId] = useState("");
  const [cep, setCep] = useState("");
  const [cnh, setCnh] = useState("");
  const [categoriaCnh, setCategoriaCnh] = useState("");
  const [validadeCnh, setValidadeCnh] = useState("");
  const [statusMotorista, setStatusMotorista] = useState<"ativo" | "inativo">("ativo");
  const [observacoesInternas, setObservacoesInternas] = useState("");

  const [estadosIbge, setEstadosIbge] = useState<IbgeEstado[]>([]);
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingCidades, setLoadingCidades] = useState(false);

  const [arPerfil, setArPerfil] = useState<File | null>(null);
  const [arCnhF, setArCnhF] = useState<File | null>(null);
  const [arCnhV, setArCnhV] = useState<File | null>(null);
  const [arResid, setArResid] = useState<File | null>(null);

  const [tipoPagamento, setTipoPagamento] = useState("");
  const [pixChave, setPixChave] = useState("");

  const [saving, setSaving] = useState(false);

  const estadoUfRef = useRef(estadoUf);
  estadoUfRef.current = estadoUf;

  const enderecoCompleto = useMemo(() => {
    const parts = [logradouro.trim(), numero.trim(), complemento.trim(), bairro.trim()].filter(Boolean);
    return parts.join(", ");
  }, [logradouro, numero, complemento, bairro]);

  const municipiosFiltrados = useMemo(() => {
    const q = cityFilter.trim().toLowerCase();
    if (q.length < 2) return [];
    const hit = municipios.filter((m) => m.nome.toLowerCase().includes(q));
    if (hit.length <= 250) return hit;
    return hit.slice(0, 250);
  }, [municipios, cityFilter]);

  const resetEmpty = useCallback(() => {
    setNome("");
    setCpf("");
    setRg("");
    setDataNascimento("");
    setTelefone("");
    setEmailField("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstadoUf("");
    setMunicipioIbgeId("");
    setCep("");
    setCnh("");
    setCategoriaCnh("");
    setValidadeCnh("");
    setStatusMotorista("ativo");
    setObservacoesInternas("");
    setCityFilter("");
    setMunicipios([]);
    setArPerfil(null);
    setArCnhF(null);
    setArCnhV(null);
    setArResid(null);
    setTipoPagamento("");
    setPixChave("");
    setTabIndex(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoadingEstados(true);
      try {
        const list = await fetchIbgeEstados();
        if (!cancelled) setEstadosIbge(list);
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar estados (IBGE). Verifique a rede.");
      } finally {
        if (!cancelled) setLoadingEstados(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !estadoUf || estadosIbge.length === 0) {
      if (!estadoUf) setMunicipios([]);
      return;
    }
    const estadoId = findEstadoIdPorSigla(estadosIbge, estadoUf);
    if (estadoId == null) return;

    let cancelled = false;
    setLoadingCidades(true);
    void (async () => {
      try {
        const list = await fetchIbgeMunicipiosPorEstadoId(estadoId);
        if (!cancelled) setMunicipios(list);
      } catch {
        if (!cancelled) {
          toast.error("Não foi possível carregar cidades (IBGE).");
          setMunicipios([]);
        }
      } finally {
        if (!cancelled) setLoadingCidades(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, estadoUf, estadosIbge]);

  useEffect(() => {
    if (!open || !initialData || municipios.length === 0 || municipioIbgeId) return;
    const target = (initialData.cidade || "").trim().toLowerCase();
    if (!target) return;
    const exact = municipios.find((m) => m.nome.toLowerCase() === target);
    const loose = exact ?? municipios.find((m) => m.nome.toLowerCase().includes(target));
    if (loose) {
      setMunicipioIbgeId(String(loose.id));
      setCidade(loose.nome);
    }
  }, [open, initialData, municipios, municipioIbgeId]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const dw = parseDadosWebhook(initialData.dados_webhook);
      setNome(initialData.nome || "");
      setCpf(initialData.cpf || "");
      setTelefone(initialData.telefone || "");
      setEmailField(initialData.email || "");
      setCnh(initialData.cnh || "");
      setEstadoUf((initialData.estado || "").toUpperCase().slice(0, 2));
      setObservacoesInternas(initialData.mensagem_observacoes || "");
      setRg(pickStr(dw, "rg"));
      setDataNascimento(pickStr(dw, "data_nascimento").slice(0, 10));
      setCep(pickStr(dw, "cep"));
      setCategoriaCnh(pickStr(dw, "categoria_cnh", "categoria"));
      setLogradouro(pickStr(dw, "logradouro", "endereco", "_endereco"));
      setNumero(pickStr(dw, "numero"));
      setComplemento(pickStr(dw, "complemento"));
      setBairro(pickStr(dw, "bairro"));
      const sid = pickStr(dw, "ibge_municipio_id");
      if (sid && /^\d+$/.test(sid)) setMunicipioIbgeId(sid);
      const sit = pickStr(dw, "situacao_frota");
      if (sit === "inativo") setStatusMotorista("inativo");
      else if (sit === "ativo") setStatusMotorista("ativo");
      setTabIndex(0);
      toast.message("Revise os dados (UF → cidade IBGE) e complete o cadastro antes de salvar.", { duration: 5000 });
    } else {
      resetEmpty();
    }
  }, [open, initialData, resetEmpty]);

  const validateTab0 = (): string | null => {
    if (!nome.trim()) return "Informe o nome completo.";
    if (!cpf.trim()) return "Informe o CPF.";
    if (!telefone.trim()) return "Informe o telefone.";
    if (!emailField.trim()) return "Informe o e-mail.";
    if (!dataNascimento) return "Informe a data de nascimento.";
    if (!rg.trim()) return "Informe o RG.";
    if (!estadoUf) return "Selecione o estado (UF) na lista IBGE.";
    if (!municipioIbgeId) return "Selecione a cidade (filtrar por nome, mín. 2 letras).";
    if (!cidade.trim()) return "Cidade inválida — selecione novamente na lista.";
    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return "Informe um CEP válido (8 dígitos).";
    if (!logradouro.trim()) return "Informe o logradouro (rua/avenida).";
    if (!numero.trim()) return "Informe o número.";
    if (!bairro.trim()) return "Informe o bairro.";
    if (!cnh.trim()) return "Informe o número da CNH.";
    if (!categoriaCnh) return "Selecione a categoria da CNH.";
    if (!validadeCnh) return "Informe a validade da CNH.";
    if (!statusMotorista) return "Selecione o status (ativo ou inativo).";
    return null;
  };

  const validateTab1 = (): string | null => {
    if (!arPerfil || !arCnhF || !arCnhV || !arResid) {
      return "Anexe foto de perfil, CNH (frente e verso) e comprovante de residência.";
    }
    return null;
  };

  const validateTab2 = (): string | null => {
    if (!tipoPagamento) return "Selecione o tipo de pagamento.";
    if (tipoPagamento === "pix" && !pixChave.trim()) return "Informe a chave PIX.";
    return null;
  };

  const validateAll = (): string | null => validateTab0() ?? validateTab1() ?? validateTab2();

  const goNext = () => {
    if (tabIndex === 0) {
      const e = validateTab0();
      if (e) {
        toast.error(e);
        return;
      }
    }
    if (tabIndex === 1) {
      const e = validateTab1();
      if (e) {
        toast.error(e);
        return;
      }
    }
    if (tabIndex === 2) {
      const e = validateTab2();
      if (e) {
        toast.error(e);
        return;
      }
    }
    setTabIndex((t) => Math.min(t + 1, TABS.length - 1));
  };

  const handleCepBlur = async () => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const j = await fetchViaCep(digits);
    if (!j) return;
    if (j.uf && estadoUfRef.current && j.uf !== estadoUfRef.current) {
      toast.message("O CEP pertence a outro UF. Ajuste o estado ou o CEP.", { duration: 6000 });
    }
    if (j.logradouro) setLogradouro((prev) => (prev.trim() ? prev : j.logradouro ?? ""));
    if (j.bairro) setBairro((prev) => (prev.trim() ? prev : j.bairro ?? ""));
    if (j.complemento) setComplemento((prev) => (prev.trim() ? prev : j.complemento ?? ""));
  };

  const handleSave = async () => {
    const err = validateAll();
    if (err) {
      toast.error(err);
      if (validateTab0()) setTabIndex(0);
      else if (validateTab1()) setTabIndex(1);
      else setTabIndex(2);
      return;
    }
    setSaving(true);

    const ibgeIdNum = Number(municipioIbgeId);
    const dadosWebhookObj = {
      rg,
      data_nascimento: dataNascimento || null,
      endereco: enderecoCompleto || null,
      logradouro: logradouro.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cep: cep.replace(/\D/g, "") || null,
      categoria_cnh: categoriaCnh || null,
      validade_cnh: validadeCnh || null,
      tipo_pagamento: tipoPagamento || null,
      pix_chave: tipoPagamento === "pix" ? pixChave.trim() || null : null,
      observacoes_internas: observacoesInternas || null,
      situacao_frota: statusMotorista,
      ibge_municipio_id: Number.isFinite(ibgeIdNum) ? ibgeIdNum : null,
    };

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      toast.error("Sessão inválida. Faça login novamente.");
      setSaving(false);
      return;
    }

    const row: MotoristaInsert = {
      user_id: user.id,
      nome: nome.trim(),
      cpf: cpf.replace(/\D/g, "") || null,
      cnh: cnh.trim() || null,
      telefone: telefone.trim() || null,
      email: emailField.trim() || null,
      cidade: cidade.trim(),
      estado: estadoUf,
      mensagem: observacoesInternas.trim() || null,
      mensagem_observacoes: observacoesInternas.trim() || null,
      dados_webhook: dadosWebhookObj as unknown as Json,
      status: "cadastrado",
    };

    const { error } = await supabase.from("solicitacoes_motoristas").insert(row);
    if (error) {
      toast.error(`Erro ao salvar cadastro: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Motorista salvo e disponível na sua lista.");
    setSaving(false);
    onOpenChange(false);
    onCreated?.();
  };

  const isLast = tabIndex === TABS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Completar cadastro a partir da solicitação" : "Cadastrar motorista"}</DialogTitle>
        </DialogHeader>

        {initialData && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Confirme <strong>UF</strong> e <strong>cidade (IBGE)</strong> antes de gravar. O registo fica associado à sua conta e visível só para si.
          </p>
        )}

        <div className="flex items-center overflow-hidden rounded-lg border border-border">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const active = i === tabIndex;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setTabIndex(i)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {tabIndex === 0 && (
          <div className="space-y-4">
            <fieldset className="space-y-4">
              <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">Dados básicos</legend>
              <div>
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CPF *</Label>
                  <Input className="mt-1" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </div>
                <div>
                  <Label>RG *</Label>
                  <Input className="mt-1" value={rg} onChange={(e) => setRg(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de nascimento *</Label>
                  <Input className="mt-1" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input className="mt-1" placeholder="(11) 99999-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input className="mt-1" type="email" value={emailField} onChange={(e) => setEmailField(e.target.value)} />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">
                Endereço (IBGE + ViaCEP)
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Estado (UF) *</Label>
                  <Select
                    value={estadoUf || undefined}
                    disabled={loadingEstados || estadosIbge.length === 0}
                    onValueChange={(uf) => {
                      setEstadoUf(uf);
                      setMunicipioIbgeId("");
                      setCidade("");
                      setCityFilter("");
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={loadingEstados ? "A carregar IBGE…" : "Selecione o estado"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(280px,50vh)]">
                      {estadosIbge.map((e) => (
                        <SelectItem key={e.id} value={e.sigla}>
                          {e.nome} ({e.sigla})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Fonte: API de localidades do IBGE.</p>
                </div>

                <div className="sm:col-span-2">
                  <Label>Filtrar cidade *</Label>
                  <Input
                    className="mt-1"
                    placeholder="Digite ao menos 2 letras (ex.: cam)"
                    value={cityFilter}
                    disabled={!estadoUf || loadingCidades}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setMunicipioIbgeId("");
                      setCidade("");
                    }}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Cidade (município IBGE) *</Label>
                  <Select
                    value={municipioIbgeId || undefined}
                    disabled={!estadoUf || loadingCidades || municipiosFiltrados.length === 0}
                    onValueChange={(id) => {
                      setMunicipioIbgeId(id);
                      const m = municipios.find((x) => String(x.id) === id);
                      setCidade(m?.nome ?? "");
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue
                        placeholder={
                          !estadoUf
                            ? "Selecione primeiro o estado"
                            : loadingCidades
                              ? "A carregar municípios…"
                              : cityFilter.trim().length < 2
                                ? "Digite 2+ letras para listar cidades"
                                : "Selecione a cidade"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(280px,50vh)]">
                      {municipiosFiltrados.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cityFilter.trim().length >= 2 && municipiosFiltrados.length === 250 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Lista limitada a 250 resultados — refine o filtro se não encontrar a cidade.
                    </p>
                  )}
                </div>

                <div>
                  <Label>CEP *</Label>
                  <Input
                    className="mt-1"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    onBlur={() => void handleCepBlur()}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">ViaCEP preenche rua e bairro quando possível.</p>
                </div>
                <div className="sm:col-span-2">
                  <Label>Logradouro (rua/avenida) *</Label>
                  <Input className="mt-1" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input className="mt-1" value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input className="mt-1" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Bairro *</Label>
                  <Input className="mt-1" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">CNH</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Número da CNH *</Label>
                  <Input className="mt-1" value={cnh} onChange={(e) => setCnh(e.target.value)} />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={categoriaCnh || undefined} onValueChange={setCategoriaCnh}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CNH_CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validade *</Label>
                  <Input className="mt-1" type="date" value={validadeCnh} onChange={(e) => setValidadeCnh(e.target.value)} />
                </div>
              </div>
            </fieldset>

            <div>
              <Label>Situação na frota *</Label>
              <Select value={statusMotorista} onValueChange={(v) => setStatusMotorista(v as "ativo" | "inativo")}>
                <SelectTrigger className="mt-1 w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Não confundir com o estado do pré-cadastro na plataforma: aqui é só controle da sua frota (guardado em dados
                extra).
              </p>
            </div>

            <div>
              <Label>Observações (internas / solicitação)</Label>
              <Textarea
                className="mt-1"
                placeholder="Observações vindas do lead ou anotações internas..."
                value={observacoesInternas}
                onChange={(e) => setObservacoesInternas(e.target.value)}
              />
            </div>
          </div>
        )}

        {tabIndex === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie os quatro ficheiros abaixo (obrigatório para concluir o cadastro).
            </p>
            <FileRow label="Foto de perfil" required file={arPerfil} onFile={setArPerfil} />
            <FileRow label="CNH — frente" required file={arCnhF} onFile={setArCnhF} />
            <FileRow label="CNH — verso" required file={arCnhV} onFile={setArCnhV} />
            <FileRow label="Comprovante de residência" required file={arResid} onFile={setArResid} />
          </div>
        )}

        {tabIndex === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Dados para repasse *</p>
            <div>
              <Label>Tipo de pagamento *</Label>
              <Select value={tipoPagamento || undefined} onValueChange={setTipoPagamento}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="conta">Conta bancária</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoPagamento === "pix" && (
              <div>
                <Label>Chave PIX *</Label>
                <Input
                  className="mt-1"
                  value={pixChave}
                  onChange={(e) => setPixChave(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou aleatória"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          {tabIndex > 0 ? (
            <Button type="button" variant="outline" onClick={() => setTabIndex((t) => t - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
          ) : (
            <div />
          )}
          {isLast ? (
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar motorista"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              Próximo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
