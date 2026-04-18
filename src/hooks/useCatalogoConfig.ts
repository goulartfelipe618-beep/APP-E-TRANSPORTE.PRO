import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Row = Database["public"]["Tables"]["catalogos_motorista"]["Row"];

export type CatalogoTema = "dark" | "graphite" | "noir" | "midnight";

export interface CatalogoServicoDestaque {
  titulo: string;
  descricao: string;
  icone?: string;
}

export interface CatalogoComodidade {
  titulo: string;
  descricao?: string;
}

export interface CatalogoConfig {
  id: string | null;
  slogan: string;
  subtitulo: string;
  sobre_nos: string;
  instagram_handle: string | null;
  site_url: string | null;
  whatsapp_e164: string | null;
  cidades_atendidas: string[];
  servicos_destaque: CatalogoServicoDestaque[];
  comodidades: CatalogoComodidade[];
  tema: CatalogoTema;
  cor_acento: string;
  banner_capa_url: string | null;
  banner_contracapa_url: string | null;
  ultimo_pdf_gerado_em: string | null;
}

export const DEFAULT_CATALOGO: CatalogoConfig = {
  id: null,
  slogan: "TRANSPORTE PREMIUM",
  subtitulo:
    "Cada viagem é pensada para que você se sinta no controle com conforto, segurança e elegância do início ao fim.",
  sobre_nos:
    "Contamos com motoristas experientes e uma frota impecável para atender desde compromissos de trabalho até ocasiões especiais. Onde você estiver, estamos prontos para te levar com exclusividade e tranquilidade.",
  instagram_handle: null,
  site_url: null,
  whatsapp_e164: null,
  cidades_atendidas: [],
  servicos_destaque: [
    {
      titulo: "Transporte Executivo",
      descricao:
        "Ideal para compromissos corporativos, reuniões e eventos de alto nível. Discrição, conforto e veículos de luxo com motoristas uniformizados.",
    },
    {
      titulo: "Transfer Aeroporto",
      descricao:
        "Conexões pontuais de/para aeroportos com monitoramento de voo, acolhimento personalizado e assistência com bagagem.",
    },
    {
      titulo: "Passeios & Turismo",
      descricao:
        "Roteiros personalizados com conforto absoluto. Motoristas locais experientes para transformar cada percurso numa experiência inesquecível.",
    },
    {
      titulo: "Eventos & Casamentos",
      descricao:
        "Transporte de classe para eventos únicos. Organizamos chegadas, partidas e deslocamentos de convidados com elegância.",
    },
  ],
  comodidades: [
    { titulo: "Bancos de couro" },
    { titulo: "Água mineral & bebidas" },
    { titulo: "Carregadores & dispositivos" },
    { titulo: "Higienização rigorosa" },
    { titulo: "Wi-Fi a bordo" },
    { titulo: "Snacks & cereais" },
  ],
  tema: "dark",
  cor_acento: "#FF6600",
  banner_capa_url: null,
  banner_contracapa_url: null,
  ultimo_pdf_gerado_em: null,
};

function rowToConfig(row: Row): CatalogoConfig {
  return {
    id: row.id,
    slogan: row.slogan ?? DEFAULT_CATALOGO.slogan,
    subtitulo: row.subtitulo ?? DEFAULT_CATALOGO.subtitulo,
    sobre_nos: row.sobre_nos ?? DEFAULT_CATALOGO.sobre_nos,
    instagram_handle: row.instagram_handle,
    site_url: row.site_url,
    whatsapp_e164: row.whatsapp_e164,
    cidades_atendidas: Array.isArray(row.cidades_atendidas)
      ? (row.cidades_atendidas as string[])
      : [],
    servicos_destaque: Array.isArray(row.servicos_destaque)
      ? (row.servicos_destaque as CatalogoServicoDestaque[])
      : DEFAULT_CATALOGO.servicos_destaque,
    comodidades: Array.isArray(row.comodidades)
      ? (row.comodidades as CatalogoComodidade[])
      : DEFAULT_CATALOGO.comodidades,
    tema: (row.tema as CatalogoTema) ?? "dark",
    cor_acento: row.cor_acento ?? DEFAULT_CATALOGO.cor_acento,
    banner_capa_url: row.banner_capa_url,
    banner_contracapa_url: row.banner_contracapa_url,
    ultimo_pdf_gerado_em: row.ultimo_pdf_gerado_em,
  };
}

export function useCatalogoConfig() {
  const [config, setConfig] = useState<CatalogoConfig>(DEFAULT_CATALOGO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setConfig(DEFAULT_CATALOGO);
        return;
      }
      const { data, error } = await supabase
        .from("catalogos_motorista")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      if (data) setConfig(rowToConfig(data));
      else setConfig(DEFAULT_CATALOGO);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<CatalogoConfig>): Promise<CatalogoConfig | null> => {
      setSaving(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Sem sessão activa");

        const merged = { ...config, ...patch };
        const payload = {
          user_id: uid,
          slogan: merged.slogan,
          subtitulo: merged.subtitulo,
          sobre_nos: merged.sobre_nos,
          instagram_handle: merged.instagram_handle,
          site_url: merged.site_url,
          whatsapp_e164: merged.whatsapp_e164,
          cidades_atendidas: merged.cidades_atendidas,
          servicos_destaque: merged.servicos_destaque,
          comodidades: merged.comodidades,
          tema: merged.tema,
          cor_acento: merged.cor_acento,
          banner_capa_url: merged.banner_capa_url,
          banner_contracapa_url: merged.banner_contracapa_url,
        };

        const { data, error } = await supabase
          .from("catalogos_motorista")
          .upsert(payload, { onConflict: "user_id" })
          .select("*")
          .single();
        if (error) throw error;
        const next = rowToConfig(data);
        setConfig(next);
        return next;
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  const marcarGeracao = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase
      .from("catalogos_motorista")
      .update({ ultimo_pdf_gerado_em: new Date().toISOString() })
      .eq("user_id", uid);
    setConfig((prev) => ({ ...prev, ultimo_pdf_gerado_em: new Date().toISOString() }));
  }, []);

  return { config, setConfig, loading, saving, load, save, marcarGeracao };
}
