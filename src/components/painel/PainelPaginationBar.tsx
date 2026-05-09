import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAINEL_PAGE_SIZE } from "@/lib/painelPagination";
import { cn } from "@/lib/utils";

type PainelPaginationBarProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Rodapé de paginação cliente (10 itens). Oculta-se quando cabe numa única página.
 */
export function PainelPaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
  className,
  disabled,
}: PainelPaginationBarProps) {
  if (totalItems <= 0 || totalPages <= 1) return null;
  const start = (page - 1) * PAINEL_PAGE_SIZE + 1;
  const end = Math.min(page * PAINEL_PAGE_SIZE, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> de{" "}
        <span className="font-medium text-foreground">{totalItems}</span> · Página{" "}
        <span className="font-medium text-foreground">{page}</span> de{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
