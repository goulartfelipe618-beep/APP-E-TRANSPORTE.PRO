import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import type { Database } from "@/integrations/supabase/types";
import { MOTORISTA_FROTA_DOCS_BUCKET } from "@/lib/motoristaFrotaStorage";
import { getAppPublicOrigin, getMotoristaVerificacaoAppOrigin } from "@/lib/appPublicUrl";

export const PORTAL_FOTO_SLOTS = [1, 2, 3, 4] as const;
export type PortalFotoSlot = (typeof PORTAL_FOTO_SLOTS)[number];

export const PORTAL_FOTO_PATH_KEYS: Record<PortalFotoSlot, string> = {
  1: "portal_foto_1_path",
  2: "portal_foto_2_path",
  3: "portal_foto_3_path",
  4: "portal_foto_4_path",
};

const MAX_BYTES = 5 * 1024 * 1024;

function portalFotoStoragePath(ownerUserId: string, motoristaId: string, slot: PortalFotoSlot, ext: string): string {
  return `${ownerUserId}/${motoristaId}/portal-foto-${slot}.${ext}`;
}

export function pickPortalFotoPath(dadosWebhook: unknown, slot: PortalFotoSlot): string | null {
  const dw = parseDadosWebhook(dadosWebhook);
  const raw = pickStr(dw, PORTAL_FOTO_PATH_KEYS[slot]);
  return raw?.trim() ? raw.trim() : null;
}

export function listPortalFotoPaths(dadosWebhook: unknown): Partial<Record<PortalFotoSlot, string>> {
  const out: Partial<Record<PortalFotoSlot, string>> = {};
  for (const slot of PORTAL_FOTO_SLOTS) {
    const p = pickPortalFotoPath(dadosWebhook, slot);
    if (p) out[slot] = p;
  }
  return out;
}

export async function uploadMotoristaPortalFoto(
  supabase: SupabaseClient<Database>,
  ownerUserId: string,
  motoristaId: string,
  slot: PortalFotoSlot,
  file: File,
): Promise<string> {
  const { mime } = await assertUploadMagicBytes(file, "raster-image", MAX_BYTES);
  const ext = extensionForDetectedMime(mime);
  const path = portalFotoStoragePath(ownerUserId, motoristaId, slot, ext);
  const { error } = await supabase.storage.from(MOTORISTA_FROTA_DOCS_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: mime,
  });
  if (error) throw new Error(error.message);

  const { error: rpcErr } = await (supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ error: { message: string } | null }> }).rpc(
    "merge_motorista_portal_foto_path",
    { _slot: slot, _path: path },
  );
  if (rpcErr) throw new Error(rpcErr.message);
  return path;
}

export async function removeMotoristaPortalFoto(
  supabase: SupabaseClient<Database>,
  slot: PortalFotoSlot,
  existingPath: string | null,
): Promise<void> {
  if (existingPath?.trim()) {
    await supabase.storage.from(MOTORISTA_FROTA_DOCS_BUCKET).remove([existingPath.trim()]);
  }
  const { error: rpcErr } = await (supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ error: { message: string } | null }> }).rpc(
    "merge_motorista_portal_foto_path",
    { _slot: slot, _path: null },
  );
  if (rpcErr) throw new Error(rpcErr.message);
}

function buildViewerUrl(token: string): string {
  const base = getMotoristaVerificacaoAppOrigin() || getAppPublicOrigin();
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/motorista-frota-doc?t=${encodeURIComponent(token)}`;
}

function buildEdgeUrl(token: string): string {
  const u = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!u) return "";
  return `${u.replace(/\/$/, "")}/functions/v1/motorista-frota-doc-link?t=${encodeURIComponent(token)}`;
}

export type PortalFotoSignedUrls = Partial<Record<PortalFotoSlot, { preview: string; share: string }>>;

/** URLs assinadas para fotos do portal (motorista ou dono da frota). */
export async function signMotoristaPortalFotoUrls(
  supabase: SupabaseClient<Database>,
  dadosWebhook: unknown,
): Promise<PortalFotoSignedUrls> {
  const paths = listPortalFotoPaths(dadosWebhook);
  const uniquePaths = [...new Set(Object.values(paths).filter(Boolean))] as string[];
  const out: PortalFotoSignedUrls = {};

  if (uniquePaths.length === 0) return out;

  let tokens: Record<string, string> = {};
  const { data, error } = await supabase.functions.invoke("motorista-frota-doc-link" as never, {
    body: { paths: uniquePaths },
  });
  if (!error && data && typeof data === "object" && data !== null && "tokens" in data) {
    const t = (data as { tokens?: Record<string, string> }).tokens;
    if (t && typeof t === "object") tokens = t;
  }

  for (const slot of PORTAL_FOTO_SLOTS) {
    const path = paths[slot];
    if (!path) continue;
    const tok = tokens[path];
    if (tok) {
      const preview = buildEdgeUrl(tok);
      const share = buildViewerUrl(tok);
      if (preview || share) out[slot] = { preview: preview || share, share: share || preview };
    } else {
      const { data: signed, error: signErr } = await supabase.storage
        .from(MOTORISTA_FROTA_DOCS_BUCKET)
        .createSignedUrl(path, 3600);
      if (!signErr && signed?.signedUrl) {
        out[slot] = { preview: signed.signedUrl, share: signed.signedUrl };
      }
    }
  }

  return out;
}
