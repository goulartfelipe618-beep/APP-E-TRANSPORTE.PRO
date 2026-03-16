import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, ArrowLeft, CheckCircle2, FileText, X } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { toast } from "sonner";

interface MentoriaCard {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  imagem_url: string;
  video_url: string;
  materiais: string;
  link_url: string | null;
  ordem: number;
  ativo: boolean;
}

export default function MentoriaPage() {
  const [sobreCards, setSobreCards] = useState<MentoriaCard[]>([]);
  const [conteudoCards, setConteudoCards] = useState<MentoriaCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MentoriaCard | null>(null);
  const [progresso, setProgresso] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data } = await (supabase
        .from("mentoria_cards" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true }) as any);
      if (data) {
        setSobreCards(data.filter((c: MentoriaCard) => c.tipo === "sobre_sistema"));
        setConteudoCards(data.filter((c: MentoriaCard) => c.tipo === "conteudo"));
      }

      if (user) {
        const { data: prog } = await (supabase
          .from("mentoria_progresso" as any)
          .select("card_id, concluido")
          .eq("user_id", user.id) as any);
        if (prog) {
          const map: Record<string, boolean> = {};
          prog.forEach((p: any) => { if (p.concluido) map[p.card_id] = true; });
          setProgresso(map);
        }
      }
    };
    init();
  }, []);

  const markComplete = useCallback(async (cardId: string) => {
    if (!userId || progresso[cardId]) return;
    const { error } = await (supabase
      .from("mentoria_progresso" as any)
      .upsert({
        user_id: userId,
        card_id: cardId,
        concluido: true,
        concluido_em: new Date().toISOString(),
      }, { onConflict: "user_id,card_id" }) as any);
    if (!error) {
      setProgresso(prev => ({ ...prev, [cardId]: true }));
      toast.success("Conteúdo concluído! ✅");
    }
  }, [userId, progresso]);

  const handleVideoEnded = useCallback(() => {
    if (selectedCard) markComplete(selectedCard.id);
  }, [selectedCard, markComplete]);

  const openCard = (card: MentoriaCard) => {
    setSelectedCard(card);
  };

  // Video detail view
  if (selectedCard) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedCard(null)} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Mentoria
        </Button>

        {/* Video Player */}
        <div className="w-full rounded-xl overflow-hidden bg-black shadow-2xl">
          {selectedCard.video_url ? (
            <video
              ref={videoRef}
              src={selectedCard.video_url}
              controls
              autoPlay
              onEnded={handleVideoEnded}
              className="w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
              <p>Nenhum vídeo disponível para este conteúdo.</p>
            </div>
          )}
        </div>

        {/* Title + Completed badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl font-bold text-foreground">{selectedCard.titulo}</h1>
            {progresso[selectedCard.id] && (
              <Badge className="bg-emerald-600 text-white gap-1">
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </Badge>
            )}
          </div>
          {!progresso[selectedCard.id] && (
            <Button onClick={() => markComplete(selectedCard.id)} variant="outline" className="gap-2 shrink-0">
              <CheckCircle2 className="h-4 w-4" /> Marcar como concluído
            </Button>
          )}
        </div>

        {/* Description */}
        {selectedCard.descricao && (
          <div className="bg-muted/50 rounded-lg p-5 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">Descrição</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedCard.descricao}</p>
          </div>
        )}

        {/* Materials */}
        {selectedCard.materiais && (
          <div className="bg-muted/50 rounded-lg p-5 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Materiais Utilizados
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedCard.materiais}</p>
          </div>
        )}
      </div>
    );
  }

  // Card grid view
  return (
    <div className="space-y-8">
      <SlideCarousel pagina="mentoria" />

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" /> Mentoria
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conteúdos exclusivos para elevar sua operação de transporte executivo.
        </p>
      </div>

      {/* Sobre o Sistema */}
      {sobreCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Sobre o Sistema
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sobreCards.map((card) => (
              <button key={card.id} onClick={() => openCard(card)} className="group block text-left w-full">
                <Card className="overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 relative">
                  {progresso[card.id] && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1 px-1.5 py-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                  <div className="relative" style={{ aspectRatio: "1080/760" }}>
                    <img src={card.imagem_url} alt={card.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs sm:text-sm font-bold leading-tight line-clamp-2">{card.titulo}</p>
                      {card.descricao && <p className="text-white/70 text-[10px] sm:text-xs mt-1 line-clamp-1">{card.descricao}</p>}
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Conteúdos */}
      {conteudoCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Conteúdos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {conteudoCards.map((card) => (
              <button key={card.id} onClick={() => openCard(card)} className="group block text-left w-full">
                <Card className="overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 relative">
                  {progresso[card.id] && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1 px-1.5 py-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                  <div className="relative" style={{ aspectRatio: "1080/1920" }}>
                    <img src={card.imagem_url} alt={card.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs sm:text-sm font-bold leading-tight line-clamp-2">{card.titulo}</p>
                      {card.descricao && <p className="text-white/70 text-[10px] sm:text-xs mt-1 line-clamp-2">{card.descricao}</p>}
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}

      {sobreCards.length === 0 && conteudoCards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum conteúdo disponível</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Os conteúdos de mentoria serão adicionados pelo administrador em breve.</p>
        </div>
      )}
    </div>
  );
}
