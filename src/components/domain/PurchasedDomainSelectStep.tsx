import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DominioUsuarioRow } from "@/hooks/usePurchasedDomains";

/** Valor interno do Select para redirecionar ao menu Domínios (deve coincidir com o item do final da lista). */
export const REGISTER_NEW_DOMAIN_VALUE = "__register__";

type Props = {
  domains: DominioUsuarioRow[];
  loading: boolean;
  /** id do domínio selecionado ou "" */
  value: string;
  onValueChange: (domainId: string, row: DominioUsuarioRow | null) => void;
  onRegisterNew: () => void;
};

/**
 * Etapa padronizada: título "Escolha seu domínio" + seletor (lista comprada + registrar novo).
 * Usada em Website e E-mail Business.
 */
export function PurchasedDomainSelectStep({
  domains,
  loading,
  value,
  onValueChange,
  onRegisterNew,
}: Props) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Escolha seu domínio</h1>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando domínios…</p>
        ) : (
          <Select
            value={value || undefined}
            onValueChange={(v) => {
              if (v === REGISTER_NEW_DOMAIN_VALUE) {
                onRegisterNew();
                return;
              }
              const row = domains.find((d) => d.id === v) ?? null;
              onValueChange(v, row);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um domínio…" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.fqdn}
                </SelectItem>
              ))}
              <SelectItem value={REGISTER_NEW_DOMAIN_VALUE}>Registrar um novo domínio (www)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
