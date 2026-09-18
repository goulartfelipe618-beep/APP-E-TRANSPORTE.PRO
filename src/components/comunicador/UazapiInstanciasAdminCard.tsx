import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeApiKey } from "@/lib/evolutionApi";
import { Loader2, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_UAZAPI_URL = "https://ipazua.uazapi.com";
const TABLE = "comunicador_uazapi_instancias";

type InstanciaRow = {
  id: string;
  rotulo: string;
  api_url: string;
  instance_token: string;
  instance_name: string | null;
  assigned_user_id: string | null;
};

type MotoristaOpt = { id: string; label: string };

function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

async function loadMotoristas(): Promise<MotoristaOpt[]> {
  const rolesWanted = ["admin_transfer", "motorista_executivo"] as const;
  const { data: roles, error } = await supabase.from("user_roles").select("user_id, role").in("role", [...rolesWanted]);
  if (error) throw error;
  const ids = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))] as string[];
  if (ids.length === 0) return [];

  const labels = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 120) {
    const part = ids.slice(i, i + 120);
    const { data: rows } = await supabase
      .from("configuracoes")
      .select("user_id, nome_completo, nome_empresa, email")
      .in("user_id", part);
    for (const row of rows || []) {
      const nome = String((row as { nome_completo?: string }).nome_completo || "").trim();
      const emp = String((row as { nome_empresa?: string }).nome_empresa || "").trim();
      const email = String((row as { email?: string }).email || "").trim();
      const uid = String((row as { user_id: string }).user_id);
      labels.set(uid, [nome || email || uid.slice(0, 8), emp].filter(Boolean).join(" · "));
    }
  }
  return ids
    .map((id) => ({ id, label: labels.get(id) || id.slice(0, 8) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}

export function UazapiInstanciasAdminCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<InstanciaRow[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);
  const [rotulo, setRotulo] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_UAZAPI_URL);
  const [token, setToken] = useState("");
  const [tableMissing, setTableMissing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const [inst, mots] = await Promise.all([
        supabase
          .from(TABLE)
          .select("id, rotulo, api_url, instance_token, instance_name, assigned_user_id")
          .order("created_at", { ascending: false }),
        loadMotoristas(),
      ]);
      if (inst.error) {
        const msg = (inst.error.message || "").toLowerCase();
        if (msg.includes("does not exist") || inst.error.code === "PGRST205" || inst.error.code === "42P01") {
          setTableMissing(true);
          setRows([]);
          return;
        }
        throw inst.error;
      }
      setRows((inst.data || []) as InstanciaRow[]);
      setMotoristas(mots);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar instâncias UAZAPI.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const cadastrar = async () => {
    const url = apiUrl.trim() || DEFAULT_UAZAPI_URL;
    const tok = sanitizeApiKey(token);
    if (!url.startsWith("https://")) {
      toast.error("Informe a URL HTTPS da UAZAPI.");
      return;
    }
    if (!tok) {
      toast.error("Cole o Token da Instância.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from(TABLE).insert({
        rotulo: rotulo.trim() || "Instância UAZAPI",
        api_url: url.replace(/\/+$/, ""),
        instance_token: tok,
      });
      if (error) throw error;
      setToken("");
      setRotulo("");
      toast.success("Token cadastrado. Atribua a um motorista abaixo.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar o token.");
    } finally {
      setSaving(false);
    }
  };

  const atribuir = async (instanciaId: string, userId: string | null) => {
    const { error } = await supabase
      .from(TABLE)
      .update({ assigned_user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", instanciaId);
    if (error) {
      toast.error(error.message || "Não foi possível atribuir.");
      return;
    }
    toast.success(userId ? "Instância atribuída ao motorista." : "Atribuição removida.");
    await reload();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      toast.error(error.message || "Não foi possível excluir.");
      return;
    }
    toast.success("Instância removida.");
    await reload();
  };

  const nomeDe = (userId: string | null) => {
    if (!userId) return "Ninguém";
    return motoristas.find((m) => m.id === userId)?.label || userId.slice(0, 8);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg">Instâncias UAZAPI por motorista</CardTitle>
        <CardDescription>
          Cadastre o <strong className="text-foreground">Token da Instância</strong> e atribua a um motorista. Quando
          ele clicar em conectar e escanear o QR, o WhatsApp liga nessa instância e os disparos em Comunicar usam essa
          linha.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tableMissing ? (
          <p className="text-sm text-destructive">
            Aplique a migração{" "}
            <code className="rounded bg-muted px-1 text-xs">20260918030000_comunicador_uazapi_instancias.sql</code> no
            SQL Editor do projeto lsfwmbpvithxqerfdlhy.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="uaz-rotulo">Nome da instância</Label>
                <Input
                  id="uaz-rotulo"
                  placeholder="Ex.: sacac / linha João"
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uaz-url">Server URL</Label>
                <Input
                  id="uaz-url"
                  className="font-mono text-sm"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uaz-token">Token da Instância</Label>
                <Input
                  id="uaz-token"
                  type="password"
                  autoComplete="new-password"
                  className="font-mono text-sm"
                  placeholder="UUID da instância na UAZAPI"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>
            <Button type="button" onClick={() => void cadastrar()} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Cadastrar token
            </Button>

            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando instâncias…
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum token cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">{row.rotulo}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.api_url}</p>
                      <p className="font-mono text-xs text-muted-foreground">{maskToken(row.instance_token)}</p>
                      <p className="text-xs text-muted-foreground">
                        Atribuído a: <span className="text-foreground">{nomeDe(row.assigned_user_id)}</span>
                      </p>
                    </div>
                    <div className="flex min-w-[16rem] flex-col gap-2 sm:items-end">
                      <Select
                        value={row.assigned_user_id || "__none__"}
                        onValueChange={(v) => void atribuir(row.id, v === "__none__" ? null : v)}
                      >
                        <SelectTrigger>
                          <UserPlus className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Atribuir motorista" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem motorista</SelectItem>
                          {motoristas.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void remover(row.id)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
