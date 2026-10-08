import { cn } from "@/lib/utils";
import { organizarTextoReserva, separarRotulo, splitTextoComLinks } from "@/lib/textoComLinks";

function TextoComRotulos({ value }: { value: string }) {
  const lines = value.split("\n");
  return (
    <>
      {lines.map((line, index) => {
        const separado = separarRotulo(line);
        return (
          <span key={index}>
            {separado ? (
              <>
                <strong className="font-bold">{separado.rotulo}</strong>
                {separado.valor ? ` ${separado.valor}` : ""}
              </>
            ) : (
              line
            )}
            {index < lines.length - 1 ? "\n" : null}
          </span>
        );
      })}
    </>
  );
}

export function TextoComLinks({ text, className }: { text: string; className?: string }) {
  const parts = splitTextoComLinks(organizarTextoReserva(text));
  return (
    <p className={cn("min-w-0 max-w-full whitespace-pre-wrap break-words font-normal [overflow-wrap:anywhere]", className)}>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-normal text-primary underline underline-offset-2"
          >
            {part.value}
          </a>
        ) : (
          <TextoComRotulos key={index} value={part.value} />
        ),
      )}
    </p>
  );
}
