import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SlideData {
  id: string;
  titulo: string;
  subtitulo: string;
  imagem_url: string;
  mostrar_texto: boolean;
}

interface SlideCarouselProps {
  pagina: string;
  fallbackSlides?: { titulo: string; subtitulo: string; imagem_url?: string; mostrar_texto?: boolean }[];
}

export default function SlideCarousel({ pagina, fallbackSlides }: SlideCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlides = async () => {
      const { data } = await supabase
        .from("slides")
        .select("id, titulo, subtitulo, imagem_url, mostrar_texto")
        .eq("pagina", pagina)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (data && data.length > 0) {
        setSlides(data as SlideData[]);
      }
      setLoading(false);
    };
    fetchSlides();
  }, [pagina]);

  const displaySlides = slides.length > 0
    ? slides
    : (fallbackSlides || []).map((s, i) => ({ id: `fallback-${i}`, ...s }));

  if (loading || displaySlides.length === 0) return null;

  const prevSlide = () => setCurrentSlide((c) => (c > 0 ? c - 1 : displaySlides.length - 1));
  const nextSlide = () => setCurrentSlide((c) => (c < displaySlides.length - 1 ? c + 1 : 0));
  const currentSlideData = displaySlides[currentSlide];
  const hasImage = !!currentSlideData?.imagem_url;
  const showText = currentSlideData?.mostrar_texto && (currentSlideData.titulo || currentSlideData.subtitulo);

  return (
    <div className="relative rounded-xl overflow-hidden w-full">
      {hasImage ? (
        /* Imagem no tamanho original — sem corte, sem altura fixa */
        <img
          src={displaySlides[currentSlide].imagem_url}
          alt={displaySlides[currentSlide].titulo || "Slide"}
          className="w-full h-auto block"
        />
      ) : (
        <div className="h-72 bg-gradient-to-r from-primary/80 to-primary" />
      )}

      {/* Overlay com texto — só aparece se mostrar_texto estiver ativo */}
      {showText && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-12">
          <div className="max-w-lg">
            {currentSlideData.titulo && (
              <h2 className="text-3xl font-bold text-white mb-2">{currentSlideData.titulo}</h2>
            )}
            {currentSlideData.subtitulo && (
              <p className="text-white/80">{currentSlideData.subtitulo}</p>
            )}
          </div>
        </div>
      )}

      {/* Navegação */}
      {displaySlides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white hover:bg-black/70"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {displaySlides.map((_, i) => (
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
  );
}
