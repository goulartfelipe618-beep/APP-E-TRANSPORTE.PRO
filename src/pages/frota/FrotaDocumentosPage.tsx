import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  signMotoristaFrotaDocUrls,
  hasMotoristaDocAttachment,
  type MotoristaFrotaDocSlug,
  type MotoristaFrotaDocUrlBundle,
} from "@/lib/motoristaFrotaStorage";

export default function FrotaDocumentosPage() {
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [dadosWebhook, setDadosWebhook] = useState<Json | null>(null);
  const [docBundle, setDocBundle] = useState<MotoristaFrotaDocUrlBundle>({ share: {}, preview: {} });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("solicitacoes_motoristas")
          .select("nome, dados_webhook")
          .eq("portal_auth_user_id", uid)
          .maybeSingle();

        if (error || !data) {
          if (!cancelled) {
            toast.error("Não foi possível carregar os documentos.");
            setNome("");
            setDadosWebhook(null);
            setDocBundle({ share: {}, preview: {} });
          }
          return;
        }
        if (!cancelled) {
          setNome(data.nome || "");
          setDadosWebhook((data.dados_webhook as Json) ?? null);
        }
        const urls = await signMotoristaFrotaDocUrls(supabase, data.dados_webhook, 3600);
        if (!cancelled) setDocBundle(urls);
      } catch {
        if (!cancelled) toast.error("Erro ao carregar documentos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: { slug: MotoristaFrotaDocSlug; title: string }[] = [
    { slug: "perfil", title: "Foto de perfil" },
    { slug: "cnhFrente", title: "CNH — frente" },
    { slug: "cnhVerso", title: "CNH — verso" },
    { slug: "residencia", title: "Comprovante de residência" },
  ];

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
        <h1 className="text-xl font-bold text-foreground">Documentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ficheiros enviados pela frota no seu cadastro{nome ? ` — ${nome}` : ""}. Só a sua conta de motorista vê estes anexos.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" />
        <p>
          Os links de pré-visualização expiram ao fim de uma hora por segurança. Recarregue esta página para gerar novos links quando necessário.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ slug, title }) => {
          const previewUrl = docBundle.preview[slug];
          const shareUrl = docBundle.share[slug];
          const ok = hasMotoristaDocAttachment(dadosWebhook, slug);
          return (
            <div key={slug} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#FF6600]" />
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    ok
                      ? "border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : ""
                  }
                >
                  {ok ? "Anexada" : "Pendente"}
                </Badge>
              </div>
              {previewUrl ? (
                <>
                  <a
                    href={shareUrl || previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border bg-muted/20"
                  >
                    <img src={previewUrl} alt="" className="max-h-48 w-full object-contain" />
                  </a>
                  <a
                    href={shareUrl || previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-[#FF6600] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir em novo separador
                  </a>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{ok ? "Pré-visualização indisponível." : "Ainda não foi anexado neste cadastro."}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
