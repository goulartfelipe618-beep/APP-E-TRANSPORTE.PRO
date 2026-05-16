import { PLATFORM_LOGO_URL } from "@/lib/painelBrand";

/** Tela exibida ao entrar no painel: apenas a marca E-Transporte, centralizada à direita. */
export default function PainelEntradaPage() {
  return (
    <div className="flex min-h-[min(72vh,calc(100dvh-12rem))] w-full min-w-0">
      <div className="hidden min-w-0 flex-1 lg:block" aria-hidden />

      <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-10 sm:px-10 sm:py-14 lg:flex-[0_0_50%] lg:max-w-[50%]">
        <img
          src={PLATFORM_LOGO_URL}
          alt="E-Transporte"
          className="max-h-[min(68vh,26rem)] w-auto max-w-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
