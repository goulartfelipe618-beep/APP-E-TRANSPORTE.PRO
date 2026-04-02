import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Plus, Download, Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
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

export default function MarketingQRCodePage() {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [urlDestino, setUrlDestino] = useState("");
  const [saving, setSaving] = useState(false);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<QRCode | null>(null);
  const [sizeId, setSizeId] = useState<QrExportSizeId>("medio");
  const [scheme, setScheme] = useState<QrColorScheme>("light");
  const [solidBackground, setSolidBackground] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchQRCodes = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("qr_codes" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setQrCodes(data as any);
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
      toast.error("Erro ao criar QR Code");
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
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openDownloadDialog = (qr: QRCode) => {
    setDownloadTarget(qr);
    setSizeId("medio");
    setScheme("light");
    setSolidBackground(true);
    setDownloadOpen(true);
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
        downloadTarget.titulo || downloadTarget.slug,
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

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Baixar QR Code em PNG</DialogTitle>
          </DialogHeader>
          {downloadTarget && (
            <div className="space-y-5 pt-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{downloadTarget.titulo}</span>
                <br />
                <span className="truncate block">{downloadTarget.url_destino}</span>
              </p>

              <div className="space-y-2">
                <Label className="text-base">Tamanho</Label>
                <RadioGroup
                  value={sizeId}
                  onValueChange={(v) => setSizeId(v as QrExportSizeId)}
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="pequeno" id="sz-peq" />
                    <Label htmlFor="sz-peq" className="cursor-pointer font-normal flex-1">
                      Pequeno — <span className="font-mono text-xs">512 × 512</span> px
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="medio" id="sz-med" />
                    <Label htmlFor="sz-med" className="cursor-pointer font-normal flex-1">
                      Médio — <span className="font-mono text-xs">1048 × 1048</span> px
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="grande" id="sz-gra" />
                    <Label htmlFor="sz-gra" className="cursor-pointer font-normal flex-1">
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
                    <RadioGroupItem value="light" id="cl-light" />
                    <Label htmlFor="cl-light" className="cursor-pointer font-normal flex-1">
                      Fundo branco e QR preto
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="dark" id="cl-dark" />
                    <Label htmlFor="cl-dark" className="cursor-pointer font-normal flex-1">
                      Fundo preto e QR branco
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="solid-bg" className="text-base">
                    Fundo sólido
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Desligue para PNG com fundo transparente (apenas os módulos do QR).
                  </p>
                </div>
                <Switch id="solid-bg" checked={solidBackground} onCheckedChange={setSolidBackground} />
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
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum QR Code criado ainda.</p>
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
                  <Button variant="outline" size="sm" onClick={() => openDownloadDialog(qr)}>
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
