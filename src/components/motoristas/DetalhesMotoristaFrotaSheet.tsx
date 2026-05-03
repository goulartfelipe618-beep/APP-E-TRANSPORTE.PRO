import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileDown, User, CreditCard, FileText, MapPin, Calendar } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import { supabase } from "@/integrations/supabase/client";
import { signMotoristaFrotaDocUrls, hasMotoristaDocAttachment, DOC_PATH_KEYS } from "@/lib/motoristaFrotaStorage";
import type { MotoristaFrotaDocSignedUrls } from "@/lib/motoristaFrotaStorage";
import { downloadMotoristaDossierPdf } from "@/lib/motoristaDossierPdf";
import { toast } from "sonner";

export interface MotoristaFrotaDetalheRow {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  cnh: string | null;
  mensagem: string | null;
  mensagem_observacoes: string | null;
  dados_webhook: Json | null;
  status: string;
  created_at: string;
  portal_token: string;
  portal_auth_user_id: string | null;
  motorista_verificacao_qr_token: string | null;
}

interface Props {
  motorista: MotoristaFrotaDetalheRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode | string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );
}

function isLikelyUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

function fmtCpfDisplay(raw: string | null | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 11) return raw || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function reportIdLabel(createdAt: string, rowId: string): string {
  let y = "2026";
  try {
    y = String(new Date(createdAt).getFullYear());
  } catch {
    /* noop */
  }
  const tail = rowId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `MTR-${y}-${tail}`;
}

const PATH_VALUE_SET = new Set<string>(Object.values(DOC_PATH_KEYS));

