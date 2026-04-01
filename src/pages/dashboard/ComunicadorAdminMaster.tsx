import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { AlertTriangle, Loader2, Pencil, Save, X } from "lucide-react";

const ROW_ID = "00000000-0000-0000-0000-000000000001";

type WebhookRow = Tables<"sistema_webhooks_comunicacao">;

const URL_KEYS = [
  "transfer_solicitacao_url",
  "transfer_reserva_url",
  "grupo_solicitacao_url",
  "grupo_reserva_url",
  "motorista_intake_url",
  "motoristas_cadastrados_url",
  "geolocalizacao_url",
] as const;

type UrlKey = (typeof URL_KEYS)[number];

const FIELD_META: { key: UrlKey; title: string; hint: string }[] = [
  { key: "transfer_solicitacao_url", title: "1 — Solicitações de Transfer", hint: "Envios do painel Transfer → Solicitações (Comunicar)." },
  { key: "transfer_reserva_url", title: "2 — Reservas de Transfer", hint: "Envios do painel Transfer → Reservas (Comunicar)." },
  { key: "grupo_solicitacao_url", title: "3 — Solicitações de Grupos", hint: "Grupos → Solicitações." },
  { key: "grupo_reserva_url", title: "4 — Reservas de Grupos", hint: "Grupos → Reservas." },
  { key: "motorista_intake_url", title: "5 — Solicitações para se tornar motorista", hint: "Motoristas → Solicitações." },
  { key: "motoristas_cadastrados_url", title: "6 — Motoristas já cadastrados", hint: "Reservado para quando o fluxo de comunicação desta lista estiver ativo." },
  { key: "geolocalizacao_url", title: "7 — Link de rastreamento de geolocalização", hint: "Criação de link em Transfer → Geolocalização." },
];

/** PostgREST 404 / PGRST205 quando a tabela ainda não existe no projeto (migração não aplicada). */
function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function emptyDraft(): Record<UrlKey, string> {
  return {
    transfer_solicitacao_url: "",
    transfer_reserva_url: "",
    grupo_solicitacao_url: "",
    grupo_reserva_url: "",
    motorista_intake_url: "",
    motoristas_cadastrados_url: "",
    geolocalizacao_url: "",
  };
}

export default function ComunicadorAdminMasterPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"missing_table" | "other" | null>(null);
  const [savingKey, setSavingKey] = useState<UrlKey | null>(null);
  const [server, setServer] = useState<Record<UrlKey, string>>(emptyDraft);
  const [draft, setDraft] = useState<Record<UrlKey, string>>(emptyDraft);
  const [editing, setEditing] = useState<Record<UrlKey, boolean>>(() =>
    Object.fromEntries(URL_KEYS.map((k) => [k, false])) as Record<UrlKey, boolean>,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("sistema_webhooks_comunicacao")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        setLoadError("missing_table");
        toast.error("Tabela de webhooks ainda não existe no banco. Aplique a migração no Supabase.");
      } else {
        setLoadError("other");
        toast.error(error.message || "Erro ao carregar webhooks.");
      }
      setLoading(false);
      return;
    }

    const row = data as WebhookRow | null;
    const next = emptyDraft();
    if (row) {
      for (const k of URL_KEYS) {
        next[k] = (row[k] as string | null)?.trim() || "";
      }
    }
    setServer(next);
    setDraft(next);
    setEditing(Object.fromEntries(URL_KEYS.map((k) => [k, false])) as Record<UrlKey, boolean>);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isLocked = (k: UrlKey) => Boolean(server[k]?.trim()) && !editing[k];

  const startEdit = (k: UrlKey) => {
    setEditing((prev) => ({ ...prev, [k]: true }));
  };

  const cancelEdit = (k: UrlKey) => {
    setDraft((d) => ({ ...d, [k]: server[k] ?? "" }));
    setEditing((prev) => ({ ...prev, [k]: false }));
  };

  const saveField = async (k: UrlKey) => {
    const url = draft[k]?.trim() || "";
    if (url && !url.startsWith("https://")) {
      toast.error("Use uma URL HTTPS válida.");
      return;
    }

    setSavingKey(k);
    const { error } = await supabase
      .from("sistema_webhooks_comunicacao")
      .update({ [k]: url || null, updated_at: new Date().toISOString() })
      .eq("id", ROW_ID);

    setSavingKey(null);

    if (error) {
      toast.error(error.message || "Erro ao salvar.");
      return;
    }

    setServer((s) => ({ ...s, [k]: url }));
    setEditing((prev) => ({ ...prev, [k]: false }));
    toast.success(url ? "Webhook salvo e bloqueado para edição." : "Campo limpo. Você pode preencher novamente.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Defina o destino (webhook HTTPS) de cada tipo de envio dos motoristas executivos. Após salvar uma URL, o campo
          fica destacado e bloqueado até você clicar em Editar.
        </p>
      </div>

      {loadError === "missing_table" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Banco de dados desatualizado</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              A tabela <code className="rounded bg-muted px-1 py-0.5 text-xs">sistema_webhooks_comunicacao</code> não
              foi encontrada (o navegador pode mostrar erro 404 na API do Supabase). Isso normalmente significa que a
              migração ainda não foi aplicada no projeto.
            </p>
            <p className="font-medium text-foreground">O que fazer:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>
                No projeto local, execute: <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase db push</code>{" "}
                (ou aplique o SQL manualmente no painel Supabase → SQL).
              </li>
              <li>
                Arquivo da migração:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  supabase/migrations/20260410120000_sistema_webhooks_comunicacao.sql
                </code>
              </li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {loadError === "other" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar os webhooks</AlertTitle>
          <AlertDescription>
            Verifique se você está logado como administrador master e se as políticas RLS permitem leitura desta
            tabela.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Webhooks globais</CardTitle>
          <CardDescription>
            Todos os fluxos &quot;Comunicar&quot; e o link de geolocalização enviam dados apenas para estes endereços —
            o sistema não abre WhatsApp nem outros apps externos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : loadError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">Depois de aplicar a migração, tente novamente.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            FIELD_META.map(({ key, title, hint }) => (
              <div key={key} className="space-y-2">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <Label htmlFor={key} className="text-base font-medium text-foreground">
                    {title}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">{hint}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Input
                    id={key}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://…"
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    readOnly={isLocked(key)}
                    className={
                      isLocked(key)
                        ? "bg-muted/80 text-foreground border-muted-foreground/25 font-mono text-sm"
                        : "font-mono text-sm"
                    }
                  />
                  <div className="flex shrink-0 gap-2">
                    {isLocked(key) ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(key)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveField(key)}
                          disabled={savingKey === key}
                        >
                          {savingKey === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" /> Salvar
                            </>
                          )}
                        </Button>
                        {server[key]?.trim() ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => cancelEdit(key)}>
                            <X className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
