import { Loader2, MoreVertical, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";
import { qrSrc } from "@/hooks/useComunicadoresEvolution";
import type { EvolutionCreds } from "@/lib/evolutionApi";
import { evolutionEnvConfigured, formatPhoneBrDisplay } from "@/lib/evolutionApi";

type Props = {
  title: string;
  description: string;
  row: ComunicadorRow | null;
  readOnly: boolean;
  loading: boolean;
  busy: boolean;
  onRefresh: () => void;
  onGerarQr: () => void | Promise<void>;
  onRemover?: () => void | Promise<void>;
  showRemover?: boolean;
  evolutionCreds?: EvolutionCreds | null;
  hideQr?: boolean;
  hideViteHint?: boolean;
  /** Layout motorista: conectado = foto + número + menu ⋮ para excluir; sem botões grandes de remover/gerar quando conectado. */
  motoristaOwn?: boolean;
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
  hideViteHint,
  motoristaOwn,
}: Props) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const img = qrSrc(row?.qr_code_base64 ?? null);
  const envOk = hideViteHint || evolutionEnvConfigured(evolutionCreds ?? undefined);

  const isConnected =
    Boolean(row?.telefone_conectado?.trim()) || row?.connection_status === "conectado";

  const displayName =
    row?.nome_dispositivo?.trim() ||
    (isConnected ? "WhatsApp conectado" : null);

  const initials = (displayName || "WA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "WA";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-3">
            {motoristaOwn && isConnected ? (
              <Avatar className="h-14 w-14 shrink-0 border border-border">
                <AvatarImage src={row?.foto_perfil_url || undefined} alt="" className="object-cover" />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {title}
                <Badge variant="outline">{row?.connection_status ?? "—"}</Badge>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
              {displayName && (motoristaOwn ? isConnected : true) ? (
                <p className="pt-1 text-sm font-medium text-foreground">{displayName}</p>
              ) : null}
              {row?.telefone_conectado ? (
                <p className="pt-1 text-sm text-foreground">
                  Número:{" "}
                  <span className="font-mono font-semibold">{formatPhoneBrDisplay(row.telefone_conectado)}</span>
                </p>
              ) : null}
              {row?.instance_name ? (
                <p className="font-mono text-xs text-muted-foreground">Instância: {row.instance_name}</p>
              ) : null}
            </div>
            {motoristaOwn && isConnected && showRemover && onRemover ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Opções">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setRemoveOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir comunicador
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRefresh} disabled={loading || busy} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && !hideQr && !hideViteHint && !envOk && (
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
            Quando a linha oficial estiver sincronizada (n8n / backend), o número aparecerá aqui para referência.
          </p>
        )}

        {motoristaOwn && isConnected ? null : hideQr ? null : (
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
              {!readOnly && !(motoristaOwn && isConnected) && (
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Button
                    type="button"
                    className="bg-primary text-primary-foreground"
                    onClick={() => void onGerarQr()}
                    disabled={busy || loading}
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                    Gerar QR Code
                  </Button>
                </div>
              )}
              {readOnly && (
                <p className="text-xs text-muted-foreground">
                  O número oficial é sincronizado pelo sistema; use-o como referência quando estiver disponível.
                </p>
              )}
            </div>
          </div>
        )}

        {motoristaOwn && isConnected ? (
          <p className="text-sm text-muted-foreground">
            Seu WhatsApp está conectado. As mensagens do <strong className="text-foreground">Comunicar</strong> podem ser
            enviadas por este número.
          </p>
        ) : null}
      </CardContent>

      {motoristaOwn && isConnected && showRemover && onRemover ? (
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir comunicador?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove a instância na Evolution e desvincula seu WhatsApp desta conta. Você poderá conectar de novo
                depois gerando um novo QR Code.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setRemoveOpen(false);
                  void onRemover();
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </Card>
  );
}
