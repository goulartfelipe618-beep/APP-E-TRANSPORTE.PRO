import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useActivePage } from "@/contexts/ActivePageContext";

export type SolicitacoesCapturaExternaInfoVariant = "lista" | "campanhas-ativos";

type Props = {
  /**
   * `lista` — solicitações / leads (texto genérico “nesta lista”).
   * `campanhas-ativos` — mesma lógica de captação + aviso de que os contactos aparecem em Campanhas → Leads.
   */
  variant?: SolicitacoesCapturaExternaInfoVariant;
};

/**
 * Aviso comum no topo das listas vindas de fora do painel (webhooks, formulários externos, campanhas).
 */
export function SolicitacoesCapturaExternaInfo({ variant = "lista" }: Props) {
  const { setActivePage } = useActivePage();
  const isCampanhasAtivos = variant === "campanhas-ativos";

  return (
    <Alert className="border-[#FF6600]/45 bg-[#FF6600]/10 text-foreground">
      <Info className="h-4 w-4 text-[#FF6600]" />
      <AlertTitle className="text-foreground">
        {isCampanhasAtivos ? "Como receber leads nas campanhas" : "Como receber pedidos aqui"}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm text-muted-foreground">
        {isCampanhasAtivos ? (
          <p>
            <strong className="text-foreground">Campanhas → Ativos:</strong> cada campanha que criar aqui gera um
            webhook na sua conta (em <strong className="text-foreground">Automações</strong> → webhooks de campanha).
            Os dados que os formulários enviarem para esse URL{" "}
            <strong className="text-foreground">aparecem na lista do menu Campanhas → Leads</strong> — é nesse ecrã que
            consulta e exporta os contactos captados.
          </p>
        ) : null}
        <p>
          {isCampanhasAtivos
            ? "Para chegarem leads à campanha, é preciso ter "
            : "Para aparecerem solicitações ou leads nesta lista, é preciso ter "}
          <strong className="text-foreground">formulários e coleta direta</strong> ligados aos webhooks da sua operação
          (conforme a automação que configurou), por exemplo:
        </p>
        <ul className="list-disc space-y-1 pl-5 marker:text-[#FF6600]">
          <li>Formulários de site (HTML, WordPress, etc.)</li>
          <li>Google Forms</li>
          <li>Typeform</li>
          <li>Jotform</li>
          <li>Landing pages de captura de leads</li>
        </ul>
        <p>
          Se quiser um <strong className="text-foreground">website dentro do painel</strong> para receber pedidos externos
          com mais facilidade, use o menu <strong className="text-foreground">Website</strong>. Para ajuda com integração
          ou desenvolvimento, fale com a nossa equipa de <strong className="text-foreground">suporte</strong> (Suporte ou
          chat no canto da tela).
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
            onClick={() => setActivePage("website")}
          >
            Abrir Website
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setActivePage("tickets")}>
            Abrir Suporte
          </Button>
          {isCampanhasAtivos ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setActivePage("campanhas/leads")}>
              Abrir Leads
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
