/**
 * Com 25–30 abas, só uma lidera refresh de sessão e os polls.
 * A aba visível ganha; se ficar oculta, outra visível assume em poucos segundos.
 */

const LEADER_KEY = "etp_tab_leader_v1";
const HEARTBEAT_MS = 2_000;
const STALE_MS = 6_000;

type LeaderRecord = { id: string; at: number };

let tabId = "";
let leader = false;
let started = false;
const listeners = new Set<(isLeader: boolean) => void>();

function now(): number {
  return Date.now();
}

function readRecord(): LeaderRecord | null {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeaderRecord;
    if (!parsed?.id || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(): void {
  try {
    localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now() } satisfies LeaderRecord));
  } catch {
    /* ignore */
  }
}

function setLeader(next: boolean): void {
  if (leader === next) return;
  leader = next;
  listeners.forEach((fn) => fn(next));
}

function tabVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function claim(): void {
  if (typeof localStorage === "undefined") {
    setLeader(true);
    return;
  }
  const rec = readRecord();
  const stale = !rec || now() - rec.at > STALE_MS;
  const mine = rec?.id === tabId;
  if (mine || stale) {
    if (stale && !tabVisible() && !mine) {
      setLeader(false);
      return;
    }
    writeRecord();
    const won = readRecord()?.id === tabId;
    setLeader(!!won);
    return;
  }
  setLeader(false);
}

export function isTabLeader(): boolean {
  return leader;
}

export function onTabLeaderChange(fn: (isLeader: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function startTabLeader(): void {
  if (started) return;
  started = true;
  tabId = `${now()}-${Math.random().toString(36).slice(2, 10)}`;
  claim();
  window.setInterval(() => {
    if (leader) writeRecord();
    else claim();
  }, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => {
    if (tabVisible()) claim();
  });
}
