import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CadastrarMotoristaDialog from "@/components/motoristas/CadastrarMotoristaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MOTORISTA_FROM_SOLICITACAO_KEY, type MotoristaInitialData } from "@/lib/motoristaFromSolicitacao";

export default function MotoristaCadastrosPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);
  const [fromSolicitacao, setFromSolicitacao] = useState<MotoristaInitialData | null>(null);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMotoristas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_motoristas")
      .select("id, nome, cpf, telefone, email, cidade, estado, status, created_at")
      .eq("status", "cadastrado")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cadastros de motoristas.");
    else setMotoristas(data || []);
    setLoading(false);
  }, []);

  const consumeSessionPayload = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      if (!raw) return;
      sessionStorage.removeItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      const parsed = JSON.parse(raw) as MotoristaInitialData;
      if (parsed?.solicitacao_id) {
        setFromSolicitacao(parsed);
        setOpen(true);
      }
    } catch {
      sessionStorage.removeItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      toast.error("Não foi possível carregar os dados da solicitação.");
    }
  }, []);

  useEffect(() => {
    consumeSessionPayload();
  }, [consumeSessionPayload]);

  useEffect(() => {
    fetchMotoristas();
  }, [fetchMotoristas]);

  const handleCreated = async () => {
    const sid = fromSolicitacao?.solicitacao_id;
    if (sid) {
      const { error } = await supabase.from("solicitacoes_motoristas").update({ status: "cadastrado" }).eq("id", sid);
      if (error) toast.error("Cadastro validado, mas não foi possível atualizar o status da solicitação.");
      else toast.success("Solicitação marcada como cadastrada.");
    }
    setFromSolicitacao(null);
    fetchMotoristas();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFromSolicitacao(null);
  };

  const filtered = motoristas.filter((m) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (m.nome || "").toLowerCase().includes(term) ||
      (m.cpf || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros de Motoristas</h1>
          <p className="text-muted-foreground">Gerenciamento completo de motoristas</p>
        </div>
        <Button
          onClick={() => {
            setFromSolicitacao(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo motorista
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
        <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Nenhum motorista cadastrado.</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">{m.nome}</h3>
                <Badge variant="default">Cadastrado</Badge>
              </div>
              <p className="text-sm text-muted-foreground">CPF: {m.cpf || "—"}</p>
              <p className="text-sm text-muted-foreground">Telefone: {m.telefone || "—"}</p>
              <p className="text-sm text-muted-foreground">Cidade/UF: {(m.cidade || "—")} {(m.estado ? `- ${m.estado}` : "")}</p>
              <p className="text-xs text-muted-foreground">
                Cadastrado em {new Date(m.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">CPF</th>
                <th className="text-left p-3">Telefone</th>
                <th className="text-left p-3">Cidade/UF</th>
                <th className="text-left p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3">{m.nome}</td>
                  <td className="p-3">{m.cpf || "—"}</td>
                  <td className="p-3">{m.telefone || "—"}</td>
                  <td className="p-3">{(m.cidade || "—")} {(m.estado ? `- ${m.estado}` : "")}</td>
                  <td className="p-3">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CadastrarMotoristaDialog
        open={open}
        onOpenChange={handleOpenChange}
        onCreated={handleCreated}
        initialData={fromSolicitacao}
      />
    </div>
  );
}
