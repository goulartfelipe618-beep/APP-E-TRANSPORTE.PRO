import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ArrowLeftRight, Users, UserCheck, MapPin, Globe, Mail, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isRlsOrPermissionError } from "@/lib/supabaseRlsErrors";

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
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      let rlsBlocked = false;

      const countOrZero = async (label: string, table: string) => {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        if (error) {
          if (isRlsOrPermissionError(error)) {
            rlsBlocked = true;
            return 0;
          }
          console.error(`[AdminMetricas] ${label}`, error);
          return 0;
        }
        return count ?? 0;
      };

      const rowsOrEmpty = async <T extends Record<string, unknown>>(
        label: string,
        q: PromiseLike<{ data: unknown; error: { message?: string; code?: string; status?: number; details?: string } | null }>,
      ): Promise<T[]> => {
        const { data, error } = await q;
        if (error) {
          if (isRlsOrPermissionError(error)) {
            rlsBlocked = true;
            return [];
          }
          console.error(`[AdminMetricas] ${label}`, error);
          return [];
        }
        return (data || []) as T[];
      };

      const [
        totalTransfers,
        totalGrupos,
        totalSolicitacoesTransfer,
        totalSolicitacoesGrupos,
        totalSolicitacoesMotoristas,
        totalSitesCriados,
        totalAutomacoes,
        motoristas,
        solMotoristas,
        solTransfer,
        solGrupos,
      ] = await Promise.all([
        countOrZero("reservas_transfer", "reservas_transfer"),
        countOrZero("reservas_grupos", "reservas_grupos"),
        countOrZero("solicitacoes_transfer", "solicitacoes_transfer"),
        countOrZero("solicitacoes_grupos", "solicitacoes_grupos"),
        countOrZero("solicitacoes_motoristas", "solicitacoes_motoristas"),
        countOrZero("configuracoes", "configuracoes"),
        countOrZero("automacoes", "automacoes"),
        rowsOrEmpty("motoristas cidades", supabase.from("solicitacoes_motoristas").select("cidade")),
        rowsOrEmpty("sol motoristas", supabase.from("solicitacoes_motoristas").select("cidade")),
        rowsOrEmpty("sol transfer", supabase.from("solicitacoes_transfer").select("embarque")),
        rowsOrEmpty("sol grupos", supabase.from("solicitacoes_grupos").select("destino")),
      ]);

      if (rlsBlocked) {
        setPermissionNotice(
          "Alguns totais ou listagens regionais estão limitados pelas políticas RLS (apenas dados visíveis para a sua sessão). " +
            "Se precisar de métricas globais, confirme que a conta tem papel de staff (admin) nas políticas Postgres.",
        );
      }

      const cidadesMotoristas = aggregateField(motoristas || [], "cidade");
      const cidadesSolicitacoesMotoristas = aggregateField(solMotoristas || [], "cidade");
      const cidadesSolicitacoesTransfer = aggregateField(solTransfer || [], "embarque");
      const cidadesSolicitacoesGrupos = aggregateField(solGrupos || [], "destino");

      setMetrics({
        totalTransfers,
        totalGrupos,
        totalSolicitacoesTransfer,
        totalSolicitacoesGrupos,
        totalSolicitacoesMotoristas,
        totalSitesCriados,
        totalAutomacoes,
        cidadesMotoristas,
        cidadesSolicitacoesMotoristas,
        cidadesSolicitacoesTransfer,
        cidadesSolicitacoesGrupos,
      });
      setLoading(false);
    };
    void fetchMetrics();
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

      {permissionNotice ? (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          <AlertTitle>Limiar de permissões (RLS)</AlertTitle>
          <AlertDescription>{permissionNotice}</AlertDescription>
        </Alert>
      ) : null}

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
