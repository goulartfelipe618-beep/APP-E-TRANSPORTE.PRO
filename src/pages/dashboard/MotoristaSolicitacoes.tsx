import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, LayoutGrid, List, UserCheck, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CadastrarMotoristaDialog from "@/components/motoristas/CadastrarMotoristaDialog";
import DetalhesSolicitacaoMotoristaSheet from "@/components/solicitacoes/DetalhesSolicitacaoMotoristaSheet";
import type { MotoristaInitialData } from "@/lib/motoristaFromSolicitacao";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type SolicitacaoRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  cnh: string | null;
  mensagem: string | null;
  mensagem_observacoes: string | null;
  status: string;
  created_at: string;
  dados_webhook: Json | null;
};

const STATUS_LABELS: Record<string, string> = {
  testando: "Testando",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  recusado: "Recusado",
  concluido: "Concluído",
  desativado: "Desativado",
};

const STATUS_CLASS: Record<string, string> = {
  testando: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pendente: "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
  em_andamento: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  recusado: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  concluido: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800",
  desativado: "border-border bg-muted text-muted-foreground",
};

/** Estados em que não faz sentido “completar cadastro” na frota. */
function podeCompletarCadastro(status: string): boolean {
  return !["cadastrado", "recusado", "desativado"].includes(status);
}

function leadToCompletarInitialData(m: SolicitacaoRow): MotoristaInitialData {
  const dw = m.dados_webhook;
  return {
    solicitacao_id: m.id,
    completar_lead_id: m.id,
    nome: m.nome,
    email: m.email ?? undefined,
    telefone: m.telefone ?? undefined,
    cpf: m.cpf ?? undefined,
    cnh: m.cnh ?? undefined,
    cidade: m.cidade ?? undefined,
    estado: m.estado ?? undefined,
    mensagem_observacoes: m.mensagem_observacoes ?? m.mensagem ?? undefined,
    dados_webhook: dw && typeof dw === "object" && !Array.isArray(dw) ? (dw as Record<string, unknown>) : null,
  };
}

export default function MotoristaSolicitacoesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [rows, setRows] = useState<SolicitacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detalhe, setDetalhe] = useState<SolicitacaoRow | null>(null);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [cadastroInitial, setCadastroInitial] = useState<MotoristaInitialData | null>(null);

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("solicitacoes_motoristas")
      .select(
        "id, nome, cpf, telefone, email, cidade, estado, cnh, mensagem, mensagem_observacoes, status, created_at, dados_webhook",
      )
      .eq("user_id", user.id)
      .neq("status", "cadastrado")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar solicitações.");
      setRows([]);
    } else {
      setRows((data as SolicitacaoRow[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.nome || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.telefone || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const abrirCompletarCadastro = (m: SolicitacaoRow) => {
    setCadastroInitial(leadToCompletarInitialData(m));
    setCadastroOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações</h1>
          <p className="text-muted-foreground">
            Pedidos de motoristas gerados pelo seu webhook <strong className="text-foreground">Motorista solicitação</strong> em{" "}
            <strong className="text-foreground">Sistema → Automações</strong>. Cada conta vê apenas as suas linhas.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchSolicitacoes()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou telefone…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="mb-2">Nenhuma solicitação em aberto.</p>
          <p className="text-sm">
            Com o webhook ativado em Automações, novos POSTs aparecem aqui automaticamente. Motoristas já integrados na frota ficam em{" "}
            <strong className="text-foreground">Motoristas → Cadastros</strong>.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{m.nome}</h3>
                <Badge variant="outline" className={STATUS_CLASS[m.status] ?? ""}>
                  {STATUS_LABELS[m.status] ?? m.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{m.email || "—"}</p>
              <p className="text-sm text-muted-foreground">{m.telefone || "—"}</p>
              <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDetalhe(m)}>
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Detalhes
                </Button>
                {podeCompletarCadastro(m.status) && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 border-[#FF6600]/40 text-xs text-[#FF6600] hover:bg-[#FF6600]/10"
                    onClick={() => abrirCompletarCadastro(m)}
                  >
                    <UserCheck className="mr-1 h-3.5 w-3.5" />
                    Completar cadastro
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Contato</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3 font-medium">{m.nome}</td>
                  <td className="p-3 text-muted-foreground">
                    <div>{m.email || "—"}</div>
                    <div className="text-xs">{m.telefone || ""}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={`text-xs ${STATUS_CLASS[m.status] ?? ""}`}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setDetalhe(m)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Ver
                      </Button>
                      {podeCompletarCadastro(m.status) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-[#FF6600]"
                          onClick={() => abrirCompletarCadastro(m)}
                        >
                          <UserCheck className="mr-1 h-3.5 w-3.5" />
                          Completar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetalhesSolicitacaoMotoristaSheet
        solicitacao={detalhe}
        open={detalhe !== null}
        onOpenChange={(o) => {
          if (!o) setDetalhe(null);
        }}
        onConverter={(s) => {
          setDetalhe(null);
          if (podeCompletarCadastro(s.status)) abrirCompletarCadastro(s as SolicitacaoRow);
        }}
      />

      <CadastrarMotoristaDialog
        open={cadastroOpen}
        onOpenChange={(v) => {
          setCadastroOpen(v);
          if (!v) setCadastroInitial(null);
        }}
        onCreated={() => void fetchSolicitacoes()}
        initialData={cadastroInitial}
      />
    </div>
  );
}
