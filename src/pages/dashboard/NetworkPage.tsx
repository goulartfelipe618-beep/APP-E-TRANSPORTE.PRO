import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import NetworkCollaborationFeed from "@/components/network/NetworkCollaborationFeed";

const TRANSPORTE_EXECUTIVO_SITE = "https://www.transporteexecutivo.com";

export default function NetworkPage() {
  return (
    <div className="min-w-0 space-y-6">
      <Alert className="border-[#FF6600]/45 bg-[#FF6600]/10 text-foreground">
        <AlertTitle className="text-foreground">Divulgação Network</AlertTitle>
        <AlertDescription className="space-y-3 text-sm text-muted-foreground">
          <p>
            O ambiente principal utilizado para divulgar e fornecer os contatos de Network e divulgação em massa para
            empresas e pessoas físicas é o website{" "}
            <strong className="text-foreground">www.transporteexecutivo.com</strong>.
          </p>
          <Button
            type="button"
            size="sm"
            className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
            onClick={() => window.open(TRANSPORTE_EXECUTIVO_SITE, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir website
          </Button>
        </AlertDescription>
      </Alert>

      <NetworkCollaborationFeed
        allowModeratorDelete={false}
        title="Network"
        subtitle="Oportunidades compartilhadas entre motoristas: repasses, parcerias na região e solicitações. O que você publicar fica visível para os demais motoristas do sistema; você também vê as publicações de todos."
      />
    </div>
  );
}
