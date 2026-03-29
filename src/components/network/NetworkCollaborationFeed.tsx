import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter, Trash2, Users, Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import CriarNetworkDialog from "@/components/network/CriarNetworkDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type NetworkRow = Database["public"]["Tables"]["network"]["Row"];

type Props = {
  /** Admin master pode remover qualquer publicação; motorista só as suas. */
  allowModeratorDelete: boolean;
  title: string;
  subtitle: string;
};

export default function NetworkCollaborationFeed({ allowModeratorDelete, title, subtitle }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [data, setData] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("");

  const canDelete = (row: NetworkRow) => {
    if (!currentUserId) return false;
    if (allowModeratorDelete && isAdminMaster) return true;
    return row.user_id === currentUserId;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    if (user?.id) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin_master")
        .maybeSingle();
      setIsAdminMaster(!!roleRow);
    } else {
      setIsAdminMaster(false);
    }

    const { data: rows, error } = await supabase
      .from("network")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar o Network");
      setData([]);
    } else {
      setData((rows as NetworkRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel("network-collab-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "network" },
        () => {
          void fetchData();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("network").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    toast.success("Publicação removida");
    void fetchData();
  };

  const filtered = data.filter((item) => {
    if (filtroTipo !== "all" && item.categoria !== filtroTipo) return false;
    if (filtroEstado !== "all" && item.estado !== filtroEstado) return false;
    if (filtroCidade && !item.cidade?.toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    return true;
  });

  const tipos = [...new Set(data.map((d) => d.categoria).filter(Boolean))];
  const estados = [...new Set(data.map((d) => d.estado).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="text-primary">⊕</span> {title}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="icon" onClick={() => void fetchData()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova publicação
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo</label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tipos.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Estado (UF)</label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {estados.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Cidade</label>
            <Input
              placeholder="Filtrar por cidade..."
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          <strong className="text-foreground">{filtered.length}</strong> publicaç{filtered.length === 1 ? "ão" : "ões"}
          {data.length !== filtered.length && (
            <span> (de {data.length} no total)</span>
          )}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-foreground font-medium">Nenhuma oportunidade encontrada</p>
          <p className="text-sm text-muted-foreground mt-2">
            Publique uma solicitação de repasse ou parceria para que outros motoristas da plataforma vejam.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden border-border">
              <CardHeader className="pb-2 space-y-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground leading-tight">{item.nome_empresa}</p>
                    <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.autor_nome || "Motorista"}
                        {item.autor_email ? (
                          <span className="text-xs opacity-80">· {item.autor_email}</span>
                        ) : null}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.categoria}</Badge>
                    {item.estado ? (
                      <Badge variant="outline">
                        {item.cidade ? `${item.cidade} / ` : ""}{item.estado}
                      </Badge>
                    ) : null}
                    {item.potencial_negocio ? (
                      <Badge variant="outline" className="text-xs">Urgência: {item.potencial_negocio}</Badge>
                    ) : null}
                    {canDelete(item) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Remover publicação"
                        onClick={() => void handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {item.observacoes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.observacoes}</p>
                ) : null}
                {item.endereco ? (
                  <p className="text-sm">
                    <span className="font-medium text-muted-foreground">Rota / local: </span>
                    {item.endereco}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground border-t border-border pt-3">
                  {item.nome_contato ? <span>Contato: {item.nome_contato}</span> : null}
                  {item.telefone_direto ? <span>Tel.: {item.telefone_direto}</span> : null}
                  {item.email_corporativo ? <span>E-mail: {item.email_corporativo}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.status_contato ? `${item.status_contato} · ` : ""}
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CriarNetworkDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => void fetchData()} />
    </div>
  );
}
