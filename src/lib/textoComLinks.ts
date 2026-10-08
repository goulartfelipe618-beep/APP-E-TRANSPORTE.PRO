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
