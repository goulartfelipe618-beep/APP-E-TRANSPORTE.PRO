import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Link2, Copy, ArrowLeft, Sparkles, Save, Code2, Trash2, FlaskConical, Eye, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FerramentasDevDialog from "@/components/automacoes/FerramentasDevDialog";

interface Automacao {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  mappings: Record<string, Record<string, string>>;
  created_at: string;
}

interface WebhookTeste {
  id: string;
  automacao_id: string;
  payload: Record<string, any>;
  created_at: string;
}

const tipoLabels: Record<string, string> = {
  transfer: "Transfer Executivo",
  motorista: "Solicitação Motorista",
  grupo: "Solicitação de Grupo",
};

// Fallback fields (used if DB config not loaded yet)
const fallbackFields: Record<string, Record<string, string[]>> = {};

function useCamposConfig() {
  const [camposConfig, setCamposConfig] = useState<Record<string, Record<string, string[]>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("automacoes_campos_config" as any)
        .select("*") as any;
      if (!error && data) {
        const config: Record<string, Record<string, string[]>> = {};
        for (const row of data) {
          if (!config[row.categoria]) config[row.categoria] = {};
          config[row.categoria][row.subcategoria] = Array.isArray(row.campos) ? row.campos : [];
        }
        setCamposConfig(config);
      }
      setLoaded(true);
    })();
  }, []);

  const getFields = (categoria: string, subcategoria: string): string[] => {
    return camposConfig[categoria]?.[subcategoria] || [];
  };

  return { camposConfig, getFields, loaded };
}

