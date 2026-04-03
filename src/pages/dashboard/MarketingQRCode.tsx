import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Download, Copy, ExternalLink } from "lucide-react";
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

function QrExportOptionsFields(props: {
  sizeId: QrExportSizeId;
  onSizeId: (v: QrExportSizeId) => void;
  scheme: QrColorScheme;
  onScheme: (v: QrColorScheme) => void;
  idsPrefix: string;
}) {
  const { sizeId, onSizeId, scheme, onScheme, idsPrefix } = props;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-base">Tamanho do QR Code</Label>
        <RadioGroup
          value={sizeId}
          onValueChange={(v) => onSizeId(v as QrExportSizeId)}
          className="grid gap-2"
        >
          <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <RadioGroupItem value="pequeno" id={`${idsPrefix}-sz-p`} />
            <Label htmlFor={`${idsPrefix}-sz-p`} className="cursor-pointer font-normal flex-1">
              Pequeno — <span className="font-mono text-xs">512 × 512</span> px
            </Label>
          </div>
          <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <RadioGroupItem value="medio" id={`${idsPrefix}-sz-m`} />
            <Label htmlFor={`${idsPrefix}-sz-m`} className="cursor-pointer font-normal flex-1">
              Médio — <span className="font-mono text-xs">1024 × 1024</span> px
            </Label>
          </div>
          <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <RadioGroupItem value="grande" id={`${idsPrefix}-sz-g`} />
            <Label htmlFor={`${idsPrefix}-sz-g`} className="cursor-pointer font-normal flex-1">
              Grande — <span className="font-mono text-xs">2048 × 2048</span> px
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Estilo</Label>
        <RadioGroup
          value={scheme}
          onValueChange={(v) => onScheme(v as QrColorScheme)}
          className="grid gap-2"
        >
          <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <RadioGroupItem value="light" id={`${idsPrefix}-sc-l`} />
            <Label htmlFor={`${idsPrefix}-sc-l`} className="cursor-pointer font-normal flex-1">
              QR Code preto com fundo branco
            </Label>
          </div>
          <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <RadioGroupItem value="dark" id={`${idsPrefix}-sc-d`} />
            <Label htmlFor={`${idsPrefix}-sc-d`} className="cursor-pointer font-normal flex-1">
              QR Code branco com fundo preto
            </Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );
}

export default function MarketingQRCodePage() {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [urlDestino, setUrlDestino] = useState("");
  const [saving, setSaving] = useState(false);

  const [createSizeId, setCreateSizeId] = useState<QrExportSizeId>("medio");
  const [createScheme, setCreateScheme] = useState<QrColorScheme>("light");

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<QrDownloadSource | null>(null);
  const [dlSizeId, setDlSizeId] = useState<QrExportSizeId>("medio");
  const [dlScheme, setDlScheme] = useState<QrColorScheme>("light");
  const [downloading, setDownloading] = useState(false);

  const fetchQRCodes = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("qr_codes")
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
      setQrCodes(data as unknown as QRCode[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchQRCodes();
  }, [fetchQRCodes]);

  const resetCreateForm = () => {
    setTitulo("");
    setUrlDestino("");
    setCreateSizeId("medio");
    setCreateScheme("light");
  };

  const generateSlug = () => Math.random().toString(36).substring(2, 10);

  const buildExportOpts = (sizeId: QrExportSizeId, scheme: QrColorScheme) => ({
    sizePx: QR_EXPORT_SIZES[sizeId],
    scheme,
    solidBackground: true,
  });

  const handleCreateAndDownload = async () => {
    const url = urlDestino.trim();
    if (!url) {
      toast.error("Informe o link do QR Code");
      return;
    }
    if (!isValidHttpUrl(url)) {
      toast.error("Use um endereço válido começando com http:// ou https://");
      return;
    }

    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      return;
    }

    const slug = generateSlug();
    const tituloFinal = titulo.trim() || "Sem título";

    const { error } = await supabase.from("qr_codes").insert({
      user_id: session.user.id,
      titulo: tituloFinal,
      url_destino: url,
      slug,
    });

    if (error) {
      toast.error("Erro ao criar QR Code", { description: error.message });
      setSaving(false);
      return;
    }

    try {
      await downloadQrCodePng(url, buildExportOpts(createSizeId, createScheme), tituloFinal);
      toast.success("QR Code salvo e download iniciado.");
      setCreateOpen(false);
      resetCreateForm();
      void fetchQRCodes();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o PNG.");
      void fetchQRCodes();
    } finally {
      setSaving(false);
    }
  };

  const openDownloadDialog = (source: QrDownloadSource) => {
    setDownloadTarget(source);
    setDlSizeId("medio");
    setDlScheme("light");
    setDownloadOpen(true);
  };

  const handleDownloadOnly = async () => {
    if (!downloadTarget) return;
    setDownloading(true);
    try {
      await downloadQrCodePng(
        downloadTarget.url_destino,
        buildExportOpts(dlSizeId, dlScheme),
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

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-center pt-4">
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> Novo QR Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto z-[200]">
            <DialogHeader>
              <DialogTitle>Novo QR Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label htmlFor="qr-titulo">Título (nome do QR Code)</Label>
                <Input
                  id="qr-titulo"
                  placeholder="Ex: Promoção Instagram"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-link">Link do QR Code *</Label>
                <Input
                  id="qr-link"
                  type="url"
                  placeholder="https://exemplo.com/sua-pagina"
                  value={urlDestino}
                  onChange={(e) => setUrlDestino(e.target.value)}
                />
              </div>

              <QrExportOptionsFields
                idsPrefix="create"
                sizeId={createSizeId}
                onSizeId={setCreateSizeId}
                scheme={createScheme}
                onScheme={setCreateScheme}
              />

              <p className="text-xs text-muted-foreground">
                O QR Code fica guardado de forma permanente na sua conta e não pode ser excluído.
              </p>

              <Button onClick={() => void handleCreateAndDownload()} disabled={saving} className="w-full">
                {saving ? "Salvando…" : "Salvar e baixar PNG"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              <QrExportOptionsFields
                idsPrefix="dl"
                sizeId={dlSizeId}
                onSizeId={setDlSizeId}
                scheme={dlScheme}
                onScheme={setDlScheme}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDownloadOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={() => void handleDownloadOnly()} disabled={downloading}>
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
      ) : qrCodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <Card key={qr.id}>
              <CardContent className="p-4 space-y-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{qr.titulo}</h3>
                  <p className="text-xs text-muted-foreground truncate">{qr.url_destino}</p>
                </div>

                <div className="flex justify-center bg-white rounded-lg p-3">
                  <QRCodeCanvas value={qr.url_destino} size={160} level="H" includeMargin />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => copyLink(qr.url_destino)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDownloadDialog({ url_destino: qr.url_destino, titulo: qr.titulo || qr.slug })}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(qr.url_destino, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
