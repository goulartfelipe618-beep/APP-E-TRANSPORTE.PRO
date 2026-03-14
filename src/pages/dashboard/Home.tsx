import { ChevronLeft, ChevronRight, Mail, Globe, Search, ShoppingCart, Users, BarChart3, Car, ArrowLeftRight, Handshake } from "lucide-react";
import { useState, useEffect } from "react";
import luxuryCar from "@/assets/luxury-car.jpg";
import { supabase } from "@/integrations/supabase/client";

interface SlideData {
  id: string;
  titulo: string;
  subtitulo: string;
  imagem_url: string;
}

const fallbackSlides: SlideData[] = [
  {
    id: "default",
    titulo: "Impulsione seu Transporte Executivo",
    subtitulo: "Gerencie sua frota, motoristas e corridas com tecnologia de ponta.",
    imagem_url: luxuryCar,
  },
];

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>(fallbackSlides);

  useEffect(() => {
    const fetchSlides = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("slides")
        .select("id, titulo, subtitulo, imagem_url")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (data && data.length > 0) {
        setSlides(data as SlideData[]);
      }
    };
    fetchSlides();
  }, []);

  const prevSlide = () => setCurrentSlide((c) => (c > 0 ? c - 1 : slides.length - 1));
  const nextSlide = () => setCurrentSlide((c) => (c < slides.length - 1 ? c + 1 : 0));

  return (
    <div className="space-y-8">
      {/* Hero Carousel */}
      <div className="relative rounded-xl overflow-hidden h-72">
        <img
          src={slides[currentSlide]?.imagem_url || luxuryCar}
          alt="Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-12">
          <div className="max-w-lg">
            <h1 className="text-3xl font-bold text-white mb-2">{slides[currentSlide]?.titulo}</h1>
            <p className="text-white/80">{slides[currentSlide]?.subtitulo}</p>
          </div>
        </div>
        {slides.length > 1 && (
          <>
            <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white hover:bg-black/70">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white hover:bg-black/70">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${i === currentSlide ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

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
