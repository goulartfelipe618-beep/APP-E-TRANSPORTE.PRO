import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";

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

export default function DetalhesMotoristaFrotaSheet({ motorista, open, onOpenChange }: Props) {
  if (!motorista) return null;

  const dw = parseDadosWebhook(motorista.dados_webhook);
  const obs = motorista.mensagem_observacoes?.trim() || motorista.mensagem?.trim() || "";

  const docLinks: { label: string; url: string }[] = [];
  for (const [k, v] of Object.entries(dw)) {
    if (isLikelyUrl(v)) {
      docLinks.push({ label: k.replace(/_/g, " "), url: v.trim() });
    }
  }

  const situacao = pickStr(dw, "situacao_frota") === "inativo" ? "inativo" : "ativo";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes do motorista</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Cadastrado</Badge>
            <Badge variant={situacao === "ativo" ? "default" : "secondary"}>{situacao === "ativo" ? "Ativo na frota" : "Inativo na frota"}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" value={motorista.nome} />
            <Field label="E-mail" value={motorista.email} />
            <Field label="Telefone" value={motorista.telefone} />
            <Field label="CPF" value={motorista.cpf} />
            <Field label="CNH" value={motorista.cnh} />
            <Field label="Cidade / UF" value={[motorista.cidade, motorista.estado].filter(Boolean).join(" — ") || null} />
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Dados complementares</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RG" value={pickStr(dw, "rg") || null} />
              <Field label="Data de nascimento" value={pickStr(dw, "data_nascimento") || null} />
              <Field label="CEP" value={pickStr(dw, "cep") || null} />
              <Field label="Categoria CNH" value={pickStr(dw, "categoria_cnh", "categoria") || null} />
              <Field label="Validade CNH" value={pickStr(dw, "validade_cnh") || null} />
              <Field label="Tipo de pagamento" value={pickStr(dw, "tipo_pagamento") || null} />
              <Field label="Chave PIX" value={pickStr(dw, "pix_chave") || null} />
              <Field label="IBGE município" value={pickStr(dw, "ibge_municipio_id") || null} />
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

          {obs ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Observações / mensagem</p>
              <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{obs}</p>
            </div>
          ) : null}

          {docLinks.length > 0 ? (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Documentos e links (dados extra)</p>
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
      </SheetContent>
    </Sheet>
  );
}
