import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos JSON devolvidos pelas RPCs `metricas_*` (definidas em
 * `supabase/migrations/20260520120000_metricas_dashboard_rpcs.sql`).
 *
 * Como as RPCs devolvem `Json` (jsonb genérico), declaramos aqui
 * os shapes que o frontend espera, com runtime parsing defensivo.
 */

export interface SparkPoint {
  d: string; // 'YYYY-MM-DD'
  v: number;
}

export interface MetricasKpis {
  period_days: number;
  period_start: string;
  period_end: string;
  frota_total: number;
  frota_ativa: number;
  frota_manutencao: number;
  frota_inativa: number;
  viagens_hoje_total: number;
  viagens_hoje_concluidas: number;
  viagens_hoje_andamento: number;
  viagens_hoje_pendentes: number;
  receita_mes: number;
  receita_dia: number;
  receita_periodo: number;
  receita_periodo_prev: number;
  viagens_periodo: number;
  viagens_periodo_prev: number;
  ticket_medio: number;
  utilizacao_pct: number;
  spark_receita: SparkPoint[];
  spark_viagens: SparkPoint[];
  error?: string;
}

export interface EvolucaoMensalPonto {
  mes: string; // 'YYYY-MM'
  label: string;
  receita: number;
  viagens: number;
}

export interface CanalPonto {
  mes: string;
  label: string;
  Transfer: number;
  Grupos: number;
  Motoristas: number;
  "Empty Legs": number;
}

export interface TopDestino {
  destino: string;
  viagens: number;
  receita: number;
}

export interface FunilEtapa {
  etapa: string;
  valor: number;
}

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function parseKpis(raw: unknown): MetricasKpis {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    period_days: num(r.period_days, 30),
    period_start: str(r.period_start),
    period_end: str(r.period_end),
    frota_total: num(r.frota_total),
    frota_ativa: num(r.frota_ativa),
    frota_manutencao: num(r.frota_manutencao),
    frota_inativa: num(r.frota_inativa),
    viagens_hoje_total: num(r.viagens_hoje_total),
    viagens_hoje_concluidas: num(r.viagens_hoje_concluidas),
    viagens_hoje_andamento: num(r.viagens_hoje_andamento),
    viagens_hoje_pendentes: num(r.viagens_hoje_pendentes),
    receita_mes: num(r.receita_mes),
    receita_dia: num(r.receita_dia),
    receita_periodo: num(r.receita_periodo),
    receita_periodo_prev: num(r.receita_periodo_prev),
    viagens_periodo: num(r.viagens_periodo),
    viagens_periodo_prev: num(r.viagens_periodo_prev),
    ticket_medio: num(r.ticket_medio),
    utilizacao_pct: num(r.utilizacao_pct),
    spark_receita: arr<{ d: unknown; v: unknown }>(r.spark_receita).map((p) => ({
      d: str(p.d),
      v: num(p.v),
    })),
    spark_viagens: arr<{ d: unknown; v: unknown }>(r.spark_viagens).map((p) => ({
      d: str(p.d),
      v: num(p.v),
    })),
    error: typeof r.error === "string" ? r.error : undefined,
  };
}

function parseEvolucao(raw: unknown): EvolucaoMensalPonto[] {
  return arr<Record<string, unknown>>(raw).map((p) => ({
    mes: str(p.mes),
    label: str(p.label),
    receita: num(p.receita),
    viagens: num(p.viagens),
  }));
}

function parseCanais(raw: unknown): CanalPonto[] {
  return arr<Record<string, unknown>>(raw).map((p) => ({
    mes: str(p.mes),
    label: str(p.label),
    Transfer: num(p.Transfer),
    Grupos: num(p.Grupos),
    Motoristas: num(p.Motoristas),
    "Empty Legs": num(p["Empty Legs"]),
  }));
}

function parseTopDestinos(raw: unknown): TopDestino[] {
  return arr<Record<string, unknown>>(raw).map((p) => ({
    destino: str(p.destino),
    viagens: num(p.viagens),
    receita: num(p.receita),
  }));
}

function parseFunil(raw: unknown): FunilEtapa[] {
  return arr<Record<string, unknown>>(raw).map((p) => ({
    etapa: str(p.etapa),
    valor: num(p.valor),
  }));
}

/**
 * Hook principal para o dashboard de Métricas.
 * Faz 5 chamadas RPC em paralelo e devolve um objeto agregado.
 *
 * O `periodDays` é o filtro principal (Hoje=1, 7d=7, 30d=30, 90d=90, YTD=variável).
 * O TanStack Query trata cache + refetch automático a cada 60 s.
 */
export function useMetricasDashboard(periodDays: number) {
  return useQuery({
    queryKey: ["metricas-dashboard", periodDays],
    queryFn: async () => {
      const [kpisRes, evRes, canalRes, topRes, funilRes] = await Promise.all([
        supabase.rpc("metricas_kpis", { p_period_days: periodDays }),
        supabase.rpc("metricas_evolucao_mensal"),
        supabase.rpc("metricas_solicitacoes_por_canal"),
        supabase.rpc("metricas_top_destinos", { p_limit: 5, p_period_days: Math.max(periodDays, 90) }),
        supabase.rpc("metricas_funil_conversao", { p_period_days: periodDays }),
      ]);

      // Devolvemos parcialmente, mesmo que uma RPC falhe (UI mostra fallback).
      return {
        kpis: parseKpis(kpisRes.data),
        evolucao: parseEvolucao(evRes.data),
        canais: parseCanais(canalRes.data),
        topDestinos: parseTopDestinos(topRes.data),
        funil: parseFunil(funilRes.data),
        errors: {
          kpis: kpisRes.error?.message ?? null,
          evolucao: evRes.error?.message ?? null,
          canais: canalRes.error?.message ?? null,
          topDestinos: topRes.error?.message ?? null,
          funil: funilRes.error?.message ?? null,
        },
      };
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

/**
 * Helpers expostos ao componente da página.
 */

export function calcDeltaPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  if (anterior <= 0) {
    if (atual <= 0) return 0;
    return null; // sem base de comparação → mostramos "—"
  }
  return ((atual - anterior) / anterior) * 100;
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatBRLPreciso(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const PERIOD_OPTIONS: ReadonlyArray<{ key: string; label: string; days: number }> = [
  { key: "1", label: "Hoje", days: 1 },
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
  { key: "365", label: "12 meses", days: 365 },
];
