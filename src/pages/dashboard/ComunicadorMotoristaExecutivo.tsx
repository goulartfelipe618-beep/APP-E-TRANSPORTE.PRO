import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import { formatPhoneBrDisplay } from "@/lib/evolutionApi";
import { Info } from "lucide-react";

export default function ComunicadorMotoristaExecutivoPage() {
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const { sistema, loading, reload } = useComunicadoresEvolution({ includeUsuarioComunicador: false });

  if (painelComunicadorReady && !painelMotoristaEvolutionAtivo) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">Integração Evolution (WhatsApp)</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Funcionalidade indisponível</AlertTitle>
          <AlertDescription className="text-sm">
            O administrador desativou o Comunicador Evolution no painel dos motoristas. Quando for reativado, o menu
            voltará a aparecer em Sistema.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que foi desligado?</CardTitle>
            <CardDescription>
              A página de referência ao canal oficial da plataforma deixa de ser oferecida neste painel até nova
              liberação.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">
            O WhatsApp utilizado é sempre o <strong className="text-foreground">comunicador oficial da plataforma</strong>.
            Em <strong className="text-foreground">Comunicar</strong>, os envios seguem esse canal. A ligação de um número
            próprio via QR poderá ser disponibilizada no futuro.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {sistema?.telefone_conectado ? (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="space-y-2 pb-6 pt-6 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Número oficial da plataforma</p>
            {sistema.nome_dispositivo ? (
              <p className="text-base font-medium text-foreground">{sistema.nome_dispositivo}</p>
            ) : null}
            <p className="break-all font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {formatPhoneBrDisplay(sistema.telefone_conectado)}
            </p>
            <p className="mx-auto max-w-md pt-2 text-xs text-muted-foreground">
              Use este WhatsApp para comunicação oficial com clientes quando a política da sua operação assim exigir.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ComunicadorEvolutionSection
        title="Comunicador oficial E-Transporte.pro"
        description="Linha oficial da plataforma (sincronizada via n8n / backend). Os envios em Comunicar usam sempre este canal."
        row={sistema}
        readOnly
        loading={loading}
        busy={false}
        onRefresh={() => void reload()}
        onGerarQr={() => {}}
        evolutionCreds={undefined}
        hideQr
      />
    </div>
  );
}