// Extracts all leaf keys from a nested object as dot-notation paths
function extractPayloadKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...extractPayloadKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function resolveValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function FieldMappingList({
  fields,
  mappings,
  onUpdate,
  availableVars,
  testPayload,
}: {
  fields: string[];
  mappings: Record<string, string>;
  onUpdate: (field: string, value: string) => void;
  availableVars: string[];
  testPayload: Record<string, any> | null;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {fields.map((field) => (
        <div key={field} className="space-y-1">
          <Label className="text-sm font-medium text-foreground">{field}</Label>
          {availableVars.length > 0 ? (
            <Select value={mappings[field] || ""} onValueChange={(val) => onUpdate(field, val === "__clear__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a variável..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear__">— Nenhuma —</SelectItem>
                {availableVars.map((v) => (
                  <SelectItem key={v} value={v}>
                    <span className="font-mono text-xs">{v}</span>
                    {testPayload && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        = {String(resolveValue(testPayload, v) ?? "").substring(0, 40)}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Receba um teste primeiro para selecionar variáveis"
              value={mappings[field] || ""}
              onChange={(e) => onUpdate(field, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function SistemaAutomacoesPage() {
  const { getFields, loaded: camposLoaded } = useCamposConfig();
  const [open, setOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [selected, setSelected] = useState<Automacao | null>(null);
  const [mappings, setMappings] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [testes, setTestes] = useState<WebhookTeste[]>([]);
  const [selectedTeste, setSelectedTeste] = useState<WebhookTeste | null>(null);
  // Per-container test selection for Transfer mapping
  const [containerTestes, setContainerTestes] = useState<Record<string, string>>({});
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "seu-projeto";

  const fetchAutomacoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automacoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar automações");
    else setAutomacoes((data || []).map((a: any) => ({
      ...a,
      mappings: typeof a.mappings === "object" ? a.mappings : {},
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAutomacoes(); }, [fetchAutomacoes]);

  const fetchTestes = useCallback(async (automacaoId: string) => {
    const { data, error } = await supabase
      .from("webhook_testes")
      .select("*")
      .eq("automacao_id", automacaoId)
      .order("created_at", { ascending: false });
    if (!error) setTestes((data || []) as WebhookTeste[]);
  }, []);

  const deleteTeste = async (id: string) => {
    await supabase.from("webhook_testes").delete().eq("id", id);
    setTestes((prev) => prev.filter((t) => t.id !== id));
    if (selectedTeste?.id === id) setSelectedTeste(null);
    toast.success("Teste removido");
  };

  const clearAllTestes = async (automacaoId: string) => {
    await supabase.from("webhook_testes").delete().eq("automacao_id", automacaoId);
    setTestes([]);
    setSelectedTeste(null);
    toast.success("Todos os testes removidos");
  };

  const handleCreate = async () => {
    if (!novoNome || !novoTipo) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não logado"); return; }

    const { error } = await supabase.from("automacoes").insert({
      user_id: user.id,
      nome: novoNome,
      tipo: novoTipo,
      ativo: false,
      mappings: {},
    });

    if (error) toast.error("Erro ao criar: " + error.message);
    else {
      toast.success("Automação criada com sucesso!");
      setNovoNome("");
      setNovoTipo("");
      setOpen(false);
      fetchAutomacoes();
    }
  };

  const toggleWebhook = async (automacao: Automacao) => {
    const newAtivo = !automacao.ativo;
    const { error } = await supabase
      .from("automacoes")
      .update({ ativo: newAtivo, updated_at: new Date().toISOString() })
      .eq("id", automacao.id);
    if (error) toast.error("Erro ao atualizar");
    else {
      toast.success(newAtivo ? "Webhook ativado!" : "Webhook desativado!");
      setAutomacoes((prev) => prev.map((a) => a.id === automacao.id ? { ...a, ativo: newAtivo } : a));
      if (selected?.id === automacao.id) setSelected({ ...selected, ativo: newAtivo });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("automacoes").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Automação excluída"); fetchAutomacoes(); }
  };

  const getWebhookUrl = (id: string) =>
    `https://${projectId}.supabase.co/functions/v1/webhook-solicitacao?automacao_id=${id}`;

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(getWebhookUrl(id));
    toast.success("URL copiada!");
  };

  const updateMapping = (tab: string, field: string, value: string) => {
    setMappings((prev) => ({
      ...prev,
      [tab]: { ...(prev[tab] || {}), [field]: value },
    }));
  };

  const handleSaveMappings = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("automacoes")
      .update({ mappings: mappings as any, updated_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Mapeamento salvo com sucesso!");
      // Update local state
      setAutomacoes((prev) => prev.map((a) => a.id === selected.id ? { ...a, mappings } : a));
      setSelected({ ...selected, mappings });
    }
  };

  const handleTestSubmit = (payload: Record<string, string>) => {
    if (!selected) return;
    toast.success("Teste enviado! Verifique as Solicitações correspondentes.");
  };

  // Detail view
  if (selected) {
    const isTransfer = selected.tipo === "transfer";
    const webhookUrl = getWebhookUrl(selected.id);

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setMappings({}); setTestes([]); setSelectedTeste(null); setContainerTestes({}); }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground uppercase">{tipoLabels[selected.tipo] || selected.tipo}</h1>
            <p className="text-muted-foreground">Configure o webhook e mapeamento de campos.</p>
          </div>
          <Button variant="outline" onClick={() => setDevToolsOpen(true)}>
            <Code2 className="h-4 w-4 mr-2" /> Ferramentas do Desenvolvedor
          </Button>
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
            <Button variant="outline" size="sm" onClick={() => copyUrl(selected.id)} className="shrink-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${selected.ativo ? "bg-green-500/10" : "bg-muted"}`}>
                <RefreshCw className={`h-4 w-4 ${selected.ativo ? "text-green-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selected.ativo ? "🟢 Webhook Ativado — Modo Produção" : "🔴 Webhook Desativado — Modo Teste"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.ativo
                    ? `Dados recebidos serão encaminhados automaticamente para o menu Solicitações de ${tipoLabels[selected.tipo] || selected.tipo}. Testes NÃO serão armazenados.`
                    : "Envie um POST para a URL acima para receber testes. Configure o mapeamento antes de ativar."}
                </p>
              </div>
            </div>
            <Switch
              checked={selected.ativo}
              onCheckedChange={() => toggleWebhook(selected)}
            />
          </div>
        </div>

        {/* When ACTIVE: show message that data goes to Solicitações */}
        {selected.ativo && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center space-y-2">
            <Sparkles className="h-8 w-8 text-green-500 mx-auto" />
            <h3 className="font-semibold text-foreground">Webhook em Produção</h3>
            <p className="text-sm text-muted-foreground">
              Todos os dados recebidos via webhook estão sendo encaminhados automaticamente para o menu <strong>Solicitações → {tipoLabels[selected.tipo]}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Para receber testes novamente, desative o webhook acima.
            </p>
          </div>
        )}

        {/* Side-by-side: Testes (left) + Mapeamento (right) when disabled */}
        <div className={!selected.ativo ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
          {!selected.ativo && (
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Testes Recebidos</h3>
                  <Badge variant="secondary">{testes.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchTestes(selected.id)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
                  </Button>
                  {testes.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => clearAllTestes(selected.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[65vh] space-y-3">
                {testes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum teste recebido. Envie um POST para a URL do webhook enquanto desativado.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      {testes.map((t, idx) => (
                        <Button
                          key={t.id}
                          variant={selectedTeste?.id === t.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTeste(selectedTeste?.id === t.id ? null : t)}
                          className="justify-start gap-2 w-full"
                        >
                          <Eye className="h-3 w-3 shrink-0" />
                          <span>Teste {testes.length - idx}</span>
                          <span className="text-xs opacity-70 ml-auto">
                            {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </Button>
                      ))}
                    </div>
                    {selectedTeste && (
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            Recebido em {new Date(selectedTeste.created_at).toLocaleString("pt-BR")}
                          </p>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(selectedTeste.payload, null, 2));
                              toast.success("JSON copiado!");
                            }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTeste(selectedTeste.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTeste(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Variáveis recebidas:</p>
                        <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                          {extractPayloadKeys(selectedTeste.payload).map((key) => (
                            <div key={key} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                              <span className="font-mono font-semibold text-primary">{key}</span>
                              <span className="text-muted-foreground">=</span>
                              <span className="text-foreground max-w-[120px] truncate">{String(resolveValue(selectedTeste.payload, key) ?? "")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mapeamento de Campos - only when disabled */}
          {!selected.ativo && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Mapeamento de Campos</h3>
                <Button size="sm" onClick={handleSaveMappings}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
                </Button>
              </div>
              {isTransfer ? (
                <div className="space-y-6">
                  {([
                    { key: "somente_ida", label: "Somente Ida" },
                    { key: "ida_volta", label: "Ida e Volta" },
                    { key: "por_hora", label: "Por Hora" },
                  ] as const).map(({ key, label }) => {
                    const selectedTesteForContainer = testes.find(t => t.id === containerTestes[key]) || null;
                    const availableVars = selectedTesteForContainer ? extractPayloadKeys(selectedTesteForContainer.payload) : [];
                    return (
                      <div key={key} className="rounded-lg border border-border bg-muted/10 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground uppercase">{label}</h4>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Qual teste usar de referência?</Label>
                          <Select
                            value={containerTestes[key] || ""}
                            onValueChange={(val) => setContainerTestes(prev => ({ ...prev, [key]: val === "__none__" ? "" : val }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um teste..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Nenhum —</SelectItem>
                              {testes.map((t, idx) => (
                                <SelectItem key={t.id} value={t.id}>
                                  Teste {testes.length - idx} — {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <FieldMappingList
                          fields={getFields("transfer", key)}
                          mappings={mappings[key] || {}}
                          onUpdate={(f, v) => updateMapping(key, f, v)}
                          availableVars={availableVars}
                          testPayload={selectedTesteForContainer?.payload || null}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : selected.tipo === "grupo" ? (
                <FieldMappingList fields={getFields("grupo", "default")} mappings={mappings["default"] || {}} onUpdate={(f, v) => updateMapping("default", f, v)} availableVars={selectedTeste ? extractPayloadKeys(selectedTeste.payload) : []} testPayload={selectedTeste?.payload || null} />
              ) : (
                <FieldMappingList fields={getFields("motorista", "default")} mappings={mappings["default"] || {}} onUpdate={(f, v) => updateMapping("default", f, v)} availableVars={selectedTeste ? extractPayloadKeys(selectedTeste.payload) : []} testPayload={selectedTeste?.payload || null} />
              )}
            </div>
          )}
        </div>

        <FerramentasDevDialog
          open={devToolsOpen}
          onOpenChange={setDevToolsOpen}
          tipo={selected.tipo}
          onSubmit={handleTestSubmit}
        />
      </div>
    );
  }

  // List view — table format
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Gerencie seus webhooks e mapeamentos de campos ({automacoes.length})</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAutomacoes}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Automação</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : automacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Nenhuma automação cadastrada. Clique em "Nova Automação" para começar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativar/Desativar</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automacoes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell><Badge variant="secondary">{tipoLabels[a.tipo] || a.tipo}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-[280px]">
                      <span className="text-xs font-mono text-muted-foreground truncate">{getWebhookUrl(a.id)}</span>
                      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => copyUrl(a.id)} title="Copiar URL">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.ativo ? "default" : "outline"}>
                      {a.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={a.ativo} onCheckedChange={() => toggleWebhook(a)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const m = (a.mappings && typeof a.mappings === "object") ? a.mappings : {};
                        // Ensure default tab exists for grupo/motorista
                        if (a.tipo !== "transfer" && !m["default"]) {
                          m["default"] = {};
                        }
                        // Ensure transfer tabs exist
                        if (a.tipo === "transfer") {
                          if (!m["somente_ida"]) m["somente_ida"] = {};
                          if (!m["ida_volta"]) m["ida_volta"] = {};
                          if (!m["por_hora"]) m["por_hora"] = {};
                        }
                        setSelected(a);
                        setMappings(m);
                        fetchTestes(a.id);
                      }}>
                        Configurar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

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
                    <SelectItem value="grupo">Solicitação de Grupo</SelectItem>
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
