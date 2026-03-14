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

function FieldMappingList({
  fields,
  mappings,
  onUpdate,
}: {
  fields: string[];
  mappings: Record<string, string>;
  onUpdate: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {fields.map((field) => (
        <div key={field} className="space-y-1">
          <Label className="text-sm font-medium text-foreground">{field}</Label>
          <Input
            placeholder="Digite o caminho da variável (ex: nome, dados.email)"
            value={mappings[field] || ""}
            onChange={(e) => onUpdate(field, e.target.value)}
          />
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
          onClick={() => { setSelected(null); setMappings({}); setTestes([]); setSelectedTeste(null); }}
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
              <div className="rounded-full bg-muted p-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Webhook {selected.ativo ? "Ativado" : "Desativado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.ativo
                    ? "Dados recebidos serão enviados para Solicitações automaticamente."
                    : "Webhook desativado. Ative para começar a receber dados."}
                </p>
              </div>
            </div>
            <Switch
              checked={selected.ativo}
              onCheckedChange={() => toggleWebhook(selected)}
            />
          </div>
        </div>

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
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
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
                        <pre className="text-xs font-mono bg-background rounded p-3 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                          {JSON.stringify(selectedTeste.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mapeamento de Campos */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Mapeamento de Campos</h3>
              <Button size="sm" onClick={handleSaveMappings}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
              </Button>
            </div>
            {isTransfer ? (
              <Tabs defaultValue="somente_ida">
                <TabsList className="w-full grid grid-cols-3 mb-4">
                  <TabsTrigger value="somente_ida">Somente Ida</TabsTrigger>
                  <TabsTrigger value="ida_volta">Ida e Volta</TabsTrigger>
                  <TabsTrigger value="por_hora">Por Hora</TabsTrigger>
                </TabsList>
                <TabsContent value="somente_ida">
                  <FieldMappingList fields={getFields("transfer", "somente_ida")} mappings={mappings["somente_ida"] || {}} onUpdate={(f, v) => updateMapping("somente_ida", f, v)} />
                </TabsContent>
                <TabsContent value="ida_volta">
                  <FieldMappingList fields={getFields("transfer", "ida_volta")} mappings={mappings["ida_volta"] || {}} onUpdate={(f, v) => updateMapping("ida_volta", f, v)} />
                </TabsContent>
                <TabsContent value="por_hora">
                  <FieldMappingList fields={getFields("transfer", "por_hora")} mappings={mappings["por_hora"] || {}} onUpdate={(f, v) => updateMapping("por_hora", f, v)} />
                </TabsContent>
              </Tabs>
            ) : selected.tipo === "grupo" ? (
              <FieldMappingList fields={getFields("grupo", "default")} mappings={mappings["default"] || {}} onUpdate={(f, v) => updateMapping("default", f, v)} />
            ) : (
              <FieldMappingList fields={getFields("motorista", "default")} mappings={mappings["default"] || {}} onUpdate={(f, v) => updateMapping("default", f, v)} />
            )}
          </div>
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
