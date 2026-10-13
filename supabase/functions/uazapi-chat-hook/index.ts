/**
 * Receptor dos webhooks da UAZAPI.
 * Responde e descarta o corpo. Não consulta nem grava texto, imagem ou arquivo.
 */
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const segredo = new URL(req.url).searchParams.get("k")?.trim() || "";
  if (segredo.length < 32) return new Response("unauthorized", { status: 401 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
