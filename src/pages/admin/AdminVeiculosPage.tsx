import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Eye,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
const VIEW_STORAGE_KEY = "etp_admin_veiculos_view";

const IMAGE_FIELDS: { key: string; label: string }[] = [
  { key: "dianteira", label: "Dianteira" },
  { key: "traseira", label: "Traseira" },
  { key: "lateral_esquerda", label: "Lateral esquerda" },
  { key: "lateral_direita", label: "Lateral direita" },
  { key: "externa_1", label: "Externa adicional 1" },
  { key: "externa_2", label: "Externa adicional 2" },
  { key: "externa_3", label: "Externa adicional 3" },
  { key: "externa_4", label: "Externa adicional 4" },
  { key: "interna_1", label: "Interna 1" },
  { key: "interna_2", label: "Interna 2" },
  { key: "interna_3", label: "Interna 3" },
  { key: "interna_4", label: "Interna 4" },
];

type ViewMode = "cards" | "table";

type UserConfigRow = {
  nome_completo: string | null;
  nome_empresa: string | null;
};

/** Linha completa de veículos_frota (tipos locais — tabela pode não estar em Database). */
export type VeiculoFrotaAdminRow = {
  id: string;
  user_id: string;
  tipo_veiculo: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string | null;
  placa: string;
  combustivel: string;
  renavam: string | null;
  chassi: string | null;
  status: string;
  observacoes: string | null;
  valor_km: number;
  valor_hora: number;
  tarifa_base: number;
  valor_minimo_corrida: number;
  distancia_minima_km: number;
  tempo_tolerancia_min: number;
  valor_hora_espera: number;
  fracao_tempo_min: number;
  tipo_cobranca: string;
  multiplicador_ida_volta: number;
  permitir_preco_fixo_rota: boolean;
  taxa_noturna_percentual: number;
  taxa_aeroporto_fixa: number;
  pedagio_modo: string;
  taxas_extras_json: Json | null;
  imagens_json: Json | null;
  imagem_capa_url: string | null;
  created_at: string;
  updated_at: string;
};

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "cards";
  const v = localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "table" ? "table" : "cards";
}

function brl(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function taxasExtrasFromJson(json: Json | null): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "—";
  const o = json as Record<string, unknown>;
  const d = o.descricao ?? o.observacao ?? o.texto;
  return typeof d === "string" && d.trim() ? d : "—";
}

function imagensJsonToRecord(json: Json | null): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (k === "capa") continue;
    if (typeof v === "string" && v.startsWith("http")) out[k] = v;
  }
  return out;
}

const COMBUSTIVEL_LABEL: Record<string, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  diesel: "Diesel",
  eletrico: "Elétrico",
};

