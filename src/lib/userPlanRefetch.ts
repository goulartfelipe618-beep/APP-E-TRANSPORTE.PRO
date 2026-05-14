/** Nome do evento global que o `useUserPlan` escuta para voltar a ler `user_plans`. */
export const USER_PLAN_REFETCH_EVENT = "etp-user-plan-refetch";

export function dispatchUserPlanRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_PLAN_REFETCH_EVENT));
}

/**
 * Dispara refetch imediato e com *backoff* temporal — o webhook Mercado Pago pode
 * actualizar `user_plans` alguns segundos depois da UI mostrar «aprovado».
 * Devolve função para cancelar os temporizadores (ex.: ao desmontar o ecrã).
 */
export function scheduleUserPlanRefetchWithBackoff(): () => void {
  const ids: ReturnType<typeof setTimeout>[] = [];
  const fire = () => dispatchUserPlanRefetch();
  fire();
  for (const ms of [1500, 3500, 7000]) {
    ids.push(window.setTimeout(fire, ms));
  }
  return () => {
    for (const id of ids) clearTimeout(id);
  };
}
