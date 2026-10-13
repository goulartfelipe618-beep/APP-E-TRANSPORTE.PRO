import { Download, Eye, Lock, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  locked: boolean;
  onEdit: () => void;
  onView: () => void;
  onComunicar: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

const acoes = [
  { key: "edit", label: "Editar", icon: Pencil },
  { key: "view", label: "Ver", icon: Eye },
  { key: "comunicar", label: "Comunicar", icon: MessageSquare },
  { key: "download", label: "Baixar", icon: Download },
  { key: "delete", label: "Excluir", icon: Trash2 },
] as const;

/** Botões da lista de reservas. No telefone ocupam a largura do cartão; na tabela ficam numa linha só. */
export default function ReservaListaAcoes({ locked, onEdit, onView, onComunicar, onDownload, onDelete }: Props) {
  const run = {
    edit: onEdit,
    view: onView,
    comunicar: onComunicar,
    download: onDownload,
    delete: onDelete,
  };

  return (
    <>
      <div className="grid grid-cols-5 gap-1 md:hidden">
        {locked ? (
          <Badge
            variant="outline"
            title="Acima do limite diário do plano FREE — ações limitadas; os dados mantêm-se na conta."
            className="col-span-5 mb-1 w-fit gap-1 border-amber-600/40 text-amber-700 dark:text-amber-400"
          >
            <Lock className="h-3 w-3" aria-hidden />
            FREE
          </Badge>
        ) : null}
        {acoes.map((acao) => {
          const Icon = acao.icon;
          const bloqueada = locked && acao.key !== "view";
          return (
            <Button
              key={acao.key}
              type="button"
              variant="outline"
              disabled={bloqueada}
              title={acao.label}
              aria-label={acao.label}
              onClick={run[acao.key]}
              className="h-auto min-h-11 w-full min-w-0 flex-col gap-0.5 px-0.5 py-1.5 text-[10px] leading-none"
            >
              <Icon className={`h-4 w-4 shrink-0 ${acao.key === "delete" ? "text-destructive" : ""}`} />
              <span className="max-w-full truncate">{acao.label}</span>
            </Button>
          );
        })}
      </div>
      <div className="hidden flex-nowrap items-center justify-end gap-0.5 md:inline-flex">
        {locked ? (
          <Badge
            variant="outline"
            title="Acima do limite diário do plano FREE — ações limitadas; os dados mantêm-se na conta."
            className="mr-1 shrink-0 gap-0.5 border-amber-600/40 px-1.5 py-0 text-[10px] leading-tight text-amber-700 dark:text-amber-400"
          >
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            FREE
          </Badge>
        ) : null}
        {acoes.map((acao) => {
          const Icon = acao.icon;
          const bloqueada = locked && acao.key !== "view";
          return (
            <Button
              key={acao.key}
              type="button"
              variant="ghost"
              size="icon"
              disabled={bloqueada}
              title={acao.label}
              aria-label={acao.label}
              onClick={run[acao.key]}
              className="h-8 w-8 shrink-0"
            >
              <Icon className={`h-4 w-4 ${acao.key === "delete" ? "text-destructive" : ""}`} />
            </Button>
          );
        })}
      </div>
    </>
  );
}
