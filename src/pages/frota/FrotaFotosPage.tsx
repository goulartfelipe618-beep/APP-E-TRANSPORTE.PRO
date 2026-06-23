import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Shield, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  PORTAL_FOTO_SLOTS,
  type PortalFotoSlot,
  pickPortalFotoPath,
  removeMotoristaPortalFoto,
  signMotoristaPortalFotoUrls,
  uploadMotoristaPortalFoto,
  type PortalFotoSignedUrls,
} from "@/lib/motoristaPortalFotos";

export default function FrotaFotosPage() {
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [dadosWebhook, setDadosWebhook] = useState<Json | null>(null);
  const [urls, setUrls] = useState<PortalFotoSignedUrls>({});
  const [busySlot, setBusySlot] = useState<PortalFotoSlot | null>(null);
  const fileRefs = useRef<Partial<Record<PortalFotoSlot, HTMLInputElement | null>>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("solicitacoes_motoristas")
        .select("id, user_id, nome, dados_webhook")
        .eq("portal_auth_user_id", uid)
        .eq("status", "cadastrado")
        .maybeSingle();

      if (error || !data) {
        toast.error("Não foi possível carregar o seu cadastro.");
        setNome("");
        setOwnerUserId("");
        setMotoristaId("");
        setDadosWebhook(null);
        setUrls({});
        return;
      }

      setNome(data.nome || "");
      setOwnerUserId(String(data.user_id));
      setMotoristaId(String(data.id));
      setDadosWebhook((data.dados_webhook as Json) ?? null);
      const signed = await signMotoristaPortalFotoUrls(supabase, data.dados_webhook);
      setUrls(signed);
    } catch {
      toast.error("Erro ao carregar fotos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPickFile = async (slot: PortalFotoSlot, file: File | null) => {
    if (!file || !ownerUserId || !motoristaId) return;
    setBusySlot(slot);
    try {
      await uploadMotoristaPortalFoto(supabase, ownerUserId, motoristaId, slot, file);
      toast.success(`Foto ${slot} guardada.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar foto.");
    } finally {
      setBusySlot(null);
    }
  };

  const onRemove = async (slot: PortalFotoSlot) => {
    setBusySlot(slot);
    try {
      const path = pickPortalFotoPath(dadosWebhook, slot);
      await removeMotoristaPortalFoto(supabase, slot, path);
      toast.success(`Foto ${slot} removida.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover foto.");
    } finally {
      setBusySlot(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        A carregar…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Minhas fotos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione até 4 fotos ao seu perfil operacional{nome ? ` — ${nome}` : ""}. Só você e o operador da frota que o
          cadastrou podem vê-las.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" />
        <p>
          As fotos ficam isoladas por motorista. Outros motoristas da mesma frota não têm acesso às suas imagens,
          reservas nem dados pessoais.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PORTAL_FOTO_SLOTS.map((slot) => {
          const preview = urls[slot]?.preview;
          const hasPhoto = Boolean(pickPortalFotoPath(dadosWebhook, slot));
          const busy = busySlot === slot;
          return (
            <div key={slot} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#FF6600]" />
                  <span className="text-sm font-semibold text-foreground">Foto {slot}</span>
                </div>
                <span className="text-xs text-muted-foreground">{hasPhoto ? "Enviada" : "Vazia"}</span>
              </div>
              <div className="mb-3 flex min-h-[140px] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
                {preview ? (
                  <img src={preview} alt="" className="max-h-40 w-full object-contain" />
                ) : (
                  <p className="px-4 text-center text-xs text-muted-foreground">Nenhuma foto neste espaço.</p>
                )}
              </div>
              <input
                ref={(el) => {
                  fileRefs.current[slot] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void onPickFile(slot, f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileRefs.current[slot]?.click()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {hasPhoto ? "Substituir" : "Enviar"}
                </Button>
                {hasPhoto ? (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void onRemove(slot)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
