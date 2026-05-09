/**
 * Identifica registos que excedem os limites do plano FREE (sem apagar dados).
 * Critérios alinhados às validações em `CriarReservaTransferDialog` / `CriarReservaGrupoDialog`
 * (contagem por dia civil em America/Sao_Paulo com base em `created_at`) e geolocalização
 * (até N links por mês civil SP, por `created_at`).
 */

import {
  FREE_MAX_LINKS_GEO_MES,
  FREE_MAX_MOTORISTAS_CADASTRADOS,
  FREE_MAX_RESERVAS_DIA,
  type PlanType,
} from "@/lib/painelPlanPolicy";
import { calendarDayKeySaoPauloFromIso, yearMonthKeySaoPauloFromIso } from "@/lib/spCalendarBr";

function sortByCreatedAsc<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Por cada dia (SP), só as primeiras `FREE_MAX_RESERVAS_DIA` reservas criadas contam como «ativas» no FREE. */
export function freePlanLockedReservaIdsByCreationDay(
  plano: PlanType,
  rows: { id: string; created_at: string }[],
): Set<string> {
  if (plano !== "free") return new Set();
  const byDay = new Map<string, { id: string; created_at: string }[]>();
  for (const r of rows) {
    const dk = calendarDayKeySaoPauloFromIso(r.created_at);
    const arr = byDay.get(dk) ?? [];
    arr.push(r);
    byDay.set(dk, arr);
  }
  const locked = new Set<string>();
  for (const arr of byDay.values()) {
    const sorted = sortByCreatedAsc(arr);
    for (let i = FREE_MAX_RESERVAS_DIA; i < sorted.length; i++) {
      locked.add(sorted[i].id);
    }
  }
  return locked;
}

/** Primeiros `FREE_MAX_MOTORISTAS_CADASTRADOS` cadastros (mais antigos) permanecem ativos no FREE. */
export function freePlanLockedMotoristaCadastroIds(
  plano: PlanType,
  rows: { id: string; created_at: string }[],
): Set<string> {
  if (plano !== "free") return new Set();
  const sorted = sortByCreatedAsc(rows);
  const locked = new Set<string>();
  for (let i = FREE_MAX_MOTORISTAS_CADASTRADOS; i < sorted.length; i++) {
    locked.add(sorted[i].id);
  }
  return locked;
}

/** Por cada mês (SP), só os primeiros `FREE_MAX_LINKS_GEO_MES` links criados nesse mês são «ativos» no FREE. */
export function freePlanLockedRastreioIdsByCreationMonth(
  plano: PlanType,
  rows: { id: string; created_at: string }[],
): Set<string> {
  if (plano !== "free") return new Set();
  const byMonth = new Map<string, { id: string; created_at: string }[]>();
  for (const r of rows) {
    const ym = yearMonthKeySaoPauloFromIso(r.created_at);
    const arr = byMonth.get(ym) ?? [];
    arr.push(r);
    byMonth.set(ym, arr);
  }
  const locked = new Set<string>();
  for (const arr of byMonth.values()) {
    const sorted = sortByCreatedAsc(arr);
    for (let i = FREE_MAX_LINKS_GEO_MES; i < sorted.length; i++) {
      locked.add(sorted[i].id);
    }
  }
  return locked;
}
