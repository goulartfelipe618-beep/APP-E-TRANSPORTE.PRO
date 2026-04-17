/**
 * Sincroniza os "dismissals" dos avisos de plataforma entre Supabase
 * (`public.aviso_dismissals`) e o `localStorage` (cache otimista).
 *
 * Porquê DB + cache?
 *  - LocalStorage é rápido mas perde estado ao mudar de browser/dispositivo,
 *    em Safari iOS ITP (após 7 dias), em modo anónimo, e quando antivírus
 *    limpam storage por heurística.
 *  - Persistir em DB resolve "Não mostrar novamente" em qualquer sessão.
 *
 * Estratégia:
 *  - Ao carregar: lemos da DB (fonte-de-verdade) e hidratamos o cache local.
 *  - Ao fechar o aviso: gravamos em DB (upsert) e simultaneamente em cache.
 *  - Se a DB falhar (rede offline), a UI ainda reflete a intenção via cache
 *    e o próximo login noutro dispositivo também reconcilia quando a rede
 *    voltar — o cliente só considera "permanent" se DB OU cache disser sim.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  AVISO_SNOOZE_MS,
  loadUserAvisoMap,
  saveUserAvisoMap,
  type StoredAvisoState,
} from "@/lib/painelAvisoStorage";

type DbRow = {
  user_id: string;
  aviso_id: string;
  permanent: boolean;
  snooze_until: string | null;
};

function rowToState(row: DbRow): StoredAvisoState {
  const state: StoredAvisoState = {};
  if (row.permanent) state.permanent = true;
  if (row.snooze_until) {
    const t = Date.parse(row.snooze_until);
    if (Number.isFinite(t)) state.snoozeUntil = t;
  }
  return state;
}

function mergeStates(a: StoredAvisoState, b: StoredAvisoState): StoredAvisoState {
  const out: StoredAvisoState = {};
  if (a.permanent || b.permanent) out.permanent = true;
  const candidates = [a.snoozeUntil, b.snoozeUntil].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (candidates.length > 0) out.snoozeUntil = Math.max(...candidates);
  return out;
}

export function mergeMaps(
  a: Record<string, StoredAvisoState>,
  b: Record<string, StoredAvisoState>,
): Record<string, StoredAvisoState> {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, StoredAvisoState> = {};
  for (const k of keys) {
    const sA = a[k];
    const sB = b[k];
    if (sA && sB) out[k] = mergeStates(sA, sB);
    else out[k] = sA ?? sB ?? {};
  }
  return out;
}

/**
 * Carrega os dismissals da DB para este utilizador e reconcilia com cache.
 * Retorna o mapa reconciliado pronto a usar como estado inicial.
 */
export async function loadUserAvisoMapWithSync(
  userId: string,
): Promise<Record<string, StoredAvisoState>> {
  const cache = loadUserAvisoMap(userId);

  const { data, error } = await supabase
    .from("aviso_dismissals")
    .select("user_id, aviso_id, permanent, snooze_until")
    .eq("user_id", userId);

  if (error) {
    // Rede/RLS: não bloqueia — UI segue a cache local.
    console.warn("[aviso_dismissals] load falhou, usando cache local:", error.message);
    return cache;
  }

  const remote: Record<string, StoredAvisoState> = {};
  for (const r of (data ?? []) as DbRow[]) {
    remote[r.aviso_id] = rowToState(r);
  }

  const reconciled = mergeMaps(cache, remote);

  // Persiste reconciliado localmente (fast path nas próximas renderizações).
  saveUserAvisoMap(userId, reconciled);
  return reconciled;
}

/**
 * Marca o aviso como "fechado" na DB e na cache.
 *
 * Regras (iguais ao comportamento anterior, só que agora persistente no DB):
 *  - Se `neverAgain = true` → `permanent = true` (oculta para sempre, em
 *    qualquer dispositivo).
 *  - Caso contrário → snooze de 8h (`snooze_until`).
 */
export async function persistAvisoDismiss(
  userId: string,
  avisoId: string,
  options: { neverAgain: boolean; now: number; prev: Record<string, StoredAvisoState> },
): Promise<Record<string, StoredAvisoState>> {
  const { neverAgain, now, prev } = options;

  let nextState: StoredAvisoState;
  let snoozeIso: string | null;

  if (neverAgain) {
    nextState = { permanent: true };
    snoozeIso = null;
  } else {
    const snoozeUntil = now + AVISO_SNOOZE_MS;
    nextState = { ...prev[avisoId], snoozeUntil };
    snoozeIso = new Date(snoozeUntil).toISOString();
  }

  const nextMap: Record<string, StoredAvisoState> = { ...prev, [avisoId]: nextState };

  // 1) Cache local primeiro (optimistic). Garante UX imediata mesmo offline.
  saveUserAvisoMap(userId, nextMap);

  // 2) DB em seguida (upsert). Não bloqueamos o fecho visual se a rede falhar
  //    — a próxima carga (loadUserAvisoMapWithSync) reconcilia.
  const { error } = await supabase
    .from("aviso_dismissals")
    .upsert(
      {
        user_id: userId,
        aviso_id: avisoId,
        permanent: neverAgain,
        snooze_until: snoozeIso,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "user_id,aviso_id" },
    );

  if (error) {
    console.warn("[aviso_dismissals] upsert falhou; mantido só no cache local:", error.message);
  }

  return nextMap;
}
