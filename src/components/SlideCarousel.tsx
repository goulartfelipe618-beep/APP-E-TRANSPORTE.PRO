import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface SlideCarouselSlide {
  id: string;
  titulo: string;
  subtitulo: string;
  imagem_url: string;
  mostrar_texto: boolean;
  link_url: string | null;
}

interface SlideCarouselProps {
  pagina: string;
  fallbackSlides?: {
    titulo: string;
    subtitulo: string;
    imagem_url?: string;
    mostrar_texto?: boolean;
    link_url?: string;
  }[];
  /** Banner largo (proporção 1922×330) para topo da Comunidade. */
  variant?: "default" | "banner";
  /** Quando definido, não busca no Supabase (útil para testes). */
  slidesOverride?: SlideCarouselSlide[];
  /** Sem cantos arredondados nem sombra no bloco do carrossel (padrão: true no painel). */
  fullBleed?: boolean;
  /**
   * Compensa o `p-6` do `<main>` do painel para o slide ir da borda esquerda da área de conteúdo até a direita.
   * Desative no Admin Master (ex.: Comunidade com `main` em `px-0`).
   */
  breakoutHorizontal?: boolean;
  className?: string;
}

export default function SlideCarousel({
  pagina,
  fallbackSlides,
  variant = "default",
  slidesOverride,
  fullBleed = true,
  breakoutHorizontal = true,
  className,
}: SlideCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<SlideCarouselSlide[]>([]);
  const [loading, setLoading] = useState(slidesOverride === undefined);

  useEffect(() => {
    if (slidesOverride !== undefined) {
      setSlides(slidesOverride);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchSlides = async () => {
      const { data } = await supabase
        .from("slides")
        .select("id, titulo, subtitulo, imagem_url, mostrar_texto, link_url")
        .eq("pagina", pagina)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (cancelled) return;
      if (data && data.length > 0) {
        setSlides(data as SlideCarouselSlide[]);
      } else {
        setSlides([]);
      }
      setLoading(false);
    };
    void fetchSlides();
    return () => {
      cancelled = true;
    };
  }, [pagina, slidesOverride]);

  const displaySlides = useMemo(() => {
    if (slides.length > 0) return slides;
    return (fallbackSlides || []).map((s, i) => ({
      id: `fallback-${i}`,
      titulo: s.titulo,
      subtitulo: s.subtitulo,
      imagem_url: s.imagem_url || "",
      mostrar_texto: s.mostrar_texto ?? false,
      link_url: s.link_url ?? null,
    }));
  }, [slides, fallbackSlides]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((c) => (c < displaySlides.length - 1 ? c + 1 : 0));
  }, [displaySlides.length]);

  const prevSlide = () => setCurrentSlide((c) => (c > 0 ? c - 1 : displaySlides.length - 1));

  useEffect(() => {
    setCurrentSlide(0);
  }, [displaySlides.length, pagina]);

  useEffect(() => {
    if (displaySlides.length <= 1) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide, displaySlides.length]);

  if (loading || displaySlides.length === 0) return null;

  const currentSlideData = displaySlides[currentSlide];
  const showText =
    variant !== "banner" &&
    currentSlideData?.mostrar_texto &&
    (currentSlideData.titulo || currentSlideData.subtitulo);
  const linkUrl = currentSlideData?.link_url;
  const isBanner = variant === "banner";

  const renderSlide = (slide: (typeof displaySlides)[0], index: number) => {
    const isActive = index === currentSlide;
    const hasImage = !!slide?.imagem_url;

    const imageEl = hasImage ? (
      <img
        src={slide.imagem_url}
        alt={slide.titulo || "Slide"}
        className={
          isBanner
            ? "h-full w-full object-cover object-center"
            : "h-auto w-full max-w-full block"
        }
      />
    ) : (
      <div
        className={cn(
          "bg-gradient-to-r from-primary/80 to-primary",
          isBanner ? "h-full min-h-[8rem] w-full" : "h-72 w-full",
        )}
      />
    );

    const inner = linkUrl && isActive ? (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={cn("block", isBanner && "h-full w-full")}>
        {imageEl}
      </a>
    ) : (
      imageEl
    );

    return (
      <div
        key={slide.id || index}
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none" }}
      >
        {inner}
      </div>
    );
  };

  return (
    <div
      className={cn(
        breakoutHorizontal && "-mx-6",
        "relative w-full max-w-none overflow-hidden",
        isBanner
          ? cn(
              "aspect-[1922/330]",
              fullBleed
                ? "rounded-none border-0 bg-muted/30 shadow-none"
                : "rounded-none rounded-b-xl border-b border-border bg-muted/30",
            )
          : fullBleed
            ? "rounded-none border-0 shadow-none"
            : "rounded-xl",
        className,
      )}
    >
      <div className={cn("relative", isBanner ? "absolute inset-0 h-full w-full" : "")}>
        {!isBanner && (
          <>
            {displaySlides[0]?.imagem_url ? (
              <img src={displaySlides[0].imagem_url} alt="" className="block h-auto w-full invisible" />
            ) : (
              <div className="invisible h-72" />
            )}
          </>
        )}
        {displaySlides.map((s, i) => renderSlide(s, i))}
      </div>

      {showText && (
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/70 to-transparent px-12 transition-opacity duration-700">
          <div className="max-w-lg">
            {currentSlideData.titulo && (
              <h2 className="mb-2 text-3xl font-bold text-white">{currentSlideData.titulo}</h2>
            )}
            {currentSlideData.subtitulo && <p className="text-white/80">{currentSlideData.subtitulo}</p>}
          </div>
        </div>
      )}

      {displaySlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {displaySlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                  i === currentSlide ? "scale-110 bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
