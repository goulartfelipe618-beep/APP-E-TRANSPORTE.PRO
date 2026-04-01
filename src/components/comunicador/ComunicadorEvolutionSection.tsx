import { Loader2, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";
import { qrSrc } from "@/hooks/useComunicadoresEvolution";
import type { EvolutionCreds } from "@/lib/evolutionApi";
import { evolutionEnvConfigured, formatPhoneBrDisplay } from "@/lib/evolutionApi";

type Props = {
  title: string;
  description: string;
  row: ComunicadorRow | null;
  /** Ex.: motorista vendo o oficial — só atualizar lista / ver QR que o admin gerou */
  readOnly: boolean;
  loading: boolean;
  busy: boolean;
  onRefresh: () => void;
  onGerarQr: () => void | Promise<void>;
  onRemover?: () => void | Promise<void>;
  showRemover?: boolean;
  /** Credenciais do painel (oficial) ou undefined para usar só .env no comunicador pessoal */
  evolutionCreds?: EvolutionCreds | null;
  /** Comunicador oficial: sem QR — só status após conexão automática */
  hideQr?: boolean;
};

export function ComunicadorEvolutionSection({
  title,
  description,
  row,
  readOnly,
  loading,
  busy,
  onRefresh,
  onGerarQr,
  onRemover,
  showRemover,
  evolutionCreds,
  hideQr,
}: Props) {
  const img = qrSrc(row?.qr_code_base64 ?? null);
  const envOk = evolutionEnvConfigured(evolutionCreds ?? undefined);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {title}
            <Badge variant="outline">{row?.connection_status ?? "—"}</Badge>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
          {row?.nome_dispositivo ? (
            <p className="text-sm font-medium text-foreground pt-1">{row.nome_dispositivo}</p>
          ) : null}
          {row?.telefone_conectado ? (
            <p className="text-sm text-foreground pt-1">
              Número:{" "}
              <span className="font-mono font-semibold">{formatPhoneBrDisplay(row.telefone_conectado)}</span>
            </p>
          ) : null}
          {row?.instance_name ? (
            <p className="text-xs text-muted-foreground font-mono">Instância: {row.instance_name}</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRefresh} disabled={loading || busy} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && !hideQr && !envOk && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertTitle>Evolution API não configurada no front-end</AlertTitle>
            <AlertDescription>
              Para gerar QR Code a partir daqui, defina <code className="text-xs">VITE_EVOLUTION_API_URL</code> e{" "}
              <code className="text-xs">VITE_EVOLUTION_API_KEY</code> no ambiente de build. Sem isso, use o painel da Evolution
              diretamente com o mesmo nome de instância exibido abaixo.
            </AlertDescription>
          </Alert>
        )}
        {hideQr && !readOnly && (
          <p className="text-sm text-muted-foreground">
            A conexão com a Evolution é feita ao salvar os dados acima; o número sincronizado aparece aqui e para todos os motoristas.
          </p>
        )}
        {readOnly && !row?.telefone_conectado && !img && !loading && (
          <p className="text-sm text-muted-foreground">
            Quando o administrador master salvar os dados da Evolution, o número oficial aparecerá aqui automaticamente para todos os motoristas executivos.
          </p>
        )}

        {hideQr ? null : (
          <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:items-start sm:justify-center">
            <div className="flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
              {img ? (
                <img src={img} alt="QR Code WhatsApp" className="max-h-full max-w-full object-contain" />
              ) : (
                <Smartphone className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                Escaneie com o WhatsApp no celular. O QR expira; gere novamente se necessário.
              </p>
              {!readOnly && (
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void onGerarQr()} disabled={busy || loading}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Smartphone className="h-4 w-4 mr-2" />}
                    Gerar QR Code
                  </Button>
                  {showRemover && onRemover ? (
                    <Button type="button" variant="destructive" onClick={() => void onRemover()} disabled={busy || loading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover comunicador
                    </Button>
                  ) : null}
                </div>
              )}
              {readOnly && (
                <p className="text-xs text-muted-foreground">
                  O comunicador oficial conecta automaticamente pelo administrador; use o número quando estiver disponível.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
