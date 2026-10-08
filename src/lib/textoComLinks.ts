const ROTULO_RE =
  /(?<=\S)\s+(?=(?:Nome|Tipo de Ve[ií]culo|Classe|N[uú]mero de Passageiros|Telefone|N[uú]mero do Voo|N[uú]mero de Confirma[cç][aã]o|Embarque|Desembarque|Hor[aá]rio|Em):)/g;

/** Mantém Enter do formulário e separa trechos colados com | ou vários espaços. */
export function organizarTextoReserva(raw: string): string {
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s*\|\|\s*/g, "\n")
    .replace(/\s*\|\s*/g, "\n")
    .replace(/[ \t]{2,}/g, "\n")
    .replace(ROTULO_RE, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

export type TextoParte = { type: "text" | "link"; value: string };

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

export function splitTextoComLinks(text: string): TextoParte[] {
  const parts: TextoParte[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", value: text.slice(last, index) });
    const href = raw.replace(/[),.;:!?]+$/u, "");
    parts.push({ type: "link", value: href });
    const tail = raw.slice(href.length);
    if (tail) parts.push({ type: "text", value: tail });
    last = index + raw.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
