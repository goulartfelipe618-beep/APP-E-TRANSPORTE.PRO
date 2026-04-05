/** Lê o user id da sessão persistida pelo Supabase (localStorage), sem await. */
export function getPersistedSupabaseUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user?: { id?: string };
        session?: { user?: { id?: string } };
        currentSession?: { user?: { id?: string } };
      };
      const id =
        parsed.user?.id ?? parsed.session?.user?.id ?? parsed.currentSession?.user?.id;
      if (id && typeof id === "string") return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}
