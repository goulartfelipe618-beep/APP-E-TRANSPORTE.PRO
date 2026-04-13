import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Alert, AlertDescription, AlertTitle,
} from "@/components/ui/alert";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, ChevronRight, Send, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MapboxAddressInput from "@/components/mapbox/MapboxAddressInput";
import ServiceAreaMultiInput from "@/components/google/ServiceAreaMultiInput";
import {
  buildGoogleSolicitacaoPayload,
  formatBrazilPhoneDisplay,
  normalizeBrazilPhoneDigits,
  validateGbpBusinessTitle,
  GBP_FIXED_PRIMARY_CATEGORY,
  buildGbpWebsiteUriForUser,
  type GbpDaySchedule,
  type GbpServiceAreaPlace,
  type GbpVerificationAddress,
} from "@/lib/googleBusinessSolicitation";

const DAYS = [
  { name: "Segunda-feira", short: "Seg", defaultOn: true },
  { name: "Terça-feira", short: "Ter", defaultOn: true },
  { name: "Quarta-feira", short: "Qua", defaultOn: true },
  { name: "Quinta-feira", short: "Qui", defaultOn: true },
  { name: "Sexta-feira", short: "Sex", defaultOn: true },
  { name: "Sábado", short: "Sáb", defaultOn: true },
  { name: "Domingo", short: "Dom", defaultOn: false },
];

const STEPS = [
  { label: "Nome do negócio", desc: "Conformidade Google" },
  { label: "Endereço (verificação)", desc: "Não aparece no Maps" },
  { label: "Área de atendimento", desc: "Onde você atua" },
  { label: "Telefone", desc: "WhatsApp / ligações" },
  { label: "Horários", desc: "Funcionamento" },
  { label: "Revisão", desc: "Envio" },
] as const;

