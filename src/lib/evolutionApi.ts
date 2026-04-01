/**
 * Cliente opcional para Evolution API (WhatsApp).
 * Defina VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY no .env (ou no host).
 * Formatos variam entre versões; ajuste se o seu servidor usar outro contrato.
 */

function baseUrl(): string | undefined {
  const b = import.meta.env.VITE_EVOLUTION_API_URL as string | undefined;
  return b?.replace(/\/$/, "");
}

function apiKey(): string | undefined {
  return import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined;
}

export function evolutionEnvConfigured(): boolean {
  return Boolean(baseUrl() && apiKey());
}

/** Tenta criar a instância (ignora se já existir) e obtém o QR em base64. */
export async function fetchEvolutionQrCode(instanceName: string): Promise<{
  base64: string | null;
  error?: "missing_env" | "http" | "parse";
  detail?: string;
}> {
  const base = baseUrl();
  const key = apiKey();
  if (!base || !key) {
    return { base64: null, error: "missing_env" };
  }

  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };

  try {
    await fetch(`${base}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    const connectRes = await fetch(`${base}/instance/connect/${encodeURIComponent(instanceName)}`, {
      headers: { apikey: key },
    });

    if (!connectRes.ok) {
      const t = await connectRes.text();
      return { base64: null, error: "http", detail: t.slice(0, 200) };
    }

    const data = (await connectRes.json()) as Record<string, unknown>;
    const b64 =
      (typeof data.base64 === "string" && data.base64) ||
      (typeof (data as { qrcode?: { base64?: string } }).qrcode?.base64 === "string" &&
        (data as { qrcode: { base64: string } }).qrcode.base64) ||
      null;

    return { base64: b64 };
  } catch (e) {
    return { base64: null, error: "parse", detail: e instanceof Error ? e.message : String(e) };
  }
}
