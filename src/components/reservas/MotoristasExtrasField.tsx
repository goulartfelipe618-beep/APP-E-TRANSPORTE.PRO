import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motoristaAssignValue, motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";

type Motorista = { id: string; nome: string; portal_auth_user_id?: string | null };

export function MotoristasExtrasField({
  motoristas,
  primaryId,
  selected,
  onChange,
}: {
  motoristas: Motorista[];
  primaryId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const primary = primaryId.trim();
  const others = motoristas.filter((m) => motoristaAssignValue(m) !== primary && m.id !== primary);
  if (others.length === 0) return null;

  const toggle = (value: string, on: boolean) => {
    onChange(on ? [...selected, value] : selected.filter((id) => id !== value));
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Também vincular estes motoristas</Label>
      <p className="text-xs text-muted-foreground">
        Qualquer categoria. Os motoristas marcados passam a ver esta reserva. Reservas já gravadas não são alteradas.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {others.map((m) => {
          const value = motoristaAssignValue(m);
          return (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selected.some((id) => id === value || motoristaMatchesAssignment(id, m))}
                onCheckedChange={(checked) => toggle(value, checked === true)}
              />
              <span>
                {m.nome}
                {!m.portal_auth_user_id ? " (portal pendente)" : ""}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
