import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, FileText, CreditCard, Car, ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import type { MotoristaInitialData } from "@/lib/motoristaFromSolicitacao";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const TABS = [
  { label: "Pessoal", icon: User },
  { label: "Documentos", icon: FileText },
  { label: "Pagamento", icon: CreditCard },
  { label: "Veículo", icon: Car },
];

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

function normPossuiVeiculo(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (s === "não" || s === "nao" || s === "n" || s === "false" || s === "0") return false;
  return true;
}

export default function CadastrarMotoristaDialog({ open, onOpenChange, onCreated, initialData }: Props) {
  const [tabIndex, setTabIndex] = useState(0);
  const [possuiVeiculo, setPossuiVeiculo] = useState(true);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailField, setEmailField] = useState("");
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [cidade, setCidade] = useState("");
  const [estadoUf, setEstadoUf] = useState("");
  const [cep, setCep] = useState("");
  const [cnh, setCnh] = useState("");
  const [categoriaCnh, setCategoriaCnh] = useState("");
  const [validadeCnh, setValidadeCnh] = useState("");
  const [statusMotorista, setStatusMotorista] = useState("ativo");
  const [observacoesInternas, setObservacoesInternas] = useState("");

  const [arPerfil, setArPerfil] = useState<File | null>(null);
  const [arCnhF, setArCnhF] = useState<File | null>(null);
  const [arCnhV, setArCnhV] = useState<File | null>(null);
  const [arResid, setArResid] = useState<File | null>(null);
  const [arCrlv, setArCrlv] = useState<File | null>(null);
  const [arSeguro, setArSeguro] = useState<File | null>(null);

  const [tipoPagamento, setTipoPagamento] = useState("");
  const [pixChave, setPixChave] = useState("");

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [placa, setPlaca] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [statusVeiculo, setStatusVeiculo] = useState("ativo");
  const [obsVeiculo, setObsVeiculo] = useState("");

  const resetEmpty = useCallback(() => {
    setNome("");
    setCpf("");
    setRg("");
    setDataNascimento("");
    setTelefone("");
    setEmailField("");
    setEnderecoCompleto("");
    setCidade("");
    setEstadoUf("");
    setCep("");
    setCnh("");
    setCategoriaCnh("");
    setValidadeCnh("");
    setStatusMotorista("ativo");
    setObservacoesInternas("");
    setArPerfil(null);
    setArCnhF(null);
    setArCnhV(null);
    setArResid(null);
    setArCrlv(null);
    setArSeguro(null);
    setTipoPagamento("");
    setPixChave("");
    setMarca("");
    setModelo("");
    setAno("");
    setCor("");
    setPlaca("");
    setCombustivel("");
    setRenavam("");
    setChassi("");
    setStatusVeiculo("ativo");
    setObsVeiculo("");
    setPossuiVeiculo(true);
    setTabIndex(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const dw = parseDadosWebhook(initialData.dados_webhook);
      setNome(initialData.nome || "");
      setCpf(initialData.cpf || "");
      setTelefone(initialData.telefone || "");
      setEmailField(initialData.email || "");
      setCnh(initialData.cnh || "");
      setCidade(initialData.cidade || "");
      setEstadoUf((initialData.estado || "").toUpperCase().slice(0, 2));
      setObservacoesInternas(initialData.mensagem_observacoes || "");
      setRg(pickStr(dw, "rg"));
      setDataNascimento(pickStr(dw, "data_nascimento").slice(0, 10));
      setEnderecoCompleto(pickStr(dw, "endereco", "_endereco"));
      setCep(pickStr(dw, "cep"));
      setCategoriaCnh(pickStr(dw, "categoria_cnh", "categoria"));
      const pv = pickStr(dw, "possui_veiculo", "_possui_veiculo");
      setPossuiVeiculo(normPossuiVeiculo(pv));
      setMarca(pickStr(dw, "marca_veiculo", "marca"));
      setModelo(pickStr(dw, "modelo_veiculo", "modelo"));
      setAno(pickStr(dw, "ano_veiculo", "ano"));
      setPlaca(pickStr(dw, "placa_veiculo", "placa"));
      setObsVeiculo(pickStr(dw, "experiencia", "_experiencia"));
      setTabIndex(0);
      toast.message("Revise e complete todos os campos obrigatórios antes de salvar.", { duration: 5000 });
    } else {
      resetEmpty();
    }
  }, [open, initialData, resetEmpty]);

  const strict = !!initialData;

  const validateTab0 = (): string | null => {
    if (!nome.trim()) return "Informe o nome completo.";
    if (!cpf.trim()) return "Informe o CPF.";
    if (!telefone.trim()) return "Informe o telefone.";
    if (!strict) return null;
    if (!emailField.trim()) return "Informe o e-mail.";
    if (!dataNascimento) return "Informe a data de nascimento.";
    if (!rg.trim()) return "Informe o RG.";
    if (!enderecoCompleto.trim()) return "Informe o endereço completo.";
    if (!cidade.trim()) return "Informe a cidade.";
    if (!estadoUf) return "Selecione o estado (UF).";
    if (!cep.trim()) return "Informe o CEP.";
    if (!cnh.trim()) return "Informe o número da CNH.";
    if (!categoriaCnh) return "Selecione a categoria da CNH.";
    if (!validadeCnh) return "Informe a validade da CNH.";
    return null;
  };

  const validateTab1 = (): string | null => {
    if (!strict) return null;
    if (!arPerfil || !arCnhF || !arCnhV || !arResid) {
      return "Anexe foto de perfil, CNH (frente e verso) e comprovante de residência.";
    }
    return null;
  };

  const validateTab2 = (): string | null => {
    if (!strict) return null;
    if (!tipoPagamento) return "Selecione o tipo de pagamento.";
    if (tipoPagamento === "pix" && !pixChave.trim()) return "Informe a chave PIX.";
    return null;
  };

  const validateTab3 = (): string | null => {
    if (!possuiVeiculo) return null;
    if (!marca.trim()) return "Informe a marca do veículo.";
    if (!modelo.trim()) return "Informe o modelo do veículo.";
    if (!ano.trim()) return "Informe o ano do veículo.";
    if (!placa.trim()) return "Informe a placa do veículo.";
    if (!combustivel) return "Selecione o combustível.";
    if (strict && (!arCrlv || !arSeguro)) return "Anexe CRLV e seguro do veículo.";
    return null;
  };

  const validateAll = (): string | null =>
    validateTab0() ?? validateTab1() ?? validateTab2() ?? validateTab3();

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

  const handleSave = () => {
    const err = validateAll();
    if (err) {
      toast.error(err);
      if (validateTab0()) setTabIndex(0);
      else if (validateTab1()) setTabIndex(1);
      else if (validateTab2()) setTabIndex(2);
      else setTabIndex(3);
      return;
    }
    // Persistência em motoristas/veículos: ainda não implementada no backend deste fluxo
    toast.success("Validação OK. Cadastro completo será persistido quando a API de motoristas estiver ligada.");
    onOpenChange(false);
    onCreated?.();
  };

  const isLast = tabIndex === TABS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Converter solicitação — cadastro completo" : "Cadastrar Motorista"}</DialogTitle>
        </DialogHeader>

        {strict && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Preencha <strong>todos</strong> os dados do motorista e do veículo (quando aplicável). Não é possível salvar com campos obrigatórios vazios.
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
              <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">Endereço</legend>
              <div>
                <Label>Endereço completo *</Label>
                <Input
                  className="mt-1"
                  placeholder="Rua, número, complemento, bairro"
                  value={enderecoCompleto}
                  onChange={(e) => setEnderecoCompleto(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Cidade *</Label>
                  <Input className="mt-1" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF) *</Label>
                  <Select value={estadoUf || undefined} onValueChange={setEstadoUf}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CEP *</Label>
                  <Input className="mt-1" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">CNH</legend>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Número da CNH *</Label>
                  <Input className="mt-1" value={cnh} onChange={(e) => setCnh(e.target.value)} />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={categoriaCnh || undefined} onValueChange={setCategoriaCnh}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Cat." />
                    </SelectTrigger>
                    <SelectContent>
                      {(["A", "B", "C", "D", "E", "AB"] as const).map((c) => (
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
              <Label>Status</Label>
              <Select value={statusMotorista} onValueChange={setStatusMotorista}>
                <SelectTrigger className="mt-1 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações (solicitação / internas)</Label>
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
              {strict
                ? "Envio obrigatório dos quatro arquivos abaixo para concluir a conversão."
                : "Anexe documentos (opcional neste fluxo)."}
            </p>
            <FileRow label="Foto de perfil" required={strict} file={arPerfil} onFile={setArPerfil} />
            <FileRow label="CNH — frente" required={strict} file={arCnhF} onFile={setArCnhF} />
            <FileRow label="CNH — verso" required={strict} file={arCnhV} onFile={setArCnhV} />
            <FileRow label="Comprovante de residência" required={strict} file={arResid} onFile={setArResid} />
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
                <Input className="mt-1" value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
              </div>
            )}
          </div>
        )}

        {tabIndex === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={possuiVeiculo} onCheckedChange={setPossuiVeiculo} id="pv" />
              <label htmlFor="pv" className="text-sm text-foreground">
                Este motorista possui veículo próprio
              </label>
            </div>

            {possuiVeiculo && (
              <>
                <fieldset className="space-y-4">
                  <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">Dados do veículo</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Marca *</Label>
                      <Input className="mt-1" value={marca} onChange={(e) => setMarca(e.target.value)} />
                    </div>
                    <div>
                      <Label>Modelo *</Label>
                      <Input className="mt-1" value={modelo} onChange={(e) => setModelo(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Ano *</Label>
                      <Input className="mt-1" value={ano} onChange={(e) => setAno(e.target.value)} />
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <Input className="mt-1" value={cor} onChange={(e) => setCor(e.target.value)} />
                    </div>
                    <div>
                      <Label>Placa *</Label>
                      <Input className="mt-1" value={placa} onChange={(e) => setPlaca(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Combustível *</Label>
                      <Select value={combustivel || undefined} onValueChange={setCombustivel}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flex">Flex</SelectItem>
                          <SelectItem value="gasolina">Gasolina</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="eletrico">Elétrico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>RENAVAM</Label>
                      <Input className="mt-1" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
                    </div>
                    <div>
                      <Label>Chassi</Label>
                      <Input className="mt-1" value={chassi} onChange={(e) => setChassi(e.target.value)} />
                    </div>
                  </div>
                </fieldset>

                <div>
                  <Label>Status do veículo</Label>
                  <Select value={statusVeiculo} onValueChange={setStatusVeiculo}>
                    <SelectTrigger className="mt-1 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <fieldset className="space-y-4">
                  <legend className="w-full border-b border-border pb-2 text-sm font-semibold text-foreground">Documentos do veículo</legend>
                  <FileRow label="CRLV" required={strict} file={arCrlv} onFile={setArCrlv} />
                  <FileRow label="Seguro" required={strict} file={arSeguro} onFile={setArSeguro} />
                </fieldset>

                <div>
                  <Label>Observações do veículo</Label>
                  <Textarea className="mt-1" placeholder="Anotações sobre o veículo..." value={obsVeiculo} onChange={(e) => setObsVeiculo(e.target.value)} />
                </div>
              </>
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
            <Button type="button" onClick={handleSave}>
              Salvar motorista
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
