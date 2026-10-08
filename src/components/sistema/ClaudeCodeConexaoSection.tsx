import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Conexao = {
  id: string;
  nome: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type TokenCriado = {
  id: string;
  token: string;
  token_prefix: string;
  nome: string;
};

function mcpUrl(): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/functions/v1/claude-code-mcp`;
}

function snippet(token: string): string {
  const url = mcpUrl();
  return `{
  "mcpServers": {
    "e-transporte": {
      "type": "http",
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`;
}

function formatWhen(value: string | null): string {
  if (!value) return "ainda não usada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export default function ClaudeCodeConexaoSection() {
  const [nome, setNome] = useState("Claude Code");
  const [lista, setLista] = useState<Conexao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [criado, setCriado] = useState<TokenCriado | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("listar_tokens_claude_code");
    if (error) {
      toast.error("Não foi possível carregar as conexões do Claude Code.");
      setLista([]);
    } else {
      setLista(Array.isArray(data) ? (data as Conexao[]) : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("criar_token_claude_code", {
      p_nome: nome.trim() || "Claude Code",
    });
    setBusy(false);
    if (error || !data || typeof data !== "object") {
      const msg = error?.message ?? "";
      toast.error(msg.includes("limite") ? "Já existem 5 conexões ativas. Revogue uma antes de criar outra." : "Não foi possível criar a chave.");
      return;
    }
    setCriado(data as TokenCriado);
    setNome("Claude Code");
    await carregar();
  };

  const revogar = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("revogar_token_claude_code", { p_id: id });
    setBusy(false);
    if (error || data !== true) {
      toast.error("Não foi possível revogar esta conexão.");
      return;
    }
    toast.success("Conexão revogada. O Claude Code deixa de entrar com esta chave.");
    if (criado?.id === id) setCriado(null);
    await carregar();
  };

  const copiar = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const ativas = lista.filter((item) => !item.revoked_at);

  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-foreground" />
        <h3 className="font-semibold text-foreground">Claude Code</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Liga o Claude Code a esta conta. Ele passa a ver e atualizar só a sua operação: reservas, frota, motoristas,
        clientes e o resumo financeiro. Não vê as outras empresas do sistema.
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={nome}
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da conexão"
          aria-label="Nome da conexão Claude Code"
        />
        <Button type="button" onClick={() => void criar()} disabled={busy || ativas.length >= 5}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Gerar chave
        </Button>
      </div>

      {criado ? (
        <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Copie agora. Esta chave não volta a aparecer.</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 text-xs text-foreground">
            {snippet(criado.token)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copiar(snippet(criado.token), "Configuração copiada.")}>
              <Copy className="mr-2 h-4 w-4" /> Copiar configuração
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copiar(criado.token, "Chave copiada.")}>
              <Copy className="mr-2 h-4 w-4" /> Copiar só a chave
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No Claude Code, cole isto no ficheiro <span className="font-medium text-foreground">.mcp.json</span> do projeto
            ou das definições do utilizador. O endereço é {mcpUrl()}.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar conexões…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conexão criada.</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{item.nome}</span>
                  <Badge variant={item.revoked_at ? "secondary" : "outline"}>{item.revoked_at ? "Revogada" : "Ativa"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.token_prefix}… · criada {formatWhen(item.created_at)} · {item.revoked_at ? `revogada ${formatWhen(item.revoked_at)}` : `último uso ${formatWhen(item.last_used_at)}`}
                </p>
              </div>
              {!item.revoked_at ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revogar(item.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Revogar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