function motoristaLabel(userId: string, cfg: UserConfigRow | undefined): string {
  const nome = cfg?.nome_completo?.trim() || cfg?.nome_empresa?.trim();
  const short = `${userId.slice(0, 8)}…`;
  return nome ? `${nome} (${short})` : short;
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export default function AdminVeiculosPage() {
  const [rows, setRows] = useState<VeiculoFrotaAdminRow[]>([]);
  const [userById, setUserById] = useState<Record<string, UserConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => readInitialView());
  const [detail, setDetail] = useState<VeiculoFrotaAdminRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("veiculos_frota")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os veículos.");
      setRows([]);
      setUserById({});
      setLoading(false);
      return;
    }

    const list = (data || []) as VeiculoFrotaAdminRow[];
    setRows(list);

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      setUserById({});
      setLoading(false);
      return;
    }

    const { data: cfgRows, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("user_id, nome_completo, nome_empresa")
      .in("user_id", userIds);

    if (cfgErr) {
      toast.error("Não foi possível carregar nomes dos motoristas.");
      setUserById({});
    } else {
      const map: Record<string, UserConfigRow> = {};
      for (const row of (cfgRows || []) as { user_id: string; nome_completo: string | null; nome_empresa: string | null }[]) {
        map[row.user_id] = { nome_completo: row.nome_completo, nome_empresa: row.nome_empresa };
      }
      setUserById(map);
    }
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((v) => {
      const cfg = userById[v.user_id];
      const motoristaNome = [cfg?.nome_completo, cfg?.nome_empresa].filter(Boolean).join(" ").toLowerCase();
      return [v.marca, v.modelo, v.placa, v.tipo_veiculo, motoristaNome, v.user_id].some((field) =>
        (field || "").toLowerCase().includes(term),
      );
    });
  }, [search, rows, userById]);

  const detailImagens = detail ? imagensJsonToRecord(detail.imagens_json) : {};

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Veículos (frota dos motoristas)</h1>
          <p className="text-pretty text-sm text-muted-foreground sm:text-base">
            Visualização completa e somente leitura de todos os veículos cadastrados pelos motoristas executivos. O admin não pode
            editar daqui.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => void load()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Total na plataforma</p>
            <Car className="h-5 w-5 shrink-0 text-[#FF6600]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">Após filtro</p>
            <Eye className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{filtered.length}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-w-0 flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Buscar por placa, marca, motorista, tipo..."
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
          Nenhum veículo encontrado.
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const cfg = userById[v.user_id];
            return (
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
                  <p className="truncate text-xs text-muted-foreground" title={v.user_id}>
                    {motoristaLabel(v.user_id, cfg)}
                  </p>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 font-semibold leading-snug text-foreground">
                      {v.marca} {v.modelo}
                    </h3>
                    <Badge variant={v.status === "ativo" ? "default" : "secondary"} className="shrink-0">
                      {v.status}
                    </Badge>
                  </div>
                  <p className="truncate font-mono text-sm text-muted-foreground">Placa: {v.placa}</p>
                  <p className="text-sm text-muted-foreground">Tipo: {v.tipo_veiculo.toUpperCase()}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    KM: {brl(v.valor_km)} | Hora: {brl(v.valor_hora)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full border-[#FF6600]/40 text-[#FF6600] hover:bg-[#FF6600]/10"
                    onClick={() => setDetail(v)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver detalhes (somente leitura)
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="w-24 p-2 sm:p-3">Capa</th>
                <th className="p-2 sm:p-3">Motorista</th>
                <th className="p-2 sm:p-3">Marca / Modelo</th>
                <th className="p-2 sm:p-3">Placa</th>
                <th className="p-2 sm:p-3">Tipo</th>
                <th className="p-2 sm:p-3">Status</th>
                <th className="hidden p-2 lg:table-cell lg:p-3">Valores</th>
                <th className="w-[1%] whitespace-nowrap p-2 text-right sm:p-3">—</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const cfg = userById[v.user_id];
                return (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="p-2 sm:p-3">
                      <div className="relative h-14 w-20 overflow-hidden rounded-md border border-border bg-muted sm:h-16 sm:w-24">
                        {v.imagem_capa_url ? (
                          <img src={v.imagem_capa_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Car className="h-6 w-6 opacity-50" aria-hidden />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[12rem] p-2 text-xs sm:p-3">
                      <span className="line-clamp-2">{motoristaLabel(v.user_id, cfg)}</span>
                    </td>
                    <td className="max-w-[10rem] p-2 sm:max-w-none sm:p-3">
                      <span className="line-clamp-2 font-medium text-foreground">
                        {v.marca} {v.modelo}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2 font-mono text-xs sm:p-3 sm:text-sm">{v.placa}</td>
                    <td className="whitespace-nowrap p-2 sm:p-3">{v.tipo_veiculo.toUpperCase()}</td>
                    <td className="p-2 sm:p-3">
                      <Badge variant={v.status === "ativo" ? "default" : "secondary"} className="text-xs">
                        {v.status}
                      </Badge>
                    </td>
                    <td className="hidden max-w-[14rem] p-2 text-xs lg:table-cell lg:p-3">
                      <span className="line-clamp-2">
                        KM {brl(v.valor_km)} · band. {brl(v.tarifa_base)}
                      </span>
                    </td>
                    <td className="p-2 text-right sm:p-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[#FF6600]/40 text-[#FF6600] hover:bg-[#FF6600]/10"
                        onClick={() => setDetail(v)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Detalhes</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col gap-0 overflow-y-auto sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          {detail && (
            <>
              <SheetHeader className="space-y-1 border-b border-border pb-4 text-left">
                <SheetTitle className="pr-8">
                  {detail.marca} {detail.modelo}
                </SheetTitle>
                <SheetDescription>
                  Auditoria e dados completos do cadastro — somente leitura. ID do veículo:{" "}
                  <span className="font-mono text-xs">{detail.id}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-4">
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Proprietário (motorista)</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField label="user_id" value={<span className="font-mono text-xs break-all">{detail.user_id}</span>} />
                    <DetailField
                      label="Nome / empresa (configurações)"
                      value={
                        [userById[detail.user_id]?.nome_completo, userById[detail.user_id]?.nome_empresa]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      }
                    />
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Identificação do veículo</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Tipo" value={detail.tipo_veiculo.toUpperCase()} />
                    <DetailField label="Status" value={detail.status} />
                    <DetailField label="Marca" value={detail.marca} />
                    <DetailField label="Modelo" value={detail.modelo} />
                    <DetailField label="Ano" value={detail.ano} />
                    <DetailField label="Cor" value={detail.cor || "—"} />
                    <DetailField label="Placa" value={detail.placa} />
                    <DetailField
                      label="Combustível"
                      value={COMBUSTIVEL_LABEL[detail.combustivel] || detail.combustivel}
                    />
                    <DetailField label="RENAVAM" value={detail.renavam || "—"} />
                    <DetailField label="Chassi" value={detail.chassi || "—"} />
                  </div>
                  <div className="mt-3">
                    <DetailField label="Observações" value={detail.observacoes || "—"} />
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Valores e regras de corrida</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Valor por KM" value={brl(detail.valor_km)} />
                    <DetailField label="Valor por hora" value={brl(detail.valor_hora)} />
                    <DetailField label="Tarifa base (bandeirada)" value={brl(detail.tarifa_base)} />
                    <DetailField label="Valor mínimo da corrida" value={brl(detail.valor_minimo_corrida)} />
                    <DetailField label="Distância mínima (km)" value={String(detail.distancia_minima_km)} />
                    <DetailField label="Tipo de cobrança" value={detail.tipo_cobranca} />
                    <DetailField label="Tolerância (min)" value={String(detail.tempo_tolerancia_min)} />
                    <DetailField label="Valor/hora de espera" value={brl(detail.valor_hora_espera)} />
                    <DetailField label="Cobrança por fração (min)" value={String(detail.fracao_tempo_min)} />
                    <DetailField label="Multiplicador ida e volta" value={String(detail.multiplicador_ida_volta)} />
                    <DetailField
                      label="Permitir preço fixo por rota"
                      value={detail.permitir_preco_fixo_rota ? "Sim" : "Não"}
                    />
                    <DetailField label="Taxa noturna (%)" value={String(detail.taxa_noturna_percentual)} />
                    <DetailField label="Taxa aeroporto (fixa)" value={brl(detail.taxa_aeroporto_fixa)} />
                    <DetailField label="Pedágio" value={detail.pedagio_modo} />
                    <DetailField label="Taxas extras (texto)" value={taxasExtrasFromJson(detail.taxas_extras_json)} />
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Imagem de capa</h3>
                  {detail.imagem_capa_url ? (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <img
                        src={detail.imagem_capa_url}
                        alt="Capa"
                        className="aspect-[1220/880] w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem capa registada.</p>
                  )}
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Imagens do veículo (cadastro)</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {IMAGE_FIELDS.map((field) => {
                      const url = detailImagens[field.key];
                      return (
                        <div key={field.key} className="min-w-0 rounded-lg border border-border p-2">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">{field.label}</p>
                          {url ? (
                            <div className="overflow-hidden rounded-md border border-border bg-muted">
                              <img src={url} alt={field.label} className="h-40 w-full object-cover" loading="lazy" />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Auditoria</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField
                      label="Criado em"
                      value={new Date(detail.created_at).toLocaleString("pt-BR")}
                    />
                    <DetailField
                      label="Atualizado em"
                      value={new Date(detail.updated_at).toLocaleString("pt-BR")}
                    />
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
