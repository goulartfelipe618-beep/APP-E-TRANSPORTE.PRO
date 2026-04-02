import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, UserCheck } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

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
  onComunicar: (s: SolicitacaoMotorista) => void;
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
  const extras =
    solicitacao.dados_webhook && typeof solicitacao.dados_webhook === "object" && !Array.isArray(solicitacao.dados_webhook)
      ? JSON.stringify(solicitacao.dados_webhook, null, 2)
      : null;

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

          {extras ? (
            <details className="rounded-lg border border-border p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">Dados extras (webhook)</summary>
              <pre className="mt-2 max-h-48 overflow-auto text-muted-foreground">{extras}</pre>
            </details>
          ) : null}

          <div className="text-xs text-muted-foreground">Recebida em {new Date(solicitacao.created_at).toLocaleString("pt-BR")}</div>

          <div className="flex gap-2 border-t border-border pt-4">
            {podeConverter && (
              <Button onClick={() => onConverter(solicitacao)} className="flex-1">
                <UserCheck className="mr-2 h-4 w-4" /> Converter em cadastro
              </Button>
            )}
            <Button variant="outline" onClick={() => onComunicar(solicitacao)} className={podeConverter ? "flex-1" : "w-full"}>
              <MessageSquare className="mr-2 h-4 w-4" /> Comunicar
            </Button>
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
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}
