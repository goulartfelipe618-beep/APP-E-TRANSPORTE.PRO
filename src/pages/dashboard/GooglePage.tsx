import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SlideCarousel from "@/components/SlideCarousel";
import {
  Plus, Search, Shield, Building2, MapPin, Phone, Clock, Camera,
  Send, ExternalLink, Calendar, Info, CheckCircle2, Star, MessageSquare,
  FileText, Package, Settings, Image, PenLine, Globe, Tag, Users,
  Megaphone, BarChart3, CirclePlus, Trash2, ChevronRight, Edit,
  HelpCircle, Accessibility, Wifi, ParkingCircle, CreditCard, Award,
  ThumbsUp, Reply, Eye, TrendingUp, MousePointerClick, PhoneCall,
  Navigation, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DAYS = [
  { name: "Segunda-feira", short: "Seg", defaultOn: true },
  { name: "Terça-feira", short: "Ter", defaultOn: true },
  { name: "Quarta-feira", short: "Qua", defaultOn: true },
  { name: "Quinta-feira", short: "Qui", defaultOn: true },
  { name: "Sexta-feira", short: "Sex", defaultOn: true },
  { name: "Sábado", short: "Sáb", defaultOn: true },
  { name: "Domingo", short: "Dom", defaultOn: false },
];

const MANAGEMENT_TABS = [
  { id: "info", label: "Informações", icon: Building2 },
  { id: "location", label: "Localização", icon: MapPin },
  { id: "contact", label: "Contato", icon: Phone },
  { id: "hours", label: "Horários", icon: Clock },
  { id: "special-hours", label: "Horários Especiais", icon: Calendar },
  { id: "photos", label: "Fotos", icon: Camera },
  { id: "posts", label: "Publicações", icon: FileText },
  { id: "products", label: "Produtos", icon: Package },
  { id: "services", label: "Serviços", icon: Settings },
  { id: "reviews", label: "Críticas", icon: Star },
  { id: "qna", label: "Perguntas", icon: HelpCircle },
  { id: "attributes", label: "Atributos", icon: Tag },
  { id: "performance", label: "Desempenho", icon: BarChart3 },
];

export default function GooglePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);

  // === Create form state ===
  const [createStep, setCreateStep] = useState(0);
  const [tipoEntidade, setTipoEntidade] = useState("motorista");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState("");
  const [categoriaSecundaria, setCategoriaSecundaria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [serviceArea, setServiceArea] = useState(true);
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

  // === Management state ===
  const [posts, setPosts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [specialHours, setSpecialHours] = useState<any[]>([]);

  // New post form
  const [newPostType, setNewPostType] = useState("update");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCta, setNewPostCta] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");

  // New product form
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductImageUrl, setNewProductImageUrl] = useState("");

  // New service form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  // Special hours form
  const [specialDate, setSpecialDate] = useState("");
  const [specialOpen, setSpecialOpen] = useState("");
  const [specialClose, setSpecialClose] = useState("");
  const [specialClosed, setSpecialClosed] = useState(false);

  // Attributes
  const [attributes, setAttributes] = useState({
    wheelchair: false,
    wifi: false,
    parking: false,
    creditCard: true,
    appointment: true,
    onlineBooking: true,
    lgbtFriendly: false,
    petFriendly: false,
  });

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
    if (!nomeEmpresa.trim()) { toast.error("Informe o nome da empresa."); return; }
    if (!categoriaPrincipal) { toast.error("Selecione a categoria principal."); return; }
    if (!telefone.trim()) { toast.error("Informe o telefone."); return; }

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
    toast.success("Solicitação enviada com sucesso!");
    setCreateOpen(false);
  };

  // Active service view
  if (servicoAtivo?.status === "concluido") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" /> Google Business — Serviço Ativo
          </h1>
          <Button onClick={() => setManageOpen(true)}>
            <Edit className="h-4 w-4 mr-2" /> Gerenciar Perfil
          </Button>
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

        {renderManagementDialog()}
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

  // === MANAGEMENT DIALOG ===
  function renderManagementDialog() {
    return (
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex h-[85vh]">
            {/* Sidebar */}
            <div className="w-56 border-r border-border bg-muted/30 p-3 space-y-1 overflow-y-auto shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Gerenciar</p>
              {MANAGEMENT_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* INFO */}
              {activeTab === "info" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Informações do Negócio</h3>
                    <p className="text-sm text-muted-foreground">Edite as informações básicas do seu perfil no Google.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Label>Nome do Negócio *</Label><Input placeholder="Ex: Transfer Executivo São Paulo" /></div>
                    <div>
                      <Label>Categoria Principal *</Label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transporte_executivo">Serviço de Transporte Executivo</SelectItem>
                          <SelectItem value="taxi">Serviço de Táxi</SelectItem>
                          <SelectItem value="aluguel_veiculos">Aluguel de Veículos</SelectItem>
                          <SelectItem value="limusine">Serviço de Limusine</SelectItem>
                          <SelectItem value="transporte_aeroporto">Transporte para Aeroporto</SelectItem>
                          <SelectItem value="shuttle">Serviço de Shuttle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Categoria Secundária</Label>
                      <Select><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transporte">Serviço de Transporte</SelectItem>
                          <SelectItem value="turismo">Turismo</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Descrição do Negócio</Label>
                      <Textarea placeholder="Descreva seus serviços em detalhes..." maxLength={750} className="min-h-[120px]" />
                      <p className="text-xs text-muted-foreground mt-1">0/750 caracteres</p>
                    </div>
                    <div>
                      <Label>Ano de Abertura</Label>
                      <Input type="number" placeholder="2020" />
                    </div>
                    <div>
                      <Label>Identificador Curto (short name)</Label>
                      <Input placeholder="minha-empresa" />
                    </div>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Informações</Button>
                </div>
              )}

              {/* LOCATION */}
              {activeTab === "location" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Localização e Área de Atendimento</h3>
                    <p className="text-sm text-muted-foreground">Defina onde sua empresa está e as regiões que atende.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Service Area Business (SAB)</p>
                      <p className="text-xs text-muted-foreground">Ative se o serviço é móvel, sem ponto físico fixo. Recomendado para motoristas.</p>
                    </div>
                    <Switch checked={serviceArea} onCheckedChange={setServiceArea} />
                  </div>
                  {serviceArea && (
                    <div>
                      <Label>Áreas de Atendimento *</Label>
                      <Textarea placeholder="São Paulo, Guarulhos, ABC Paulista, Campinas..." className="min-h-[80px]" />
                      <p className="text-xs text-muted-foreground mt-1">Separe as cidades/regiões por vírgula</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Endereço</Label><Input placeholder="Av. Paulista, 1000" /></div>
                    <div><Label>Bairro</Label><Input placeholder="Bela Vista" /></div>
                    <div><Label>CEP</Label><Input placeholder="00000-000" /></div>
                    <div><Label>Cidade</Label><Input placeholder="São Paulo" /></div>
                    <div><Label>Estado</Label><Input placeholder="SP" /></div>
                    <div><Label>País</Label><Input placeholder="Brasil" defaultValue="Brasil" /></div>
                  </div>
                  <div>
                    <Label>Coordenadas (Latitude, Longitude)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="-23.5505" />
                      <Input placeholder="-46.6333" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Opcional. Ajuda a posicionar seu pin no Maps com precisão.</p>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Localização</Button>
                </div>
              )}

              {/* CONTACT */}
              {activeTab === "contact" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Informações de Contato</h3>
                    <p className="text-sm text-muted-foreground">Telefone, website e links de contato.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Telefone Principal *</Label><Input placeholder="(11) 99999-9999" /></div>
                    <div><Label>Telefone Secundário</Label><Input placeholder="(11) 3333-3333" /></div>
                    <div><Label>WhatsApp</Label><Input placeholder="(11) 99999-9999" /></div>
                    <div><Label>Website</Label><Input placeholder="https://www.exemplo.com.br" /></div>
                    <div><Label>Link de Agendamento</Label><Input placeholder="https://booking.exemplo.com" /></div>
                    <div><Label>Link do Menu/Cardápio</Label><Input placeholder="https://..." /></div>
                  </div>
                  <div>
                    <Label>Links de Redes Sociais</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Facebook</span>
                        <Input placeholder="https://facebook.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Instagram</span>
                        <Input placeholder="https://instagram.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">LinkedIn</span>
                        <Input placeholder="https://linkedin.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">YouTube</span>
                        <Input placeholder="https://youtube.com/..." className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Contato</Button>
                </div>
              )}

              {/* HOURS */}
              {activeTab === "hours" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Horário de Funcionamento</h3>
                    <p className="text-sm text-muted-foreground">Defina os horários regulares do seu negócio.</p>
                  </div>
                  <div className="space-y-3">
                    {schedule.map((day, i) => (
                      <div key={day.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(v) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], enabled: v }; return n; })}
                        />
                        <span className="text-sm text-foreground w-32 font-medium">{day.name}</span>
                        {day.enabled ? (
                          <div className="flex items-center gap-2">
                            <Input type="time" value={day.open} className="w-32" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], open: e.target.value }; return n; })} />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input type="time" value={day.close} className="w-32" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], close: e.target.value }; return n; })} />
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30">Fechado</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">Para serviços 24h, defina abertura 00:00 e fechamento 23:59.</p>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Horários</Button>
                </div>
              )}

              {/* SPECIAL HOURS */}
              {activeTab === "special-hours" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Horários Especiais / Feriados</h3>
                    <p className="text-sm text-muted-foreground">Configure horários diferentes para datas específicas.</p>
                  </div>
                  <Card className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Data</Label><Input type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)} /></div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch checked={specialClosed} onCheckedChange={setSpecialClosed} />
                        <span className="text-sm text-foreground">Fechado neste dia</span>
                      </div>
                    </div>
                    {!specialClosed && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Abertura</Label><Input type="time" value={specialOpen} onChange={(e) => setSpecialOpen(e.target.value)} /></div>
                        <div><Label>Fechamento</Label><Input type="time" value={specialClose} onChange={(e) => setSpecialClose(e.target.value)} /></div>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => {
                      if (!specialDate) { toast.error("Selecione uma data."); return; }
                      setSpecialHours([...specialHours, { date: specialDate, closed: specialClosed, open: specialOpen, close: specialClose }]);
                      setSpecialDate(""); setSpecialOpen(""); setSpecialClose(""); setSpecialClosed(false);
                      toast.success("Horário especial adicionado.");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                  </Card>

                  {specialHours.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Horário</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {specialHours.map((sh, i) => (
                            <TableRow key={i}>
                              <TableCell>{new Date(sh.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell>
                                <Badge variant={sh.closed ? "destructive" : "outline"}>
                                  {sh.closed ? "Fechado" : "Aberto"}
                                </Badge>
                              </TableCell>
                              <TableCell>{sh.closed ? "—" : `${sh.open} - ${sh.close}`}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setSpecialHours(specialHours.filter((_, j) => j !== i))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Horários Especiais</Button>
                </div>
              )}

              {/* PHOTOS */}
              {activeTab === "photos" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Fotos do Perfil</h3>
                    <p className="text-sm text-muted-foreground">Gerencie todas as fotos do seu perfil no Google.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Image className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Logotipo</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Imagem quadrada, mínimo 250x250px</p>
                      <Input placeholder="URL da imagem..." />
                      <Button variant="outline" size="sm"><Camera className="h-4 w-4 mr-2" /> Enviar Foto</Button>
                    </Card>
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Image className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Foto de Capa</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Proporção 16:9, mínimo 480x270px</p>
                      <Input placeholder="URL da imagem..." />
                      <Button variant="outline" size="sm"><Camera className="h-4 w-4 mr-2" /> Enviar Foto</Button>
                    </Card>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Categorias de Fotos</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {["Exterior", "Interior", "Equipe", "Veículos", "No Trabalho", "Alimentos e Bebidas"].map((cat) => (
                        <Card key={cat} className="p-4 text-center space-y-2 cursor-pointer hover:border-primary/50 transition-colors">
                          <Camera className="h-8 w-8 text-muted-foreground mx-auto" />
                          <p className="text-xs font-medium text-foreground">{cat}</p>
                          <p className="text-xs text-muted-foreground">0 fotos</p>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Card className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Adicionar Fotos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Categoria</Label>
                        <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exterior">Exterior</SelectItem>
                            <SelectItem value="interior">Interior</SelectItem>
                            <SelectItem value="equipe">Equipe</SelectItem>
                            <SelectItem value="veiculos">Veículos</SelectItem>
                            <SelectItem value="trabalho">No Trabalho</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>URL da Foto</Label><Input placeholder="https://..." /></div>
                    </div>
                    <Button variant="outline" size="sm"><CirclePlus className="h-4 w-4 mr-2" /> Adicionar Foto</Button>
                  </Card>
                </div>
              )}

              {/* POSTS */}
              {activeTab === "posts" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Publicações</h3>
                    <p className="text-sm text-muted-foreground">Crie publicações, ofertas e eventos para seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Nova Publicação</h4>
                    <div>
                      <Label>Tipo de Publicação</Label>
                      <Select value={newPostType} onValueChange={setNewPostType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="update">Atualização</SelectItem>
                          <SelectItem value="offer">Oferta</SelectItem>
                          <SelectItem value="event">Evento</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newPostType === "event" && (
                      <div><Label>Título do Evento</Label><Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Ex: Promoção de Fim de Ano" /></div>
                    )}
                    {newPostType === "offer" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Título da Oferta</Label><Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Ex: 20% de desconto" /></div>
                        <div><Label>Código do Cupom</Label><Input placeholder="PROMO20" /></div>
                        <div><Label>Data Início</Label><Input type="date" /></div>
                        <div><Label>Data Fim</Label><Input type="date" /></div>
                      </div>
                    )}
                    <div><Label>Conteúdo *</Label><Textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="Escreva sua publicação..." className="min-h-[100px]" maxLength={1500} /></div>
                    <div><Label>URL da Imagem</Label><Input value={newPostImageUrl} onChange={(e) => setNewPostImageUrl(e.target.value)} placeholder="https://..." /></div>
                    <div>
                      <Label>Botão de Ação (CTA)</Label>
                      <Select value={newPostCta} onValueChange={setNewPostCta}>
                        <SelectTrigger><SelectValue placeholder="Sem botão" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem botão</SelectItem>
                          <SelectItem value="book">Reservar</SelectItem>
                          <SelectItem value="order">Pedir</SelectItem>
                          <SelectItem value="learn_more">Saiba mais</SelectItem>
                          <SelectItem value="sign_up">Registrar</SelectItem>
                          <SelectItem value="call">Ligar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => {
                      if (!newPostContent.trim()) { toast.error("Escreva o conteúdo da publicação."); return; }
                      setPosts([...posts, { type: newPostType, title: newPostTitle, content: newPostContent, cta: newPostCta, image: newPostImageUrl, date: new Date().toISOString() }]);
                      setNewPostContent(""); setNewPostTitle(""); setNewPostImageUrl(""); setNewPostCta("");
                      toast.success("Publicação criada!");
                    }}>
                      <Megaphone className="h-4 w-4 mr-2" /> Publicar
                    </Button>
                  </Card>

                  {posts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Publicações Recentes</h4>
                      {posts.map((post, i) => (
                        <Card key={i} className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge variant="outline" className="mb-2">{post.type === "update" ? "Atualização" : post.type === "offer" ? "Oferta" : post.type === "event" ? "Evento" : "Produto"}</Badge>
                              {post.title && <p className="text-sm font-medium text-foreground">{post.title}</p>}
                              <p className="text-sm text-muted-foreground mt-1">{post.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">{new Date(post.date).toLocaleDateString("pt-BR")}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPosts(posts.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PRODUCTS */}
              {activeTab === "products" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Produtos</h3>
                    <p className="text-sm text-muted-foreground">Adicione produtos/serviços com preços ao seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Novo Produto</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome do Produto *</Label><Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ex: Transfer Aeroporto" /></div>
                      <div><Label>Preço (R$)</Label><Input value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="220,00" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="Descreva o produto..." /></div>
                    <div><Label>URL da Imagem</Label><Input value={newProductImageUrl} onChange={(e) => setNewProductImageUrl(e.target.value)} placeholder="https://..." /></div>
                    <div>
                      <Label>Categoria do Produto</Label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="passeio">Passeio</SelectItem>
                          <SelectItem value="eventos">Eventos</SelectItem>
                          <SelectItem value="diaria">Diária</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={() => {
                      if (!newProductName.trim()) { toast.error("Informe o nome do produto."); return; }
                      setProducts([...products, { name: newProductName, price: newProductPrice, desc: newProductDesc, image: newProductImageUrl }]);
                      setNewProductName(""); setNewProductPrice(""); setNewProductDesc(""); setNewProductImageUrl("");
                      toast.success("Produto adicionado!");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar Produto
                    </Button>
                  </Card>

                  {products.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {products.map((p, i) => (
                        <Card key={i} className="p-4 space-y-2">
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          {p.price && <p className="text-primary font-semibold">R$ {p.price}</p>}
                          {p.desc && <p className="text-xs text-muted-foreground">{p.desc}</p>}
                          <Button variant="ghost" size="sm" onClick={() => setProducts(products.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3 text-destructive mr-1" /> Remover
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SERVICES */}
              {activeTab === "services" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Serviços</h3>
                    <p className="text-sm text-muted-foreground">Liste os serviços oferecidos pelo seu negócio.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Novo Serviço</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome do Serviço *</Label><Input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="Ex: Transfer Executivo" /></div>
                      <div><Label>Preço (R$)</Label><Input value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} placeholder="150,00" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} placeholder="Descreva o serviço..." /></div>
                    <Button variant="outline" onClick={() => {
                      if (!newServiceName.trim()) { toast.error("Informe o nome do serviço."); return; }
                      setServices([...services, { name: newServiceName, price: newServicePrice, desc: newServiceDesc }]);
                      setNewServiceName(""); setNewServicePrice(""); setNewServiceDesc("");
                      toast.success("Serviço adicionado!");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar Serviço
                    </Button>
                  </Card>

                  {services.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Serviço</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map((s, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.price ? `R$ ${s.price}` : "—"}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">{s.desc || "—"}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setServices(services.filter((_, j) => j !== i))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* REVIEWS */}
              {activeTab === "reviews" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Críticas e Avaliações</h3>
                    <p className="text-sm text-muted-foreground">Veja e responda às avaliações dos clientes.</p>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-4 text-center">
                      <Star className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">5.0</p>
                      <p className="text-xs text-muted-foreground">Nota Média</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <MessageSquare className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">52</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Reply className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">48</p>
                      <p className="text-xs text-muted-foreground">Respondidas</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Clock className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">4</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </Card>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="outline"><Globe className="h-4 w-4 mr-2" /> Solicitar Avaliações</Button>
                    <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Link de Avaliação</Button>
                  </div>

                  <div className="space-y-3">
                    {[
                      { name: "Ana M.", rating: 5, text: "Fiz tudo pelo site, de forma rápida e prática.", date: "2025-03-10", replied: true },
                      { name: "Carlos R.", rating: 5, text: "Ótimo atendimento, serviço exclusivo de luxo em Balneário Camboriú e região.", date: "2025-03-08", replied: true },
                      { name: "João S.", rating: 5, text: "Presente em grande parte do território brasileiro!!!", date: "2025-03-05", replied: false },
                    ].map((review, i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">{review.name[0]}</div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{review.name}</p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: review.rating }).map((_, j) => (
                                    <Star key={j} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">"{review.text}"</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(review.date).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.replied ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Respondida</Badge>
                            ) : (
                              <Button size="sm" variant="outline"><Reply className="h-3 w-3 mr-1" /> Responder</Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Q&A */}
              {activeTab === "qna" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Perguntas e Respostas</h3>
                    <p className="text-sm text-muted-foreground">Gerencie as perguntas feitas pelos clientes no seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Adicionar Pergunta Frequente</h4>
                    <div><Label>Pergunta</Label><Input placeholder="Ex: Vocês atendem no aeroporto de Guarulhos?" /></div>
                    <div><Label>Resposta</Label><Textarea placeholder="Sim, atendemos todos os aeroportos..." /></div>
                    <Button variant="outline" size="sm"><CirclePlus className="h-4 w-4 mr-2" /> Publicar Pergunta</Button>
                  </Card>

                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">Publique perguntas frequentes para ajudar os clientes a encontrar informações rapidamente.</p>
                  </div>
                </div>
              )}

              {/* ATTRIBUTES */}
              {activeTab === "attributes" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Atributos do Negócio</h3>
                    <p className="text-sm text-muted-foreground">Informe características e facilidades oferecidas.</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: "wheelchair", label: "Acessibilidade para cadeirantes", icon: Accessibility },
                      { key: "wifi", label: "Wi-Fi disponível", icon: Wifi },
                      { key: "parking", label: "Estacionamento", icon: ParkingCircle },
                      { key: "creditCard", label: "Aceita cartão de crédito", icon: CreditCard },
                      { key: "appointment", label: "Agendamento necessário", icon: Calendar },
                      { key: "onlineBooking", label: "Reserva online", icon: Globe },
                      { key: "lgbtFriendly", label: "LGBT-friendly", icon: Award },
                      { key: "petFriendly", label: "Pet-friendly", icon: ThumbsUp },
                    ].map((attr) => {
                      const Icon = attr.icon;
                      return (
                        <div key={attr.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{attr.label}</span>
                          </div>
                          <Switch
                            checked={attributes[attr.key as keyof typeof attributes]}
                            onCheckedChange={(v) => setAttributes({ ...attributes, [attr.key]: v })}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Métodos de Pagamento</h4>
                    <div className="flex flex-wrap gap-2">
                      {["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito", "Transferência Bancária"].map((method) => (
                        <Badge key={method} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors px-3 py-1.5">{method}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Idiomas Atendidos</h4>
                    <div className="flex flex-wrap gap-2">
                      {["Português", "Inglês", "Espanhol", "Francês", "Italiano"].map((lang) => (
                        <Badge key={lang} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors px-3 py-1.5">{lang}</Badge>
                      ))}
                    </div>
                  </div>

                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Atributos</Button>
                </div>
              )}

              {/* PERFORMANCE */}
              {activeTab === "performance" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Desempenho e Métricas</h3>
                    <p className="text-sm text-muted-foreground">Acompanhe como os clientes interagem com seu perfil.</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="p-4 text-center">
                      <Eye className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">828</p>
                      <p className="text-xs text-muted-foreground">Visualizações</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <MousePointerClick className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">156</p>
                      <p className="text-xs text-muted-foreground">Cliques no Site</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <PhoneCall className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">89</p>
                      <p className="text-xs text-muted-foreground">Ligações</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Navigation className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">234</p>
                      <p className="text-xs text-muted-foreground">Direções Solicitadas</p>
                    </Card>
                  </div>

                  <Card className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Como os clientes encontram você</h4>
                    <div className="space-y-3">
                      {[
                        { label: "Pesquisa Direta", value: 45, color: "bg-primary" },
                        { label: "Pesquisa por Descoberta", value: 35, color: "bg-blue-500" },
                        { label: "Pesquisa de Marca", value: 20, color: "bg-green-500" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="text-foreground font-medium">{item.value}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Ações dos Clientes (últimos 28 dias)</h4>
                    <div className="space-y-2">
                      {[
                        { label: "Visitaram o site", value: "156" },
                        { label: "Pediram direções", value: "234" },
                        { label: "Ligaram para você", value: "89" },
                        { label: "Enviaram mensagem", value: "67" },
                        { label: "Viram suas fotos", value: "412" },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between py-2 border-b border-border last:border-0">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-medium text-foreground">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // === CREATE DIALOG ===
  const CREATE_STEPS = [
    { label: "Informações", icon: Building2 },
    { label: "Localização", icon: MapPin },
    { label: "Contato", icon: Phone },
    { label: "Horários", icon: Clock },
    { label: "Fotos", icon: Camera },
  ];

  return (
    <div className="space-y-6">
      {pendingBanner}
      <SlideCarousel
        pagina="google"
        fallbackSlides={[
          { titulo: "Coloque Sua Empresa no Google", subtitulo: "Crie seu perfil no Google Business Profile e apareça nas buscas quando clientes procurarem por transporte executivo na sua região." },
          { titulo: "Perfil Verificado no Google", subtitulo: "Motoristas com perfil verificado passam mais confiança. Hotéis e empresas encontram você diretamente no Google Maps." },
          { titulo: "Aumente Sua Visibilidade", subtitulo: "Destaque-se nos resultados de busca com avaliações positivas e informações completas do seu serviço." },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Google Business Profile</h2>
          <p className="text-muted-foreground">Gerencie perfis para Google Meu Negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Gerenciar Perfil
          </Button>
          <Button onClick={() => { setCreateOpen(true); setCreateStep(0); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Perfil
          </Button>
        </div>
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
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Perfil Google Business</DialogTitle>
          </DialogHeader>

          {/* Step pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {CREATE_STEPS.map((step, i) => {
              const Icon = step.icon;
              const active = i === createStep;
              const done = i < createStep;
              return (
                <button
                  key={step.label}
                  onClick={() => setCreateStep(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {step.label}
                </button>
              );
            })}
          </div>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((createStep + 1) / CREATE_STEPS.length) * 100}%` }} />
          </div>

          {createStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Tipo de Entidade</Label>
                <Select value={tipoEntidade} onValueChange={setTipoEntidade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="empresa">Empresa</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Nome da Empresa *</Label><Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Ex: Transfer Executivo São Paulo" /></div>
              <div>
                <Label>Categoria Principal *</Label>
                <Select value={categoriaPrincipal} onValueChange={setCategoriaPrincipal}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transporte_executivo">Serviço de Transporte Executivo</SelectItem>
                    <SelectItem value="taxi">Serviço de Táxi</SelectItem>
                    <SelectItem value="aluguel">Aluguel de Veículos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria Secundária</Label>
                <Select value={categoriaSecundaria} onValueChange={setCategoriaSecundaria}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transporte">Serviço de Transporte</SelectItem>
                    <SelectItem value="turismo">Turismo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o serviço oferecido..." maxLength={750} />
                <p className="text-xs text-muted-foreground mt-1">{descricao.length}/750 caracteres</p>
              </div>
            </div>
          )}

          {createStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Service Area Business</p>
                  <p className="text-xs text-muted-foreground">Ative se o serviço é móvel (sem ponto físico fixo).</p>
                </div>
                <Switch checked={serviceArea} onCheckedChange={setServiceArea} />
              </div>
              <div><Label>Área de Atendimento *</Label><Input value={areaAtendimento} onChange={(e) => setAreaAtendimento(e.target.value)} placeholder="Ex: São Paulo, Guarulhos, ABC Paulista" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>CEP</Label><Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" /></div>
                <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
              </div>
              <div><Label>Estado</Label><Input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="SP" /></div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-4">
              <div><Label>Telefone *</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" /></div>
              <div><Label>WhatsApp</Label><Input value={whatsappG} onChange={(e) => setWhatsappG(e.target.value)} placeholder="(11) 99999-9999" /></div>
              <div><Label>Website</Label><Input value={websiteG} onChange={(e) => setWebsiteG(e.target.value)} placeholder="https://www.exemplo.com.br" /></div>
            </div>
          )}

          {createStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure o horário de funcionamento padrão.</p>
              {schedule.map((day, i) => (
                <div key={day.name} className="flex items-center gap-3">
                  <Switch checked={day.enabled} onCheckedChange={(v) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], enabled: v }; return n; })} />
                  <span className="text-sm text-foreground w-20">{day.short}</span>
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

          {createStep === 4 && (
            <div className="space-y-4">
              <div><Label>URL do Logo</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
              <div><Label>URL da Capa</Label><Input value={capaUrl} onChange={(e) => setCapaUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => { if (createStep === 0) setCreateOpen(false); else setCreateStep((s) => s - 1); }}>
              Anterior
            </Button>
            {createStep === CREATE_STEPS.length - 1 ? (
              <Button className="bg-primary text-primary-foreground" onClick={handleSubmitGoogle} disabled={submitting}>
                <Send className="h-4 w-4 mr-2" /> {submitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            ) : (
              <Button onClick={() => {
                if (createStep === 0) {
                  if (!nomeEmpresa.trim()) { toast.error("Informe o nome da empresa."); return; }
                  if (!categoriaPrincipal) { toast.error("Selecione a categoria principal."); return; }
                }
                if (createStep === 1 && !areaAtendimento.trim()) { toast.error("Informe a área de atendimento."); return; }
                if (createStep === 2 && !telefone.trim()) { toast.error("Informe o telefone."); return; }
                setCreateStep((s) => s + 1);
              }}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {renderManagementDialog()}
    </div>
  );
}
