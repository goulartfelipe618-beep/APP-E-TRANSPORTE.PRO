import { useEffect, useState } from "react";
import { ClipboardList, Eye, Trash2, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface SolicitacaoAcesso {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  mensagem: string | null;
  tipo_interesse: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  em_contato: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  aprovado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  recusado: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_contato: "Em Contato",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const interesseLabels: Record<string, string> = {
  conhecer: "Conhecer o sistema",
  teste: "Teste gratuito",
  contratar: "Contratar",
};

export default function AdminUsuariosSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [selected, setSelected] = useState<SolicitacaoAcesso | null>(null);

  const fetchSolicitacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_acesso")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSolicitacoes(data as SolicitacaoAcesso[]);
    setLoading(false);
  };

  useEffect(() => { fetchSolicitacoes(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("solicitacoes_acesso")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success("Status atualizado!");
    fetchSolicitacoes();
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: newStatus } : null);
  };

  const deleteSolicitacao = async (id: string) => {
    const { error } = await supabase.from("solicitacoes_acesso").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Solicitação excluída!");
    fetchSolicitacoes();
    if (selected?.id === id) setSelected(null);
  };

  const filtered = filtroStatus === "todos" ? solicitacoes : solicitacoes.filter((s) => s.status === filtroStatus);

  const formUrl = `${window.location.origin}/solicitar-acesso`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Solicitações de Acesso
        </h1>
        <p className="text-muted-foreground mt-1">Solicitações de motoristas que desejam conhecer ou adquirir o sistema.</p>
      </div>

      {/* Link do formulário público */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Link do formulário público:</p>
          <p className="text-xs text-muted-foreground break-all">{formUrl}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(formUrl); toast.success("Link copiado!"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={formUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
            </a>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_contato">Em Contato</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} solicitação(ões)</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Nenhuma solicitação encontrada</h3>
          <p className="text-sm text-muted-foreground">Compartilhe o link do formulário para receber solicitações.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{s.nome_completo}</p>
                <p className="text-sm text-muted-foreground truncate">{s.email} · {s.telefone}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={statusColors[s.status] || ""}>
                    {statusLabels[s.status] || s.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{interesseLabels[s.tipo_interesse] || s.tipo_interesse}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_contato">Em Contato</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="recusado">Recusado</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => setSelected(s)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteSolicitacao(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalhes Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Solicitação</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <Field label="Nome" value={selected.nome_completo} />
              <Field label="E-mail" value={selected.email} />
              <Field label="Telefone" value={selected.telefone} />
              <Field label="Cidade" value={selected.cidade || "—"} />
              <Field label="Estado" value={selected.estado || "—"} />
              <Field label="Interesse" value={interesseLabels[selected.tipo_interesse] || selected.tipo_interesse} />
              <Field label="Mensagem" value={selected.mensagem || "Nenhuma mensagem"} />
              <Field label="Data" value={new Date(selected.created_at).toLocaleString("pt-BR")} />
              <Field label="Status" value={statusLabels[selected.status] || selected.status} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
