import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, LayoutGrid, Link2, List, Pencil, Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CadastrarVeiculoDialog from "@/components/veiculos/CadastrarVeiculoDialog";
import { cn } from "@/lib/utils";

const VIEW_STORAGE_KEY = "etp_veiculos_view";

type VeiculoRow = {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  tipo_veiculo: string;
  status: string;
  valor_km: number;
  valor_hora: number;
  tarifa_base: number;
  valor_minimo_corrida: number;
  imagem_capa_url: string | null;
};

type ViewMode = "cards" | "table";

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "cards";
  const v = localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "table" ? "table" : "cards";
}

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<VeiculoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVeiculoId, setEditingVeiculoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readInitialView());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("veiculos_frota")
      .select(
        "id, marca, modelo, placa, tipo_veiculo, status, valor_km, valor_hora, tarifa_base, valor_minimo_corrida, imagem_capa_url",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar os veículos.");
    else setVeiculos((data || []) as VeiculoRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const openCreate = () => {
    setEditingVeiculoId(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingVeiculoId(id);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingVeiculoId(null);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return veiculos;
    return veiculos.filter((v) =>
      [v.marca, v.modelo, v.placa, v.tipo_veiculo].some((field) => (field || "").toLowerCase().includes(term)),
    );
  }, [search, veiculos]);

  const totalAtivos = veiculos.filter((v) => v.status === "ativo").length;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Veículos</h1>
          <p className="text-pretty text-sm text-muted-foreground sm:text-base">
            Cadastro completo e centralizado da frota para cálculo automático de corridas.
          </p>
        </div>
        <Button onClick={openCreate} className="w-full shrink-0 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo veículo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Total de veículos</p>
            <Car className="h-5 w-5 shrink-0 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{veiculos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Ativos</p>
            <Link2 className="h-5 w-5 shrink-0 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalAtivos}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Com precificação</p>
            <Settings2 className="h-5 w-5 shrink-0 text-[#FF6600]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{veiculos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Vista</p>
            <LayoutGrid className="h-5 w-5 shrink-0 text-violet-500" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">Cards ou tabela</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Buscar por placa, marca, modelo ou tipo..."
          />
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
          <Button
            type="button"
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none sm:h-10 sm:w-10"
            onClick={() => setView("cards")}
            aria-label="Ver em cards"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none sm:h-10 sm:w-10"
            onClick={() => setView("table")}
            aria-label="Ver em tabela"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Carregando veículos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum veículo cadastrado. Use o botão <strong className="text-foreground">+ Novo veículo</strong>.
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <article
              key={v.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="relative aspect-[1220/880] w-full shrink-0 overflow-hidden bg-muted">
                {v.imagem_capa_url ? (
                  <img
                    src={v.imagem_capa_url}
                    alt={`Capa ${v.marca} ${v.modelo}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                    <Car className="h-12 w-12 opacity-40" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 font-semibold leading-snug text-foreground">
                    {v.marca} {v.modelo}
                  </h3>
                  <Badge variant={v.status === "ativo" ? "default" : "secondary"} className="shrink-0">
                    {v.status}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">Placa: {v.placa}</p>
                <p className="text-sm text-muted-foreground">Tipo: {v.tipo_veiculo.toUpperCase()}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  KM: R$ {v.valor_km.toFixed(2)} | Hora: R$ {v.valor_hora.toFixed(2)}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Bandeirada: R$ {v.tarifa_base.toFixed(2)} | Mínimo: R$ {v.valor_minimo_corrida.toFixed(2)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-[#FF6600]/40 text-[#FF6600] hover:bg-[#FF6600]/10"
                  onClick={() => openEdit(v.id)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="w-24 p-2 sm:p-3">Capa</th>
                <th className="p-2 sm:p-3">Marca / Modelo</th>
                <th className="p-2 sm:p-3">Placa</th>
                <th className="p-2 sm:p-3">Tipo</th>
                <th className="p-2 sm:p-3">Status</th>
                <th className="hidden p-2 sm:table-cell sm:p-3">KM / Hora</th>
                <th className="hidden p-2 md:table-cell md:p-3">Bandeirada / Mín.</th>
                <th className="w-[1%] whitespace-nowrap p-2 text-right sm:p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="p-2 sm:p-3">
                    <div className="relative h-14 w-20 overflow-hidden rounded-md border border-border bg-muted sm:h-16 sm:w-24">
                      {v.imagem_capa_url ? (
                        <img
                          src={v.imagem_capa_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Car className="h-6 w-6 opacity-50" aria-hidden />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[10rem] p-2 sm:max-w-none sm:p-3">
                    <span className="line-clamp-2 font-medium text-foreground">
                      {v.marca} {v.modelo}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-2 font-mono text-xs sm:p-3 sm:text-sm">{v.placa}</td>
                  <td className="whitespace-nowrap p-2 sm:p-3">{v.tipo_veiculo.toUpperCase()}</td>
                  <td className="p-2 sm:p-3">
                    <Badge variant={v.status === "ativo" ? "default" : "secondary"} className={cn("text-xs")}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="hidden whitespace-nowrap p-2 text-xs sm:table-cell sm:p-3">
                    R$ {v.valor_km.toFixed(2)} / R$ {v.valor_hora.toFixed(2)}
                  </td>
                  <td className="hidden whitespace-nowrap p-2 text-xs md:table-cell md:p-3">
                    R$ {v.tarifa_base.toFixed(2)} / R$ {v.valor_minimo_corrida.toFixed(2)}
                  </td>
                  <td className="p-2 text-right sm:p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#FF6600]/40 text-[#FF6600] hover:bg-[#FF6600]/10"
                      onClick={() => openEdit(v.id)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border p-2 text-center text-xs text-muted-foreground sm:hidden">
            Deslize horizontalmente para ver todas as colunas.
          </p>
        </div>
      )}

      <CadastrarVeiculoDialog
        open={dialogOpen}
        veiculoId={editingVeiculoId}
        onOpenChange={handleDialogOpenChange}
        onSaved={() => {
          void load();
        }}
      />
    </div>
  );
}
