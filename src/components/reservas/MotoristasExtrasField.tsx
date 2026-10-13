import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motoristaAssignValue, motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";
import { parseRepasseInformado } from "@/lib/reservaMotoristasExtra";

type Motorista = { id: string; nome: string; portal_auth_user_id?: string | null };

export type ExtraSelecionado = { motoristaId: string; repasse: string };

function marcado(selected: ExtraSelecionado[], motorista: Motorista): ExtraSelecionado | undefined {
  const value = motoristaAssignValue(motorista);
  return selected.find(
    (item) => item.motoristaId === value || item.motoristaId === motorista.id || motoristaMatchesAssignment(item.motoristaId, motorista),
  );
}

function somaReais(principal: string, selected: ExtraSelecionado[]): number | null {
  const partes = [parseRepasseInformado(principal), ...selected.map((item) => parseRepasseInformado(item.repasse))];
  if (partes.some((parte) => !parte.ok)) return null;
  return partes.reduce((total, parte) => total + (parte.ok ? parte.valor ?? 0 : 0), 0);
}

export function MotoristasExtrasField({
  motoristas,
  primaryId,
  selected,
  onChange,
  repassePrincipal = "",
}: {
  motoristas: Motorista[];
  primaryId: string;
  selected: ExtraSelecionado[];
  onChange: (ids: ExtraSelecionado[]) => void;
  repassePrincipal?: string;
}) {
  const primary = primaryId.trim();
  const others = motoristas.filter((m) => motoristaAssignValue(m) !== primary && m.id !== primary);
  if (others.length === 0) return null;

  const toggle = (motorista: Motorista, on: boolean) => {
    const value = motoristaAssignValue(motorista);
    if (!on) {
      onChange(selected.filter((item) => item.motoristaId !== value && !motoristaMatchesAssignment(item.motoristaId, motorista)));
      return;
    }
    if (marcado(selected, motorista)) return;
    onChange([...selected, { motoristaId: value, repasse: "" }]);
  };

  const definirRepasse = (motorista: Motorista, repasse: string) => {
    const value = motoristaAssignValue(motorista);
    onChange(
      selected.map((item) =>
        item.motoristaId === value || motoristaMatchesAssignment(item.motoristaId, motorista) ? { ...item, repasse } : item,
      ),
    );
  };

  const total = somaReais(repassePrincipal, selected);
  const vinculados = others.filter((motorista) => marcado(selected, motorista)).length;

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="space-y-1">
        <Label>Outros motoristas desta reserva</Label>
        <p className="text-xs text-muted-foreground">
          Marque só quem também executa esta viagem. Ao marcar, a reserva passa a aparecer no mini painel daquele motorista
          e em mais nenhum outro. O repasse de cada um é separado do motorista principal.
        </p>
      </div>
      <div className="space-y-2">
        {others.map((motorista) => {
          const atual = marcado(selected, motorista);
          const ativo = Boolean(atual);
          const portalPronto = Boolean(motorista.portal_auth_user_id);
          return (
            <div
              key={motorista.id}
              className={`rounded-lg border p-3 ${ativo ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={ativo}
                  onCheckedChange={(checked) => toggle(motorista, checked === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{motorista.nome}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {portalPronto
                      ? "Mini painel próprio. O vínculo não sai desta conta."
                      : "Portal ainda pendente. A reserva fica guardada para quando o acesso existir."}
                  </span>
                </span>
              </label>
              {ativo ? (
                <div className="mt-3 space-y-1.5 pl-7">
                  <Label className="text-xs">Repasse deste motorista (R$)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={atual?.repasse ?? ""}
                    onChange={(e) => definirRepasse(motorista, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco se ele não recebe. Com a reserva concluída, este valor vira uma despesa só dele no Financeiro.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {vinculados === 0
          ? "Nenhum motorista extra marcado."
          : `${vinculados} motorista${vinculados === 1 ? "" : "s"} extra${vinculados === 1 ? "" : "s"} marcado${vinculados === 1 ? "" : "s"}.`}
        {total == null
          ? " Há um repasse inválido."
          : ` Soma dos repasses desta tela: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`}
      </p>
    </div>
  );
}
