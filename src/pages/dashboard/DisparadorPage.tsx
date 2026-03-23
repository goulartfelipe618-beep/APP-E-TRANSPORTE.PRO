import { useState } from "react";
import SlideCarousel from "@/components/SlideCarousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Send, MessageSquare, ListChecks, MousePointerClick,
  Smartphone, ShieldAlert, XCircle, Zap, Globe, ArrowRight, CheckCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";

const STEPS = [
  {
    icon: Smartphone,
    title: "1. Use um número secundário",
    description:
      "O Disparador utiliza a tecnologia Baileys, que se conecta diretamente ao servidor do WhatsApp. Por isso, NUNCA use seu número oficial de atendimento. Compre um chip pré-pago exclusivo para disparos.",
    highlight: true,
  },
  {
    icon: Zap,
    title: "2. Conecte o número ao Disparador",
    description:
      "Ao acessar o disparador (link fornecido pelo administrador), escaneie o QR Code com o WhatsApp do chip secundário. Isso vincula o número à plataforma de envio.",
  },
  {
    icon: ListChecks,
    title: "3. Monte suas listas de contatos",
    description:
      "Importe ou cadastre os contatos que deseja alcançar. Organize por categorias: hotéis, agências, clientes recorrentes, leads frios, etc.",
  },
  {
    icon: MessageSquare,
    title: "4. Crie mensagens com Botões e Listas",
    description:
      "Em vez de texto puro, utilize mensagens interativas com botões de ação e menus em lista. Esse formato tem taxa de resposta até 3x maior que mensagens comuns.",
  },
  {
    icon: Send,
    title: "5. Programe e dispare",
    description:
      "Configure intervalos entre envios (recomendado: 15-30 segundos) para evitar bloqueios. Agende campanhas e acompanhe os resultados.",
  },
];

const ADVANTAGES = [
  { icon: MousePointerClick, text: "Botões interativos aumentam conversão em até 300%" },
  { icon: ListChecks, text: "Menus em lista organizam opções e facilitam a resposta do cliente" },
  { icon: Send, text: "Disparo em massa com intervalos inteligentes anti-bloqueio" },
  { icon: MessageSquare, text: "Mensagens com formato profissional, como as grandes empresas" },
];

const WARNINGS = [
  { icon: XCircle, text: "NUNCA use seu número oficial — risco de banimento permanente" },
  { icon: ShieldAlert, text: "O WhatsApp pode bloquear números que fazem disparo em massa" },
  { icon: AlertTriangle, text: "Use intervalos entre mensagens para reduzir risco de bloqueio" },
];

export default function DisparadorPage() {
  const { hasPlan } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [domainStep, setDomainStep] = useState(false);
  const [domain, setDomain] = useState("");
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainResult, setDomainResult] = useState<{ available: boolean | null; message: string } | null>(null);

  const handleCheckDomain = async () => {
    if (!domain.trim()) { toast.error("Informe um domínio"); return; }
    setCheckingDomain(true); setDomainResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-domain", { body: { domain: domain.trim() } });
      if (error) throw error;
      setDomainResult({ available: data.available, message: data.message });
    } catch {
      toast.error("Erro ao verificar domínio");
      setDomainResult({ available: null, message: "Não foi possível verificar." });
    }
    setCheckingDomain(false);
  };

  const handleAccessDispatcher = () => {
    if (!hasPlan("grow")) {
      setUpgradeOpen(true);
      return;
    }
    toast.info("Acessando disparador...");
  };

  // Domain step view
  if (domainStep) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disparador — Escolha seu domínio</h1>
          <p className="text-sm text-muted-foreground">Verifique a disponibilidade do domínio para continuar.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nome desejado para o domínio</label>
            <Input value={domain} onChange={e => { setDomain(e.target.value); setDomainResult(null); }} placeholder="empresa.com.br" className="mt-1" />
          </div>
          <Button variant="outline" onClick={handleCheckDomain} disabled={checkingDomain || !domain.trim()}>
            {checkingDomain ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</> : <><Globe className="h-4 w-4 mr-2" /> Pesquisar Domínio</>}
          </Button>
          {domainResult && (
            <div className={cn("rounded-lg border p-4 flex items-start gap-3",
              domainResult.available === true && "border-green-500/30 bg-green-500/10",
              domainResult.available === false && "border-destructive/30 bg-destructive/10",
              domainResult.available === null && "border-border bg-muted/30",
            )}>
              {domainResult.available === true && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
              {domainResult.available === false && <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
              <p className="text-sm font-semibold">{domainResult.message}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setDomainStep(false)}>Voltar</Button>
            <Button onClick={() => {
              if (!hasPlan("grow")) { setUpgradeOpen(true); return; }
              toast.info("Prosseguindo...");
            }}>
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
        <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} requiredPlan="grow" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SlideCarousel pagina="disparador" />

      {/* Hero */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold">
          <Send className="h-4 w-4" />
          Disparador de Mensagens
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Dispare mensagens que realmente convertem
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Envie mensagens com <strong>botões interativos</strong> e <strong>menus em lista</strong> para
          seus contatos. Converta até 3x mais do que disparos de texto comum.
        </p>
      </div>

      {/* Advantages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ADVANTAGES.map((a, i) => (
          <Card key={i} className="border-primary/20">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                <a.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-foreground">{a.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warning banner */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-foreground">⚠️ Atenção — Leia antes de usar</h3>
          </div>
          <div className="space-y-2">
            {WARNINGS.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <w.icon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">{w.text}</p>
              </div>
            ))}
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3 mt-2">
            <p className="text-sm text-foreground font-medium">
              💡 Esta tecnologia usa a biblioteca <Badge variant="outline" className="mx-1">Baileys</Badge> que
              se conecta ao servidor real do WhatsApp utilizando engenharia reversa da API oficial.
              O uso é por sua conta e risco. Recomendamos fortemente o uso de um <strong>número secundário exclusivo</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Como funciona — Passo a passo</h2>
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <Card key={i} className={step.highlight ? "border-destructive/50 bg-destructive/5" : ""}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`rounded-xl p-3 shrink-0 ${step.highlight ? "bg-destructive/10" : "bg-muted"}`}>
                  <step.icon className={`h-6 w-6 ${step.highlight ? "text-destructive" : "text-primary"}`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


      {/* CTA */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-6 text-center space-y-3">
          <Zap className="h-8 w-8 text-primary mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Pronto para disparar?</h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Certifique-se de ter um chip secundário em mãos antes de iniciar.
          </p>
          <Button className="gap-2" onClick={() => setDomainStep(true)}>
            <Send className="h-4 w-4" /> Acessar Disparador
          </Button>
        </CardContent>
      </Card>

      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} requiredPlan="grow" />
    </div>
  );
}
