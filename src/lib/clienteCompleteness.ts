import type { Json } from "@/integrations/supabase/types";

export type ClienteCompletenessInput = {
  nome_exibicao: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  enderecos: Json;
  documentos: Json;
};

/** 0–100: quanto o perfil do cliente está completo (para barra de progresso / reservas “novo cliente”). */
export function computeClienteProfilePercent(c: ClienteCompletenessInput): number {
  let pts = 0;
  const max = 100;

  if ((c.nome_exibicao || "").trim().length >= 2) pts += 22;
  if ((c.email || "").trim().includes("@")) pts += 18;
  if ((c.telefone_1 || "").replace(/\D/g, "").length >= 8) pts += 18;
  if ((c.telefone_2 || "").replace(/\D/g, "").length >= 8) pts += 7;
  if ((c.cpf_cnpj || "").replace(/\D/g, "").length >= 11) pts += 15;

  const end = c.enderecos;
  if (Array.isArray(end) && end.length > 0) {
    const ok = end.some((x) => {
      if (!x || typeof x !== "object") return false;
      const o = x as Record<string, unknown>;
      return String(o.rotulo || "").trim().length > 0 && String(o.endereco || "").trim().length > 5;
    });
    if (ok) pts += 12;
  }

  const docs = c.documentos;
  if (docs && typeof docs === "object" && !Array.isArray(docs) && Object.keys(docs as object).length > 0) {
    pts += 8;
  }

  return Math.min(max, Math.round(pts));
}
