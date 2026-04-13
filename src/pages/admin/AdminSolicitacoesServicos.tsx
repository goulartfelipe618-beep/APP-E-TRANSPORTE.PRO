import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { RefreshCw, Filter, ClipboardList, Eye, Globe, Mail, Monitor, Search, CheckCircle2, Clock, XCircle, Loader2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadSolicitacaoBriefingPdf } from "@/lib/solicitacaoServicoBriefingPdf";

interface Solicitacao {
  id: string;
  user_id: string;
  tipo_servico: string;
  status: string;
  dados_solicitacao: any;
  link_acesso: string | null;
  data_expiracao: string | null;
  instrucoes_acesso: string | null;
  como_usar: string | null;
  observacoes_admin: string | null;
  created_at: string;
}

const TIPO_LABELS: Record<string, string> = {
  website: "Website",
  email: "E-mail Business",
  google: "Google Business",
  dominio: "Domínio",
};

const TIPO_ICONS: Record<string, any> = {
  website: Monitor,
  email: Mail,
  google: Search,
  dominio: Globe,
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  em_andamento: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  concluido: "bg-green-500/10 text-green-700 border-green-500/30",
  publicado: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30",
  recusado: "bg-red-500/10 text-red-700 border-red-500/30",
};

export default function AdminSolicitacoesServicos() {
  const [data, setData] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [editLink, setEditLink] = useState("");
  const [editExpiracao, setEditExpiracao] = useState("");
  const [editInstrucoes, setEditInstrucoes] = useState("");
  const [editComoUsar, setEditComoUsar] = useState("");
  const [editObs, setEditObs] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const fetchData = async () => {
    const { data: rows, error } = await (supabase.from("solicitacoes_servicos" as any).select("*").order("created_at", { ascending: false }) as any);
    if (error) toast.error("Erro ao carregar");
    else setData(rows || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openDetail = (s: Solicitacao) => {
    setSelected(s);
    setEditLink(s.link_acesso || "");
    setEditExpiracao(s.data_expiracao || "");
    setEditInstrucoes(s.instrucoes_acesso || "");
    setEditComoUsar(s.como_usar || "");
    setEditObs(s.observacoes_admin || "");
    setEditStatus(s.status);
  };

  const handleDownloadPdf = () => {
    if (!selected) return;
    try {
      downloadSolicitacaoBriefingPdf(
        {
          id: selected.id,
          user_id: selected.user_id,
          tipo_servico: selected.tipo_servico,
          status: selected.status,
          dados_solicitacao: selected.dados_solicitacao || {},
          created_at: selected.created_at,
          link_acesso: selected.link_acesso,
          data_expiracao: selected.data_expiracao,
          instrucoes_acesso: selected.instrucoes_acesso,
          como_usar: selected.como_usar,
          observacoes_admin: selected.observacoes_admin,
        },
        {
          status: editStatus,
          link_acesso: editLink || null,
          data_expiracao: editExpiracao || null,
          instrucoes_acesso: editInstrucoes || null,
          como_usar: editComoUsar || null,
          observacoes_admin: editObs || null,
        },
      );
      toast.success("PDF gerado. Verifique sua pasta de downloads.");
    } catch (e) {
      toast.error("Não foi possível gerar o PDF.", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase.from("solicitacoes_servicos" as any).update({
      status: editStatus,
      link_acesso: editLink || null,
      data_expiracao: editExpiracao || null,
      instrucoes_acesso: editInstrucoes || null,
      como_usar: editComoUsar || null,
      observacoes_admin: editObs || null,
      updated_at: new Date().toISOString(),
    } as any).eq("id", selected.id) as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Solicitação atualizada!");
    setSelected(null);
    fetchData();
  };

  const filtered = data.filter((s) => {
    if (filtroTipo !== "all" && s.tipo_servico !== filtroTipo) return false;
    if (filtroStatus !== "all" && s.status !== filtroStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Solicitações de Serviços
          </h1>
          <p className="text-muted-foreground">Gerencie pedidos de Website, E-mail, Google Business e Domínio</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Serviço</label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="email">E-mail Business</SelectItem>
                <SelectItem value="google">Google Business</SelectItem>
                <SelectItem value="dominio">Domínio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="publicado">Website publicado</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Solicitações
          <Badge variant="secondary" className="ml-2">{filtered.length} registros</Badge>
        </h3>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-2 opacity-40" />
            <p>Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const Icon = TIPO_ICONS[s.tipo_servico] || Globe;
                  const dados = s.dados_solicitacao || {};
                  const resumo = dados.dominio || dados.nome_empresa || dados.template || "—";
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{TIPO_LABELS[s.tipo_servico] || s.tipo_servico}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.user_id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                          {s.status === "pendente" && <Clock className="h-3 w-3 mr-1" />}
                          {s.status === "em_andamento" && <Loader2 className="h-3 w-3 mr-1" />}
                          {s.status === "concluido" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {s.status === "publicado" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {s.status === "recusado" && <XCircle className="h-3 w-3 mr-1" />}
                          {s.status === "publicado" ? "Website publicado" : s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{resumo}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selected && TIPO_ICONS[selected.tipo_servico] && (() => { const I = TIPO_ICONS[selected.tipo_servico]; return <I className="h-5 w-5" />; })()}
              {selected && (TIPO_LABELS[selected.tipo_servico] || selected.tipo_servico)}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-6 mt-6">
              <Button type="button" variant="secondary" className="w-full gap-2" onClick={handleDownloadPdf}>
                <FileDown className="h-4 w-4 shrink-0" />
                Baixar briefing em PDF
              </Button>
              <p className="text-xs text-muted-foreground -mt-2">
                Inclui todos os dados do formulário (website, Google, e-mail, etc.) e os campos da resposta administrativa
                conforme preenchidos abaixo — salve antes se quiser o PDF com as últimas alterações gravadas no banco.
              </p>

              {/* Dados da solicitação */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground">Dados da Solicitação</h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(selected.dados_solicitacao || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                      <span className="text-foreground font-medium text-right max-w-[60%] truncate">
                        {typeof val === "boolean" ? (val ? "Sim" : "Não") : Array.isArray(val) ? val.join(", ") : String(val || "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin edit */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground">Resposta do Administrador</h4>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="publicado">Website publicado</SelectItem>
                      <SelectItem value="recusado">Recusado</SelectItem>
                    </SelectContent>
                  </Select>
                  {selected?.tipo_servico === "website" && editStatus === "publicado" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Informe o <strong>Link de Acesso</strong> com a URL final do site; o motorista verá o botão &quot;Visualizar site publicado&quot;.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Link de Acesso</label>
                  <Input placeholder="https://..." value={editLink} onChange={(e) => setEditLink(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Data de Expiração</label>
                  <Input type="date" value={editExpiracao} onChange={(e) => setEditExpiracao(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Instruções de Acesso</label>
                  <Textarea placeholder="Como o usuário acessa o serviço..." value={editInstrucoes} onChange={(e) => setEditInstrucoes(e.target.value)} rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Como Usar</label>
                  <Textarea placeholder="Passo a passo de uso..." value={editComoUsar} onChange={(e) => setEditComoUsar(e.target.value)} rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Observações</label>
                  <Textarea placeholder="Notas internas ou para o usuário..." value={editObs} onChange={(e) => setEditObs(e.target.value)} rows={2} />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar e Confirmar
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
