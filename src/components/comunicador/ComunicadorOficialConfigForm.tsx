import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type OficialFormValues = {
  api_url: string;
  api_key: string;
  instance_name: string;
  nome_dispositivo: string;
};

type Props = {
  values: OficialFormValues;
  onChange: (field: keyof OficialFormValues, value: string) => void;
  onSubmit: () => void | Promise<void>;
  saving: boolean;
  disabled?: boolean;
};

export function ComunicadorOficialConfigForm({ values, onChange, onSubmit, saving, disabled }: Props) {
  return (
    <Card className="border-primary/30 bg-muted/20">
      <CardHeader>
        <CardTitle className="text-lg">Configuração Evolution — comunicador oficial</CardTitle>
        <CardDescription>
          Preencha os quatro campos e salve: a conexão com a Evolution é feita automaticamente — não é necessário escanear QR Code neste painel. O número passa a aparecer para todos os motoristas quando a Evolution devolver a linha conectada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="evo-url">URL da API Evolution</Label>
            <Input
              id="evo-url"
              placeholder="https://sua-api.evolution.com"
              value={values.api_url}
              onChange={(e) => onChange("api_url", e.target.value)}
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="evo-key">Chave da API (API Key)</Label>
            <Input
              id="evo-key"
              type="password"
              placeholder="••••••••"
              value={values.api_key}
              onChange={(e) => onChange("api_key", e.target.value)}
              autoComplete="new-password"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evo-instance">Nome da instância</Label>
            <Input
              id="evo-instance"
              placeholder="ex.: etp-oficial"
              value={values.instance_name}
              onChange={(e) => onChange("instance_name", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evo-device">Nome do dispositivo</Label>
            <Input
              id="evo-device"
              placeholder="ex.: WhatsApp Central E-Transporte"
              value={values.nome_dispositivo}
              onChange={(e) => onChange("nome_dispositivo", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void onSubmit()} disabled={disabled || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar e conectar automaticamente
        </Button>
      </CardContent>
    </Card>
  );
}
