import { PLATFORM_LOGO_URL } from "@/lib/painelBrand";

/** Tela exibida ao entrar no painel: marca E-Transporte centralizada na área de conteúdo. */
export default function PainelEntradaPage() {
  return (
    <div className="flex min-h-[min(calc(100dvh-8rem),80vh)] w-full min-w-0 items-center justify-center px-6 py-8 sm:px-10 sm:py-12">
      <img
        src={PLATFORM_LOGO_URL}
        alt="E-Transporte"
        className="mx-auto max-h-[min(60vh,22rem)] w-auto max-w-[min(92vw,28rem)] object-contain"
        draggable={false}
      />
    </div>
  );
}
