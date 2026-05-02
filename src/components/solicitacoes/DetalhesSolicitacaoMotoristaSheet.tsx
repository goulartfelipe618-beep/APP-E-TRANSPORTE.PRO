import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, UserCheck } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { parseDadosWebhook } from "@/lib/motoristaFromSolicitacao";

interface SolicitacaoMotorista {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  cnh: string | null;
  cidade: string | null;
  estado: string | null;
  mensagem: string | null;
  mensagem_observacoes: string | null;
  dados_webhook: Json | null;
  status: string;
  created_at: string;
}

interface Props {
  solicitacao: SolicitacaoMotorista | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverter: (s: SolicitacaoMotorista) => void;
  /** Se omitido, o botão Comunicar não é exibido (ex.: painel do próprio motorista). */
  onComunicar?: (s: SolicitacaoMotorista) => void;
}

export default function DetalhesSolicitacaoMotoristaSheet({
  solicitacao,
  open,
  onOpenChange,
  onConverter,
  onComunicar,
}: Props) {
  if (!solicitacao) return null;

  const obs = solicitacao.mensagem_observacoes?.trim() || solicitacao.mensagem?.trim() || "";
  const podeConverter = solicitacao.status !== "cadastrado";
  const dw = parseDadosWebhook(solicitacao.dados_webhook);
  const extrasRows = buildWebhookExtrasForDisplay(dw);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes do motorista</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" value={solicitacao.nome} />
            <Field label="E-mail" value={solicitacao.email} />
            <Field label="Telefone" value={solicitacao.telefone} />
            <Field label="CPF" value={solicitacao.cpf} />
            <Field label="CNH" value={solicitacao.cnh} />
            <Field label="Cidade" value={solicitacao.cidade} />
            <Field label="Estado (UF)" value={solicitacao.estado} />
            <Field label="Status" value={<Badge variant="outline">{solicitacao.status}</Badge>} />
          </div>

          {obs ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Mensagem / observações</p>
              <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{obs}</p>
            </div>
          ) : null}

          {extrasRows.length > 0 ? (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Dados complementares</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {extrasRows.map(({ key, label, value }) => (
                  <Field key={key} label={label} value={value} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">Recebida em {new Date(solicitacao.created_at).toLocaleString("pt-BR")}</div>

          <div className="flex gap-2 border-t border-border pt-4">
            {podeConverter && (
              <Button onClick={() => onConverter(solicitacao)} className="flex-1">
                <UserCheck className="mr-2 h-4 w-4" /> Converter em cadastro
              </Button>
            )}
            {onComunicar && (
              <Button variant="outline" onClick={() => onComunicar(solicitacao)} className={podeConverter ? "flex-1" : "w-full"}>
                <MessageSquare className="mr-2 h-4 w-4" /> Comunicar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode | string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );
}

/** Chaves técnicas / proveniência — não mostrar ao utilizador comum. */
function isInternalWebhookKey(key: string): boolean {
  return key.startsWith("_");
}

const WEBHOOK_EXTRA_LABELS_PT: Record<string, string> = {
  endereco: "Endereço",
  endereco_completo: "Endereço completo",
  numero_cnh: "Número da CNH",
  data_nascimento: "Data de nascimento",
  "data nascimento": "Data de nascimento",
  categoria_cnh: "Categoria da CNH",
  possui_veiculo: "Possui veículo",
  marca_veiculo: "Marca do veículo",
  modelo_veiculo: "Modelo do veículo",
  ano_veiculo: "Ano do veículo",
  placa_veiculo: "Placa do veículo",
  experiencia: "Experiência profissional",
  origem_captacao: "Como nos encontrou",
  nome_empresa_lead: "Empresa",
  especificacao_origem: "Detalhe (origem)",
  rg: "RG",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  bairro: "Bairro",
  complemento: "Complemento",
};

function labelForWebhookExtraKey(key: string): string {
  const normalized = key.trim().replace(/\s+/g, " ");
  if (WEBHOOK_EXTRA_LABELS_PT[normalized]) return WEBHOOK_EXTRA_LABELS_PT[normalized];
  const snake = normalized.replace(/\s+/g, "_").toLowerCase();
  if (WEBHOOK_EXTRA_LABELS_PT[snake]) return WEBHOOK_EXTRA_LABELS_PT[snake];
  return normalized
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatWebhookExtraValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => formatWebhookExtraValue(v)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function buildWebhookExtrasForDisplay(dw: Record<string, unknown>): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(dw)) {
    if (isInternalWebhookKey(key)) continue;
    const value = formatWebhookExtraValue(raw).trim();
    if (!value) continue;
    rows.push({ key, label: labelForWebhookExtraKey(key), value });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return rows;
}
