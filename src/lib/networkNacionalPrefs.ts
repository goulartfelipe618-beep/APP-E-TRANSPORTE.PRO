import { supabase } from "@/integrations/supabase/client";

const LS_ACEITO = "network_nacional_aceito";
const LS_SAIDA = "network_saida_data";
const LS_HIGHLIGHT = "network_highlight_shown";

async function upsertNetworkFields(fields: Record<string, unknown>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: existing } = await supabase
    .from("configuracoes")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const payload = { ...fields, updated_at: new Date().toISOString() };

  if (existing) {
    const { error } = await supabase.from("configuracoes").update(payload).eq("user_id", user.id);
    return !error;
  }

  const { error } = await supabase.from("configuracoes").insert({
    user_id: user.id,
    nome_projeto: "E-Transporte.pro",
    ...payload,
  });
  return !error;
}

function applyRowToLocalStorage(row: {
  network_nacional_aceito: string | null;
  network_saida_data: string | null;
  network_highlight_shown: boolean | null;
}) {
  if (row.network_nacional_aceito === "sim" || row.network_nacional_aceito === "nao") {
    localStorage.setItem(LS_ACEITO, row.network_nacional_aceito);
  }
  if (row.network_saida_data) {
    localStorage.setItem(LS_SAIDA, row.network_saida_data);
  } else {
    localStorage.removeItem(LS_SAIDA);
  }
  if (row.network_highlight_shown) {
    localStorage.setItem(LS_HIGHLIGHT, "sim");
  } else {
    localStorage.removeItem(LS_HIGHLIGHT);
  }
}

/** Lê o Supabase e atualiza localStorage. DB tem prioridade; se ainda não há resposta no DB, envia o que está no dispositivo. */
export async function hydrateNetworkNacionalFromDb(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("configuracoes")
    .select("network_nacional_aceito, network_saida_data, network_highlight_shown")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return;

  const row = data as {
    network_nacional_aceito: string | null;
    network_saida_data: string | null;
    network_highlight_shown: boolean | null;
  };

  if (row.network_nacional_aceito === "sim" || row.network_nacional_aceito === "nao") {
    applyRowToLocalStorage(row);
    return;
  }

  const lsAceito = localStorage.getItem(LS_ACEITO);
  const lsSaida = localStorage.getItem(LS_SAIDA);
  const lsHighlight = localStorage.getItem(LS_HIGHLIGHT);

  if (lsAceito === "sim" || lsAceito === "nao") {
    await upsertNetworkFields({
      network_nacional_aceito: lsAceito,
      network_saida_data: lsSaida || null,
      network_highlight_shown: lsHighlight === "sim",
    });
    return;
  }

  if (row.network_highlight_shown) {
    localStorage.setItem(LS_HIGHLIGHT, "sim");
  }
}

export async function persistNetworkAceitoSim(): Promise<boolean> {
  return upsertNetworkFields({
    network_nacional_aceito: "sim",
    network_saida_data: null,
    network_highlight_shown: false,
  });
}

export async function persistNetworkAceitoNao(): Promise<boolean> {
  return upsertNetworkFields({
    network_nacional_aceito: "nao",
    network_saida_data: null,
  });
}

export async function persistNetworkHighlightDismissed(): Promise<boolean> {
  return upsertNetworkFields({ network_highlight_shown: true });
}

export async function persistNetworkSair(): Promise<boolean> {
  return upsertNetworkFields({
    network_nacional_aceito: "nao",
    network_saida_data: new Date().toISOString(),
    network_highlight_shown: false,
  });
}

export async function persistNetworkRetornoSolicitado(): Promise<boolean> {
  return upsertNetworkFields({
    network_nacional_aceito: null,
    network_saida_data: null,
    network_highlight_shown: false,
  });
}
