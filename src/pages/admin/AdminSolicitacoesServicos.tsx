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
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
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

type UserConfigRow = {
  nome_completo: string | null;
  nome_empresa: string | null;
};

function formatCobrancaEmailBusiness(c: unknown): string {
  if (!c || typeof c !== "object") return "—";
  const o = c as { tipo?: string; valor_mensal_reais?: number };
  if (o.tipo === "primeiro_gratuito") return "Primeiro e-mail gratuito";
  if (o.tipo === "adicional_mensal") {
    const v = Number(o.valor_mensal_reais ?? 14.99);
    return `Caixa adicional — R$ ${v.toFixed(2).replace(".", ",")}/mês`;
  }
  return "—";
}

/** Campos já exibidos de forma legível no painel de e-mail (evita duplicar no bloco técnico). */
const EMAIL_SOLICITACAO_KEYS_SHOWN = new Set([
  "dominio",
  "dominio_usuario_id",
  "tipo_dominio",
  "email_prefix",
  "email_principal",
  "nome_completo",
  "nome_empresa",
  "cobranca_email_business",
]);

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

function statusSelectOptions(tipoServico: string, currentStatus: string) {
  const common = [
    { value: "pendente", label: "Pendente" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "concluido", label: "Concluído" },
    { value: "recusado", label: "Recusado" },
  ];
  if (tipoServico === "website") {
    return [...common, { value: "publicado", label: "Website publicado" }];
  }
  if (currentStatus === "publicado") {
    return [...common, { value: "publicado", label: "Publicado (ajustar para outro status se necessário)" }];
  }
  return common;
}

