import type { PlanType } from "@/lib/painelPlanPolicy";

type UserPlanCacheSnapshot = {
  userId: string;
  plano: PlanType;
};

let snapshot: UserPlanCacheSnapshot | null = null;

export function getUserPlanCache(): UserPlanCacheSnapshot | null {
  return snapshot;
}

export function setUserPlanCache(userId: string, plano: PlanType): void {
  snapshot = { userId, plano };
}

export function clearUserPlanCache(): void {
  snapshot = null;
}

export function isUserPlanCacheReadyFor(userId: string | null | undefined): boolean {
  return Boolean(userId && snapshot?.userId === userId);
}
