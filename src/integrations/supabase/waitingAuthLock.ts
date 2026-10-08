import { processLock } from "@supabase/supabase-js";

/**
 * O lock padrão do supabase-js usa `{ steal: true }`: uma aba nova aborta a antiga.
 * Aqui a aba espera a vez. Com sessão partilhada, só uma chama /token de cada vez.
 */
export async function waitingAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) {
    return processLock(name, acquireTimeout, fn);
  }

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), Math.max(1, acquireTimeout));
  try {
    return await locks.request(name, { mode: "exclusive", signal: ac.signal }, () => fn());
  } finally {
    window.clearTimeout(timer);
  }
}