function defaultSchedule(): GbpDaySchedule[] {
  return DAYS.map((d, dayIndex) => ({
    dayIndex,
    dayShort: d.short,
    dayName: d.name,
    enabled: d.defaultOn,
    open: "08:00",
    close: "18:00",
  }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export default function GoogleBusinessSolicitationDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null);

  const [businessTitle, setBusinessTitle] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [mapboxLine, setMapboxLine] = useState("");
  const [verifLat, setVerifLat] = useState<number | null>(null);
  const [verifLng, setVerifLng] = useState<number | null>(null);

  const [serviceAreas, setServiceAreas] = useState<GbpServiceAreaPlace[]>([]);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [schedule, setSchedule] = useState<GbpDaySchedule[]>(() => defaultSchedule());

  useEffect(() => {
    if (!open || step !== 5) return;
    void supabase.auth.getUser().then(({ data }) => {
      setSummaryUserId(data.user?.id ?? null);
    });
  }, [open, step]);

  const resetForm = () => {
    setStep(0);
    setBusinessTitle("");
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
    setMapboxLine("");
    setVerifLat(null);
    setVerifLng(null);
    setServiceAreas([]);
    setPhoneDigits("");
    setSchedule(defaultSchedule());
    setSummaryUserId(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const verificationAddress = (): GbpVerificationAddress => ({
    cep: cep.trim(),
    logradouro: logradouro.trim(),
    numero: numero.trim(),
    complemento: complemento.trim(),
    bairro: bairro.trim(),
    cidade: cidade.trim(),
    uf: uf.trim().toUpperCase().slice(0, 2),
    linha_completa: mapboxLine.trim() || undefined,
    latitude: verifLat,
    longitude: verifLng,
  });

  const validateStep = (i: number): boolean => {
    if (i === 0) {
      const r = validateGbpBusinessTitle(businessTitle);
      if (!r.ok) {
        toast.error(r.message);
        return false;
      }
    }
    if (i === 1) {
      const a = verificationAddress();
      if (!a.cep || !a.logradouro || !a.numero || !a.bairro || !a.cidade || !a.uf || a.uf.length < 2) {
        toast.error("Preencha CEP, rua, número, bairro, cidade e UF do endereço residencial.");
        return false;
      }
    }
    if (i === 2) {
      if (serviceAreas.length < 1) {
        toast.error("Adicione pelo menos uma cidade ou região de atendimento.");
        return false;
      }
    }
    if (i === 3) {
      const d = normalizeBrazilPhoneDigits(phoneDigits);
      if (d.length < 10) {
        toast.error("Informe um telefone / WhatsApp válido (DDD + número).");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não autenticado");
      return;
    }
    const digits = normalizeBrazilPhoneDigits(phoneDigits);
    setSubmitting(true);
    try {
      const { data: free, error: rpcErr } = await supabase.rpc(
        "motorista_telefone_disponivel_para_google" as any,
        { p_user_id: user.id, p_telefone: digits } as any,
      );
      if (rpcErr) {
        toast.error("Não foi possível validar o telefone. Tente novamente.");
        return;
      }
      if (free !== true) {
        toast.error("Este número já está em uso por outro cadastro na plataforma. Use um telefone exclusivo para o Google.");
        return;
      }

      const payload = buildGoogleSolicitacaoPayload({
        userId: user.id,
        businessTitle,
        verificationAddress: verificationAddress(),
        serviceAreas,
        primaryPhoneDigits: digits,
        regularHours: schedule,
      });

      const { error } = await supabase.from("solicitacoes_servicos" as any).insert({
        user_id: user.id,
        tipo_servico: "google",
        dados_solicitacao: payload,
      } as any);

      if (error) {
        toast.error("Erro: " + error.message);
        return;
      }
      toast.success("Solicitação enviada. Nossa equipe seguirá as regras do Google Business Profile (SAB).");
      handleClose(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar perfil no Google Business Profile</DialogTitle>
            <DialogDescription>
              Motoristas sem loja física são cadastrados como <strong>Service Area Business (SAB)</strong>: endereço só para
              verificação, não exibido no Maps. Categoria e site são definidos pela plataforma para proteger a conta API.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-500/40 bg-amber-500/10">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-950 dark:text-amber-100">Conformidade e verificação</AlertTitle>
            <AlertDescription className="text-amber-950/90 dark:text-amber-50/90 text-sm">
              O Google pode exigir <strong>verificação por vídeo</strong> (veículo, painel, documentos). Se isso ocorrer, o status
              aparecerá como pendente de verificação e você receberá instruções para concluir no app Google Business Profile.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  if (i <= step) setStep(i);
                }}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="gbp-title">Nome profissional ou razão social *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left">
                    Use só seu nome ou o da empresa. Não use cidades, preços, &quot;barato&quot;, &quot;24h&quot; ou adjetivos — o Google
                    pode suspender o perfil e afetar toda a plataforma.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="gbp-title"
                value={businessTitle}
                onChange={(e) => setBusinessTitle(e.target.value)}
                placeholder="Ex.: João Silva Transportes"
                maxLength={58}
              />
              <p className="text-xs text-destructive font-medium">
                Não use palavras como barato, 24h, promoção ou o nome da cidade no título — risco de banimento pelo Google.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Endereço residencial</strong> — obrigatório para o Google validar que você existe.
                Ele <strong>não será exibido</strong> aos clientes no Maps (perfil SAB).
              </p>
              <div>
                <Label className="mb-1.5 block">Buscar no mapa (opcional)</Label>
                <MapboxAddressInput
                  value={mapboxLine}
                  onChangeAddress={setMapboxLine}
                  onCoordinatesChange={(lat, lng) => {
                    setVerifLat(lat);
                    setVerifLng(lng);
                  }}
                  onPlaceContext={(c, e) => {
                    if (c) setCidade(c);
                    if (e) setUf(e);
                  }}
                  placeholder="Digite rua e cidade para preencher mais rápido…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label>CEP *</Label>
                  <Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Logradouro (rua/avenida) *</Label>
                  <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Bairro *</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="SC" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>Área de atendimento *</Label>
              <ServiceAreaMultiInput areas={serviceAreas} onChange={setServiceAreas} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="gbp-phone">WhatsApp / celular para contato *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left">
                    Cada número deve ser exclusivo na plataforma. O Google cruza telefones repetidos e pode encerrar perfis por fraude.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="gbp-phone"
                inputMode="tel"
                autoComplete="tel"
                value={formatBrazilPhoneDisplay(phoneDigits)}
                onChange={(e) => setPhoneDigits(normalizeBrazilPhoneDigits(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Informe horários realistas. &quot;24 horas&quot; é aceito para transporte, mas evite frustração dos passageiros.
              </p>
              {schedule.map((day, i) => (
                <div key={day.dayName} className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) =>
                      setSchedule((s) => {
                        const n = [...s];
                        n[i] = { ...n[i], enabled: v };
                        return n;
                      })
                    }
                  />
                  <span className="text-sm text-foreground w-12 shrink-0">{day.dayShort}</span>
                  {day.enabled ? (
                    <>
                      <Input
                        type="time"
                        value={day.open}
                        className="w-28"
                        onChange={(e) =>
                          setSchedule((s) => {
                            const n = [...s];
                            n[i] = { ...n[i], open: e.target.value };
                            return n;
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">às</span>
                      <Input
                        type="time"
                        value={day.close}
                        className="w-28"
                        onChange={(e) =>
                          setSchedule((s) => {
                            const n = [...s];
                            n[i] = { ...n[i], close: e.target.value };
                            return n;
                          })
                        }
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm">
              <p className="font-medium text-foreground">Definido pela plataforma (API)</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Perfil como empresa de área de atendimento (SAB) — endereço oculto no Maps</li>
                <li>Categoria principal: {GBP_FIXED_PRIMARY_CATEGORY.displayLabel}</li>
                <li>
                  Site no perfil:{" "}
                  <span className="font-mono text-xs break-all text-foreground">
                    {summaryUserId ? buildGbpWebsiteUriForUser(summaryUserId) : "Carregando…"}
                  </span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                A URL usa seu identificador na plataforma para ser única. Opcional: defina{" "}
                <code className="text-[11px]">VITE_MOTORISTA_PUBLIC_BASE_URL</code> no ambiente (ex.: pasta de catálogo público).
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                <p><span className="text-muted-foreground">Nome:</span> {businessTitle}</p>
                <p><span className="text-muted-foreground">Endereço (verificação):</span> {logradouro}, {numero} — {bairro}, {cidade}/{uf}</p>
                <p><span className="text-muted-foreground">Áreas:</span> {serviceAreas.map((a) => a.label).join("; ")}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {formatBrazilPhoneDisplay(phoneDigits)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? handleClose(false) : setStep((s) => s - 1))}>
              {step === 0 ? "Cancelar" : "Anterior"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => {
                  if (!validateStep(step)) return;
                  setStep((s) => s + 1);
                }}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar solicitação
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
