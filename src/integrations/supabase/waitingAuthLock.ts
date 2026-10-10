import { processLock } from "@supabase/supabase-js";

/**
 * Desktop: Web Lock exclusivo, para duas abas não renovarem o token ao mesmo tempo.
 * O tempo limite vale só até conseguir o lock. Com o lock na mão, o temporizador
 * é cancelado — uma rede lenta não aborta o refresh no meio.
 * Se não conseguir o lock, a chamada falha. Não corre o refresh solto.
 *
 * Celular: o Web Lock do Safari/Chrome iOS (e vários WebViews) não libera e a
 * tela fica no spinner, mesmo com internet boa. Nesses aparelhos usa-se o lock
 * interno da aba (`processLock`), que serializa a renovação sem travar.
 */
function useWebLocks(): boolean {
  if (typeof navigator === "undefined" || !navigator.locks?.request) return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  if (navigator.maxTouchPoints > 1) return false;
  return true;
}

export async function waitingAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (!useWebLocks()) {
    return processLock(name, acquireTimeout, fn);
  }

  const ac = new AbortController();
  let timer: number | undefined;

  const clearTimer = () => {
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timer = undefined;
  };

  if (acquireTimeout > 0) {
    timer = window.setTimeout(() => {
      ac.abort();
    }, acquireTimeout);
  }

  try {
    return await navigator.locks.request(name, { mode: "exclusive", signal: ac.signal }, async () => {
      clearTimer();
      return fn();
    });
  } finally {
    clearTimer();
  }
}
