import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Eye, Pencil, UserPlus, Users } from "lucide-react";
import CadastrarClienteDialog, { type CadastroClienteRow } from "@/components/clientes/CadastrarClienteDialog";
import DetalhesClienteSheet from "@/components/clientes/DetalhesClienteSheet";
import type { Json } from "@/integrations/supabase/types";
import { computeClienteProfilePercent } from "@/lib/clienteCompleteness";

function rowFromDb(r: Record<string, unknown>): CadastroClienteRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    tipo: r.tipo === "pj" ? "pj" : "pf",
    nome_exibicao: String(r.nome_exibicao ?? ""),
    cpf_cnpj: r.cpf_cnpj != null ? String(r.cpf_cnpj) : null,
    email: r.email != null ? String(r.email) : null,
    telefone_1: r.telefone_1 != null ? String(r.telefone_1) : null,
    telefone_2: r.telefone_2 != null ? String(r.telefone_2) : null,
    enderecos: (r.enderecos ?? []) as Json,
    documentos: (r.documentos ?? {}) as Json,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export default function ClientesPage() {
  const [rows, setRows] = useState<CadastroClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<CadastroClienteRow | null>(null);
  const [detailRow, setDetailRow] = useState<CadastroClienteRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("cadastro_clientes")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("nome_exibicao", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar clientes.");
      setRows([]);
    } else {
      setRows((data ?? []).map((x) => rowFromDb(x as Record<string, unknown>)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditRow(null);
    setDialogOpen(true);
  };

  const openEdit = (r: CadastroClienteRow) => {
    setEditRow(r);
    setDialogOpen(true);
  };

  const openDetail = (r: CadastroClienteRow) => {
    setDetailRow(r);
    setDetailOpen(true);
  };

  const fromDetailToEdit = () => {
    if (detailRow) {
      setEditRow(detailRow);
      setDetailOpen(false);
      setDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Cadastros privados da sua conta — cada utilizador vê apenas os clientes que criou. Use nas reservas Transfer e Grupos.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 bg-[#FF6600] text-white hover:bg-[#e65c00]"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          + CADASTRAR CLIENTE
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Ainda não tem clientes cadastrados.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={openCreate}>
            Criar o primeiro
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const pct = computeClienteProfilePercent(r);
            return (
              <li
                key={r.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-[#FF6600]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{r.nome_exibicao}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.tipo === "pj" ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> PJ
                        </span>
                      ) : (
                        "PF"
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)} title="Detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Perfil</span>
                    <span className="font-semibold text-[#FF6600]">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#FF6600]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {r.email ? <p className="mt-2 truncate text-xs text-muted-foreground">{r.email}</p> : null}
                {r.telefone_1 ? <p className="truncate text-xs text-muted-foreground">{r.telefone_1}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <CadastrarClienteDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditRow(null);
        }}
        editRow={editRow}
        onSaved={() => {
          void fetchRows();
          if (detailRow && editRow?.id === detailRow.id) {
            void (async () => {
              const { data } = await supabase.from("cadastro_clientes").select("*").eq("id", detailRow.id).maybeSingle();
              if (data) setDetailRow(rowFromDb(data as Record<string, unknown>));
            })();
          }
        }}
      />

      <DetalhesClienteSheet
        row={detailRow}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailRow(null);
        }}
        onEdit={fromDetailToEdit}
      />
    </div>
  );
}
