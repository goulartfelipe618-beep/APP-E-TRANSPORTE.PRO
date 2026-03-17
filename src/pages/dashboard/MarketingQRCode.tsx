import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Download, Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

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

  useEffect(() => { fetchQRCodes(); }, []);

  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const handleCreate = async () => {
    if (!urlDestino.trim()) { toast.error("Informe a URL de destino"); return; }
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

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

  const downloadQR = (slug: string, titulo: string) => {
    const canvas = document.getElementById(`qr-${slug}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode-${titulo || slug}.png`;
    a.click();
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
                  <Button variant="outline" size="sm" onClick={() => downloadQR(qr.slug, qr.titulo)}>
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
