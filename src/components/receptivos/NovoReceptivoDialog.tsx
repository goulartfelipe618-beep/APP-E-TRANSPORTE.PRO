import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildFooterPayloadFromReserva,
  generateReceptivoTransferPdf,
  downloadReceptivoPdf,
  getEnderecosReservaParaExibicao,
} from "@/lib/receptivoTransferPdf";

type Reserva = Tables<"reservas_transfer">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export default function NovoReceptivoDialog({ open, onOpenChange, onSaved }: Props) {
  const { config } = useConfiguracoes();
  const [modelo, setModelo] = useState("1");
  const [nomeCliente, setNomeCliente] = useState("");
  const [reservaId, setReservaId] = useState<string>("");
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingReservas(true);
    void (async () => {
      const { data, error } = await supabase
        .from("reservas_transfer")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar reservas Transfer");
        setReservas([]);
      } else {
        setReservas((data as Reserva[]) || []);
      }
      setLoadingReservas(false);
    })();
  }, [open]);

  const selectedReserva = reservas.find((r) => r.id === reservaId) ?? null;
  const enderecosPreview = selectedReserva ? getEnderecosReservaParaExibicao(selectedReserva) : null;

  const reset = () => {
    setModelo("1");
    setNomeCliente("");
    setReservaId("");
  };

  const handleGerar = async () => {
    const nome = nomeCliente.trim();
    if (!nome) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const m = Number(modelo);
    if (m < 1 || m > 5) {
      toast.error("Selecione um modelo válido");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Não autenticado");
        return;
      }

      const reserva = selectedReserva;
      const footer = buildFooterPayloadFromReserva(reserva, nome);

      const nomeProjeto = config.nome_projeto || "E-Transporte.pro";
      const doc = await generateReceptivoTransferPdf(
        m,
        nome,
        nomeProjeto,
        config.logo_url || null,
        footer,
      );

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const fname = `receptivo-${stamp}.pdf`;
      downloadReceptivoPdf(doc, fname);

      const { error: insErr } = await supabase.from("receptivos").insert({
        user_id: user.id,
        modelo: m,
        nome_cliente: nome,
        reserva_transfer_id: reserva?.id ?? null,
        reserva_numero: reserva?.numero_reserva ?? null,
        tipo_viagem: reserva?.tipo_viagem ?? null,
        embarque: reserva ? footer.embarque || null : null,
        desembarque: reserva ? footer.desembarque || null : null,
        volta_embarque: reserva?.volta_embarque ?? null,
        volta_desembarque: reserva?.volta_desembarque ?? null,
        ida_data: reserva?.ida_data ?? null,
        ida_hora: reserva?.ida_hora ?? null,
        volta_data: reserva?.volta_data ?? null,
        volta_hora: reserva?.volta_hora ?? null,
      });

      if (insErr) {
        toast.error("PDF gerado, mas não foi possível salvar o histórico: " + insErr.message);
      } else {
        toast.success("Receptivo gerado e salvo no histórico");
      }

      reset();
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo receptivo</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Gera uma plaquinha em PDF (A4 paisagem). Os endereços de embarque e desembarque{" "}
            <strong className="text-foreground">só entram no PDF</strong> quando você associa uma{" "}
            <strong className="text-foreground">reserva Transfer</strong>; caso contrário, o rodapé da viagem fica em
            branco.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Modelo do receptivo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Modelo 1 — Logo central, nome e traço</SelectItem>
                <SelectItem value="2">Modelo 2 — Faixa superior e destaque</SelectItem>
                <SelectItem value="3">Modelo 3 — Coluna lateral e tipografia</SelectItem>
                <SelectItem value="4">Modelo 4 — Moldura dupla clássica</SelectItem>
                <SelectItem value="5">Modelo 5 — Cantoneiras decorativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nome-cliente">Nome do cliente *</Label>
            <Input
              id="nome-cliente"
              className="mt-1.5"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              placeholder="Como deve aparecer na plaquinha"
            />
          </div>

          <div>
            <Label>Reserva Transfer</Label>
            <Select
              value={reservaId || "none"}
              onValueChange={(v) => setReservaId(v === "none" ? "" : v)}
              disabled={loadingReservas}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={loadingReservas ? "Carregando…" : "Selecione uma reserva"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma — sem endereços no PDF (só nome na plaquinha)</SelectItem>
                {reservas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    #{r.numero_reserva} — {r.nome_completo} ({r.tipo_viagem?.replace("_", " ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReserva && enderecosPreview && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">Endereços da reserva (automáticos no PDF)</p>
              <p>
                <span className="text-muted-foreground">Embarque: </span>
                {enderecosPreview.embarque}
              </p>
              <p>
                <span className="text-muted-foreground">Desembarque: </span>
                {enderecosPreview.desembarque}
              </p>
              <p className="text-xs text-muted-foreground">Não é possível editar manualmente; altere a reserva na base se necessário.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={() => void handleGerar()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Gerar PDF e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
