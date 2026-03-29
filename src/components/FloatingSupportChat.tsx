import { useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkSpotlightActive } from "@/contexts/NetworkSpotlightContext";

export default function FloatingSupportChat() {
  // [CHAT-FLOATING-IMPLEMENTACAO]
  const networkSpotlight = useNetworkSpotlightActive();
  const [isOpen, setIsOpen] = useState(false);

  // [CHAT-FLOATING-IMPLEMENTACAO]
  const typebotUrl = useMemo(
    () => (import.meta.env.VITE_TYPEBOT_CHAT_URL as string | undefined)?.trim() || "",
    []
  );

  // [CHAT-FLOATING-IMPLEMENTACAO]
  const hasTypebotUrl = typebotUrl.length > 0;

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 transition-opacity",
        networkSpotlight && "pointer-events-none opacity-25",
      )}
    >
      {/* [CHAT-FLOATING-IMPLEMENTACAO] */}
      {isOpen && (
        <div className="w-[350px] max-w-[calc(100vw-2.5rem)] h-[500px] max-h-[70vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {hasTypebotUrl ? (
            <iframe
              title="Chat de atendimento"
              src={typebotUrl}
              className="h-full w-full border-0"
              allow="clipboard-write; microphone"
            />
          ) : (
            <div className="h-full w-full p-4 text-sm text-muted-foreground">
              URL do Typebot nao configurada. Defina <strong>VITE_TYPEBOT_CHAT_URL</strong> para habilitar o chat.
            </div>
          )}
        </div>
      )}

      {/* [CHAT-FLOATING-IMPLEMENTACAO] */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
        aria-label={isOpen ? "Fechar chat de atendimento" : "Abrir chat de atendimento"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
