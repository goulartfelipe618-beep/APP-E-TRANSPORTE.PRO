import { cn } from "@/lib/utils";
import { organizarTextoReserva, splitTextoComLinks } from "@/lib/textoComLinks";

export function TextoComLinks({ text, className }: { text: string; className?: string }) {
  const parts = splitTextoComLinks(organizarTextoReserva(text));
  return (
    <p className={cn("min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}
