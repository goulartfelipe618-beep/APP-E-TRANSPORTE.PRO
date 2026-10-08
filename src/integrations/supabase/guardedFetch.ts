/**
 * Quando o Postgres está saturado, cada aba repete refresh e /user ao mesmo tempo.
 * Fila por tipo, cache curto de /user e pausa depois de 502/503/504/522/524.
 */

const OVERLOAD_STATUS = new Set([502, 503, 504, 522, 524]);
const COOLDOWN_MS = 20_000;
const USER_CACHE_MS = 45_000;
const USER_CACHE_KEY = "etp_auth_user_http_v1";
const BC_NAME = "etp-auth-fetch-v1";

type Lane = "refresh" | "user";

type Slot = {
  until: number;
  inflight: Promise<Response> | null;
};

const slots: Record<Lane, Slot> = {
  refresh: { until: 0, inflight: null },
  user: { until: 0, inflight: null },
};

type UserCache = { token: string; at: number; status: number; body: string };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(BC_NAME);
    channel.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; lane?: Lane; until?: number } | null;
      if (data?.type === "cooldown" && data.lane && typeof data.until === "number") {
        slots[data.lane].until = data.until;
      }
    };
  }
  return channel;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function laneOf(input: RequestInfo | URL): Lane | null {
  const url = requestUrl(input);
  if (!url.includes("/auth/v1/")) return null;
  if (url.includes("/token") && url.includes("refresh_token")) return "refresh";
  if (url.includes("/user")) return "user";
  return null;
}

function overloadedResponse(): Response {
  return new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

function bearerOf(init?: RequestInit): string {
  try {
    const headers = new Headers(init?.headers);
    return headers.get("Authorization") ?? "";
  } catch {
    return "";
  }
}

function readUserCache(token: string): UserCache | null {
  if (typeof localStorage === "undefined" || !token) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "null") as UserCache | null;
    if (!parsed?.token || parsed.token !== token) return null;
    if (Date.now() - parsed.at > USER_CACHE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeUserCache(token: string, status: number, body: string): void {
  if (typeof localStorage === "undefined" || !token) return;
  try {
    const payload: UserCache = { token, at: Date.now(), status, body };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function cachedResponse(cache: UserCache): Response {
  return new Response(cache.body, {
    status: cache.status,
    headers: { "Content-Type": "application/json" },
  });
}

function setCooldown(lane: Lane): void {
  const until = Date.now() + COOLDOWN_MS;
  slots[lane].until = until;
  getChannel()?.postMessage({ type: "cooldown", lane, until });
}

export function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  getChannel();
  const lane = laneOf(input);
  if (!lane) return fetch(input, init);

  if (Date.now() < slots[lane].until) return Promise.resolve(overloadedResponse());

  if (lane === "user" && (!init?.method || init.method === "GET")) {
    const cache = readUserCache(bearerOf(init));
    if (cache) return Promise.resolve(cachedResponse(cache));
  }

  const slot = slots[lane];
  if (slot.inflight) return slot.inflight.then((res) => res.clone());

  const run = fetch(input, init).then(async (res) => {
    if (OVERLOAD_STATUS.has(res.status)) setCooldown(lane);
    if (lane === "user" && res.ok) {
      const body = await res.clone().text();
      writeUserCache(bearerOf(init), res.status, body);
    }
    return res;
  });
  slot.inflight = run.finally(() => {
    slot.inflight = null;
  });
  return slot.inflight.then((res) => res.clone());
}
