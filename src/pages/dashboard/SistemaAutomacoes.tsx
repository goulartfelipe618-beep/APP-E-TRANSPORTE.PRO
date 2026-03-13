import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Link2, Copy, ArrowLeft, Sparkles, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Automacao {
  id: string;
  nome: string;
  tipo: string;
  tipoLabel: string;
  webhookEnabled: boolean;
  testes: WebhookTest[];
}

interface WebhookTest {
  id: string;
  payload: Record<string, string>;
  receivedAt: string;
}

const tipoLabels: Record<string, string> = {
  transfer: "Transfer Executivo",
  motorista: "Solicitação Motorista",
  grupo: "Grupos e Excursões",
};

export default function SistemaAutomacoesPage() {
  const [open, setOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [selected, setSelected] = useState<Automacao | null>(null);
  const [selectedTest, setSelectedTest] = useState<WebhookTest | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "seu-projeto";

  const handleCreate = () => {
    if (!novoNome || !novoTipo) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const novo: Automacao = {
      id: crypto.randomUUID(),
      nome: novoNome,
      tipo: novoTipo,
      tipoLabel: tipoLabels[novoTipo] || novoTipo,
      webhookEnabled: false,
      testes: [],
    };
    setAutomacoes((prev) => [...prev, novo]);
    setNovoNome("");
    setNovoTipo("");
    setOpen(false);
    toast.success("Automação criada com sucesso!");
  };

  const toggleWebhook = (id: string) => {
    setAutomacoes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, webhookEnabled: !a.webhookEnabled } : a))
    );
    if (selected) {
      setSelected({ ...selected, webhookEnabled: !selected.webhookEnabled });
    }
  };

  const webhookUrl = selected
    ? `https://${projectId}.supabase.co/functions/v1/webhook-solicitacao?automacao_id=${selected.id}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  // Detail view
  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setSelectedTest(null); setMappings({}); }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground uppercase">{selected.tipoLabel}</h1>
          <p className="text-muted-foreground">Configure o webhook e mapeamento de campos.</p>
        </div>

        {/* Webhook URL card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-primary/10 p-2">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">URL do Webhook:</p>
              <p className="text-xs text-muted-foreground break-all mt-1 font-mono">{webhookUrl}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyUrl} className="shrink-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Webhook {selected.webhookEnabled ? "Ativado" : "Desativado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.webhookEnabled
                    ? "Envios estão sendo processados em tempo real."
                    : "Envios são salvos como testes para configurar o mapeamento."}
                </p>
              </div>
            </div>
            <Switch
              checked={selected.webhookEnabled}
              onCheckedChange={() => toggleWebhook(selected.id)}
            />
          </div>
        </div>

        {/* Bottom two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Testes Recebidos */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Testes Recebidos</h3>
              </div>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {selected.testes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum teste recebido. Desative o webhook e envie uma requisição POST para a URL acima.
              </p>
            ) : (
              <div className="space-y-2">
                {selected.testes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTest(t);
                      // Auto-populate mappings from payload keys
                      const m: Record<string, string> = {};
                      Object.keys(t.payload).forEach((k) => { m[k] = ""; });
                      setMappings(m);
                    }}
                    className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                      selectedTest?.id === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium text-foreground">Teste #{t.id.slice(0, 6)}</p>
                    <p className="text-xs text-muted-foreground">{t.receivedAt}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mapeamento de Campos */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Mapeamento de Campos</h3>
              <Button
                size="sm"
                disabled={!selectedTest}
                onClick={() => toast.success("Mapeamento salvo!")}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
              </Button>
            </div>

            {!selectedTest ? (
              <p className="text-sm text-muted-foreground">
                Selecione um teste recebido para visualizar as variáveis disponíveis e configurar o mapeamento.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(selectedTest.payload).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {`{{${key}}}`} → <span className="text-foreground font-mono">{value}</span>
                    </Label>
                    <Select
                      value={mappings[key] || ""}
                      onValueChange={(v) => setMappings((prev) => ({ ...prev, [key]: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Mapear para campo do sistema..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nome">Nome</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="origem">Origem</SelectItem>
                        <SelectItem value="destino">Destino</SelectItem>
                        <SelectItem value="data">Data</SelectItem>
                        <SelectItem value="horario">Horário</SelectItem>
                        <SelectItem value="passageiros">Passageiros</SelectItem>
                        <SelectItem value="observacoes">Observações</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Gerencie seus webhooks e mapeamentos de campos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Automação</Button>
        </div>
      </div>

      {automacoes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Nenhuma automação cadastrada. Clique em "Nova Automação" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {automacoes.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-card/80"
            >
              <p className="font-semibold text-foreground">{a.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.tipoLabel}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`h-2 w-2 rounded-full ${a.webhookEnabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                <span className="text-xs text-muted-foreground">
                  {a.webhookEnabled ? "Ativo" : "Inativo"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
            <DialogDescription>Dê um nome e selecione o tipo de automação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Automação</Label>
              <Input
                placeholder="Ex: Formulário do site principal"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de Automação</Label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>CATEGORIAS DO SISTEMA</SelectLabel>
                    <SelectItem value="transfer">Transfer Executivo</SelectItem>
                    <SelectItem value="motorista">Solicitação Motorista</SelectItem>
                    <SelectItem value="grupo">Grupos e Excursões</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
