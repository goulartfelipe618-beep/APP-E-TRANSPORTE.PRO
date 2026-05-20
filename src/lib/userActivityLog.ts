import { supabase } from "@/integrations/supabase/client";

/** Códigos estáveis gravados na base; mensagem é o texto exibido no terminal do admin. */
export const USER_ACTIVITY_ACTIONS = {
  primeiro_acesso: "PRIMEIRO ACESSO",
  config_iniciais_concluidas: "CONCLUIU AS CONF. INICIAIS",
  reserva_transfer_criada: "CRIOU UMA RESERVA -- TRANSFER",
  reserva_grupo_criada: "CRIOU UMA RESERVA -- GRUPO",
  receptivo_criado: "CRIOU RECEPTIVO",
  motorista_cadastrado: "ADICIONOU UM CADASTRO DE MOTORISTA",
  veiculo_cadastrado: "CADASTROU UM VEÍCULO",
} as const;

export type UserActivityActionCode = keyof typeof USER_ACTIVITY_ACTIONS;

const ONCE_ACTIONS = new Set<UserActivityActionCode>([
  "primeiro_acesso",
  "config_iniciais_concluidas",
]);

export type UserActivityLogRow = {
  id: string;
  user_id: string;
  action_code: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Formato pedido: HH:mm - DD/MM/YYYY - MENSAGEM */
export function formatUserActivityTerminalLine(createdAt: string, message: string): string {
  const d = new Date(createdAt);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} - ${date} - ${message}`;
}

/**
 * Regista uma atividade do utilizador autenticado. Falhas são silenciosas para não quebrar fluxos do painel.
 */
export async function logUserActivity(
  actionCode: UserActivityActionCode,
  options?: { userId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    let userId = options?.userId;
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      userId = user.id;
    }

    const message = USER_ACTIVITY_ACTIONS[actionCode];
    const row = {
      user_id: userId,
      action_code: actionCode,
      message,
      metadata: options?.metadata ?? {},
    };

    if (ONCE_ACTIONS.has(actionCode)) {
      const { error } = await supabase.from("user_activity_log").insert(row);
      if (error?.code === "23505") return;
      return;
    }

    await supabase.from("user_activity_log").insert(row);
  } catch {
    /* não interromper UX do painel transfer */
  }
}

/** Lista atividades de um utilizador (admin_master via RLS). */
export async function fetchUserActivityLogs(userId: string): Promise<UserActivityLogRow[]> {
  const { data, error } = await supabase
    .from("user_activity_log")
    .select("id, user_id, action_code, message, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as UserActivityLogRow[];
}