export default function DetalhesMotoristaFrotaSheet({ motorista, open, onOpenChange }: Props) {
  const [docUrls, setDocUrls] = useState<MotoristaFrotaDocSignedUrls>({});

  useEffect(() => {
    if (!open || !motorista) {
      setDocUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const u = await signMotoristaFrotaDocUrls(supabase, motorista.dados_webhook, 3600);
        if (!cancelled) setDocUrls(u);
      } catch {
        if (!cancelled) setDocUrls({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, motorista]);

  if (!motorista) return null;

  const dw = parseDadosWebhook(motorista.dados_webhook);
  const obs = motorista.mensagem_observacoes?.trim() || motorista.mensagem?.trim() || "";

  const docLinks: { label: string; url: string }[] = [];
  for (const [k, v] of Object.entries(dw)) {
    if (k.endsWith("_path") || PATH_VALUE_SET.has(k)) continue;
    if (isLikelyUrl(v)) {
      docLinks.push({ label: k.replace(/_/g, " "), url: v.trim() });
    }
  }

  const situacao = pickStr(dw, "situacao_frota") === "inativo" ? "inativo" : "ativo";
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const docPreview = (
    slug: keyof MotoristaFrotaDocSignedUrls,
    title: string,
  ): { title: string; url?: string; ok: boolean } => ({
    title,
    url: docUrls[slug],
    ok: hasMotoristaDocAttachment(motorista.dados_webhook, slug),
  });

  const previews = [
    docPreview("perfil", "Foto de perfil"),
    docPreview("cnhFrente", "CNH — frente"),
    docPreview("cnhVerso", "CNH — verso"),
    docPreview("residencia", "Comprovante de residência"),
  ];

  const handleExportPdf = () => {
    void toast.promise(
      (async () => {
        const urls = await signMotoristaFrotaDocUrls(supabase, motorista.dados_webhook, 7200);
        await downloadMotoristaDossierPdf({
          id: motorista.id,
          nome: motorista.nome,
          cpf: motorista.cpf,
          telefone: motorista.telefone,
          email: motorista.email,
          cidade: motorista.cidade,
          estado: motorista.estado,
          cnh: motorista.cnh,
          created_at: motorista.created_at,
          dados_webhook: motorista.dados_webhook,
          docUrls: urls,
          verificacao_qr_token: motorista.motorista_verificacao_qr_token,
          app_public_origin: typeof window !== "undefined" ? window.location.origin : "",
        });
      })(),
      { loading: "A gerar o PDF…", success: "Ficha exportada com sucesso.", error: "Não foi possível gerar o PDF." },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden border-l border-border p-0 sm:max-w-xl">
        <div className="border-b border-border bg-card px-6 pb-4 pt-6">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SheetTitle className="text-lg text-[#1a2744] dark:text-foreground">Dossiê do motorista</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">Relatório com dados cadastrais e documentos da sua frota.</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 bg-[#c9a227] text-[#1a2744] hover:bg-[#b89220]"
                onClick={handleExportPdf}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Exportar ficha completa
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#faf3dd] px-2 py-1 text-[#1a2744] dark:bg-amber-950/40 dark:text-amber-100">
                <Calendar className="h-3.5 w-3.5 text-[#c9a227]" />
                Documento visualizado em {hoje}
              </span>
              <span>ID: #{reportIdLabel(motorista.created_at, motorista.id)}</span>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex gap-4 border-b border-border pb-6">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-[#c9a227]/40 bg-muted">
              {docUrls.perfil ? (
                <img src={docUrls.perfil} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <User className="h-10 w-10 opacity-40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-xl font-bold leading-tight text-[#1a2744] dark:text-foreground">{motorista.nome}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Cadastrado</Badge>
                <Badge
                  className={
                    situacao === "ativo"
                      ? "border-emerald-600/30 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "text-muted-foreground"
                  }
                  variant="outline"
                >
                  {situacao === "ativo" ? "Ativo na frota" : "Inativo na frota"}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2 text-foreground">
                  <CreditCard className="h-3.5 w-3.5 shrink-0 text-[#c9a227]" />
                  <span className="text-muted-foreground">CPF:</span> {fmtCpfDisplay(motorista.cpf)}
                </p>
                <p className="flex items-center gap-2 text-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#c9a227]" />
                  <span className="text-muted-foreground">Telefone:</span> {motorista.telefone || "—"}
                </p>
                <p className="flex items-center gap-2 text-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#c9a227]" />
                  <span className="text-muted-foreground">E-mail:</span>{" "}
                  <span className="truncate">{motorista.email || "—"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1a2744] dark:text-foreground">
                <MapPin className="h-3.5 w-3.5 text-[#c9a227]" />
                Informações principais
              </p>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3 sm:grid-cols-3">
                <Field label="Cidade / UF" value={[motorista.cidade, motorista.estado].filter(Boolean).join(" / ") || null} />
                <Field label="CNH" value={motorista.cnh} />
                <Field label="Categoria" value={pickStr(dw, "categoria_cnh", "categoria") || null} />
                <Field label="Validade CNH" value={pickStr(dw, "validade_cnh") || null} />
                <Field label="IBGE município" value={pickStr(dw, "ibge_municipio_id") || null} />
                <Field label="Tipo de pagamento" value={pickStr(dw, "tipo_pagamento") || null} />
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Dados complementares</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="RG" value={pickStr(dw, "rg") || null} />
                <Field label="Data de nascimento" value={pickStr(dw, "data_nascimento") || null} />
                <Field label="CEP" value={pickStr(dw, "cep") || null} />
                <Field label="Chave PIX" value={pickStr(dw, "pix_chave") || null} />
              </div>
              <Field
                label="Endereço"
                value={
                  pickStr(dw, "endereco") ||
                  [pickStr(dw, "logradouro"), pickStr(dw, "numero"), pickStr(dw, "bairro")].filter(Boolean).join(", ") ||
                  null
                }
              />
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-semibold text-foreground uppercase tracking-wide">Documentos anexados</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {previews.map((p) => (
                  <div key={p.title} className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">{p.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          p.ok
                            ? "border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                            : ""
                        }
                      >
                        {p.ok ? "Anexada" : "Pendente"}
                      </Badge>
                    </div>
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block overflow-hidden rounded-md border border-border bg-background"
                      >
                        <img src={p.url} alt="" className="max-h-36 w-full object-contain transition-opacity group-hover:opacity-90" />
                      </a>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                        {p.ok ? "Pré-visualização indisponível" : "Sem ficheiro"}
                      </div>
                    )}
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#FF6600] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir ficheiro
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {obs ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Observações / mensagem</p>
                <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{obs}</p>
              </div>
            ) : null}

            {docLinks.length > 0 ? (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold text-foreground">Outros links (dados extra)</p>
                <ul className="space-y-2">
                  {docLinks.map(({ label, url }) => (
                    <li key={label + url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-[#FF6600] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="capitalize">{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="rounded-lg border border-border p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">JSON completo (dados extra)</summary>
              <pre className="mt-2 max-h-48 overflow-auto text-muted-foreground whitespace-pre-wrap break-all">
                {Object.keys(dw).length ? JSON.stringify(dw, null, 2) : "—"}
              </pre>
            </details>

            <div className="text-xs text-muted-foreground border-t border-border pt-3">
              <p>Cadastrado em {new Date(motorista.created_at).toLocaleString("pt-BR")}</p>
              <p className="mt-1">
                Portal do motorista: {motorista.portal_auth_user_id ? "senha já definida" : "link enviado — definir senha"}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
