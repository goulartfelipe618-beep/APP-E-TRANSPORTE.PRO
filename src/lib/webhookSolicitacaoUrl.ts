/** URL pública da Edge Function para formulários externos (POST JSON). */
export function buildWebhookSolicitacaoUrl(automacaoId: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";
  if (!base) return "";
  return `${base}/functions/v1/webhook-solicitacao?automacao_id=${encodeURIComponent(automacaoId)}`;
}
