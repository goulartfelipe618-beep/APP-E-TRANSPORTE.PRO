import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, List, Link2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CadastrarMotoristaDialog from "@/components/motoristas/CadastrarMotoristaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type MotoristaCadastroRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  created_at: string;
  dados_webhook: Json | null;
  portal_token: string;
  portal_auth_user_id: string | null;
};

function situacaoFrotaFromWebhook(dw: Json | null): "ativo" | "inativo" {
  if (!dw || typeof dw !== "object" || Array.isArray(dw)) return "ativo";
  const o = dw as Record<string, unknown>;
  return o.situacao_frota === "inativo" ? "inativo" : "ativo";
}

export default function MotoristaCadastrosPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);
  const [motoristas, setMotoristas] = useState<MotoristaCadastroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMotoristas = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setMotoristas([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("solicitacoes_motoristas")
      .select("id, nome, cpf, telefone, email, cidade, estado, status, created_at, dados_webhook, portal_token, portal_auth_user_id")
      .eq("user_id", user.id)
      .eq("status", "cadastrado")
      .order("created_at", { ascending: false });

    if (error) toast.error("Erro ao carregar cadastros de motoristas.");
    else setMotoristas((data as MotoristaCadastroRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMotoristas();
  }, [fetchMotoristas]);

  const handleCreated = () => {
    void fetchMotoristas();
  };

  const portalUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/frota/acesso/${token}` : "";

  const copyPortalLink = (token: string) => {
    const u = portalUrl(token);
    if (!u) return;
    void navigator.clipboard.writeText(u).then(() => toast.success("Link copiado."));
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
          <h1 className="text-2xl font-bold text-foreground">Cadastros de motoristas</h1>
          <p className="text-muted-foreground">
            Motoristas da <strong>sua frota</strong> (cada registo fica associado à sua conta; o painel Admin Master gere
            pré-cadastros do site separadamente). A lista usa o mesmo critério de segurança na base de dados (RLS).
          </p>
        </div>
        <Button
          onClick={() => {
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
        <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar…</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Nenhum motorista cadastrado.</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const situacao = situacaoFrotaFromWebhook(m.dados_webhook);
            return (
              <div key={m.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{m.nome}</h3>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Badge variant="outline">Cadastrado</Badge>
                    <Badge variant={situacao === "ativo" ? "default" : "secondary"}>
                      {situacao === "ativo" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">CPF: {m.cpf || "—"}</p>
                <p className="text-sm text-muted-foreground">Telefone: {m.telefone || "—"}</p>
                <p className="text-sm text-muted-foreground">
                  Cidade/UF: {m.cidade || "—"} {m.estado ? `- ${m.estado}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Cadastrado em {new Date(m.created_at).toLocaleDateString("pt-BR")}</p>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Portal: {m.portal_auth_user_id ? "senha definida" : "enviar link para definir senha"}
                  </span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyPortalLink(m.portal_token)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar link
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">CPF</th>
                <th className="p-3 text-left">Telefone</th>
                <th className="p-3 text-left">Cidade/UF</th>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const situacao = situacaoFrotaFromWebhook(m.dados_webhook);
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-3">{m.nome}</td>
                    <td className="p-3">{m.cpf || "—"}</td>
                    <td className="p-3">{m.telefone || "—"}</td>
                    <td className="p-3">
                      {m.cidade || "—"} {m.estado ? `- ${m.estado}` : ""}
                    </td>
                    <td className="p-3">
                      <Badge variant={situacao === "ativo" ? "default" : "secondary"} className="text-xs">
                        {situacao === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="p-3">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CadastrarMotoristaDialog open={open} onOpenChange={setOpen} onCreated={handleCreated} initialData={null} />
    </div>
  );
}
