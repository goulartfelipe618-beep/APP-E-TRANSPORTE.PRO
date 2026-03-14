import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ArrowLeftRight, Users, UserCheck, MapPin, Globe, Mail, TrendingUp } from "lucide-react";

interface Metrics {
  totalTransfers: number;
  totalGrupos: number;
  totalSolicitacoesTransfer: number;
  totalSolicitacoesGrupos: number;
  totalSolicitacoesMotoristas: number;
  totalSitesCriados: number;
  totalAutomacoes: number;
  cidadesMotoristas: { cidade: string; count: number }[];
  cidadesSolicitacoesMotoristas: { cidade: string; count: number }[];
  cidadesSolicitacoesTransfer: { cidade: string; count: number }[];
  cidadesSolicitacoesGrupos: { destino: string; count: number }[];
}

export default function AdminMetricas() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      const [
        { count: totalTransfers },
        { count: totalGrupos },
        { count: totalSolicitacoesTransfer },
        { count: totalSolicitacoesGrupos },
        { count: totalSolicitacoesMotoristas },
        { count: totalSitesCriados },
        { count: totalAutomacoes },
        { data: motoristas },
        { data: solMotoristas },
        { data: solTransfer },
        { data: solGrupos },
      ] = await Promise.all([
        supabase.from("reservas_transfer").select("*", { count: "exact", head: true }),
        supabase.from("reservas_grupos").select("*", { count: "exact", head: true }),
        supabase.from("solicitacoes_transfer").select("*", { count: "exact", head: true }),
        supabase.from("solicitacoes_grupos").select("*", { count: "exact", head: true }),
        supabase.from("solicitacoes_motoristas").select("*", { count: "exact", head: true }),
        supabase.from("configuracoes").select("*", { count: "exact", head: true }),
        supabase.from("automacoes").select("*", { count: "exact", head: true }),
        supabase.from("solicitacoes_motoristas").select("cidade"),
        supabase.from("solicitacoes_motoristas").select("cidade"),
        supabase.from("solicitacoes_transfer").select("embarque"),
        supabase.from("solicitacoes_grupos").select("destino"),
      ]);

      // Aggregate cities for motoristas
      const cidadesMotoristas = aggregateField(motoristas || [], "cidade");
      const cidadesSolicitacoesMotoristas = aggregateField(solMotoristas || [], "cidade");

      // For transfer, use embarque as region indicator
      const cidadesSolicitacoesTransfer = aggregateField(solTransfer || [], "embarque");
      const cidadesSolicitacoesGrupos = aggregateField(solGrupos || [], "destino");

      setMetrics({
        totalTransfers: totalTransfers || 0,
        totalGrupos: totalGrupos || 0,
        totalSolicitacoesTransfer: totalSolicitacoesTransfer || 0,
        totalSolicitacoesGrupos: totalSolicitacoesGrupos || 0,
        totalSolicitacoesMotoristas: totalSolicitacoesMotoristas || 0,
        totalSitesCriados: totalSitesCriados || 0,
        totalAutomacoes: totalAutomacoes || 0,
        cidadesMotoristas,
        cidadesSolicitacoesMotoristas,
        cidadesSolicitacoesTransfer,
        cidadesSolicitacoesGrupos,
      });
      setLoading(false);
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Métricas Gerais da Plataforma
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral de toda a operação — demandas, regiões e crescimento.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={ArrowLeftRight} label="Reservas Transfer" value={metrics.totalTransfers} />
        <KpiCard icon={Users} label="Reservas Grupos" value={metrics.totalGrupos} />
        <KpiCard icon={ArrowLeftRight} label="Solicitações Transfer" value={metrics.totalSolicitacoesTransfer} />
        <KpiCard icon={Users} label="Solicitações Grupos" value={metrics.totalSolicitacoesGrupos} />
        <KpiCard icon={UserCheck} label="Solicitações Motoristas" value={metrics.totalSolicitacoesMotoristas} />
        <KpiCard icon={Globe} label="Sites Criados" value={metrics.totalSitesCriados} />
        <KpiCard icon={Mail} label="Automações Criadas" value={metrics.totalAutomacoes} />
      </div>

      {/* Regional Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegionTable
          title="Cidades com Mais Motoristas"
          icon={UserCheck}
          data={metrics.cidadesMotoristas}
          fieldLabel="Cidade"
        />
        <RegionTable
          title="Cidades com Mais Solicitações de Motorista"
          icon={MapPin}
          data={metrics.cidadesSolicitacoesMotoristas}
          fieldLabel="Cidade"
        />
        <RegionTable
          title="Regiões com Mais Demandas de Transfer"
          icon={ArrowLeftRight}
          data={metrics.cidadesSolicitacoesTransfer}
          fieldLabel="Região / Embarque"
        />
        <RegionTable
          title="Destinos com Mais Demandas de Grupos"
          icon={Users}
          data={metrics.cidadesSolicitacoesGrupos}
          fieldLabel="Destino"
        />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function RegionTable({ title, icon: Icon, data, fieldLabel }: { title: string; icon: any; data: { cidade?: string; destino?: string; count: number }[]; fieldLabel: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 10).map((item, i) => {
            const name = (item as any).cidade || (item as any).destino || "Não informado";
            const maxCount = data[0]?.count || 1;
            const pct = (item.count / maxCount) * 100;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground truncate mr-2">{name}</span>
                  <span className="text-muted-foreground font-medium">{item.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function aggregateField(rows: any[], field: string): any[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const val = row[field]?.trim() || "Não informado";
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ [field]: key, count }))
    .sort((a, b) => b.count - a.count);
}
