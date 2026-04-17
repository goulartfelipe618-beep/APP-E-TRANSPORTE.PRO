import { useEffect } from "react";
import LiveTrackingMap from "./LiveTrackingMap";
import BotaoEncerrarViagem from "./BotaoEncerrarViagem";
import { useRastreioAoVivo } from "@/hooks/useRastreioAoVivo";
import { useMotoristaGPSBroadcast } from "@/hooks/useMotoristaGPSBroadcast";
import { cn } from "@/lib/utils";

export type PainelGeolocalizadorProps = {
  rastreioId: string;
  /**
   * `motorista`: o utilizador é o dono da corrida. O hook de GPS é ativado
   * e o botão "Encerrar viagem" fica flutuante sobre o mapa no mobile.
   *
   * `central`: apenas consome — nunca escreve lat/lng. O botão Encerrar
   * também aparece no mobile, mas o hook de GPS não é activado.
   *
   * `cliente`: só visualiza — sem botão Encerrar, sem GPS.
   */
  papel: "motorista" | "central" | "cliente";
  /** Intervalo mínimo de envio GPS (5-10s, default 7s) — só usado quando papel='motorista'. */
  intervaloGpsMs?: number;
  /** Classe extra no container. */
  className?: string;
};

/**
 * Componente de alto-nível que junta LiveTrackingMap + BotaoEncerrarViagem,
 * cobre o viewport no mobile (com botão flutuante) e volta ao layout normal
 * no desktop. Troca automaticamente para o ResumoViagemCard quando a corrida
 * estiver concluída (lógica já dentro do LiveTrackingMap).
 */
export default function PainelGeolocalizador({
  rastreioId,
  papel,
  intervaloGpsMs = 7000,
  className,
}: PainelGeolocalizadorProps) {
  const { data: rastreio } = useRastreioAoVivo(rastreioId);

  const corridaConcluida = rastreio?.status === "concluida";

  useMotoristaGPSBroadcast({
    rastreioId,
    enabled: papel === "motorista" && !corridaConcluida,
    intervaloMs: intervaloGpsMs,
  });

  const mostraBotao = papel !== "cliente" && !corridaConcluida;

  // No mobile fullscreen precisamos de bloquear scroll do body para o mapa não
  // competir com o scroll da página.
  useEffect(() => {
    if (!mostraBotao || corridaConcluida) return;
    if (typeof document === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mostraBotao, corridaConcluida]);

  return (
    <LiveTrackingMap
      rastreioId={rastreioId}
      className={cn(className)}
      fullscreenOnMobile={!corridaConcluida}
      heightPx={520}
      overlay={
        mostraBotao ? (
          <BotaoEncerrarViagem
            rastreioId={rastreioId}
            origemInicial={rastreio?.origem_endereco ?? ""}
            destinoInicial={rastreio?.destino_endereco ?? ""}
            valorInicial={
              rastreio?.valor_total !== undefined && rastreio?.valor_total !== null
                ? Number(rastreio.valor_total)
                : null
            }
            className="w-full shadow-lg"
          />
        ) : null
      }
    />
  );
}
