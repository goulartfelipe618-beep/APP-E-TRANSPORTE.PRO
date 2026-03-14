import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, ChevronLeft, ChevronRight, Shield, Building2, MapPin, Phone, Clock, Camera, ArrowLeft, ArrowRight, Send, ExternalLink, Calendar, Info, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TABS = [
  { label: "Informações Básicas", icon: Building2 },
  { label: "Localização", icon: MapPin },
  { label: "Contato", icon: Phone },
  { label: "Horário de Funcionamento", icon: Clock },
  { label: "Fotos", icon: Camera },
];

const DAYS = [
  { name: "Segunda", defaultOn: true },
  { name: "Terça", defaultOn: true },
  { name: "Quarta", defaultOn: true },
  { name: "Quinta", defaultOn: true },
  { name: "Sexta", defaultOn: true },
  { name: "Sábado", defaultOn: true },
  { name: "Domingo", defaultOn: false },
];

export default function GooglePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [descLen, setDescLen] = useState(0);
  const [serviceArea, setServiceArea] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  // Form state
  const [tipoEntidade, setTipoEntidade] = useState("motorista");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState("");
  const [categoriaSecundaria, setCategoriaSecundaria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [areaAtendimento, setAreaAtendimento] = useState("");
  const [cep, setCep] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsappG, setWhatsappG] = useState("");
  const [websiteG, setWebsiteG] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [capaUrl, setCapaUrl] = useState("");
  const [schedule, setSchedule] = useState(
    DAYS.map((d) => ({ ...d, open: "08:00", close: "18:00", enabled: d.defaultOn }))
  );

  useEffect(() => {
    const checkServico = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "google").order("created_at", { ascending: false }).limit(1) as any);
      if (data && data.length > 0) setServicoAtivo(data[0]);
    };
    checkServico();
  }, []);

  const handleSubmitGoogle = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }
    const { error } = await (supabase.from("solicitacoes_servicos" as any).insert({
      user_id: user.id,
      tipo_servico: "google",
      dados_solicitacao: {
        tipo_entidade: tipoEntidade,
        nome_empresa: nomeEmpresa,
        categoria_principal: categoriaPrincipal,
        categoria_secundaria: categoriaSecundaria,
        descricao,
        service_area: serviceArea,
        area_atendimento: areaAtendimento,
        cep, cidade, estado,
        telefone, whatsapp: whatsappG, website: websiteG,
        horarios: schedule,
        logo_url: logoUrl,
        capa_url: capaUrl,
      },
    } as any) as any);
    setSubmitting(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Solicitação de Google Business enviada com sucesso!");
    setOpen(false);
  };

  const slides = [
    { title: "Coloque Sua Empresa no Google", description: "Crie seu perfil no Google Business Profile e apareça nas buscas quando clientes procurarem por transporte executivo na sua região." },
    { title: "Perfil Verificado no Google", description: "Motoristas com perfil verificado passam mais confiança. Hotéis e empresas encontram você diretamente no Google Maps." },
    { title: "Aumente Sua Visibilidade", description: "Destaque-se nos resultados de busca com avaliações positivas e informações completas do seu serviço." },
  ];

  const isLast = tabIndex === TABS.length - 1;

  // Active service
  if (servicoAtivo?.status === "concluido") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" /> Google Business — Serviço Ativo
          </h1>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-4">
          {servicoAtivo.link_acesso && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Link de Acesso</p>
              <a href={servicoAtivo.link_acesso} target="_blank" rel="noopener noreferrer" className="text-primary font-medium flex items-center gap-1 hover:underline">
                <ExternalLink className="h-4 w-4" /> {servicoAtivo.link_acesso}
              </a>
            </div>
          )}
          {servicoAtivo.data_expiracao && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Válido até</p>
              <p className="text-foreground font-medium flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(servicoAtivo.data_expiracao).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
          {servicoAtivo.instrucoes_acesso && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Instruções</p>
              <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.instrucoes_acesso}</p>
            </div>
          )}
          {servicoAtivo.como_usar && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Como Usar</p>
              <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.como_usar}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pendingBanner = servicoAtivo && (servicoAtivo.status === "pendente" || servicoAtivo.status === "em_andamento") ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
      <Info className="h-5 w-5 text-yellow-600" />
      <div>
        <p className="text-sm font-semibold text-foreground">Solicitação Google Business em análise</p>
        <p className="text-xs text-muted-foreground">Status: <Badge variant="outline">{servicoAtivo.status === "pendente" ? "Pendente" : "Em andamento"}</Badge></p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {pendingBanner}
      {/* Carousel */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-primary/80 to-primary h-80 flex items-center">
        <Button variant="ghost" size="icon" className="absolute left-2 z-10 bg-background/30 hover:bg-background/50 text-primary-foreground" onClick={() => setCurrentSlide((p) => (p === 0 ? slides.length - 1 : p - 1))}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="px-12 max-w-2xl">
          <h2 className="text-2xl font-bold text-primary-foreground mb-2">{slides[currentSlide].title}</h2>
          <p className="text-primary-foreground/80">{slides[currentSlide].description}</p>
        </div>
        <Button variant="ghost" size="icon" className="absolute right-2 z-10 bg-background/30 hover:bg-background/50 text-primary-foreground" onClick={() => setCurrentSlide((p) => (p === slides.length - 1 ? 0 : p + 1))}><ChevronRight className="h-5 w-5" /></Button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (<button key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentSlide ? "bg-primary-foreground" : "bg-primary-foreground/40"}`} onClick={() => setCurrentSlide(i)} />))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Google Business Profile</h2>
          <p className="text-muted-foreground">Gerencie perfis para Google Meu Negócio</p>
        </div>
        <Button onClick={() => { setOpen(true); setTabIndex(0); }}><Plus className="h-4 w-4 mr-2" /> Novo Perfil</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium text-foreground">Como funciona</span></div>
        <p className="text-sm text-muted-foreground">Preencha os dados do perfil no wizard. O sistema valida automaticamente o nome, categoria e endereço para reduzir chances de suspensão pelo Google. Motoristas sem ponto fixo devem ser configurados como "Service Area Business".</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." className="pl-9" />
        </div>
        <Select defaultValue="all"><SelectTrigger className="w-48"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem></SelectContent></Select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead>Validado</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8"><TableBody><TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow></TableBody></TableCell></TableRow></TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Perfil Google Business</DialogTitle>
          </DialogHeader>

          {/* Tab pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {TABS.map((tab, i) => {
              const Icon = tab.icon;
              const active = i === tabIndex;
              const done = i < tabIndex;
              return (
                <button
                  key={tab.label}
                  onClick={() => setTabIndex(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <button onClick={() => setTabIndex((t) => Math.max(0, t - 1))} className="text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((tabIndex + 1) / TABS.length) * 100}%` }} />
            </div>
            <button onClick={() => setTabIndex((t) => Math.min(TABS.length - 1, t + 1))} className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {/* Tab 0 – Informações Básicas */}
          {tabIndex === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Tipo de Entidade</Label>
                <Select defaultValue="motorista"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="empresa">Empresa</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Nome da Empresa *</Label><Input placeholder="Ex: Transfer Executivo São Paulo" /></div>
              <div>
                <Label>Categoria Principal *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="transporte">Serviço de Transporte Executivo</SelectItem><SelectItem value="taxi">Serviço de Táxi</SelectItem><SelectItem value="aluguel">Aluguel de Veículos</SelectItem></SelectContent></Select>
              </div>
              <div>
                <Label>Categoria Secundária</Label>
                <Select><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="transporte">Serviço de Transporte</SelectItem><SelectItem value="turismo">Turismo</SelectItem></SelectContent></Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea placeholder="Descreva o serviço oferecido..." maxLength={750} onChange={(e) => setDescLen(e.target.value.length)} />
                <p className="text-xs text-muted-foreground mt-1">{descLen}/750 caracteres</p>
              </div>
            </div>
          )}

          {/* Tab 1 – Localização */}
          {tabIndex === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Service Area Business</p>
                  <p className="text-xs text-muted-foreground">Ative se o serviço é móvel (sem ponto físico fixo). Recomendado para transporte.</p>
                </div>
                <Switch checked={serviceArea} onCheckedChange={setServiceArea} />
              </div>
              <div><Label>Área de Atendimento *</Label><Input placeholder="Ex: São Paulo, Guarulhos, ABC Paulista" /><p className="text-xs text-muted-foreground mt-1">Informe as cidades ou regiões que você atende</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>CEP</Label><Input placeholder="00000-000" /></div>
                <div><Label>Cidade</Label><Input /></div>
              </div>
              <div><Label>Estado</Label><Input placeholder="SP" /></div>
            </div>
          )}

          {/* Tab 2 – Contato */}
          {tabIndex === 2 && (
            <div className="space-y-4">
              <div><Label>Telefone *</Label><Input placeholder="(11) 99999-9999" /></div>
              <div><Label>WhatsApp</Label><Input placeholder="(11) 99999-9999" /></div>
              <div><Label>Website</Label><Input placeholder="https://www.exemplo.com.br" /></div>
            </div>
          )}

          {/* Tab 3 – Horário de Funcionamento */}
          {tabIndex === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure o horário de funcionamento padrão.</p>
              {schedule.map((day, i) => (
                <div key={day.name} className="flex items-center gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], enabled: v }; return n; })}
                  />
                  <span className="text-sm text-foreground w-20">{day.name}</span>
                  {day.enabled ? (
                    <>
                      <Input type="time" value={day.open} className="w-28" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], open: e.target.value }; return n; })} />
                      <span className="text-xs text-muted-foreground">às</span>
                      <Input type="time" value={day.close} className="w-28" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], close: e.target.value }; return n; })} />
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tab 4 – Fotos */}
          {tabIndex === 4 && (
            <div className="space-y-4">
              <div><Label>URL do Logo</Label><Input placeholder="https://..." /></div>
              <div><Label>URL da Capa</Label><Input placeholder="https://..." /></div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => { if (tabIndex === 0) setOpen(false); else setTabIndex((t) => t - 1); }} disabled={tabIndex === 0 && false}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
            </Button>
            {isLast ? (
              <Button className="bg-primary text-primary-foreground" onClick={handleSubmitGoogle} disabled={submitting}>
                <Send className="h-4 w-4 mr-2" /> {submitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            ) : (
              <Button onClick={() => setTabIndex((t) => t + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
