import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CampanhasLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activeCampaignWebhooks, setActiveCampaignWebhooks] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [leadRes, campaignRes, webhookRes] = await Promise.all([
      supabase
        .from("campanha_leads" as any)
        .select("*, campanhas(id, nome, slug)")
        .order("created_at", { ascending: false }),
      supabase.from("campanhas" as any).select("id, nome, slug").order("nome", { ascending: true }),
      supabase
        .from("automacoes")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "campanha")
        .eq("is_campaign_webhook", true)
        .eq("ativo", true),
    ]);

    if (leadRes.error) toast.error("Erro ao carregar leads.");
    else setLeads(leadRes.data || []);

    if (!campaignRes.error) setCampaigns(campaignRes.data || []);
    setActiveCampaignWebhooks(webhookRes.count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const byCampaign = campaignFilter === "all" || lead.campanha_id === campaignFilter;
      if (!byCampaign) return false;
      if (!search.trim()) return true;
      const text = JSON.stringify(lead.payload || {}).toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [campaignFilter, leads, search]);

  const exportCsv = () => {
    if (filteredLeads.length === 0) {
      toast.error("Não há leads para exportar.");
      return;
    }
    const header = ["campanha", "slug_campanha", "data", "payload_json"];
    const rows = filteredLeads.map((lead) => [
      lead.campanhas?.nome || "",
      lead.campanhas?.slug || "",
      new Date(lead.created_at).toISOString(),
      JSON.stringify(lead.payload || {}).replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `campanhas-leads-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">Leads recebidos pelos webhooks de campanha</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Webhooks de campanha ativos: {activeCampaignWebhooks}</Badge>
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Campanha</label>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger><SelectValue placeholder="Todas as Campanhas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Campanhas</SelectItem>
                {campaigns.map((campanha) => (
                  <SelectItem key={campanha.id} value={campanha.id}>{campanha.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Busca no payload</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: telefone, nome, utm_source" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Todos os Leads de Campanhas ({filteredLeads.length})</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filteredLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead encontrado para os filtros atuais.</p>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{lead.campanhas?.nome || "Campanha removida"}</p>
                    <p className="text-xs text-muted-foreground">
                      Recebido em {new Date(lead.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline">{lead.campanhas?.slug || "sem-slug"}</Badge>
                </div>
                <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto">
                  {JSON.stringify(lead.payload || {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