export default function AdminSolicitacoesServicos() {
  const [data, setData] = useState<Solicitacao[]>([]);
  const [userById, setUserById] = useState<Record<string, UserConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroUsuario, setFiltroUsuario] = useState("");
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
    setLoading(true);
    const { data: rows, error } = await (supabase.from("solicitacoes_servicos" as any).select("*").order("created_at", { ascending: false }) as any);
    if (error) {
      toast.error("Erro ao carregar");
      setData([]);
      setUserById({});
      setLoading(false);
      return;
    }
    const list = (rows || []) as Solicitacao[];
    setData(list);

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      setUserById({});
      setLoading(false);
      return;
    }
    const { data: cfgRows, error: cfgErr } = await supabase
      .from("configuracoes" as any)
      .select("user_id, nome_completo, nome_empresa")
      .in("user_id", userIds);
    if (cfgErr) {
      toast.error("Não foi possível carregar nomes dos usuários");
      setUserById({});
    } else {
      const map: Record<string, UserConfigRow> = {};
      for (const row of (cfgRows || []) as { user_id: string; nome_completo: string | null; nome_empresa: string | null }[]) {
        map[row.user_id] = { nome_completo: row.nome_completo, nome_empresa: row.nome_empresa };
      }
      setUserById(map);
    }
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
    const q = filtroUsuario.trim().toLowerCase();
    if (q) {
      const u = userById[s.user_id];
      const nome = (u?.nome_completo || "").toLowerCase();
      const emp = (u?.nome_empresa || "").toLowerCase();
      if (!nome.includes(q) && !emp.includes(q)) return false;
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="md:col-span-2 lg:col-span-1">
            <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-2">
              <Search className="h-3.5 w-3.5" /> Usuário (nome ou empresa)
            </label>
            <Input
              placeholder="Ex.: João Silva, Transporte…"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Filtra pelo cadastro do motorista em Configurações.</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Solicitações
          <Badge variant="secondary" className="ml-2">{filtered.length} registros</Badge>
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 mb-2 animate-spin opacity-60" />
            <p>Carregando solicitações…</p>
          </div>
        ) : filtered.length === 0 ? (
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
                  const resumo =
                    s.tipo_servico === "email"
                      ? (dados.email_principal || dados.dominio || "—")
                      : (dados.dominio || dados.nome_empresa || dados.template || "—");
                  const u = userById[s.user_id];
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{TIPO_LABELS[s.tipo_servico] || s.tipo_servico}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[10rem] max-w-[14rem]">
                          <div className="text-sm font-medium text-foreground truncate" title={u?.nome_completo || undefined}>
                            {u?.nome_completo?.trim() || "Sem nome cadastrado"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate" title={u?.nome_empresa || undefined}>
                            {u?.nome_empresa?.trim() || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                          {s.status === "pendente" && <Clock className="h-3 w-3 mr-1" />}
                          {s.status === "em_andamento" && <Loader2 className="h-3 w-3 mr-1" />}
                          {s.status === "concluido" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {s.status === "publicado" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {s.status === "recusado" && <XCircle className="h-3 w-3 mr-1" />}
                          {s.status === "publicado"
                            ? (s.tipo_servico === "website" ? "Website publicado" : "Publicado")
                            : s.status}
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
            {selected && (() => {
              const uc = userById[selected.user_id];
              return (
                <SheetDescription className="text-left space-y-1">
                  <span className="block text-foreground font-medium">
                    {uc?.nome_completo?.trim() || "Motorista sem nome no cadastro"}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    {uc?.nome_empresa?.trim()
                      ? `Empresa: ${uc.nome_empresa}`
                      : "Empresa não informada nas configurações"}
                  </span>
                  <span className="block text-xs text-muted-foreground font-mono pt-1">ID: {selected.user_id}</span>
                </SheetDescription>
              );
            })()}
          </SheetHeader>

          {selected && (
            <div className="space-y-6 mt-6">
              <Button type="button" variant="secondary" className="w-full gap-2" onClick={handleDownloadPdf}>
                <FileDown className="h-4 w-4 shrink-0" />
                Baixar briefing em PDF
              </Button>
              <p className="text-xs text-muted-foreground -mt-2">
                {selected.tipo_servico === "email" ? (
                  <>
                    Consolida endereço solicitado, regra de cobrança (primeiro gratuito / adicional), dados do formulário e a
                    resposta administrativa abaixo. Salve no banco antes se quiser o PDF com o que já está gravado.
                  </>
                ) : (
                  <>
                    Inclui todos os dados do formulário (website, Google, e-mail, etc.) e os campos da resposta administrativa
                    conforme preenchidos abaixo — salve antes se quiser o PDF com as últimas alterações gravadas no banco.
                  </>
                )}
              </p>

              {/* Dados da solicitação: E-mail Business (layout próprio) */}
              {selected.tipo_servico === "email" ? (() => {
                const d = (selected.dados_solicitacao || {}) as Record<string, unknown>;
                const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
                const extras = Object.entries(d).filter(([k]) => !EMAIL_SOLICITACAO_KEYS_SHOWN.has(k));
                const tipoDom = str("tipo_dominio");
                const tipoDomLabel =
                  tipoDom === "existing" ? "Domínio já cadastrado no painel" : tipoDom || "—";
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-foreground">Briefing da caixa de e-mail</h4>
                    <p className="text-xs text-muted-foreground">
                      Pedido de endereço profissional (@domínio do motorista). Não confundir com briefing de site ou páginas.
                    </p>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-3">
                      <div className="space-y-2">
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">E-mail solicitado</span>
                          <span className="font-mono font-semibold text-foreground text-right break-all">{str("email_principal") || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">Domínio</span>
                          <span className="font-mono text-foreground text-right break-all">{str("dominio") || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">Prefixo (parte local)</span>
                          <span className="font-mono text-foreground text-right break-all">{str("email_prefix") || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">Origem do domínio</span>
                          <span className="text-foreground text-right">{tipoDomLabel}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">Responsável (informado na solicitação)</span>
                          <span className="text-foreground text-right break-words">{str("nome_completo") || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border/80 pb-2">
                          <span className="text-muted-foreground shrink-0">Empresa (informada na solicitação)</span>
                          <span className="text-foreground text-right break-words">{str("nome_empresa") || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 pb-1">
                          <span className="text-muted-foreground shrink-0">Cobrança (regra do painel)</span>
                          <span className="text-foreground text-right font-medium">{formatCobrancaEmailBusiness(d.cobranca_email_business)}</span>
                        </div>
                        {str("dominio_usuario_id") ? (
                          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                            Referência interna do domínio: <span className="font-mono">{str("dominio_usuario_id")}</span>
                          </p>
                        ) : null}
                      </div>
                      {extras.length > 0 ? (
                        <details className="rounded-md border border-dashed border-border bg-background/50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Outros campos enviados</summary>
                          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto text-xs">
                            {extras.map(([key, val]) => (
                              <div key={key} className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">{key.replace(/_/g, " ")}</span>
                                <span className="text-foreground font-medium text-right break-all">
                                  {typeof val === "boolean" ? (val ? "Sim" : "Não") : Array.isArray(val) ? val.join(", ") : String(val ?? "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                );
              })() : (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground">Dados da solicitação</h4>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(selected.dados_solicitacao || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                        <span className="text-foreground font-medium text-right max-w-[60%] break-words">
                          {typeof val === "boolean" ? (val ? "Sim" : "Não") : Array.isArray(val) ? val.join(", ") : String(val || "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin edit */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground">
                  {selected.tipo_servico === "email"
                    ? "Retorno ao motorista (ativação da caixa)"
                    : "Resposta do administrador"}
                </h4>
                {selected.tipo_servico === "email" ? (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Ao concluir, use os campos para entregar webmail, credenciais ou link do provedor. O status &quot;Website publicado&quot; não se aplica a e-mail.
                  </p>
                ) : null}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusSelectOptions(selected.tipo_servico, editStatus).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected.tipo_servico === "website" && editStatus === "publicado" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Informe o <strong>Link de Acesso</strong> com a URL final do site; o motorista verá o botão &quot;Visualizar site publicado&quot;.
                    </p>
                  )}
                  {selected.tipo_servico === "email" && editStatus === "concluido" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Preencha o <strong>link de acesso</strong> (webmail ou painel) e as <strong>instruções</strong> para o motorista localizar tudo no painel E-mail Business.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {selected.tipo_servico === "email" ? "Link de acesso (webmail / painel)" : "Link de Acesso"}
                  </label>
                  <Input
                    placeholder={selected.tipo_servico === "email" ? "https://webmail… ou URL do painel" : "https://..."}
                    value={editLink}
                    onChange={(e) => setEditLink(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Data de Expiração</label>
                  <Input type="date" value={editExpiracao} onChange={(e) => setEditExpiracao(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {selected.tipo_servico === "email" ? "Instruções de acesso (login, servidor, etc.)" : "Instruções de Acesso"}
                  </label>
                  <Textarea
                    placeholder={selected.tipo_servico === "email" ? "Ex.: URL webmail, usuário inicial, servidor IMAP/SMTP…" : "Como o usuário acessa o serviço..."}
                    value={editInstrucoes}
                    onChange={(e) => setEditInstrucoes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {selected.tipo_servico === "email" ? "Orientações de uso no dia a dia" : "Como Usar"}
                  </label>
                  <Textarea
                    placeholder={selected.tipo_servico === "email" ? "Ex.: configurar no celular, assinatura, redirecionamentos…" : "Passo a passo de uso..."}
                    value={editComoUsar}
                    onChange={(e) => setEditComoUsar(e.target.value)}
                    rows={3}
                  />
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
