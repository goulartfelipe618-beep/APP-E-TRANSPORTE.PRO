import { Fragment, type ReactNode } from "react";

/**
 * Interpreta `**trecho**` no texto do aviso como negrito (resto permanece normal).
 * Quebras de linha são preservadas pelo `whitespace-pre-wrap` no elemento pai.
 */
export function renderAvisoTextoComMarcacao(text: string): ReactNode[] {
  const parts = text.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
