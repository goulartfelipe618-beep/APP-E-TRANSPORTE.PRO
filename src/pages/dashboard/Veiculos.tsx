import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Link2, Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CadastrarVeiculoDialog from "@/components/veiculos/CadastrarVeiculoDialog";

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
};

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<VeiculoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("veiculos_frota")
      .select("id, marca, modelo, placa, tipo_veiculo, status, valor_km, valor_hora, tarifa_base, valor_minimo_corrida")
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar os veículos.");
    else setVeiculos((data || []) as VeiculoRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return veiculos;
    return veiculos.filter((v) =>
      [v.marca, v.modelo, v.placa, v.tipo_veiculo].some((field) => (field || "").toLowerCase().includes(term)),
    );
  }, [search, veiculos]);

  const totalAtivos = veiculos.filter((v) => v.status === "ativo").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-muted-foreground">Cadastro completo e centralizado da frota para cálculo automático de corridas.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo veículo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total de veículos</p>
            <Car className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{veiculos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <Link2 className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalAtivos}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Com precificação</p>
            <Settings2 className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{veiculos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Tipos</p>
            <Car className="h-5 w-5 text-violet-500" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">Carro e VAN</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          placeholder="Buscar por placa, marca, modelo ou tipo..."
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Carregando veículos...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum veículo cadastrado. Use o botão <strong>+ Novo veículo</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{v.marca} {v.modelo}</h3>
                <Badge variant={v.status === "ativo" ? "default" : "secondary"}>{v.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Placa: {v.placa}</p>
              <p className="text-sm text-muted-foreground">Tipo: {v.tipo_veiculo.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">
                KM: R$ {v.valor_km.toFixed(2)} | Hora: R$ {v.valor_hora.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Bandeirada: R$ {v.tarifa_base.toFixed(2)} | Mínimo: R$ {v.valor_minimo_corrida.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      <CadastrarVeiculoDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={() => {
          void load();
        }}
      />
    </div>
  );
}
