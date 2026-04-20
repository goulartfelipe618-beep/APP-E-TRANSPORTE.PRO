import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Download,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useCatalogoConfig,
  type CatalogoComodidade,
  type CatalogoServicoDestaque,
  type CatalogoTema,
} from "@/hooks/useCatalogoConfig";
import {
  fetchCatalogoDadosSistema,
  gerarCatalogoPdf,
  type CatalogoDadosSistema,
} from "@/lib/catalogoPdfGenerator";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";

const TEMAS: Array<{ id: CatalogoTema; label: string; preview: string }> = [
  { id: "dark", label: "Dark Classic", preview: "#0B0B0C" },
  { id: "noir", label: "Noir", preview: "#000000" },
  { id: "graphite", label: "Graphite", preview: "#15181C" },
  { id: "midnight", label: "Midnight", preview: "#0A1020" },
];

const CORES_ACENTO = [
  "#FF6600",
  "#F59E0B",
  "#EF4444",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#E5E7EB",
];

type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export default function CatalogoPage() {
  const { plano, refetch: refetchPlano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { config, setConfig, save, loading, saving, marcarGeracao } = useCatalogoConfig();
  const [sistema, setSistema] = useState<CatalogoDadosSistema | null>(null);
  const [carregandoSistema, setCarregandoSistema] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [novaCidade, setNovaCidade] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileInputCapaRef = useRef<HTMLInputElement | null>(null);
  const fileInputContracapaRef = useRef<HTMLInputElement | null>(null);

  const carregarSistema = useCallback(async () => {
    setCarregandoSistema(true);
    try {
      const dados = await fetchCatalogoDadosSistema();
      setSistema(dados);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os dados do sistema.");
    } finally {
      setCarregandoSistema(false);
    }
  }, []);

  useEffect(() => {
    void carregarSistema();
  }, [carregarSistema]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!sistema) return [];
    return [
      {
        id: "logo",
        label: "Logomarca configurada",
        ok: Boolean(sistema.logo_url),
        hint: "Configurações → Dados da empresa → Logomarca.",
      },
      {
        id: "nome",
        label: "Nome do projeto preenchido",
        ok: Boolean(sistema.nome_projeto?.trim()),
        hint: "Configurações → Dados da empresa.",
      },
      {
        id: "contacto",
        label: "Telefone ou email de contacto",
        ok: Boolean(sistema.telefone || sistema.email),
      },
      {
        id: "veiculos",
        label: "Pelo menos um veículo cadastrado",
        ok: sistema.veiculos.length > 0,
        hint: "Ferramentas → Veículos.",
      },
      {
        id: "fotos_veiculos",
        label: "Veículos com foto (ideal para vitrine)",
        ok: sistema.veiculos.some((v) => v.imagem_capa_url),
      },
      {
        id: "sobre",
        label: "Texto 'Sobre nós' preenchido",
        ok: config.sobre_nos.trim().length >= 60,
        hint: "Aba Conteúdo → Sobre nós (mínimo 60 caracteres).",
      },
      {
        id: "servicos",
        label: "Pelo menos 3 serviços definidos",
        ok: config.servicos_destaque.filter((s) => s.titulo?.trim()).length >= 3,
      },
      {
        id: "cidades",
        label: "Pelo menos 3 cidades atendidas",
        ok: config.cidades_atendidas.filter(Boolean).length >= 3,
      },
    ];
  }, [sistema, config]);

  const completos = checklist.filter((c) => c.ok).length;
  const total = checklist.length || 1;
  const pctCompleto = Math.round((completos / total) * 100);
  const podeGerar = completos === total;

  // ─── Handlers ──────────────────────────────────────────────
  const update = (patch: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSalvar = async () => {
    try {
      await save(config);
      setDirty(false);
      toast.success("Configuração do catálogo salva.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const adicionarCidade = () => {
    const valor = novaCidade.trim();
    if (!valor) return;
    if (config.cidades_atendidas.some((c) => c.toLowerCase() === valor.toLowerCase())) {
      toast.info("Essa cidade já está na lista.");
      return;
    }
    update({ cidades_atendidas: [...config.cidades_atendidas, valor] });
    setNovaCidade("");
  };

  const removerCidade = (idx: number) => {
    update({
      cidades_atendidas: config.cidades_atendidas.filter((_, i) => i !== idx),
    });
  };

  const adicionarServico = () => {
    if (config.servicos_destaque.length >= 8) {
      toast.info("Máximo de 8 serviços.");
      return;
    }
    update({
      servicos_destaque: [
        ...config.servicos_destaque,
        { titulo: "Novo serviço", descricao: "Descrição do serviço oferecido." },
      ],
    });
  };

  const atualizarServico = (idx: number, patch: Partial<CatalogoServicoDestaque>) => {
    update({
      servicos_destaque: config.servicos_destaque.map((s, i) =>
        i === idx ? { ...s, ...patch } : s,
      ),
    });
  };

  const removerServico = (idx: number) => {
    update({
      servicos_destaque: config.servicos_destaque.filter((_, i) => i !== idx),
    });
  };

  const adicionarComodidade = () => {
    if (config.comodidades.length >= 10) {
      toast.info("Máximo de 10 comodidades.");
      return;
    }
    update({
      comodidades: [...config.comodidades, { titulo: "Nova comodidade" }],
    });
  };

  const atualizarComodidade = (idx: number, patch: Partial<CatalogoComodidade>) => {
    update({
      comodidades: config.comodidades.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  };

  const removerComodidade = (idx: number) => {
    update({
      comodidades: config.comodidades.filter((_, i) => i !== idx),
    });
  };

  const handleUpload = async (
    file: File,
    campo: "banner_capa_url" | "banner_contracapa_url",
  ) => {
    setUploading(campo);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sem sessão");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Use JPG, PNG ou WEBP.");
      }
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("Máx 15 MB.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${campo}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("catalogo-motorista")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("catalogo-motorista").getPublicUrl(path);
      update({ [campo]: pub.publicUrl } as Partial<typeof config>);
      toast.success("Imagem enviada.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(null);
    }
  };

  const handleRemoverImagem = (campo: "banner_capa_url" | "banner_contracapa_url") => {
    update({ [campo]: null } as Partial<typeof config>);
  };

  const handleGerar = async () => {
    if (!sistema) return;
    if (plano === "free") {
      setUpgradeOpen(true);
      return;
    }
    if (!podeGerar) {
      toast.error("Complete o checklist para liberar o download.");
      return;
    }
    setGerando(true);
    try {
      if (dirty) await save(config);
      const { blob, filename } = await gerarCatalogoPdf(config, sistema);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      void marcarGeracao();
      toast.success("Catálogo gerado! Download iniciado.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const handlePreview = async () => {
    if (!sistema) return;
    setGerando(true);
    try {
      const { blob } = await gerarCatalogoPdf(config, sistema);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar preview.");
    } finally {
      setGerando(false);
    }
  };

  if (loading || carregandoSistema) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ─── HERO ──────────────────────────────────────── */}
      <Card className="relative overflow-hidden border-orange-500/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black dark:from-zinc-900 dark:to-black">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <CardContent className="relative z-10 flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-orange-400">
              <Sparkles className="h-3.5 w-3.5" /> Beta · Novo
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              Catálogo Comercial em PDF
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Gere um catálogo premium em PDF paisagem, pronto para enviar a clientes,
              hotéis e parceiros. Usa a tua logomarca, frota e informações já cadastradas.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-bold",
                podeGerar
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-orange-500/40 bg-orange-500/10 text-orange-400",
              )}
            >
              {pctCompleto}% pronto · {completos}/{total} itens
            </Badge>
            <Button
              size="lg"
              onClick={handleGerar}
              disabled={gerando || (plano !== "free" && !podeGerar)}
              className="bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {gerando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar catálogo PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── CHECKLIST ──────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Checklist de pré-requisitos</h2>
              <p className="text-xs text-muted-foreground">
                O botão de download só é liberado depois que todos os itens estiverem verdes.
              </p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                style={{ width: `${pctCompleto}%` }}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  item.ok
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-orange-500/30 bg-orange-500/5",
                )}
              >
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                )}
                <div>
                  <p className="font-medium leading-tight">{item.label}</p>
                  {!item.ok && item.hint && (
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── TABS ───────────────────────────────────────── */}
      <Tabs defaultValue="conteudo" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="conteudo" className="flex-1 min-w-[140px]">Conteúdo</TabsTrigger>
          <TabsTrigger value="servicos" className="flex-1 min-w-[140px]">Serviços</TabsTrigger>
          <TabsTrigger value="comodidades" className="flex-1 min-w-[140px]">Comodidades</TabsTrigger>
          <TabsTrigger value="cidades" className="flex-1 min-w-[140px]">Cidades</TabsTrigger>
          <TabsTrigger value="visual" className="flex-1 min-w-[140px]">Visual</TabsTrigger>
          <TabsTrigger value="preview" className="flex-1 min-w-[140px]">Preview</TabsTrigger>
        </TabsList>

        {/* CONTEÚDO */}
        <TabsContent value="conteudo" className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Slogan principal (capa)</Label>
                <Input
                  value={config.slogan}
                  onChange={(e) => update({ slogan: e.target.value.slice(0, 40) })}
                  maxLength={40}
                  placeholder="Ex: TRANSPORTE PREMIUM"
                />
                <p className="text-xs text-muted-foreground">
                  Aparece gigante na capa em caixa alta. Máx 40 caracteres.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Subtítulo da capa</Label>
                <Textarea
                  value={config.subtitulo}
                  onChange={(e) => update({ subtitulo: e.target.value.slice(0, 180) })}
                  rows={3}
                  placeholder="Cada viagem é pensada para que você se sinta no controle..."
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Sobre nós (página 2)</Label>
                <Textarea
                  value={config.sobre_nos}
                  onChange={(e) => update({ sobre_nos: e.target.value.slice(0, 1200) })}
                  rows={6}
                  placeholder="Conte a história da sua operação, filosofia de atendimento, o que te diferencia..."
                />
                <p className="text-xs text-muted-foreground">
                  {config.sobre_nos.length} / 1200 caracteres · mínimo 60 para liberar o checklist.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>WhatsApp comercial</Label>
                <Input
                  value={config.whatsapp_e164 ?? ""}
                  onChange={(e) => update({ whatsapp_e164: e.target.value || null })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={config.site_url ?? ""}
                  onChange={(e) => update({ site_url: e.target.value || null })}
                  placeholder="www.seusite.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={config.instagram_handle ?? ""}
                  onChange={(e) => update({ instagram_handle: e.target.value || null })}
                  placeholder="@seuperfil"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SERVIÇOS */}
        <TabsContent value="servicos" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Serviços oferecidos</h3>
                  <p className="text-xs text-muted-foreground">
                    Aparecem em grid na página "O que oferecemos". Recomendado 3 a 6 serviços.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={adicionarServico}>
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {config.servicos_destaque.map((s, i) => (
                  <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-orange-500 text-xs font-bold text-white">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Input
                        value={s.titulo}
                        onChange={(e) => atualizarServico(i, { titulo: e.target.value })}
                        placeholder="Título do serviço"
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removerServico(i)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={s.descricao}
                      onChange={(e) => atualizarServico(i, { descricao: e.target.value })}
                      rows={3}
                      placeholder="Descrição curta do serviço."
                    />
                  </div>
                ))}
                {config.servicos_destaque.length === 0 && (
                  <p className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum serviço adicionado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMODIDADES */}
        <TabsContent value="comodidades" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Comodidades a bordo</h3>
                  <p className="text-xs text-muted-foreground">
                    Aparecem numa grelha enumerada. Frases curtas funcionam melhor.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={adicionarComodidade}>
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {config.comodidades.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-orange-500 text-xs font-bold text-white">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Input
                      value={c.titulo}
                      onChange={(e) => atualizarComodidade(i, { titulo: e.target.value })}
                      placeholder="Bancos de couro"
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removerComodidade(i)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CIDADES */}
        <TabsContent value="cidades" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="text-base font-bold">Cidades atendidas</h3>
                <p className="text-xs text-muted-foreground">
                  Pressiona Enter para adicionar. Mínimo 3 cidades para liberar o checklist.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={novaCidade}
                  onChange={(e) => setNovaCidade(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarCidade();
                    }
                  }}
                  placeholder="Ex: Balneário Camboriú"
                />
                <Button onClick={adicionarCidade} variant="default">
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {config.cidades_atendidas.map((c, i) => (
                  <Badge
                    key={i}
                    className="h-8 gap-1.5 border-orange-500/30 bg-orange-500/10 px-3 text-sm text-orange-700 dark:text-orange-300"
                    variant="outline"
                  >
                    {c}
                    <button
                      onClick={() => removerCidade(i)}
                      className="-mr-1 rounded p-0.5 hover:bg-orange-500/20"
                      aria-label={`Remover ${c}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
                {config.cidades_atendidas.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma cidade adicionada ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VISUAL */}
        <TabsContent value="visual" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-base font-bold">Tema do catálogo</h3>
                <p className="text-xs text-muted-foreground">
                  Todos os temas são dark — escolhe o que combina melhor com a tua marca.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {TEMAS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ tema: t.id })}
                    className={cn(
                      "flex flex-col items-stretch overflow-hidden rounded-lg border-2 transition",
                      config.tema === t.id
                        ? "border-orange-500 shadow-lg shadow-orange-500/20"
                        : "border-border hover:border-orange-500/50",
                    )}
                  >
                    <div
                      className="h-20 w-full"
                      style={{ backgroundColor: t.preview }}
                    >
                      <div
                        className="ml-3 mt-3 h-1.5 w-10"
                        style={{ backgroundColor: config.cor_acento }}
                      />
                    </div>
                    <div className="bg-background px-3 py-2 text-left">
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">#{t.preview.slice(1)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="text-base font-bold">Cor de acento</h3>
                <p className="text-xs text-muted-foreground">
                  Destaque usado em barras, títulos e elementos de marca.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CORES_ACENTO.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => update({ cor_acento: hex })}
                    className={cn(
                      "h-10 w-10 rounded-full border-2 transition",
                      config.cor_acento === hex
                        ? "scale-110 border-foreground shadow-lg"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={hex}
                  />
                ))}
                <Input
                  type="color"
                  value={config.cor_acento}
                  onChange={(e) => update({ cor_acento: e.target.value })}
                  className="h-10 w-14 cursor-pointer p-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <BannerUpload
                titulo="Banner da capa"
                descricao="Aparece em full bleed na página 1. Recomendado 3000×2000 px."
                url={config.banner_capa_url}
                onUpload={(f) => handleUpload(f, "banner_capa_url")}
                onRemove={() => handleRemoverImagem("banner_capa_url")}
                inputRef={fileInputCapaRef}
                loading={uploading === "banner_capa_url"}
              />
              <BannerUpload
                titulo="Banner da contracapa"
                descricao="Última página com CTA. Opcional — usa gradient se não houver."
                url={config.banner_contracapa_url}
                onUpload={(f) => handleUpload(f, "banner_contracapa_url")}
                onRemove={() => handleRemoverImagem("banner_contracapa_url")}
                inputRef={fileInputContracapaRef}
                loading={uploading === "banner_contracapa_url"}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREVIEW */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">Preview do catálogo</h3>
                  <p className="text-xs text-muted-foreground">
                    Gera um PDF temporário numa nova aba — sem marca d'água.
                  </p>
                  {sistema && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">Veículos:</strong>{" "}
                        {sistema.veiculos.length}
                      </span>
                      <span>
                        <strong className="text-foreground">Serviços:</strong>{" "}
                        {config.servicos_destaque.filter((s) => s.titulo?.trim()).length}
                      </span>
                      <span>
                        <strong className="text-foreground">Comodidades:</strong>{" "}
                        {config.comodidades.filter((c) => c.titulo?.trim()).length}
                      </span>
                      <span>
                        <strong className="text-foreground">Cidades:</strong>{" "}
                        {config.cidades_atendidas.length}
                      </span>
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={handlePreview} disabled={gerando}>
                  {gerando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="mr-2 h-4 w-4" />
                  )}
                  Abrir preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── BARRA INFERIOR FIXA ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            {dirty ? (
              <span className="flex items-center gap-1.5 text-orange-500">
                <Circle className="h-2 w-2 fill-current" />
                Alterações não salvas
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tudo salvo
              </span>
            )}
            {config.ultimo_pdf_gerado_em && (
              <span>
                · último PDF em{" "}
                {new Date(config.ultimo_pdf_gerado_em).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSalvar}
              disabled={saving || !dirty}
              size="sm"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
            <Button
              onClick={handleGerar}
              disabled={gerando || (plano !== "free" && !podeGerar)}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
            >
              {gerando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar PDF
            </Button>
          </div>
        </div>
      </div>

      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}

function BannerUpload({
  titulo,
  descricao,
  url,
  onUpload,
  onRemove,
  inputRef,
  loading,
}: {
  titulo: string;
  descricao: string;
  url: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  loading: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
        {url ? (
          <img src={url} alt={titulo} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Nenhuma imagem</span>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {url ? "Trocar" : "Enviar"}
        </Button>
        {url && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
