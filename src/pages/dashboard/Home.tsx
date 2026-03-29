import { Mail, Globe, Search, ShoppingCart, Users, BarChart3, Car, ArrowLeftRight, Handshake, ShieldCheck, AlertTriangle, CheckCircle2, Settings, CircleDot, Check } from "lucide-react";
import { useState, useEffect } from "react";
import luxuryCar from "@/assets/luxury-car.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SlideCarousel from "@/components/SlideCarousel";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  persistNetworkAceitoNao,
  persistNetworkAceitoSim,
  persistNetworkRetornoSolicitado,
} from "@/lib/networkNacionalPrefs";

const tools = [
  { icon: Mail, title: "E-mail Profissional", desc: "Crie e-mails corporativos com o domínio da sua empresa para credibilidade total." },
  { icon: Globe, title: "Criação de Website", desc: "Tenha seu site profissional no ar em minutos, com design exclusivo para transporte." },
  { icon: Search, title: "Google Meu Negócio", desc: "Apareça no Google Maps e nas buscas locais com perfil verificado." },
  { icon: ShoppingCart, title: "Domínio Oficial", desc: "Registre seu domínio .com.br direto pela plataforma com planos acessíveis." },
  { icon: Users, title: "Network", desc: "Construa sua rede de contatos com hotéis, agências e parceiros estratégicos." },
  { icon: BarChart3, title: "Métricas & Análises", desc: "Acompanhe KPIs, volume de corridas e desempenho da sua operação em tempo real." },
  { icon: Car, title: "Gestão de Veículos", desc: "Cadastre e controle sua frota com documentação, status e manutenção." },
  { icon: ArrowLeftRight, title: "Transfer & Reservas", desc: "Gerencie solicitações, reservas e contratos de transfer executivo." },
  { icon: Handshake, title: "Parcerias & Motoristas", desc: "Cadastre motoristas, parceiros e gerencie a operação colaborativa." },
];

