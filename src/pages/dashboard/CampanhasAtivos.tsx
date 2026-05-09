import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateYmd } from "@/lib/localCalendarDate";
import { toast } from "sonner";
import { SolicitacoesCapturaExternaInfo } from "@/components/solicitacoes/SolicitacoesCapturaExternaInfo";
import { useUserPlan } from "@/hooks/useUserPlan";
import { minimumPlanForPage, pageAllowedForPlan } from "@/lib/painelPlanPolicy";
import PlanTierOpaqueGate from "@/components/planos/PlanTierOpaqueGate";

const CAMPAIGN_COLORS = [
  "#3B82F6", "#10B981", "#F43F5E", "#F59E0B",
  "#A78BFA", "#F97316", "#EC4899", "#06B6D4",
];

export default function CampanhasAtivosPage() {
  const { plano, loading: planLoading } = useUserPlan();
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(CAMPAIGN_COLORS[0]);
  const [nome, setNome] = useState("");
  const [fonte, setFonte] = useState("");
  const [linkCampanha, setLinkCampanha] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("ativa");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campanhas, setCampanhas] = useState<any[]>([]);

  const slugify = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  const resetForm = () => {
    setNome("");
    setFonte("");
    setLinkCampanha("");
    setDescricao("");
    setStatus("ativa");
    setSelectedColor(CAMPAIGN_COLORS[0]);
    setDataInicio("");
    setDataFim("");
  };

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    let uid = sessionData.session?.user?.id;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData.user?.id;
    }
    if (!uid) {
      setCampanhas([]);
      setLoading(false);
      return;
    }
    const { error: rpcErr } = await supabase.rpc("ensure_my_campaign_webhooks" as never);
    if (rpcErr) {
      console.warn("ensure_my_campaign_webhooks:", rpcErr.message);
    }
    const { data, error } = await supabase
      .from("campanhas" as any)
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar campanhas");
      setCampanhas([]);
    } else {
      setCampanhas(data || []);
    }
    setLoading(false);
  }, []);

  const syncExpiredCampaigns = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return;
    const todayYmd = getLocalDateYmd();
    const { data, error } = await supabase
      .from("campanhas" as any)
      .select("id")
      .eq("user_id", uid)
      .eq("status", "ativa")
      .lt("data_fim", todayYmd);
    if (error || !data || data.length === 0) return;
    const ids = data.map((c: any) => c.id);
    await supabase.from("campanhas" as any).update({ status: "encerrada" }).in("id", ids);
    await supabase.from("automacoes").delete().in("campanha_id", ids);
  }, []);

  useEffect(() => {
    (async () => {
      await syncExpiredCampaigns();
      await fetchCampanhas();
    })();
  }, [fetchCampanhas, syncExpiredCampaigns]);

  const handleCreate = async () => {
    if (!nome.trim() || !dataInicio || !dataFim) {
      toast.error("Nome, data de início e data de término são obrigatórios.");
      return;
    }
    if (dataFim < dataInicio) {
      toast.error("A data de término deve ser maior ou igual à data de início.");
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      toast.error("Sessão inválida. Faça login novamente.");
      setSaving(false);
      return;
    }

    const baseSlug = slugify(nome);
    const finalSlug = `${baseSlug || "campanha"}-${Date.now().toString().slice(-6)}`;

    const { data: campanha, error: campanhaError } = await (supabase
      .from("campanhas" as any)
      .insert({
        user_id: user.id,
        nome: nome.trim(),
        slug: finalSlug,
        plataforma_fonte: fonte || null,
        link_campanha: linkCampanha || null,
        cor: selectedColor,
        descricao: descricao || null,
        status,
        data_inicio: dataInicio,
        data_fim: dataFim,
      })
      .select("*")
      .single() as any);

    if (campanhaError || !campanha) {
      toast.error(`Erro ao criar campanha: ${campanhaError?.message || "desconhecido"}`);
      setSaving(false);
      return;
    }

    const { error: automacaoError } = await supabase.from("automacoes").insert({
      user_id: user.id,
      nome: campanha.nome,
      tipo: "campanha",
      /** Activo para POST externos gravarem em campanha_leads (não só «testes»). */
      ativo: true,
      mappings: {},
      campanha_id: campanha.id,
      is_campaign_webhook: true,
    } as any);

    if (automacaoError) {
      // O DELETE pode falhar enquanto a campanha está "ativa" no período (trigger). Pausar antes remove o bloqueio.
      await supabase.from("campanhas" as any).update({ status: "pausada" }).eq("id", campanha.id);
      await supabase.from("campanhas" as any).delete().eq("id", campanha.id);
      toast.error(`Erro ao criar webhook automático: ${automacaoError.message}`);
      setSaving(false);
      return;
    }

    toast.success(
      "Campanha criada. Copie o URL do webhook em Automações → secção «Webhooks de campanha». Os POSTs aparecem em Campanhas → Leads.",
    );
    setSaving(false);
    setOpen(false);
    resetForm();
    fetchCampanhas();
  };

  const campanhasAtivas = campanhas.filter((c) => c.status !== "encerrada");
  const campanhasEncerradas = campanhas.filter((c) => c.status === "encerrada");

  if (planLoading) {
    return <div className="flex justify-center py-20 text-sm text-muted-foreground">A carregar…</div>;
  }

  return (
    <PlanTierOpaqueGate
      minimumPlan={minimumPlanForPage("campanhas/ativos")}
      blocked={!pageAllowedForPlan(plano, "campanhas/ativos")}
      title="Campanhas — Ativos (visualização)"
      description="Crie e gira campanhas com webhooks dedicados e período de captação."
    >
    <div className="space-y-6">
      <SolicitacoesCapturaExternaInfo variant="campanhas-ativos" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas Ativas</h1>
          <p className="text-muted-foreground">
            Só vê as suas campanhas. Após a data de término, a campanha encerra e o respetivo webhook é removido
            automaticamente. O URL do webhook está em <strong className="text-foreground">Automações</strong> → Webhooks
            de campanha.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchCampanhas}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Campanha</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Campanhas Ativas</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : campanhasAtivas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma campanha ativa encontrada.</p>
        ) : (
          <div className="space-y-3">
            {campanhasAtivas.map((campanha) => (
              <div key={campanha.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: campanha.cor || "#3B82F6" }} />
                    <h4 className="font-semibold text-foreground">{campanha.nome}</h4>
                    <Badge variant={campanha.status === "ativa" ? "default" : "outline"}>{campanha.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{campanha.descricao || "Sem descrição."}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-xs text-foreground flex flex-wrap items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Início: <strong>{new Date(`${campanha.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}</strong></span>
                  <span>|</span>
                  <span>Término: <strong>{new Date(`${campanha.data_fim}T00:00:00`).toLocaleDateString("pt-BR")}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Campanhas Encerradas</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : campanhasEncerradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma campanha encerrada.</p>
        ) : (
          <div className="space-y-2">
            {campanhasEncerradas.map((campanha) => (
              <div key={campanha.id} className="rounded-lg border border-border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{campanha.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Período: {new Date(`${campanha.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")} - {new Date(`${campanha.data_fim}T00:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="secondary">Encerrada</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>
              Cria a campanha e um webhook na sua conta (visível em Automações → Webhooks de campanha). Os leads chegam a
              Campanhas → Leads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div><Label>Nome da Campanha *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Facebook Ads - Aluguel de Luxo" /></div>
            <div><Label>Plataforma/Fonte</Label><Input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex: Google, Meta, Landing Page" /></div>
            <div><Label>Link da Campanha</Label><Input value={linkCampanha} onChange={(e) => setLinkCampanha(e.target.value)} placeholder="https://exemplo.com/campanha" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Data de Início *</Label><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
              <div><Label>Data de Término *</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
            </div>
            <div>
              <Label>Cor da Campanha</Label>
              <div className="flex gap-2 mt-2">
                {CAMPAIGN_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${selectedColor === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva a campanha..." /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? "Criando..." : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PlanTierOpaqueGate>
  );
}
