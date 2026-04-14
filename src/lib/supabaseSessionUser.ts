function readSbUserIdFromStorage(store: Storage): string | null {
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith("sb-")) continue;
    const raw = store.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as {
      user?: { id?: string };
      session?: { user?: { id?: string } };
      currentSession?: { user?: { id?: string } };
    };
    const id = parsed.user?.id ?? parsed.session?.user?.id ?? parsed.currentSession?.user?.id;
    if (id && typeof id === "string") return id;
  }
  return null;
}

/** Lê o user id da sessão persistida pelo Supabase (sessionStorage; fallback legacy localStorage), sem await. */
export function getPersistedSupabaseUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = readSbUserIdFromStorage(sessionStorage);
    if (fromSession) return fromSession;
    return readSbUserIdFromStorage(localStorage);
  } catch {
    /* ignore */
  }
  return null;
}
