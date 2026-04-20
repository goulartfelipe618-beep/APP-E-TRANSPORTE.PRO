import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export type PainelKind = "motorista_executivo" | "admin_master" | "taxi";

type LogKind = "error" | "unhandledrejection" | "react_boundary";

type ReporterConfig = {
  painel: PainelKind;
  navStorageKey: string;
};

let cfg: ReporterConfig | null = null;
let boundOnError: ((ev: ErrorEvent) => void) | null = null;
let boundOnRejection: ((ev: PromiseRejectionEvent) => void) | null = null;
let displayNameCache: { at: number; value: string | null } = { at: 0, value: null };
const DISPLAY_NAME_TTL_MS = 5 * 60_000;
const MAX_TEXT = 14_000;
const DEDUPE_MS = 4_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;

let lastFingerprint = "";
let lastFingerprintAt = 0;
const recentInserts: number[] = [];

function pruneRateWindow(now: number) {
  while (recentInserts.length > 0 && now - recentInserts[0]! > RATE_WINDOW_MS) {
    recentInserts.shift();
  }
}

function readActivePage(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw && raw.length > 0 && raw.length < 240) return raw;
  } catch {
    /* private mode / blocked */
  }
  return null;
}

function truncate(s: string | undefined | null): string | null {
  if (s == null || s.length === 0) return null;
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
}

/** Evita persistir tokens OAuth/PKCE ou outros segredos frequentes em query/hash. */
function sanitizeHrefForLog(href: string): string | null {
  try {
    const u = new URL(href);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function resolveDisplayName(userId: string): Promise<string | null> {
  const now = Date.now();
  if (displayNameCache.value !== null && now - displayNameCache.at < DISPLAY_NAME_TTL_MS) {
    return displayNameCache.value;
  }
  const { data } = await supabase
    .from("configuracoes")
    .select("nome_completo")
    .eq("user_id", userId)
    .maybeSingle();
  const name = (data?.nome_completo && data.nome_completo.trim()) || null;
  displayNameCache = { at: now, value: name };
  return name;
}

function fingerprint(kind: string, message: string, stack: string | null): string {
  return `${kind}|${message}|${stack ?? ""}`;
}

function shouldSkipDuplicate(fp: string): boolean {
  const now = Date.now();
  if (fp === lastFingerprint && now - lastFingerprintAt < DEDUPE_MS) return true;
  lastFingerprint = fp;
  lastFingerprintAt = now;
  return false;
}

function underRateLimit(): boolean {
  const now = Date.now();
  pruneRateWindow(now);
  if (recentInserts.length >= RATE_MAX) return false;
  recentInserts.push(now);
  return true;
}

function benignConsoleNoise(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("resizeobserver loop")) return true;
  if (m.includes("non-error promise rejection captured")) return true;
  return false;
}

export function initPainelErrorReporter(next: ReporterConfig): void {
  shutdownPainelErrorReporter();
  cfg = next;
  if (typeof window === "undefined") return;

  boundOnError = (ev: ErrorEvent) => {
    const msg = ev.message || String(ev.error ?? "Error");
    if (benignConsoleNoise(msg)) return;
    void reportPainelError({
      kind: "error",
      message: msg,
      stack: ev.error instanceof Error ? ev.error.stack ?? null : null,
      extra: {
        filename: ev.filename ?? null,
        lineno: ev.lineno ?? null,
        colno: ev.colno ?? null,
      },
    });
  };

  boundOnRejection = (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? reason.message || "Unhandled rejection"
        : typeof reason === "string"
          ? reason
          : "Unhandled rejection";
    if (benignConsoleNoise(msg)) return;
    void reportPainelError({
      kind: "unhandledrejection",
      message: msg,
      stack: reason instanceof Error ? reason.stack ?? null : null,
      extra: { reasonType: typeof reason },
    });
  };

  window.addEventListener("error", boundOnError);
  window.addEventListener("unhandledrejection", boundOnRejection);
}

export function shutdownPainelErrorReporter(): void {
  if (typeof window !== "undefined") {
    if (boundOnError) window.removeEventListener("error", boundOnError);
    if (boundOnRejection) window.removeEventListener("unhandledrejection", boundOnRejection);
  }
  boundOnError = null;
  boundOnRejection = null;
  cfg = null;
}

export function isPainelErrorReporterActive(): boolean {
  return cfg !== null;
}

export async function reportPainelError(payload: {
  kind: LogKind;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  if (!cfg) return;
  const now = Date.now();
  const fp = fingerprint(payload.kind, payload.message, payload.stack ?? null);
  if (shouldSkipDuplicate(fp)) return;
  if (!underRateLimit()) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const activePage = readActivePage(cfg.navStorageKey);
  const routePath = typeof window !== "undefined" ? window.location.pathname : null;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

  let userDisplayName: string | null = null;
  try {
    userDisplayName = await resolveDisplayName(user.id);
  } catch {
    /* ignore */
  }

  const row: TablesInsert<"painel_client_error_logs"> = {
    user_id: user.id,
    painel: cfg.painel,
    active_page: activePage,
    route_path: routePath,
    kind: payload.kind,
    message: truncate(payload.message) ?? "",
    stack: truncate(payload.stack ?? null),
    component_stack: truncate(payload.componentStack ?? null),
    user_display_name: userDisplayName,
    user_email: user.email ?? null,
    user_agent: userAgent ? truncate(userAgent) : null,
    extra: {
      ...(payload.extra ?? {}),
      href:
        typeof window !== "undefined" ? sanitizeHrefForLog(window.location.href) : null,
    },
  };

  const { error } = await supabase.from("painel_client_error_logs").insert(row);
  if (error && import.meta.env.DEV) {
    console.warn("[painelErrorReporter] insert falhou:", error.message);
  }
}
