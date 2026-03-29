import type { ReactNode } from "react";
import { Globe, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DomainOption = "new" | "existing";

export interface DomainSelectionCardProps {
  domainOption: DomainOption;
  onDomainOptionChange: (v: DomainOption) => void;
  domain: string;
  onDomainChange: (v: string) => void;
  domainChecked: boolean;
  domainAvailable: boolean | null;
  domainMessage: string;
  checkingDomain: boolean;
  onCheckDomain: () => void;
  onResetCheck: () => void;
  /** Conteúdo extra abaixo do campo de domínio (ex.: provedor quando já possui domínio) */
  extraBelowDomain?: ReactNode;
  disabled?: boolean;
}

/**
 * Bloco único de escolha de domínio (igual ao fluxo E-mail Business).
 * Reutilizado em Website e outros fluxos que exijam domínio primeiro.
 */
export function DomainSelectionCard({
  domainOption,
  onDomainOptionChange,
  domain,
  onDomainChange,
  domainChecked,
  domainAvailable,
  domainMessage,
  checkingDomain,
  onCheckDomain,
  onResetCheck,
  extraBelowDomain,
  disabled,
}: DomainSelectionCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-bold text-foreground">Escolha seu domínio</h2>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Você já tem um domínio?</p>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="domain-option-shared"
              checked={domainOption === "new"}
              onChange={() => {
                onDomainOptionChange("new");
                onResetCheck();
              }}
              disabled={disabled}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">Quero registrar um novo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="domain-option-shared"
              checked={domainOption === "existing"}
              onChange={() => {
                onDomainOptionChange("existing");
                onResetCheck();
              }}
              disabled={disabled}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">Já tenho um domínio</span>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">
            {domainOption === "new" ? "Nome desejado para o domínio" : "Informe seu domínio"}
          </label>
          <Input
            value={domain}
            onChange={(e) => {
              onDomainChange(e.target.value);
              onResetCheck();
            }}
            placeholder="suaempresa.com.br"
            className="mt-1"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {domainOption === "new"
              ? "Pesquise a disponibilidade antes de continuar."
              : "Será necessário apontar o DNS para ativação."}
          </p>
        </div>

        {domainOption === "new" && (
          <Button variant="outline" onClick={onCheckDomain} disabled={checkingDomain || !domain.trim() || disabled}>
            {checkingDomain ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" /> Pesquisar Domínio
              </>
            )}
          </Button>
        )}

        {extraBelowDomain}

        {domainChecked && (
          <div
            className={cn(
              "rounded-lg border p-4 flex items-start gap-3",
              domainAvailable === true && "border-green-500/30 bg-green-500/10",
              domainAvailable === false && "border-destructive/30 bg-destructive/10"
            )}
          >
            {domainAvailable === true && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
            {domainAvailable === false && <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  domainAvailable === true && "text-green-500",
                  domainAvailable === false && "text-destructive"
                )}
              >
                {domainMessage || (domainAvailable ? "Domínio disponível!" : "Domínio indisponível.")}
              </p>
              {domainAvailable === false && (
                <p className="text-xs text-muted-foreground mt-1">Tente outro nome ou variação.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Regra igual ao wizard E-mail Business / Website após domínio. */
export function canAdvanceFromDomainSelection(
  domain: string,
  domainOption: DomainOption,
  domainChecked: boolean,
  domainAvailable: boolean | null
): boolean {
  if (!domain.trim() || !domain.includes(".")) return false;
  if (domainOption === "existing") return true;
  return domainChecked && domainAvailable === true;
}
