import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** User-Agent “de navegador”: alguns WAFs do NIC.br retornam 403 para bots / IPs de datacenter. */
const fetchHeaders: Record<string, string> = {
  Accept: "application/rdap+json, application/json",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/**
 * RDAP por TLD. Para .br o serviço oficial do NIC.br:
 * GET https://rdap.registro.br/domain/{fqdn}
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

/** Nível de confiança da resposta (para o painel decidir se libera “Salvar”). */
type Certainty =
  | "registry_br" // RDAP registro.br respondeu de forma interpretável
  | "registry_other" // outro RDAP (ex.: .com Verisign)
  | "dns_hint" // só DNS — não é prova de registro
  | "unknown"; // não dá para afirmar

function isNicBrRdap(base: string): boolean {
  return base.includes("rdap.registro.br");
}

function isBrFqdn(domain: string): boolean {
  return domain.toLowerCase().endsWith(".br");
}

function getTLD(domain: string): string {
  const parts = domain.split(".");
  if (parts.length >= 3) {
    const compound = parts.slice(-2).join(".");
    if (rdapServers[compound]) return compound;
  }
  return parts[parts.length - 1];
}

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Google DNS JSON: Status 3 = NXDOMAIN. Indício fraco para domínios .br (não substitui RDAP). */
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
        certainty: "unknown" satisfies Certainty,
        message: "Requisição inválida. Tente novamente.",
      });
    }

    const domain = typeof raw === "object" && raw !== null && "domain" in raw
      ? (raw as { domain?: unknown }).domain
      : undefined;

    if (!domain || typeof domain !== "string") {
      return ok({
        available: null,
        certainty: "unknown" satisfies Certainty,
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
        certainty: "unknown" satisfies Certainty,
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
          certainty: "unknown" satisfies Certainty,
          method: "dns",
          message: "Não foi possível verificar este TLD automaticamente. Pesquise no registrador responsável.",
        });
      }
      return ok({
        domain: cleanDomain,
        available: dns,
        certainty: "dns_hint" satisfies Certainty,
        method: "dns",
        message: dns
          ? "Indício por DNS apenas: não há resposta A para este nome. Isso não prova que o domínio possa ser registrado — confirme no registrador."
          : "Indício por DNS: há registro para este nome. Provavelmente já está em uso.",
      });
    }

    const rdapUrl = `${rdapBase}/domain/${encodeURIComponent(cleanDomain)}`;
    const nicBr = isNicBrRdap(rdapBase);

    let rdapResp: Response;
    try {
      rdapResp = await fetch(rdapUrl, { headers: fetchHeaders });
    } catch (e) {
      console.error("RDAP fetch failed:", e);
      if (nicBr && isBrFqdn(cleanDomain)) {
        return ok({
          domain: cleanDomain,
          available: null,
          certainty: "unknown" satisfies Certainty,
          method: "rdap_error",
          source: "rdap.registro.br",
          message:
            "Não foi possível contatar o RDAP do Registro.br. Sem essa consulta oficial, o painel não indica se o .br está livre. Tente de novo em instantes ou pesquise em registro.br.",
        });
      }
      const dns = await dnsLooksUnregistered(cleanDomain);
      if (dns === null) {
        return ok({
          domain: cleanDomain,
          available: null,
          certainty: "unknown" satisfies Certainty,
          method: "dns_fallback",
          message: "Serviço RDAP indisponível. Tente de novo em instantes ou confira no registrador.",
        });
      }
      return ok({
        domain: cleanDomain,
        available: dns,
        certainty: "dns_hint" satisfies Certainty,
        method: "dns_fallback",
        message: dns
          ? "RDAP indisponível; só há indício por DNS (não é confirmação definitiva). Verifique no registrador."
          : "RDAP indisponível; há resposta em DNS — o nome provavelmente já está em uso.",
      });
    }

    if (rdapResp.status === 404 || rdapResp.status === 400) {
      if (nicBr) {
        return ok({
          domain: cleanDomain,
          available: true,
          certainty: "registry_br" satisfies Certainty,
          method: "rdap",
          source: "rdap.registro.br",
          message:
            "No RDAP oficial do Registro.br (NIC.br), este nome não consta como domínio registrado. É a mesma base pública que o órgão disponibiliza. O registro só fica definitivo quando você concluir a contratação no site do Registro.br (regras e políticas deles valem).",
        });
      }
      return ok({
        domain: cleanDomain,
        available: true,
        certainty: "registry_other" satisfies Certainty,
        method: "rdap",
        message: "No RDAP deste TLD, o nome não foi encontrado — em geral indica que pode ser registrado. Confirme no registrador.",
      });
    }

    if (rdapResp.ok) {
      try {
        const rdapData = await rdapResp.json();
        const events = rdapData.events || [];
        const registration = events.find((e: { eventAction?: string }) => e.eventAction === "registration");
        const expiration = events.find((e: { eventAction?: string }) => e.eventAction === "expiration");

        if (nicBr) {
          return ok({
            domain: cleanDomain,
            available: false,
            certainty: "registry_br" satisfies Certainty,
            method: "rdap",
            source: "rdap.registro.br",
            message:
              "Este nome consta como domínio registrado no RDAP oficial do Registro.br (NIC.br). Não é possível registrá-lo de novo enquanto estiver ativo para o mesmo titular/registro.",
            registrationDate: registration?.eventDate ?? null,
            expirationDate: expiration?.eventDate ?? null,
          });
        }

        return ok({
          domain: cleanDomain,
          available: false,
          certainty: "registry_other" satisfies Certainty,
          method: "rdap",
          message: "Este domínio consta como registrado no RDAP deste TLD.",
          registrationDate: registration?.eventDate ?? null,
          expirationDate: expiration?.eventDate ?? null,
        });
      } catch (e) {
        console.error("RDAP JSON parse failed:", e);
        if (nicBr && isBrFqdn(cleanDomain)) {
          return ok({
            domain: cleanDomain,
            available: null,
            certainty: "unknown" satisfies Certainty,
            method: "rdap_parse_error",
            source: "rdap.registro.br",
            message:
              "O Registro.br respondeu, mas a resposta não pôde ser interpretada. Tente de novo ou consulte diretamente em registro.br — sem RDAP válido não indicamos disponibilidade.",
          });
        }
        const dns = await dnsLooksUnregistered(cleanDomain);
        if (dns === null) {
          return ok({
            domain: cleanDomain,
            available: null,
            certainty: "unknown" satisfies Certainty,
            method: "dns_fallback",
            message: "Resposta RDAP inválida. Tente novamente ou verifique no registrador.",
          });
        }
        return ok({
          domain: cleanDomain,
          available: dns,
          certainty: "dns_hint" satisfies Certainty,
          method: "dns_fallback",
          message: dns
            ? "RDAP com resposta inválida; há só indício por DNS — confirme no registrador."
            : "RDAP com resposta inválida; há DNS ativo — provavelmente já registrado.",
        });
      }
    }

    if (nicBr && isBrFqdn(cleanDomain) && rdapResp.status === 403) {
      return ok({
        domain: cleanDomain,
        available: null,
        certainty: "unknown" satisfies Certainty,
        method: "rdap_forbidden",
        source: "rdap.registro.br",
        message:
          "O Registro.br devolveu 403 para a consulta feita a partir do servidor (bloqueio comum a IPs de datacenter). O painel tenta primeiro o RDAP direto no seu navegador — atualize a página com a versão mais recente do app. Se continuar, pesquise o nome em registro.br.",
      });
    }

    if (nicBr && isBrFqdn(cleanDomain)) {
      return ok({
        domain: cleanDomain,
        available: null,
        certainty: "unknown" satisfies Certainty,
        method: "rdap_unexpected",
        source: "rdap.registro.br",
        message: `O RDAP do Registro.br retornou status ${rdapResp.status}. Não usamos DNS como substituto para .br. Tente de novo ou pesquise em registro.br.`,
      });
    }

    const dns = await dnsLooksUnregistered(cleanDomain);
    if (dns === null) {
      return ok({
        domain: cleanDomain,
        available: null,
        certainty: "unknown" satisfies Certainty,
        method: "dns_fallback",
        message: `Consulta RDAP retornou status ${rdapResp.status}. Verifique manualmente no registrador.`,
      });
    }
    return ok({
      domain: cleanDomain,
      available: dns,
      certainty: "dns_hint" satisfies Certainty,
      method: "dns_fallback",
      message: dns
        ? "RDAP não respondeu como esperado; indício por DNS apenas — confirme no registrador."
        : "RDAP não respondeu como esperado; há DNS — provavelmente já registrado.",
    });
  } catch (error) {
    console.error("Error checking domain:", error);
    return ok({
      available: null,
      certainty: "unknown" satisfies Certainty,
      message: "Erro ao verificar o domínio. Tente novamente em alguns instantes.",
    });
  }
});
