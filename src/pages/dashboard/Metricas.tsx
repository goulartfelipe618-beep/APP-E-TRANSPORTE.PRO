import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Calendar as CalendarIcon,
  Map as MapIcon,
  ArrowLeftRight,
  Users,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  PieChart as PieChartIcon,
  Filter,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CountUp from "react-countup";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useMetricasDashboard,
  calcDeltaPct,
  formatBRL,
  formatBRLPreciso,
  PERIOD_OPTIONS,
  type MetricasKpis,
  type SparkPoint,
} from "@/hooks/useMetricasDashboard";
import type { Tables } from "@/integrations/supabase/types";

const ACCENT = "#FF6600"; // acento laranja do projeto

// =====================================================================
// Helpers UI
// =====================================================================

type Tone = "up" | "down" | "neutral";

function deltaTone(delta: number | null): Tone {
  if (delta === null) return "neutral";
  if (delta > 0.5) return "up";
  if (delta < -0.5) return "down";
  return "neutral";
}

function DeltaPill({ delta }: { delta: number | null }) {
  const tone = deltaTone(delta);
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const color =
    tone === "up"
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : tone === "down"
        ? "text-red-500 bg-red-500/10 border-red-500/20"
        : "text-muted-foreground bg-muted/40 border-border";
  const label =
    delta === null
      ? "—"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Sparkline({
  data,
  stroke = ACCENT,
  fill = "url(#spark-orange)",
  height = 40,
}: {
  data: SparkPoint[];
  stroke?: string;
  fill?: string;
  height?: number;
}) {
  if (!data.length) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spark-orange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.6}
          fill={fill}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({
  icon: Icon,
  label,
  children,
  spark,
  delta,
  footer,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  spark?: SparkPoint[];
  delta?: number | null;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors hover:border-orange-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </span>
          <div className="mt-1 text-3xl font-bold text-foreground leading-tight">{children}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Icon className="h-5 w-5 text-orange-500" />
          {delta !== undefined && <DeltaPill delta={delta} />}
        </div>
      </div>
      {spark && spark.length > 0 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={spark} />
        </div>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function StatusChip({
  tone,
  label,
  value,
}: {
  tone: "ok" | "warn" | "err" | "muted";
  label: string;
  value: number;
}) {
  const color =
    tone === "ok"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "err"
          ? "text-red-500"
          : "text-muted-foreground";
  return (
    <div className="flex flex-col items-start">
      <span className={`text-lg font-bold ${color}`}>
        <CountUp end={value} duration={0.6} />
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

// =====================================================================
// Side queries (Operações + filtros independentes do RPC principal)
// =====================================================================

type ReservaTransfer = Tables<"reservas_transfer">;
type ReservaGrupo = Tables<"reservas_grupos">;

function useUltimosTransfers() {
  return useQuery({
    queryKey: ["metricas-ultimos-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas_transfer")
        .select("id,numero_reserva,nome_completo,ida_embarque,ida_desembarque,ida_data,valor_total,status")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Array<Pick<
        ReservaTransfer,
        "id" | "numero_reserva" | "nome_completo" | "ida_embarque" | "ida_desembarque" | "ida_data" | "valor_total" | "status"
      >>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function useUltimosGrupos() {
  return useQuery({
    queryKey: ["metricas-ultimos-grupos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas_grupos")
        .select("id,numero_reserva,nome_completo,embarque,destino,data_ida,num_passageiros,valor_total,status")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Array<Pick<
        ReservaGrupo,
        "id" | "numero_reserva" | "nome_completo" | "embarque" | "destino" | "data_ida" | "num_passageiros" | "valor_total" | "status"
      >>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function statusBadge(status: string | null | undefined) {
  const v = (status ?? "").toLowerCase();
  if (v.startsWith("conclu") || v === "finalizado")
    return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Concluída</Badge>;
  if (v.startsWith("cancel"))
    return <Badge className="bg-red-500/15 text-red-500 border-red-500/30">Cancelada</Badge>;
  if (v.includes("andamento") || v === "iniciada" || v === "pausado")
    return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30">Em andamento</Badge>;
  if (v === "ativa" || v === "ativo")
    return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Ativa</Badge>;
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
}

function fmtData(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

// =====================================================================
// Página principal
// =====================================================================

export default function MetricasPage() {
  const [periodKey, setPeriodKey] = useState<string>("30");
  const [refreshKey, setRefreshKey] = useState(0);
  const periodDays = useMemo(
    () => PERIOD_OPTIONS.find((p) => p.key === periodKey)?.days ?? 30,
    [periodKey],
  );

  const { data, isLoading, isFetching, refetch } = useMetricasDashboard(periodDays);
  const ultimosTransfers = useUltimosTransfers();
  const ultimosGrupos = useUltimosGrupos();

  // Animação de "live": pequena marca verde quando faz refetch automático.
  const [livePulse, setLivePulse] = useState(false);
  useEffect(() => {
    if (isFetching && !isLoading) {
      setLivePulse(true);
      const t = setTimeout(() => setLivePulse(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isFetching, isLoading]);

  const k: MetricasKpis | undefined = data?.kpis;

  const deltaReceita = k ? calcDeltaPct(k.receita_periodo, k.receita_periodo_prev) : null;
  const deltaViagens = k ? calcDeltaPct(k.viagens_periodo, k.viagens_periodo_prev) : null;

  const topMaxViagens = useMemo(() => {
    const max = (data?.topDestinos ?? []).reduce((m, d) => Math.max(m, d.viagens), 0);
    return Math.max(max, 1);
  }, [data?.topDestinos]);

  const funilMax = useMemo(() => {
    const max = (data?.funil ?? []).reduce((m, d) => Math.max(m, d.valor), 0);
    return Math.max(max, 1);
  }, [data?.funil]);

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-orange-500" /> Métricas
            {livePulse && (
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            Indicadores de performance e KPIs do seu negócio. Atualização automática a cada 60 s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  periodKey === p.key
                    ? "bg-orange-500 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setRefreshKey((k) => k + 1);
              void refetch();
            }}
            disabled={isFetching}
            title="Atualizar agora"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              key={refreshKey}
            />
          </Button>
        </div>
      </div>

      {/* ============================ ZONA 1: KPI HERO ============================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !k ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[170px] rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard
              icon={Truck}
              label="Frota Ativa"
              footer={
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {k.frota_ativa} de {k.frota_total} veículos
                  </span>
                  <span className="text-muted-foreground">
                    {k.frota_total > 0
                      ? `${Math.round((k.frota_ativa / k.frota_total) * 100)}%`
                      : "—"}
                  </span>
                </div>
              }
            >
              <CountUp end={k.frota_ativa} duration={0.8} />
              <span className="text-base font-medium text-muted-foreground"> /{k.frota_total}</span>
            </KpiCard>

            <KpiCard
              icon={ArrowLeftRight}
              label="Viagens Hoje"
              footer={
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <StatusChip tone="ok" label="Concluí." value={k.viagens_hoje_concluidas} />
                  <StatusChip tone="warn" label="Andam." value={k.viagens_hoje_andamento} />
                  <StatusChip tone="muted" label="Pend." value={k.viagens_hoje_pendentes} />
                </div>
              }
            >
              <CountUp end={k.viagens_hoje_total} duration={0.8} />
            </KpiCard>

            <KpiCard
              icon={Activity}
              label="Utilização da Frota"
              spark={k.spark_viagens}
              footer={
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {k.viagens_periodo} viagens / {k.frota_total || 0} veículos
                  </span>
                  <span className="text-muted-foreground">últimos {k.period_days}d</span>
                </div>
              }
            >
              <CountUp end={k.utilizacao_pct} duration={0.8} decimals={1} suffix="%" />
            </KpiCard>

            <KpiCard
              icon={Wallet}
              label={`Receita (${k.period_days}d)`}
              spark={k.spark_receita}
              delta={deltaReceita}
              footer={
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Mês: {formatBRL(k.receita_mes)}</span>
                  <span className="text-muted-foreground">Hoje: {formatBRL(k.receita_dia)}</span>
                </div>
              }
            >
              <span className="text-2xl">
                <CountUp
                  end={k.receita_periodo}
                  duration={0.9}
                  prefix="R$ "
                  separator="."
                  decimals={0}
                />
              </span>
            </KpiCard>
          </>
        )}
      </div>

      {/* Linha extra de KPIs (Ticket Médio + Δ Viagens) */}
      {k && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ticket Médio (período)
              </span>
              <p className="text-xl font-bold text-foreground mt-1">
                {formatBRLPreciso(k.ticket_medio)}
              </p>
            </div>
            <Wallet className="h-5 w-5 text-orange-500" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Viagens (período)
              </span>
              <p className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
                <CountUp end={k.viagens_periodo} duration={0.8} />
                <DeltaPill delta={deltaViagens} />
              </p>
            </div>
            <ArrowLeftRight className="h-5 w-5 text-orange-500" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Status da Frota
              </span>
              <div className="grid grid-cols-3 gap-3 mt-1">
                <StatusChip tone="ok" label="Ativos" value={k.frota_ativa} />
                <StatusChip tone="warn" label="Manutenç." value={k.frota_manutencao} />
                <StatusChip tone="err" label="Inativos" value={k.frota_inativa} />
              </div>
            </div>
            <Truck className="h-5 w-5 text-orange-500" />
          </div>
        </div>
      )}

      {/* ====================== ZONA 2: GRÁFICOS PRINCIPAIS ====================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução Mensal — ComposedChart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Evolução Mensal</h3>
            </div>
            <span className="text-xs text-muted-foreground">Últimos 12 meses</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data?.evolucao ?? []} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,22%)" />
                <XAxis dataKey="label" stroke="hsl(0,0%,55%)" fontSize={11} />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(0,0%,55%)"
                  fontSize={11}
                  tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(0,0%,55%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220,12%,12%)",
                    border: "1px solid hsl(220,10%,22%)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) =>
                    name === "Receita" ? [formatBRLPreciso(value), name] : [value, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill="url(#rev-grad)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="viagens"
                  name="Viagens"
                  fill="hsl(220,15%,40%)"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="viagens"
                  name="Tendência"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Solicitações por Canal — Stacked Bar */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Solicitações por Canal</h3>
            </div>
            <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.canais ?? []} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,22%)" />
                <XAxis dataKey="label" stroke="hsl(0,0%,55%)" fontSize={11} />
                <YAxis stroke="hsl(0,0%,55%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220,12%,12%)",
                    border: "1px solid hsl(220,10%,22%)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Transfer" stackId="a" fill={ACCENT} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Grupos" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Motoristas" stackId="a" fill="#10b981" />
                <Bar dataKey="Empty Legs" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ============================ ZONA 3: OPERAÇÕES ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimos Transfers */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Últimos Transfers</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {ultimosTransfers.data?.length ?? 0}
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {ultimosTransfers.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 m-3" />
              ))
            ) : !ultimosTransfers.data?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Sem transfers cadastrados ainda.
              </div>
            ) : (
              ultimosTransfers.data.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      #{r.numero_reserva ?? "?"} · {r.nome_completo ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.ida_embarque ?? "—"} → {r.ida_desembarque ?? "—"} · {fmtData(r.ida_data)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {formatBRLPreciso(Number(r.valor_total ?? 0))}
                    </p>
                    {statusBadge(r.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Últimos Grupos */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Últimos Grupos</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {ultimosGrupos.data?.length ?? 0}
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {ultimosGrupos.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 m-3" />
              ))
            ) : !ultimosGrupos.data?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Sem grupos cadastrados ainda.
              </div>
            ) : (
              ultimosGrupos.data.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      #{r.numero_reserva ?? "?"} · {r.nome_completo ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.embarque ?? "—"} → {r.destino ?? "—"} ·{" "}
                      {r.num_passageiros ?? 0} pax · {fmtData(r.data_ida)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {formatBRLPreciso(Number(r.valor_total ?? 0))}
                    </p>
                    {statusBadge(r.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================ ZONA 4: INTELLIGENCE ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 destinos */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Top 5 Destinos</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              últimos {Math.max(periodDays, 90)}d
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : !data?.topDestinos?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              Sem dados de destinos no período.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.topDestinos.map((d, i) => {
                const pct = (d.viagens / topMaxViagens) * 100;
                return (
                  <li key={`${d.destino}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground truncate flex-1">
                        <span className="text-orange-500 mr-2">{i + 1}.</span>
                        {d.destino}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.viagens} viagens · {formatBRL(d.receita)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Funil de Conversão */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-foreground">Funil de Conversão</h3>
            </div>
            <span className="text-xs text-muted-foreground">últimos {periodDays}d</span>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data?.funil?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sem dados de funil.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.funil.map((f, i) => {
                const pct = (f.valor / funilMax) * 100;
                const taxa =
                  i > 0 && data.funil[0].valor > 0
                    ? `${((f.valor / data.funil[0].valor) * 100).toFixed(0)}% do topo`
                    : i === 0
                      ? "topo do funil"
                      : "—";
                const Icon =
                  i === 0 ? AlertCircle : i === 1 ? Clock : CheckCircle;
                return (
                  <li key={f.etapa}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-foreground inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-orange-500" />
                        {f.etapa}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{f.valor}</strong> · {taxa}
                      </span>
                    </div>
                    <div className="h-7 w-full rounded-md bg-muted overflow-hidden flex items-center">
                      <div
                        className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                        style={{
                          width: `${Math.max(pct, 5)}%`,
                          background:
                            i === 0
                              ? "linear-gradient(90deg, #FF6600 0%, #FF8533 100%)"
                              : i === 1
                                ? "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
                                : "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                        }}
                      >
                        <span className="text-[10px] font-bold text-white drop-shadow">
                          {f.valor}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Rodapé com estado */}
      {data?.errors &&
        Object.values(data.errors).some((e) => e) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            <strong>Aviso:</strong> alguns blocos não puderam ser atualizados:&nbsp;
            {Object.entries(data.errors)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </div>
        )}
    </div>
  );
}
