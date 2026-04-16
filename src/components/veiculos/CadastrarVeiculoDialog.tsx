import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated?: () => void;
};

type UploadField = { key: string; label: string; required?: boolean };

const IMAGE_FIELDS: UploadField[] = [
  { key: "dianteira", label: "Dianteira", required: true },
  { key: "traseira", label: "Traseira", required: true },
  { key: "lateral_esquerda", label: "Lateral esquerda", required: true },
  { key: "lateral_direita", label: "Lateral direita", required: true },
  { key: "externa_1", label: "Externa adicional 1" },
  { key: "externa_2", label: "Externa adicional 2" },
  { key: "externa_3", label: "Externa adicional 3" },
  { key: "externa_4", label: "Externa adicional 4" },
  { key: "interna_1", label: "Interna 1" },
  { key: "interna_2", label: "Interna 2" },
  { key: "interna_3", label: "Interna 3" },
  { key: "interna_4", label: "Interna 4" },
];

export default function CadastrarVeiculoDialog({ open, onOpenChange, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [tipoVeiculo, setTipoVeiculo] = useState<"carro" | "van">("carro");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [placa, setPlaca] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [status, setStatus] = useState("ativo");
  const [observacoes, setObservacoes] = useState("");
  const [tipoCobranca, setTipoCobranca] = useState<"km" | "hora" | "hibrido">("hibrido");
  const [valorKm, setValorKm] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [tarifaBase, setTarifaBase] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
  const [kmMinimo, setKmMinimo] = useState("");
  const [toleranciaMinutos, setToleranciaMinutos] = useState("");
  const [valorHoraEspera, setValorHoraEspera] = useState("");
  const [fracaoMinutos, setFracaoMinutos] = useState("15");
  const [multiplicadorIdaVolta, setMultiplicadorIdaVolta] = useState("2");
  const [permitePrecoFixoRota, setPermitePrecoFixoRota] = useState(false);
  const [taxaNoturnaPct, setTaxaNoturnaPct] = useState("");
  const [taxaAeroportoFixa, setTaxaAeroportoFixa] = useState("");
  const [pedagioModo, setPedagioModo] = useState<"manual" | "automatico">("manual");
  const [taxasExtras, setTaxasExtras] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const requiredKeys = useMemo(
    () => IMAGE_FIELDS.filter((field) => field.required).map((field) => field.key),
    [],
  );

  const setFile = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const asNumber = (value: string): number => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const validate = (): string | null => {
    if (!marca.trim()) return "Informe a marca do veículo.";
    if (!modelo.trim()) return "Informe o modelo do veículo.";
    if (!ano.trim()) return "Informe o ano do veículo.";
    if (!placa.trim()) return "Informe a placa do veículo.";
    if (!combustivel.trim()) return "Selecione o combustível.";
    if (!valorKm.trim()) return "Informe o valor por KM rodado.";
    if (!valorHora.trim()) return "Informe o valor por hora.";
    if (!tarifaBase.trim()) return "Informe a tarifa base.";
    if (!valorMinimo.trim()) return "Informe o valor mínimo da corrida.";
    if (!kmMinimo.trim()) return "Informe a distância mínima.";
    if (!toleranciaMinutos.trim()) return "Informe o tempo de tolerância.";
    if (!valorHoraEspera.trim()) return "Informe o valor por hora de espera.";
    if (!fracaoMinutos.trim()) return "Informe a fração de tempo de cobrança.";
    if (!multiplicadorIdaVolta.trim()) return "Informe o multiplicador de ida e volta.";
    for (const key of requiredKeys) {
      if (!files[key]) return "Envie todas as imagens obrigatórias: dianteira, traseira e laterais.";
    }
    return null;
  };

  const uploadImages = async (userId: string, veiculoId: string): Promise<Record<string, string>> => {
    const urls: Record<string, string> = {};
    const fileEntries = Object.entries(files).filter(([, file]) => !!file) as Array<[string, File]>;
    for (const [fieldKey, file] of fileEntries) {
      const { mime } = await assertUploadMagicBytes(file, "raster-image", 10 * 1024 * 1024);
      const ext = extensionForDetectedMime(mime);
      const path = `${userId}/${veiculoId}/${fieldKey}.${ext}`;
      const { error } = await supabase.storage.from("veiculos-imagens").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: mime,
      });
      if (error) {
        throw new Error(`Falha ao enviar imagem (${fieldKey}): ${error.message}`);
      }
      const { data } = supabase.storage.from("veiculos-imagens").getPublicUrl(path);
      urls[fieldKey] = data.publicUrl;
    }
    return urls;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida. Faça login novamente.");

      const veiculoId = crypto.randomUUID();
      const imagens = await uploadImages(user.id, veiculoId);

      const { error } = await supabase.from("veiculos_frota").insert({
        id: veiculoId,
        user_id: user.id,
        tipo_veiculo: tipoVeiculo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: ano.trim(),
        cor: cor.trim() || null,
        placa: placa.trim().toUpperCase(),
        combustivel: combustivel,
        renavam: renavam.trim() || null,
        chassi: chassi.trim() || null,
        status: status,
        observacoes: observacoes.trim() || null,
        valor_km: asNumber(valorKm),
        valor_hora: asNumber(valorHora),
        tarifa_base: asNumber(tarifaBase),
        valor_minimo_corrida: asNumber(valorMinimo),
        distancia_minima_km: asNumber(kmMinimo),
        tempo_tolerancia_min: asNumber(toleranciaMinutos),
        valor_hora_espera: asNumber(valorHoraEspera),
        fracao_tempo_min: asNumber(fracaoMinutos),
        tipo_cobranca: tipoCobranca,
        multiplicador_ida_volta: asNumber(multiplicadorIdaVolta),
        permitir_preco_fixo_rota: permitePrecoFixoRota,
        taxa_noturna_percentual: asNumber(taxaNoturnaPct),
        taxa_aeroporto_fixa: asNumber(taxaAeroportoFixa),
        pedagio_modo: pedagioModo,
        taxas_extras_json: taxasExtras.trim() ? { observacao: taxasExtras.trim() } : null,
        imagens_json: imagens,
      });
      if (error) throw new Error(error.message);

      toast.success("Veículo cadastrado com sucesso.");
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao cadastrar veículo.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo veículo</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Tipo de veículo *</Label>
            <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as "carro" | "van")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="carro">Carro</SelectItem>
                <SelectItem value="van">VAN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Marca *</Label><Input className="mt-1" value={marca} onChange={(e) => setMarca(e.target.value)} /></div>
          <div><Label>Modelo *</Label><Input className="mt-1" value={modelo} onChange={(e) => setModelo(e.target.value)} /></div>
          <div><Label>Ano *</Label><Input className="mt-1" value={ano} onChange={(e) => setAno(e.target.value)} /></div>
          <div><Label>Cor</Label><Input className="mt-1" value={cor} onChange={(e) => setCor(e.target.value)} /></div>
          <div><Label>Placa *</Label><Input className="mt-1" value={placa} onChange={(e) => setPlaca(e.target.value)} /></div>
          <div>
            <Label>Combustível *</Label>
            <Select value={combustivel || undefined} onValueChange={setCombustivel}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flex">Flex</SelectItem>
                <SelectItem value="gasolina">Gasolina</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="eletrico">Elétrico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>RENAVAM</Label><Input className="mt-1" value={renavam} onChange={(e) => setRenavam(e.target.value)} /></div>
          <div><Label>Chassi</Label><Input className="mt-1" value={chassi} onChange={(e) => setChassi(e.target.value)} /></div>
        </div>

        <fieldset className="space-y-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Dados operacionais e cálculo</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label>Valor por KM *</Label><Input className="mt-1" value={valorKm} onChange={(e) => setValorKm(e.target.value)} /></div>
            <div><Label>Valor por hora *</Label><Input className="mt-1" value={valorHora} onChange={(e) => setValorHora(e.target.value)} /></div>
            <div><Label>Tarifa base *</Label><Input className="mt-1" value={tarifaBase} onChange={(e) => setTarifaBase(e.target.value)} /></div>
            <div><Label>Valor mínimo *</Label><Input className="mt-1" value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} /></div>
            <div><Label>Distância mínima (KM) *</Label><Input className="mt-1" value={kmMinimo} onChange={(e) => setKmMinimo(e.target.value)} /></div>
            <div>
              <Label>Tipo de cobrança *</Label>
              <Select value={tipoCobranca} onValueChange={(v) => setTipoCobranca(v as "km" | "hora" | "hibrido")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Por KM</SelectItem>
                  <SelectItem value="hora">Por hora</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Tolerância (min) *</Label><Input className="mt-1" value={toleranciaMinutos} onChange={(e) => setToleranciaMinutos(e.target.value)} /></div>
            <div><Label>Valor/hora espera *</Label><Input className="mt-1" value={valorHoraEspera} onChange={(e) => setValorHoraEspera(e.target.value)} /></div>
            <div><Label>Cobrança por fração (min) *</Label><Input className="mt-1" value={fracaoMinutos} onChange={(e) => setFracaoMinutos(e.target.value)} /></div>
            <div><Label>Multiplicador ida e volta *</Label><Input className="mt-1" value={multiplicadorIdaVolta} onChange={(e) => setMultiplicadorIdaVolta(e.target.value)} /></div>
            <div className="flex items-end gap-2">
              <input id="preco-fixo-rota" type="checkbox" checked={permitePrecoFixoRota} onChange={(e) => setPermitePrecoFixoRota(e.target.checked)} />
              <Label htmlFor="preco-fixo-rota">Permitir preço fixo por rota</Label>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Taxas adicionais</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label>Taxa noturna (%)</Label><Input className="mt-1" value={taxaNoturnaPct} onChange={(e) => setTaxaNoturnaPct(e.target.value)} /></div>
            <div><Label>Taxa aeroporto (fixa)</Label><Input className="mt-1" value={taxaAeroportoFixa} onChange={(e) => setTaxaAeroportoFixa(e.target.value)} /></div>
            <div>
              <Label>Pedágio</Label>
              <Select value={pedagioModo} onValueChange={(v) => setPedagioModo(v as "manual" | "automatico")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatico">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Taxas extras configuráveis</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Descreva taxas extras necessárias para cálculos específicos."
              value={taxasExtras}
              onChange={(e) => setTaxasExtras(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Imagens do veículo</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {IMAGE_FIELDS.map((field) => (
              <div key={field.key}>
                <Label>{field.label}{field.required ? " *" : ""}</Label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 transition-colors hover:bg-muted">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-muted-foreground">{files[field.key]?.name || "Selecionar imagem (máx. 10MB)"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setFile(field.key, e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div>
          <Label>Observações do veículo</Label>
          <Textarea className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar veículo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