export default function HomePage() {
  const { setActivePage } = useActivePage();
  const [networkAceito, setNetworkAceito] = useState<boolean | null>(null);
  const [mostrarRegras, setMostrarRegras] = useState(false);
  const [primeirosPassosConcluidos, setPrimeirosPassosConcluidos] = useState<boolean | null>(null);

  const CAMPOS_PERFIL_OBRIGATORIOS = ["nome_completo", "nome_empresa", "cnpj", "telefone", "email", "cidade"];
  const CAMPOS_CONTRATUAIS_OBRIGATORIOS = ["razao_social", "cnpj", "endereco_sede", "telefone", "whatsapp", "email_oficial"];

  const checkPrimeirosPassos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfilData } = await supabase
        .from("configuracoes" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    const { data: contratualData } = await supabase
      .from("cabecalho_contratual" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const perfil = (perfilData || {}) as any;
    const contratual = (contratualData || {}) as any;

    const perfilCompleto = CAMPOS_PERFIL_OBRIGATORIOS.every(
      (campo) => perfil[campo] && String(perfil[campo]).trim() !== ""
    );
    const contratualCompleto = CAMPOS_CONTRATUAIS_OBRIGATORIOS.every(
      (campo) => contratual[campo] && String(contratual[campo]).trim() !== ""
    );

    setPrimeirosPassosConcluidos(perfilCompleto && contratualCompleto);
  };

  useEffect(() => {
    checkPrimeirosPassos();

    const handleConfigUpdate = () => {
      checkPrimeirosPassos();
    };

    window.addEventListener("configuracoes-updated", handleConfigUpdate);

    return () => {
      window.removeEventListener("configuracoes-updated", handleConfigUpdate);
    };
  }, []);

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
  }, []);

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
  };

  const handleRecusarNetwork = async () => {
    localStorage.setItem("network_nacional_aceito", "nao");
    const ok = await persistNetworkAceitoNao();
    if (!ok) {
      toast.error("Não foi possível salvar no servidor. A preferência ficou apenas neste dispositivo.");
    }
    setNetworkAceito(false);
    window.dispatchEvent(new Event("network-status-changed"));
  };

  return (
    <div className="space-y-8">
      {/* Hero Carousel */}
      <SlideCarousel
        pagina="home"
        fallbackSlides={[{
          titulo: "Impulsione seu Transporte Executivo",
          subtitulo: "Gerencie sua frota, motoristas e corridas com tecnologia de ponta.",
          imagem_url: luxuryCar,
        }]}
      />

      {/* Primeiros Passos */}
      {primeirosPassosConcluidos === false && (
        <div className="rounded-xl border-2 border-amber-500/50 bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Settings className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Primeiros Passos</h3>
              <p className="text-sm text-muted-foreground">Complete as etapas abaixo para começar a usar a plataforma</p>
            </div>
          </div>
          <div className="space-y-3">
            <div
              className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
              onClick={() => setActivePage("sistema/configuracoes")}
            >
              <div className="p-1.5 rounded-full border-2 border-amber-500">
                <CircleDot className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Preencha suas Configurações</p>
                <p className="text-xs text-muted-foreground">Acesse Sistema → Configurações e preencha todos os campos obrigatórios (nome, empresa, CNPJ, telefone, e-mail, endereço, cidade e estado).</p>
              </div>
              <Badge variant="outline" className="text-amber-500 border-amber-500/50">Pendente</Badge>
            </div>
          </div>
        </div>
      )}


      {networkAceito === null && !mostrarRegras && (
        <div className="rounded-xl border-2 border-primary/50 bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Network Nacional E-Transporte.pro</h3>
              <p className="text-sm text-muted-foreground">Programa de atendimento corporativo nacional</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deseja fazer parte do sistema de <strong className="text-foreground">Network Nacional</strong> da E-Transporte.pro?
            Ao participar, você poderá receber solicitações de atendimento corporativo de empresas parceiras em sua região.
          </p>
          <div className="flex gap-3">
            <Button onClick={handleAceitarNetwork} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Sim, quero participar
            </Button>
            <Button variant="outline" onClick={handleRecusarNetwork}>
              Não, obrigado
            </Button>
          </div>
        </div>
      )}

      {/* Regras e Termos obrigatórios */}
      {mostrarRegras && (
        <div className="rounded-xl border-2 border-destructive/50 bg-card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Termos Obrigatórios — Network Nacional</h3>
              <Badge variant="destructive" className="mt-1">Leitura obrigatória</Badge>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed border border-border rounded-lg p-4 bg-muted/30 max-h-80 overflow-y-auto">
            <div>
              <h4 className="font-bold text-foreground mb-1">📌 1. Obrigatoriedade de Atendimento</h4>
              <p>
                Todas as solicitações enviadas para você através do Network Nacional <strong className="text-foreground">deverão ser obrigatoriamente realizadas por você</strong>.
                Caso não consiga realizar o atendimento pessoalmente, <strong className="text-foreground">deverá ser realizado por um parceiro seu</strong>, e você será o responsável integral por esse atendimento.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-1">⚠️ 2. Penalização por Descumprimento</h4>
              <p>
                O não cumprimento de qualquer solicitação resultará em <strong className="text-destructive">perda imediata do acesso ao sistema</strong> e <strong className="text-destructive">quebra da relação com a E-Transporte.pro</strong>.
                Não haverá tolerância para descumprimentos.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-1">🎩 3. Atendimento Alto Padrão — INDISPENSÁVEL</h4>
              <p>
                O motorista que faz parte do Network Nacional <strong className="text-foreground">deve manter um atendimento de altíssimo padrão</strong> em todas as corridas.
                Isso inclui: pontualidade, cordialidade, veículo limpo e em perfeitas condições, vestimenta adequada, discrição e profissionalismo absoluto.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-destructive mb-1">🚫 4. PROIBIÇÃO TOTAL DE TROCA DE CONTATOS</h4>
              <p className="text-foreground font-semibold">
                É TOTALMENTE PROIBIDO que o motorista solicite, ofereça ou troque qualquer tipo de contato com o passageiro.
              </p>
              <p>
                Isso inclui: número de telefone, WhatsApp, e-mail, redes sociais ou qualquer outro meio de comunicação direta.
                O descumprimento desta regra resultará em <strong className="text-destructive">desligamento imediato do sistema sem possibilidade de retorno</strong>.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-1">🤝 5. Representação da Marca</h4>
              <p>
                Ao aceitar este termo, você se torna um representante da E-Transporte.pro perante os clientes corporativos.
                Qualquer conduta inadequada reflete diretamente na marca e será tratada com o máximo rigor.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleConfirmarRegras} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Li e aceito todos os termos
            </Button>
            <Button variant="outline" onClick={() => { setMostrarRegras(false); }}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Status após aceite */}
      {networkAceito === true && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Você faz parte do Network Nacional E-Transporte.pro</p>
            <p className="text-xs text-muted-foreground">Seus termos foram aceitos. Mantenha o padrão de excelência.</p>
          </div>
        </div>
      )}

      {networkAceito === false && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
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
            }}
          >
            Reconsiderar
          </Button>
        </div>
      )}

      {/* Tools */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Ferramentas Disponíveis</h2>
        <p className="text-muted-foreground mt-1">Tudo o que você precisa para impulsionar seu transporte executivo em uma única plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div key={tool.title} className="rounded-xl border border-border bg-card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 rounded-xl bg-muted">
              <tool.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{tool.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-6 bg-card rounded-xl">
        <p className="font-semibold text-foreground">🚗 E-Transporte.pro — Plataforma completa para Transporte Executivo</p>
        <p className="text-sm text-muted-foreground mt-1">Gestão de frota, marketing digital, network e muito mais. Tudo integrado para o seu crescimento.</p>
      </div>
    </div>
  );
}
