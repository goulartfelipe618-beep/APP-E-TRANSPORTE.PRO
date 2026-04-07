import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fetchHeaders: Record<string, string> = {
  Accept: "application/rdap+json, application/json",
  "User-Agent": "E-TransportePro-CheckDomain/1.0 (Supabase Edge)",
};

/**
 * RDAP por TLD. Para .br o serviço oficial do NIC.br é:
 * GET https://rdap.registro.br/domain/{fqdn} (sem /v1 — /v1/domain responde 501).
 * @see https://github.com/registrobr/rdap
 */
const rdapServers: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1",
  net: "https://rdap.verisign.com/net/v1",
  org: "https://rdap.org/org/v1",
  "com.br": "https://rdap.registro.br",
  br: "https://rdap.registro.br",
  io: "https://rdap.nic.io/v1",
  dev: "https://rdap.nic.google/v1",
  app: "https://rdap.nic.google/v1",
};

function isNicBrRdap(base: string): boolean {
  return base.includes("rdap.registro.br");
}

function getTLD(domain: string): string {
  const parts = domain.split(".");
  if (parts.length >= 3) {
    const compound = parts.slice(-2).join(".");
    if (rdapServers[compound]) return compound;
  }
  return parts[parts.length - 1];
}

/** Sempre HTTP 200: o cliente Supabase trata 4xx/5xx como erro genérico ("non-2xx"). */
function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Google DNS JSON: Status 3 = NXDOMAIN (sem registro DNS para o nome). */
async function dnsLooksUnregistered(domain: string): Promise<boolean | null> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`;
    const dnsResp = await fetch(url, { headers: { Accept: "application/dns-json" } });
    if (!dnsResp.ok) return null;
    const dnsData = await dnsResp.json();
    if (typeof dnsData.Status !== "number") return null;
    return dnsData.Status === 3;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return ok({
        available: null,
        message: "Requisição inválida. Tente novamente.",
      });
    }

    const domain = typeof raw === "object" && raw !== null && "domain" in raw
      ? (raw as { domain?: unknown }).domain
      : undefined;

    if (!domain || typeof domain !== "string") {
      return ok({
        available: null,
        message: "Domínio não informado.",
      });
    }

    const cleanDomain = domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/.*$/, "")
      .trim();

    if (!cleanDomain.includes(".")) {
      return ok({
        available: null,
        message: "Domínio inválido. Informe o nome completo (ex.: empresa.com.br).",
      });
    }

    const tld = getTLD(cleanDomain);
    const rdapBase = rdapServers[tld];

    if (!rdapBase) {
      const dns = await dnsLooksUnregistered(cleanDomain);
      if (dns === null) {
        return ok({
          domain: cleanDomain,
          available: null,
          method: "dns",
          message: "Não foi possível verificar este TLD automaticamente. Confira no registrador.",
        });
      }
      return ok({
        domain: cleanDomain,
        available: dns,
        method: "dns",
        message: dns
          ? "Domínio aparenta estar disponível (consulta DNS)."
          : "Domínio já possui registros DNS — provavelmente está registrado.",
      });
    }

    const rdapUrl = `${rdapBase}/domain/${encodeURIComponent(cleanDomain)}`;
    let rdapResp: Response;
    try {
      rdapResp = await fetch(rdapUrl, { headers: fetchHeaders });
    } catch (e) {
      console.error("RDAP fetch failed:", e);
      const dns = await dnsLooksUnregistered(cleanDomain);
      if (dns === null) {
        return ok({
          domain: cleanDomain,
          available: null,
          method: "dns_fallback",
          message: "Serviço RDAP indisponível. Tente de novo em instantes ou confira no registro.br.",
        });
      }
      return ok({
        domain: cleanDomain,
        available: dns,
        method: "dns_fallback",
        message: dns
          ? "Não foi possível consultar o RDAP; pelo DNS o nome parece livre (confirme no registrador)."
          : "Não foi possível consultar o RDAP; o domínio responde em DNS — provavelmente já está registrado.",
      });
    }

    if (rdapResp.status === 404 || rdapResp.status === 400) {
      const via = isNicBrRdap(rdapBase)
        ? " (RDAP oficial Registro.br / NIC.br)"
        : "";
      return ok({
        domain: cleanDomain,
        available: true,
        method: "rdap",
        source: isNicBrRdap(rdapBase) ? "rdap.registro.br" : "rdap",
        message: `Domínio disponível para registro${via}.`,
      });
    }

    if (rdapResp.ok) {
      try {
        const rdapData = await rdapResp.json();
        const events = rdapData.events || [];
        const registration = events.find((e: { eventAction?: string }) => e.eventAction === "registration");
        const expiration = events.find((e: { eventAction?: string }) => e.eventAction === "expiration");

        const via = isNicBrRdap(rdapBase)
          ? " (dados públicos RDAP do Registro.br)"
          : "";

        return ok({
          domain: cleanDomain,
          available: false,
          method: "rdap",
          source: isNicBrRdap(rdapBase) ? "rdap.registro.br" : "rdap",
          message: `Este domínio já está registrado${via}.`,
          registrationDate: registration?.eventDate ?? null,
          expirationDate: expiration?.eventDate ?? null,
        });
      } catch (e) {
        console.error("RDAP JSON parse failed:", e);
        const dns = await dnsLooksUnregistered(cleanDomain);
        if (dns === null) {
          return ok({
            domain: cleanDomain,
            available: null,
            method: "dns_fallback",
            message: "Resposta do RDAP inválida. Tente novamente ou verifique no registro.br.",
          });
        }
        return ok({
          domain: cleanDomain,
          available: dns,
          method: "dns_fallback",
          message: dns
            ? "Consulta RDAP incompleta; pelo DNS o nome parece livre (confirme no registrador)."
            : "Consulta RDAP incompleta; o domínio responde em DNS — provavelmente já está registrado.",
        });
      }
    }

    const dns = await dnsLooksUnregistered(cleanDomain);
    if (dns === null) {
      return ok({
        domain: cleanDomain,
        available: null,
        method: "dns_fallback",
        message: `Consulta RDAP retornou status ${rdapResp.status}. Tente de novo ou verifique manualmente no registrador.`,
      });
    }
    return ok({
      domain: cleanDomain,
      available: dns,
      method: "dns_fallback",
      message: dns
        ? "RDAP não respondeu como esperado; pelo DNS o nome parece livre (confirme no registrador)."
        : "RDAP não respondeu como esperado; o domínio responde em DNS — provavelmente já está registrado.",
    });
  } catch (error) {
    console.error("Error checking domain:", error);
    return ok({
      available: null,
      message: "Erro ao verificar o domínio. Tente novamente em alguns instantes.",
    });
  }
});
