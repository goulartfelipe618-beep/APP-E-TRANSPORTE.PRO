import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
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
   * Compensa o padding do `<main>` (`--main-pad-x` / `--main-pad-y`, padrão 1,5rem) para o slide encostar nas bordas.
   * Desative no Admin Master (ex.: Comunidade com `main` em `px-0`).
   */
  breakoutHorizontal?: boolean;
  /**
   * Compensa o padding superior do `<main>` quando o carrossel é o primeiro bloco da página.
   * Use `false` se houver título/banner acima do carrossel (evita sobreposição).
   */
  breakoutTop?: boolean;
  className?: string;
}

export default function SlideCarousel({
  pagina,
  fallbackSlides,
  variant = "default",
  slidesOverride,
  fullBleed = true,
  breakoutHorizontal = true,
  breakoutTop = true,
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

  /** Encosta nas bordas internas do `<main>` usando `--main-pad-x` / `--main-pad-y` definidos no layout. */
  const bleedStyle: CSSProperties | undefined =
    breakoutHorizontal || breakoutTop
      ? {
          ...(breakoutHorizontal && {
            marginLeft: "calc(-1 * var(--main-pad-x, 1.5rem))",
            marginRight: "calc(-1 * var(--main-pad-x, 1.5rem))",
            width: "calc(100% + 2 * var(--main-pad-x, 1.5rem))",
            maxWidth: "none",
          }),
          ...(breakoutTop && {
            marginTop: "calc(-1 * var(--main-pad-y, 1.5rem))",
          }),
        }
      : undefined;

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
        className="h-full w-full min-h-0 object-cover object-center"
      />
    ) : (
      <div
        className={cn(
          "h-full w-full min-h-0 bg-gradient-to-r from-primary/80 to-primary",
          fullBleed && "rounded-none",
          !isBanner && "min-h-[8rem]",
        )}
      />
    );

    const inner = linkUrl && isActive ? (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full w-full min-h-0"
      >
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
      style={bleedStyle}
      className={cn(
        "relative box-border min-w-0 shrink-0 overflow-hidden p-0",
        isBanner
          ? cn(
              "aspect-[1922/330] min-h-[120px]",
              fullBleed
                ? "rounded-none border-0 bg-muted/30 shadow-none"
                : "rounded-none rounded-b-xl border-b border-border bg-muted/30",
            )
          : cn(
              "aspect-[16/5] min-h-[140px] sm:min-h-[180px]",
              fullBleed ? "rounded-none border-0 shadow-none" : "rounded-xl",
            ),
        className,
      )}
    >
      <div className="absolute inset-0 min-h-0">
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
