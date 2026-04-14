import DOMPurify from "isomorphic-dompurify";

/**
 * HTML de utilizador antes de dangerouslySetInnerHTML.
 * Documentação: Frontend React — XSS (DOMPurify).
 */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "br",
      "em",
      "i",
      "li",
      "ol",
      "p",
      "strong",
      "u",
      "ul",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "title"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
  });
}
