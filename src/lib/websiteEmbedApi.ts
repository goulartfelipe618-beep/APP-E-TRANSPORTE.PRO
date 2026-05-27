/** API pública do widget WordPress (Edge Function `website-embed-public`). */

export interface WebsiteEmbedTemplate {
  id: string;
  nome: string;
  imagem_url: string;
  link_modelo: string;
  ordem: number;
}

function embedFunctionUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  if (!base) throw new Error("VITE_SUPABASE_URL não configurada.");
  return `${base}/functions/v1/website-embed-public`;
}

function anonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!key?.trim()) throw new Error("Chave Supabase não configurada.");
  return key;
}

export async function fetchWebsiteEmbedTemplates(): Promise<WebsiteEmbedTemplate[]> {
  const res = await fetch(embedFunctionUrl(), {
    method: "GET",
    headers: {
      apikey: anonKey(),
      Authorization: `Bearer ${anonKey()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Erro ${res.status} ao carregar templates.`);
  }
  const body = (await res.json()) as { templates?: WebsiteEmbedTemplate[] };
  return body.templates ?? [];
}

export type WebsiteEmbedSubmitPayload = {
  dados_solicitacao: Record<string, unknown>;
  logo_base64?: string | null;
  logo_mime?: string | null;
  referrer?: string | null;
};

export async function submitWebsiteEmbedBriefing(payload: WebsiteEmbedSubmitPayload): Promise<{ id: string }> {
  const res = await fetch(embedFunctionUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey(),
      Authorization: `Bearer ${anonKey()}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
  if (!res.ok) {
    throw new Error(body.error || `Erro ${res.status} ao enviar briefing.`);
  }
  if (!body.id) throw new Error("Resposta inválida do servidor.");
  return { id: body.id };
}

/** Snippet HTML para colar no widget HTML do WordPress. */
export function buildWordPressWebsiteEmbedSnippet(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  return `<!-- E-Transporte.pro — Galeria de templates + briefing (WordPress) -->
<div id="etp-website-embed"></div>
<script src="${origin}/embed/website-widget.js" defer></script>`;
}
