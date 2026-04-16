import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { validateVehicleCoverDimensions, VEHICLE_COVER_DIMENSIONS } from "@/lib/validateVehicleCoverDimensions";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated?: () => void;
};

type UploadField = { key: string; label: string };

const IMAGE_FIELDS: UploadField[] = [
  { key: "dianteira", label: "Dianteira" },
  { key: "traseira", label: "Traseira" },
  { key: "lateral_esquerda", label: "Lateral esquerda" },
  { key: "lateral_direita", label: "Lateral direita" },
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
  const [status, setStatus] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tipoCobranca, setTipoCobranca] = useState<"" | "km" | "hora" | "hibrido">("");
  const [valorKm, setValorKm] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [tarifaBase, setTarifaBase] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
  const [kmMinimo, setKmMinimo] = useState("");
  const [toleranciaMinutos, setToleranciaMinutos] = useState("");
  const [valorHoraEspera, setValorHoraEspera] = useState("");
  const [fracaoMinutos, setFracaoMinutos] = useState("");
  const [multiplicadorIdaVolta, setMultiplicadorIdaVolta] = useState("");
  const [precoFixoRota, setPrecoFixoRota] = useState<"" | "sim" | "nao">("");
  const [taxaNoturnaPct, setTaxaNoturnaPct] = useState("");
  const [taxaAeroportoFixa, setTaxaAeroportoFixa] = useState("");
  const [pedagioModo, setPedagioModo] = useState<"" | "manual" | "automatico">("");
  const [taxasExtras, setTaxasExtras] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [capaFile, setCapaFile] = useState<File | null>(null);

  const imageKeys = useMemo(() => IMAGE_FIELDS.map((f) => f.key), []);

  const setFile = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const asNumber = (value: string): number => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const validateNumeric = (label: string, raw: string): string | null => {
    const t = raw.trim();
    if (!t) return `Preencha ${label}.`;
    const n = asNumber(t);
    if (!Number.isFinite(n)) return `${label} deve ser um número válido.`;
    if (n < 0) return `${label} não pode ser negativo.`;
    return null;
  };

  const validate = async (): Promise<string | null> => {
    if (!marca.trim()) return "Informe a marca do veículo.";
    if (!modelo.trim()) return "Informe o modelo do veículo.";
    if (!ano.trim()) return "Informe o ano do veículo.";
    if (!cor.trim()) return "Informe a cor do veículo.";
    if (!placa.trim()) return "Informe a placa do veículo.";
    if (!combustivel.trim()) return "Selecione o combustível.";
    if (!renavam.trim()) return "Informe o RENAVAM.";
    if (!chassi.trim()) return "Informe o chassi.";
    if (!status) return "Selecione o status do veículo.";
    if (!observacoes.trim()) return "Informe as observações do veículo.";
    if (!tipoCobranca) return "Selecione o tipo de cobrança.";

    const eKm = validateNumeric("Valor por KM", valorKm);
    if (eKm) return eKm;
    const eHora = validateNumeric("Valor por hora", valorHora);
    if (eHora) return eHora;
    const eBase = validateNumeric("Tarifa base", tarifaBase);
    if (eBase) return eBase;
    const eMin = validateNumeric("Valor mínimo da corrida", valorMinimo);
    if (eMin) return eMin;
    const eKmMin = validateNumeric("Distância mínima (KM)", kmMinimo);
    if (eKmMin) return eKmMin;
    const eTol = validateNumeric("Tolerância (minutos)", toleranciaMinutos);
    if (eTol) return eTol;
    const eEsp = validateNumeric("Valor/hora de espera", valorHoraEspera);
    if (eEsp) return eEsp;
    const eFrac = validateNumeric("Cobrança por fração (minutos)", fracaoMinutos);
    if (eFrac) return eFrac;
    if (asNumber(fracaoMinutos) <= 0) return "Cobrança por fração (minutos) deve ser maior que zero.";
    const eMult = validateNumeric("Multiplicador ida e volta", multiplicadorIdaVolta);
    if (eMult) return eMult;
    if (asNumber(multiplicadorIdaVolta) <= 0) return "Multiplicador ida e volta deve ser maior que zero.";

    if (!precoFixoRota) return "Indique se permite preço fixo por rota (Sim ou Não).";

    const eNot = validateNumeric("Taxa noturna (%)", taxaNoturnaPct);
    if (eNot) return eNot;
    const eAero = validateNumeric("Taxa aeroporto (fixa)", taxaAeroportoFixa);
    if (eAero) return eAero;
    if (!pedagioModo) return "Selecione o modo de pedágio (manual ou automático).";
    if (!taxasExtras.trim()) return "Preencha as taxas extras configuráveis.";

    if (!capaFile) return "Adicione a imagem de capa do veículo (1220×880 px).";
    const capaErr = await validateVehicleCoverDimensions(capaFile);
    if (capaErr) return capaErr;

    for (const key of imageKeys) {
      if (!files[key]) return `Envie a imagem obrigatória: ${IMAGE_FIELDS.find((f) => f.key === key)?.label ?? key}.`;
    }

    return null;
  };

  const uploadOne = async (userId: string, veiculoId: string, fieldKey: string, file: File): Promise<string> => {
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
    return data.publicUrl;
  };

  const handleSave = async () => {
    const validationError = await validate();
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

      const imagemCapaUrl = await uploadOne(user.id, veiculoId, "capa", capaFile!);

      const imagens: Record<string, string> = {};
      for (const key of imageKeys) {
        const file = files[key];
        if (!file) throw new Error(`Ficheiro em falta: ${key}`);
        imagens[key] = await uploadOne(user.id, veiculoId, key, file);
      }

      const { error } = await supabase.from("veiculos_frota").insert({
        id: veiculoId,
        user_id: user.id,
        tipo_veiculo: tipoVeiculo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: ano.trim(),
        cor: cor.trim(),
        placa: placa.trim().toUpperCase(),
        combustivel: combustivel,
        renavam: renavam.trim(),
        chassi: chassi.trim(),
        status: status,
        observacoes: observacoes.trim(),
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
        permitir_preco_fixo_rota: precoFixoRota === "sim",
        taxa_noturna_percentual: asNumber(taxaNoturnaPct),
        taxa_aeroporto_fixa: asNumber(taxaAeroportoFixa),
        pedagio_modo: pedagioModo,
        taxas_extras_json: { descricao: taxasExtras.trim() },
        imagens_json: imagens,
        imagem_capa_url: imagemCapaUrl,
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
      <DialogContent className="max-h-[92vh] w-[min(100vw-1.5rem,56rem)] max-w-4xl overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Novo veículo</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground sm:text-sm">
          Todos os campos são obrigatórios. A capa deve ter exactamente{" "}
          <strong className="text-foreground">
            {VEHICLE_COVER_DIMENSIONS.width}×{VEHICLE_COVER_DIMENSIONS.height} px
          </strong>{" "}
          e aparecerá nos cards da lista.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo de veículo *</Label>
            <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as "carro" | "van")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carro">Carro</SelectItem>
                <SelectItem value="van">VAN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={status || undefined} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marca *</Label>
            <Input className="mt-1" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <Label>Modelo *</Label>
            <Input className="mt-1" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div>
            <Label>Ano *</Label>
            <Input className="mt-1" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <div>
            <Label>Cor *</Label>
            <Input className="mt-1" value={cor} onChange={(e) => setCor(e.target.value)} />
          </div>
          <div>
            <Label>Placa *</Label>
            <Input className="mt-1" value={placa} onChange={(e) => setPlaca(e.target.value)} />
          </div>
          <div>
            <Label>Combustível *</Label>
            <Select value={combustivel || undefined} onValueChange={setCombustivel}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flex">Flex</SelectItem>
                <SelectItem value="gasolina">Gasolina</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="eletrico">Elétrico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>RENAVAM *</Label>
            <Input className="mt-1" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
          </div>
          <div>
            <Label>Chassi *</Label>
            <Input className="mt-1" value={chassi} onChange={(e) => setChassi(e.target.value)} />
          </div>
        </div>

        <fieldset className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Imagem de capa (cards) *</legend>
          <div>
            <Label>
              Capa {VEHICLE_COVER_DIMENSIONS.width}×{VEHICLE_COVER_DIMENSIONS.height} px *
            </Label>
            <label className="mt-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted sm:px-4">
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {capaFile?.name || "Selecionar imagem (máx. 10MB)"}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Dados operacionais e cálculo *</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Valor por KM *</Label>
              <Input className="mt-1" value={valorKm} onChange={(e) => setValorKm(e.target.value)} />
            </div>
            <div>
              <Label>Valor por hora *</Label>
              <Input className="mt-1" value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
            </div>
            <div>
              <Label>Tarifa base *</Label>
              <Input className="mt-1" value={tarifaBase} onChange={(e) => setTarifaBase(e.target.value)} />
            </div>
            <div>
              <Label>Valor mínimo *</Label>
              <Input className="mt-1" value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} />
            </div>
            <div>
              <Label>Distância mínima (KM) *</Label>
              <Input className="mt-1" value={kmMinimo} onChange={(e) => setKmMinimo(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de cobrança *</Label>
              <Select value={tipoCobranca || undefined} onValueChange={(v) => setTipoCobranca(v as "km" | "hora" | "hibrido")}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Por KM</SelectItem>
                  <SelectItem value="hora">Por hora</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tolerância (min) *</Label>
              <Input className="mt-1" value={toleranciaMinutos} onChange={(e) => setToleranciaMinutos(e.target.value)} />
            </div>
            <div>
              <Label>Valor/hora espera *</Label>
              <Input className="mt-1" value={valorHoraEspera} onChange={(e) => setValorHoraEspera(e.target.value)} />
            </div>
            <div>
              <Label>Cobrança por fração (min) *</Label>
              <Input className="mt-1" value={fracaoMinutos} onChange={(e) => setFracaoMinutos(e.target.value)} />
            </div>
            <div>
              <Label>Multiplicador ida e volta *</Label>
              <Input className="mt-1" value={multiplicadorIdaVolta} onChange={(e) => setMultiplicadorIdaVolta(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="mb-2 block">Permitir preço fixo por rota *</Label>
              <RadioGroup
                value={precoFixoRota === "" ? undefined : precoFixoRota}
                onValueChange={(v) => setPrecoFixoRota(v as "sim" | "nao")}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="pf-sim" />
                  <Label htmlFor="pf-sim" className="font-normal">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="pf-nao" />
                  <Label htmlFor="pf-nao" className="font-normal">
                    Não
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Taxas adicionais *</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Taxa noturna (%) *</Label>
              <Input className="mt-1" value={taxaNoturnaPct} onChange={(e) => setTaxaNoturnaPct(e.target.value)} placeholder="0 se não aplicar" />
            </div>
            <div>
              <Label>Taxa aeroporto (fixa) *</Label>
              <Input className="mt-1" value={taxaAeroportoFixa} onChange={(e) => setTaxaAeroportoFixa(e.target.value)} placeholder="0 se não aplicar" />
            </div>
            <div>
              <Label>Pedágio *</Label>
              <Select value={pedagioModo || undefined} onValueChange={(v) => setPedagioModo(v as "manual" | "automatico")}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatico">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Taxas extras configuráveis *</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Descreva todas as taxas extras aplicáveis."
              value={taxasExtras}
              onChange={(e) => setTaxasExtras(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Imagens do veículo *</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {IMAGE_FIELDS.map((field) => (
              <div key={field.key} className="min-w-0">
                <Label>{field.label} *</Label>
                <label className="mt-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted sm:px-4">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate text-sm text-muted-foreground">
                    {files[field.key]?.name || "Selecionar imagem (máx. 10MB)"}
                  </span>
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
          <Label>Observações do veículo *</Label>
          <Textarea className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={() => void handleSave()} disabled={saving} className={cn("w-full sm:w-auto")}>
            {saving ? "Salvando..." : "Salvar veículo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
