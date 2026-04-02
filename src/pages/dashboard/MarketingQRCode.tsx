import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Plus, Download, Copy, ExternalLink, Eye, EyeOff, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import {
  QR_EXPORT_SIZES,
  type QrColorScheme,
  type QrExportSizeId,
  downloadQrCodePng,
} from "@/lib/qrCodeDownload";

interface QRCode {
  id: string;
  titulo: string;
  url_destino: string;
  slug: string;
  ativo: boolean;
  created_at: string;
}

/** Fonte para o diálogo de download (QR salvo ou link rápido). */
interface QrDownloadSource {
  url_destino: string;
  titulo: string;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function MarketingQRCodePage() {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [urlDestino, setUrlDestino] = useState("");
  const [saving, setSaving] = useState(false);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<QrDownloadSource | null>(null);
  const [sizeId, setSizeId] = useState<QrExportSizeId>("medio");
  const [scheme, setScheme] = useState<QrColorScheme>("light");
  const [solidBackground, setSolidBackground] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [quickUrl, setQuickUrl] = useState("");
  const [quickTitulo, setQuickTitulo] = useState("");

  const fetchQRCodes = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("qr_codes" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar os QR Codes.", {
        description: error.message || "Verifique permissões do banco (tabela qr_codes).",
      });
      setQrCodes([]);
    } else if (data) {
      setQrCodes(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const handleCreate = async () => {
    if (!urlDestino.trim()) {
      toast.error("Informe a URL de destino");
      return;
    }
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      return;
    }

    const slug = generateSlug();

    const { error } = await supabase.from("qr_codes" as any).insert({
      user_id: session.user.id,
      titulo: titulo.trim() || "Sem título",
      url_destino: urlDestino.trim(),
      slug,
    } as any);

    if (error) {
      toast.error("Erro ao criar QR Code", { description: error.message });
    } else {
      toast.success("QR Code criado com sucesso!");
      setTitulo("");
      setUrlDestino("");
      setDialogOpen(false);
      fetchQRCodes();
    }
    setSaving(false);
  };

  const toggleAtivo = async (qr: QRCode) => {
    const { error } = await supabase
      .from("qr_codes" as any)
      .update({ ativo: !qr.ativo } as any)
      .eq("id", qr.id);

    if (!error) {
      toast.success(qr.ativo ? "QR Code ocultado" : "QR Code reativado");
      fetchQRCodes();
    } else {
      toast.error("Não foi possível atualizar", { description: error.message });
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openDownloadDialog = (source: QrDownloadSource) => {
    setDownloadTarget(source);
    setSizeId("medio");
    setScheme("light");
    setSolidBackground(true);
    setDownloadOpen(true);
  };

  const openQuickDownloadDialog = () => {
    const u = quickUrl.trim();
    if (!u) {
      toast.error("Cole um link (https://…)");
      return;
    }
    if (!isValidHttpUrl(u)) {
      toast.error("Use um endereço válido começando com http:// ou https://");
      return;
    }
    openDownloadDialog({
      url_destino: u,
      titulo: quickTitulo.trim() || "qr-rapido",
    });
  };

  const handleDownload = async () => {
    if (!downloadTarget) return;
    setDownloading(true);
    try {
      await downloadQrCodePng(
        downloadTarget.url_destino,
        {
          sizePx: QR_EXPORT_SIZES[sizeId],
          scheme,
          solidBackground,
        },
        downloadTarget.titulo,
      );
      toast.success("Download iniciado.");
      setDownloadOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o PNG.");
    } finally {
      setDownloading(false);
    }
  };

  const quickPreviewUrl = quickUrl.trim() && isValidHttpUrl(quickUrl.trim()) ? quickUrl.trim() : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR Code</h1>
          <p className="text-muted-foreground">Crie QR Codes permanentes para seus links</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchQRCodes}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" /> Novo QR Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar QR Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Título (opcional)</Label>
                  <Input
                    placeholder="Ex: Promoção Instagram"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div>
                  <Label>URL de destino *</Label>
                  <Input
                    placeholder="https://exemplo.com/minha-pagina"
                    value={urlDestino}
                    onChange={(e) => setUrlDestino(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O QR Code gerado será <strong>permanente</strong> — mesmo que ocultado, o link nunca deixará de funcionar.
                </p>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? "Criando..." : "Criar QR Code"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Baixar QR Code (sem salvar)</CardTitle>
          </div>
          <CardDescription>
            Escolha tamanho (512 / 1048 / 2048 px), cores (fundo branco+QR preto ou fundo preto+QR branco) e com ou sem
            fundo transparente — funciona mesmo sem criar um QR na lista abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-url">Link para codificar *</Label>
              <Input
                id="quick-url"
                type="url"
                placeholder="https://seusite.com/promo"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-tit">Nome do arquivo (opcional)</Label>
              <Input
                id="quick-tit"
                placeholder="Ex: campanha-instagram"
                value={quickTitulo}
                onChange={(e) => setQuickTitulo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {quickPreviewUrl ? (
              <div className="flex justify-center rounded-lg border border-border bg-white p-3 w-fit">
                <QRCodeCanvas value={quickPreviewUrl} size={120} level="H" includeMargin />
              </div>
            ) : (
              <div className="h-[152px] w-[152px] rounded-lg border border-dashed border-muted-foreground/40 flex items-center justify-center text-xs text-muted-foreground text-center px-2">
                Prévia após colar o link
              </div>
            )}
            <Button type="button" onClick={openQuickDownloadDialog} className="sm:ml-auto">
              <Download className="h-4 w-4 mr-2" />
              Escolher tamanho, cores e baixar PNG
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto z-[200]">
          <DialogHeader>
            <DialogTitle>Baixar QR Code em PNG</DialogTitle>
          </DialogHeader>
          {downloadTarget && (
            <div className="space-y-5 pt-4">
              <p className="text-sm text-muted-foreground break-all">
                <span className="font-medium text-foreground block truncate">{downloadTarget.titulo}</span>
                {downloadTarget.url_destino}
              </p>

              <div className="space-y-2">
                <Label className="text-base">Tamanho</Label>
                <RadioGroup
                  value={sizeId}
                  onValueChange={(v) => setSizeId(v as QrExportSizeId)}
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="pequeno" id="dl-sz-peq" />
                    <Label htmlFor="dl-sz-peq" className="cursor-pointer font-normal flex-1">
                      Pequeno — <span className="font-mono text-xs">512 × 512</span> px
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="medio" id="dl-sz-med" />
                    <Label htmlFor="dl-sz-med" className="cursor-pointer font-normal flex-1">
                      Médio — <span className="font-mono text-xs">1048 × 1048</span> px
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="grande" id="dl-sz-gra" />
                    <Label htmlFor="dl-sz-gra" className="cursor-pointer font-normal flex-1">
                      Grande — <span className="font-mono text-xs">2048 × 2048</span> px
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Cores</Label>
                <RadioGroup
                  value={scheme}
                  onValueChange={(v) => setScheme(v as QrColorScheme)}
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="light" id="dl-cl-light" />
                    <Label htmlFor="dl-cl-light" className="cursor-pointer font-normal flex-1">
                      Fundo branco e QR preto
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="dark" id="dl-cl-dark" />
                    <Label htmlFor="dl-cl-dark" className="cursor-pointer font-normal flex-1">
                      Fundo preto e QR branco
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="dl-solid-bg" className="text-base">
                    Fundo sólido
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Desligue para PNG com fundo transparente (apenas os módulos do QR).
                  </p>
                </div>
                <Switch id="dl-solid-bg" checked={solidBackground} onCheckedChange={setSolidBackground} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDownloadOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={() => void handleDownload()} disabled={downloading}>
                  {downloading ? "Gerando…" : "Baixar PNG"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : qrCodes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Nenhum QR Code salvo na lista ainda.</p>
          <p className="text-xs text-muted-foreground">
            Use o bloco <strong className="text-foreground">Baixar QR Code (sem salvar)</strong> acima para exportar PNG
            com todas as opções, ou clique em <strong className="text-foreground">Novo QR Code</strong> para guardar um
            link permanente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <Card key={qr.id} className={`relative ${!qr.ativo ? "opacity-60" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{qr.titulo}</h3>
                    <p className="text-xs text-muted-foreground truncate">{qr.url_destino}</p>
                  </div>
                  <Badge variant={qr.ativo ? "default" : "secondary"} className="ml-2 shrink-0">
                    {qr.ativo ? "Ativo" : "Oculto"}
                  </Badge>
                </div>

                <div className="flex justify-center bg-white rounded-lg p-3">
                  <QRCodeCanvas
                    id={`qr-${qr.slug}`}
                    value={qr.url_destino}
                    size={160}
                    level="H"
                    includeMargin
                  />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => copyLink(qr.url_destino)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openDownloadDialog({ url_destino: qr.url_destino, titulo: qr.titulo || qr.slug })
                    }
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(qr.url_destino, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAtivo(qr)}>
                    {qr.ativo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
