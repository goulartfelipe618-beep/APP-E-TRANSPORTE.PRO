import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CabRow {
  razao_social: string;
  cnpj: string;
  endereco_sede: string;
  representante_legal: string;
  telefone: string;
  whatsapp: string;
  email_oficial: string;
}

interface ContratoComoPdfPreviewProps {
  modelo: string;
  politica: string;
  clausulas: string;
  /** Mesmo rótulo usado no PDF na área de assinatura (lado cliente). */
  nomeClienteAssinatura?: string;
}

/**
 * Pré-visualização alinhada ao que `addContractPages` gera no PDF após a confirmação:
 * nova "página" lógica com cabeçalho da empresa, título "Contrato de Prestação de Serviço",
 * blocos CONTRATO / POLÍTICA / CLÁUSULAS e área de assinatura.
 */
export default function ContratoComoPdfPreview({
  modelo,
  politica,
  clausulas,
  nomeClienteAssinatura = "Nome completo do contratante (como na reserva)",
}: ContratoComoPdfPreviewProps) {
  const [cab, setCab] = useState<CabRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("cabecalho_contratual" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setCab(data as CabRow);
    })();
  }, []);

  const temAlgumTexto = Boolean(modelo?.trim() || politica?.trim() || clausulas?.trim());

  return (
    <div className="rounded-xl border-2 border-border bg-white text-neutral-900 shadow-sm overflow-hidden">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600">
        <span className="font-medium">Pré-visualização</span>
        {" — "}
        Mesma estrutura das página(s) de contrato do PDF (após a confirmação). Nº da reserva e ID são exemplos; no arquivo gerado vêm da reserva.
      </div>
      <div
        className="p-6 md:p-8 max-w-[210mm] mx-auto min-h-[200px]"
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        {cab?.razao_social ? (
          <>
            <h2 className="text-[13pt] font-bold text-neutral-900 leading-tight">{cab.razao_social}</h2>
            <div className="mt-1.5 text-[7.5pt] text-neutral-600 space-y-1">
              {(cab.cnpj || cab.endereco_sede) && (
                <p>
                  {cab.cnpj ? `CNPJ: ${cab.cnpj}` : null}
                  {cab.cnpj && cab.endereco_sede ? "   •   " : null}
                  {cab.endereco_sede || null}
                </p>
              )}
              {(cab.telefone || cab.whatsapp || cab.email_oficial) && (
                <p>
                  {[
                    cab.telefone ? `Tel: ${cab.telefone}` : null,
                    cab.whatsapp ? `WhatsApp: ${cab.whatsapp}` : null,
                    cab.email_oficial || null,
                  ]
                    .filter(Boolean)
                    .join("   •   ")}
                </p>
              )}
              {cab.representante_legal ? (
                <p>Representante Legal: {cab.representante_legal}</p>
              ) : null}
            </div>
            <div className="mt-2 border-t border-neutral-300 pt-3" />
          </>
        ) : (
          <p className="text-sm text-neutral-500 italic mb-4">
            Preencha o cabeçalho contratual em Configurações para ver a mesma identidade visual do PDF.
          </p>
        )}

        <h1 className="text-[16pt] font-bold text-neutral-900 leading-tight">Contrato de Prestação de Serviço</h1>
        <div className="mt-2 text-[9pt] text-neutral-500">
          <p>
            Reserva Nº <span className="text-neutral-700">000</span>
            <span className="mx-8" />
            ID: <span className="font-mono text-neutral-700">00000000</span>
          </p>
          <p className="mt-1">Gerado em {new Date().toLocaleString("pt-BR")}</p>
        </div>

        <div className="mt-6 space-y-6">
          {modelo?.trim() ? (
            <section>
              <h3 className="text-[10pt] font-bold text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                CONTRATO
              </h3>
              <div className="text-[8.5pt] text-neutral-800 whitespace-pre-wrap leading-[4.2mm]">{modelo}</div>
            </section>
          ) : null}

          {politica?.trim() ? (
            <section>
              <h3 className="text-[10pt] font-bold text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                POLÍTICA DE CANCELAMENTO
              </h3>
              <div className="text-[8.5pt] text-neutral-800 whitespace-pre-wrap leading-[4.2mm]">{politica}</div>
            </section>
          ) : null}

          {clausulas?.trim() ? (
            <section>
              <h3 className="text-[10pt] font-bold text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                CLÁUSULAS ADICIONAIS
              </h3>
              <div className="text-[8.5pt] text-neutral-800 whitespace-pre-wrap leading-[4.2mm]">{clausulas}</div>
            </section>
          ) : null}

          {!temAlgumTexto ? (
            <p className="text-sm text-neutral-500 italic">Nenhum texto de contrato preenchido ainda.</p>
          ) : null}
        </div>

        <div className="mt-10 pt-6 border-t border-dashed border-neutral-300">
          <div className="grid grid-cols-2 gap-8 text-[8.5pt]">
            <div>
              <div className="border-t border-neutral-900 w-[72px] mb-1" />
              <p className="font-bold text-neutral-900">Contratante</p>
              <p className="text-neutral-500 text-[7.5pt] mt-1 whitespace-pre-wrap">{nomeClienteAssinatura}</p>
            </div>
            <div className="text-right">
              <div className="border-t border-neutral-900 w-[72px] ml-auto mb-1" />
              <p className="font-bold text-neutral-900">Contratado</p>
              <p className="text-neutral-500 text-[7.5pt] mt-1">{cab?.razao_social || "Razão social (cabecalho)"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
