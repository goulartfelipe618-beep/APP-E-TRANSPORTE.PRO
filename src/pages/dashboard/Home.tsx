import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMotoristaOnboarding } from "@/hooks/useMotoristaOnboarding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { toast } from "sonner";
import {
  persistNetworkAceitoNao,
  persistNetworkAceitoSim,
  persistNetworkRetornoSolicitado,
} from "@/lib/networkNacionalPrefs";
import { PLATFORM_LOGO_URL, resolvePainelLogoUrl } from "@/lib/painelBrand";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { setActivePage } = useActivePage();
  const { config } = useConfiguracoes();
  const onboarding = useMotoristaOnboarding();
  const [networkAceito, setNetworkAceito] = useState<boolean | null>(null);
  const [mostrarRegras, setMostrarRegras] = useState(false);

  const logoSrc = resolvePainelLogoUrl(config.logo_url);
  const logoFromConfig = Boolean(config.logo_url?.trim());
  const projectName = config.nome_projeto?.trim() || "E-Transporte.pro";

  useEffect(() => {
    const checkNetworkStatus = () => {
      const status = localStorage.getItem("network_nacional_aceito");
      const saida = localStorage.getItem("network_saida_data");
      if (status === "sim") {
        setNetworkAceito(true);
      } else if (status === "nao") {
        if (saida) {
          const diff = Date.now() - new Date(saida).getTime();
          const diasPassados = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (diasPassados < 60) {
            setNetworkAceito(false);
          } else {
            setNetworkAceito(null);
          }
        } else {
          setNetworkAceito(false);
        }
      }
    };
    checkNetworkStatus();
    window.addEventListener("network-status-changed", checkNetworkStatus);
    return () => window.removeEventListener("network-status-changed", checkNetworkStatus);
  }, [onboarding.phase1Complete]);

  const handleAceitarNetwork = () => {
    setMostrarRegras(true);
  };

  const handleConfirmarRegras = async () => {
    localStorage.removeItem("network_highlight_shown");
    localStorage.setItem("network_nacional_aceito", "sim");
    const ok = await persistNetworkAceitoSim();
    if (!ok) {
      toast.error("Não foi possível salvar no servidor. A preferência ficou apenas neste dispositivo.");
    }
    setNetworkAceito(true);
    setMostrarRegras(false);
    window.dispatchEvent(new Event("network-status-changed"));
    window.dispatchEvent(new Event("configuracoes-updated"));
  };

  const handleRecusarNetwork = async () => {
    localStorage.setItem("network_nacional_aceito", "nao");
    const ok = await persistNetworkAceitoNao();
    if (!ok) {
      toast.error("Não foi possível salvar no servidor. A preferência ficou apenas neste dispositivo.");
    }
    setNetworkAceito(false);
    window.dispatchEvent(new Event("network-status-changed"));
    window.dispatchEvent(new Event("configuracoes-updated"));
  };

  const networkBloco = (
    <>
      {!onboarding.loading && onboarding.phase1Complete && networkAceito === null && !mostrarRegras && (
        <div className="space-y-4 rounded-xl border-2 border-primary/50 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Network Nacional E-Transporte.pro</h3>
              <p className="text-sm text-muted-foreground">Programa de atendimento corporativo nacional</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Deseja fazer parte do sistema de <strong className="text-foreground">Network Nacional</strong> da
            E-Transporte.pro? Ao participar, você poderá receber solicitações de atendimento corporativo de empresas
            parceiras em sua região.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAceitarNetwork} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Sim, quero participar
            </Button>
            <Button variant="outline" onClick={handleRecusarNetwork}>
              Não, obrigado
            </Button>
          </div>
        </div>
      )}

      {!onboarding.loading && onboarding.phase1Complete && mostrarRegras && (
        <div className="space-y-5 rounded-xl border-2 border-destructive/50 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Termos obrigatórios — Network Nacional</h3>
              <Badge variant="destructive" className="mt-1">
                Leitura obrigatória
              </Badge>
            </div>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h4 className="mb-1 font-bold text-foreground">1. Obrigatoriedade de atendimento</h4>
              <p>
                Todas as solicitações enviadas para você através do Network Nacional{" "}
                <strong className="text-foreground">deverão ser obrigatoriamente realizadas por você</strong>. Caso não
                consiga realizar o atendimento pessoalmente,{" "}
                <strong className="text-foreground">deverá ser realizado por um parceiro seu</strong>, e você será o
                responsável integral por esse atendimento.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">2. Penalização por descumprimento</h4>
              <p>
                O não cumprimento de qualquer solicitação resultará em{" "}
                <strong className="text-destructive">perda imediata do acesso ao sistema</strong> e{" "}
                <strong className="text-destructive">quebra da relação com a E-Transporte.pro</strong>. Não haverá
                tolerância para descumprimentos.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">3. Atendimento alto padrão — indispensável</h4>
              <p>
                O motorista que faz parte do Network Nacional{" "}
                <strong className="text-foreground">deve manter um atendimento de altíssimo padrão</strong> em todas as
                corridas: pontualidade, cordialidade, veículo limpo e em boas condições, vestimenta adequada, discrição e
                profissionalismo.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-destructive">4. Proibição total de troca de contatos</h4>
              <p className="font-semibold text-foreground">
                É totalmente proibido solicitar, oferecer ou trocar qualquer contato com o passageiro (telefone,
                WhatsApp, e-mail, redes sociais ou outros).
              </p>
              <p>
                O descumprimento resultará em{" "}
                <strong className="text-destructive">desligamento imediato do sistema sem possibilidade de retorno</strong>
                .
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">5. Representação da marca</h4>
              <p>
                Ao aceitar este termo, você representa a E-Transporte.pro perante clientes corporativos. Condutas
                inadequadas serão tratadas com rigor.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleConfirmarRegras} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Li e aceito todos os termos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarRegras(false);
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {!onboarding.loading && onboarding.phase1Complete && networkAceito === true && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Você faz parte do Network Nacional E-Transporte.pro</p>
            <p className="text-xs text-muted-foreground">Seus termos foram aceitos. Mantenha o padrão de excelência.</p>
          </div>
        </div>
      )}

      {!onboarding.loading && onboarding.phase1Complete && networkAceito === false && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Você optou por não participar do Network Nacional.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              localStorage.removeItem("network_nacional_aceito");
              localStorage.removeItem("network_saida_data");
              localStorage.removeItem("network_highlight_shown");
              const ok = await persistNetworkRetornoSolicitado();
              if (!ok) {
                toast.error("Não foi possível atualizar no servidor.");
              }
              setNetworkAceito(null);
              window.dispatchEvent(new Event("network-status-changed"));
              window.dispatchEvent(new Event("configuracoes-updated"));
            }}
          >
            Reconsiderar
          </Button>
        </div>
      )}
    </>
  );

  const showOnboardingPanels =
    !onboarding.loading &&
    ((!onboarding.phase1Complete) ||
      (onboarding.phase1Complete && !onboarding.networkChosen));

  return (
    <div className="flex min-h-[min(72vh,calc(100dvh-12rem))] min-w-0 flex-col gap-6">
      {showOnboardingPanels ? (
        <div className="w-full max-w-3xl space-y-4 shrink-0">
          {!onboarding.loading && onboarding.phase1Complete && !onboarding.networkChosen ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">Passo seguinte: Network Nacional</h2>
              <p className="text-sm text-muted-foreground">
                Confirme abaixo se deseja integrar o programa. Esta escolha é necessária para liberar o restante do
                painel.
              </p>
              {networkBloco}
            </div>
          ) : null}

          {!onboarding.loading && !onboarding.phase1Complete ? (
            <div className="space-y-4 rounded-xl border-2 border-amber-500/50 bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-3">
                  <Settings className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Configurações obrigatórias</h3>
                  <p className="text-sm text-muted-foreground">
                    Conclua <strong className="text-foreground">Sistema → Configurações</strong> (Meu Perfil, Nome do
                    projeto, Contratual, Segurança com redefinição de senha) antes de utilizar o painel.
                  </p>
                </div>
              </div>
              {onboarding.pendencias.length > 0 ? (
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {onboarding.pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <Button className="bg-primary text-primary-foreground" onClick={() => setActivePage("sistema/configuracoes")}>
                Ir para Configurações
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-1 flex-col items-stretch justify-center",
          showOnboardingPanels ? "lg:flex-row lg:items-start lg:justify-between lg:gap-10" : "lg:justify-end",
        )}
      >
        <div className="hidden flex-1 lg:block" aria-hidden />

        <section
          className={cn(
            "flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12",
            "lg:items-end lg:px-10 lg:py-16",
            showOnboardingPanels ? "lg:max-w-[min(52%,28rem)] lg:shrink-0" : "lg:ml-auto lg:max-w-2xl",
          )}
          aria-label="Identidade visual da operação"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-muted/20 p-8 shadow-lg sm:p-12">
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(255,102,0,0.12), transparent 70%)",
              }}
              aria-hidden
            />
            <img
              src={logoSrc}
              alt={logoFromConfig ? `Logo de ${projectName}` : "Logo E-Transporte.pro"}
              className="relative mx-auto max-h-[min(52vh,22rem)] w-auto max-w-full object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.endsWith(PLATFORM_LOGO_URL)) return;
                img.src = PLATFORM_LOGO_URL;
              }}
            />
            <div className="relative mt-8 text-center lg:text-right">
              <p className="text-xs font-medium uppercase tracking-widest text-[#FF6600]">Motorista Executivo</p>
              <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {projectName}
              </h1>
              {config.nome_completo?.trim() ? (
                <p className="mt-2 text-sm text-muted-foreground">{config.nome_completo.trim()}</p>
              ) : null}
              {!logoFromConfig ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Envie a sua logo em <strong className="text-foreground">Sistema → Configurações</strong> para
                  personalizar esta área.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
