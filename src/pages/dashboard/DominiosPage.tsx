import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Info, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

type DominioRow = Tables<"dominios_usuario">;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  ativo: "Ativo",
  em_configuracao: "Em configuração",
  cancelado: "Cancelado",
};

const CUSTO_AVISO =
  "A criação e adição de novos domínios possui um custo de R$ 60,00 e não garante automaticamente a criação de um novo site.";

/** 12 opções; registro.br em primeiro lugar. */
const PLATAFORMAS_REGISTRO = [
  "registro.br",
  "GoDaddy",
  "Hostinger",
  "Locaweb",
  "Cloudflare",
  "Namecheap",
  "HostGator",
  "Bluehost",
  "UOL Host",
  "KingHost",
  "Google Domains / Squarespace",
  "Outro",
] as const;

type DialogMode = "closed" | "choose" | "existente" | "novo";

const CONFIRM_LOCK_SECONDS = 10;

function normalizeFqdn(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function sanitizeComBrLabel(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

async function checkDomainAvailability(fqdn: string): Promise<{ available: boolean | null; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("check-domain", {
      body: { domain: fqdn.trim() },
    });
    if (error) {
      return { available: null, message: error.message || "Erro ao verificar domínio." };
    }
    const message = typeof data?.message === "string" ? data.message : "";
    if (data?.available === true) return { available: true, message };
    if (data?.available === false) return { available: false, message };
    return { available: null, message: message || "Não foi possível confirmar a disponibilidade." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na verificação.";
    return { available: null, message: msg };
  }
}

export default function DominiosPage() {
  const [rows, setRows] = useState<DominioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>("closed");
  const [saving, setSaving] = useState(false);

  const [plataformaDraft, setPlataformaDraft] = useState("");
  const [fqdnExistenteDraft, setFqdnExistenteDraft] = useState("");

  const [comBrLabelDraft, setComBrLabelDraft] = useState("");
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainCheckMessage, setDomainCheckMessage] = useState("");
  const [checkingDomain, setCheckingDomain] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmNovoOpen, setConfirmNovoOpen] = useState(false);
  const [confirmLockRemaining, setConfirmLockRemaining] = useState(0);

  const fqdnNovoPreview =
    sanitizeComBrLabel(comBrLabelDraft).length > 0 ? `${sanitizeComBrLabel(comBrLabelDraft)}.com.br` : "";

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("dominios_usuario")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar os domínios.", { description: error.message });
      setRows([]);
    } else {
      setRows((data as DominioRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (dialogMode !== "novo") {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setDomainAvailable(null);
      setDomainCheckMessage("");
      setCheckingDomain(false);
      return;
    }

    const label = sanitizeComBrLabel(comBrLabelDraft);
    if (!label.length) {
      setDomainAvailable(null);
      setDomainCheckMessage("");
      setCheckingDomain(false);
      return;
    }

    const fqdn = `${label}.com.br`;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCheckingDomain(true);
    setDomainAvailable(null);
    setDomainCheckMessage("");

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const { available, message } = await checkDomainAvailability(fqdn);
        setCheckingDomain(false);
        setDomainAvailable(available);
        setDomainCheckMessage(message || "");
      })();
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [comBrLabelDraft, dialogMode]);

  useEffect(() => {
    if (!confirmNovoOpen) {
      setConfirmLockRemaining(0);
      return;
    }
    setConfirmLockRemaining(CONFIRM_LOCK_SECONDS);
    const id = window.setInterval(() => {
      setConfirmLockRemaining((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [confirmNovoOpen]);

  const resetDialogFields = () => {
    setPlataformaDraft("");
    setFqdnExistenteDraft("");
    setComBrLabelDraft("");
    setDomainAvailable(null);
    setDomainCheckMessage("");
    setCheckingDomain(false);
  };

  const openDialog = () => {
    resetDialogFields();
    setDialogMode("choose");
  };

  const closeDialog = () => {
    setDialogMode("closed");
    resetDialogFields();
  };

  const handleSaveExistente = async () => {
    const fqdn = normalizeFqdn(fqdnExistenteDraft);
    if (!plataformaDraft) {
      toast.error("Selecione a plataforma onde o domínio foi registrado.");
      return;
    }
    if (!fqdn || !fqdn.includes(".")) {
      toast.error("Informe um domínio válido (ex.: suaempresa.com.br).");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("dominios_usuario").insert({
      user_id: user.id,
      fqdn,
      status: "pendente",
      tipo_origem: "ja_registrado",
      plataforma_registro: plataformaDraft,
      observacoes: null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Este domínio já está na sua lista.");
      } else {
        toast.error("Erro ao registrar: " + error.message);
      }
      return;
    }
    toast.success("Domínio adicionado. A equipe poderá dar sequência à configuração.");
    closeDialog();
    void load();
  };

  const insertNovoComBr = async () => {
    const label = sanitizeComBrLabel(comBrLabelDraft);
    const fqdn = `${label}.com.br`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("dominios_usuario").insert({
      user_id: user.id,
      fqdn,
      status: "pendente",
      tipo_origem: "novo_com_br",
      plataforma_registro: null,
      observacoes: null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Este domínio já está na sua lista.");
      } else {
        toast.error("Erro ao registrar: " + error.message);
      }
      return;
    }
    toast.success("Solicitação de registro .com.br enviada. A equipe entrará em contato.");
    setConfirmNovoOpen(false);
    closeDialog();
    void load();
  };

  const handleClickSalvarNovo = async () => {
    const label = sanitizeComBrLabel(comBrLabelDraft);
    if (!label.length) {
      toast.error("Digite o nome do domínio (parte antes de .com.br).");
      return;
    }
    if (checkingDomain) {
      toast.error("Aguarde a verificação de disponibilidade.");
      return;
    }
    const fqdn = `${label}.com.br`;
    setCheckingDomain(true);
    const { available, message } = await checkDomainAvailability(fqdn);
    setCheckingDomain(false);
    setDomainAvailable(available);
    setDomainCheckMessage(message || "");

    if (available !== true) {
      toast.error(
        available === false
          ? "Este domínio já está em uso ou não está disponível para registro."
          : message || "Não foi possível confirmar a disponibilidade. Tente novamente.",
      );
      return;
    }
    setConfirmNovoOpen(true);
  };

  const handleConfirmNovoConfirmar = () => {
    if (confirmLockRemaining > 0) return;
    void insertNovoComBr();
  };

  const handleConfirmNovoEditar = () => {
    if (confirmLockRemaining > 0) return;
    setConfirmNovoOpen(false);
  };

  const handleConfirmNovoCancelar = () => {
    if (confirmLockRemaining > 0) return;
    setConfirmNovoOpen(false);
    closeDialog();
  };

  function origemLabel(r: DominioRow) {
    if (r.tipo_origem === "ja_registrado" && r.plataforma_registro) {
      return r.plataforma_registro;
    }
    if (r.tipo_origem === "novo_com_br") {
      return "Novo registro .com.br";
    }
    if (r.tipo_origem === "ja_registrado") {
      return "Já registrado";
    }
    return "—";
  }

  const podeSalvarNovo =
    sanitizeComBrLabel(comBrLabelDraft).length > 0 &&
    domainAvailable === true &&
    !checkingDomain;

  return (
    <div className="space-y-6">
      <Alert className="border-amber-500/40 bg-amber-500/10 text-foreground">
        <Info className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Aviso</AlertTitle>
        <AlertDescription className="text-amber-900/90 dark:text-amber-50/95">{CUSTO_AVISO}</AlertDescription>
      </Alert>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />
            Domínios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compre e gerencie seus domínios. Os domínios ativos aparecem na etapa &quot;Escolha seu domínio&quot; do fluxo
            Website.
          </p>
        </div>
        <Button type="button" onClick={openDialog} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Registrar um novo domínio
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum domínio cadastrado. Use &quot;Registrar um novo domínio&quot; para adicionar ou solicitar registro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio</TableHead>
                <TableHead className="hidden sm:table-cell w-44">Origem / plataforma</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-40 text-right">Registrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.fqdn}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {origemLabel(r)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "ativo" ? "default" : "secondary"}>
                      {STATUS_LABEL[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={dialogMode !== "closed"}
        onOpenChange={(o) => {
          if (!o && confirmNovoOpen) return;
          if (!o) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {dialogMode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Como deseja adicionar?</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-4 px-4 text-left justify-start whitespace-normal"
                  onClick={() => {
                    setPlataformaDraft("");
                    setFqdnExistenteDraft("");
                    setDialogMode("existente");
                  }}
                >
                  <span className="font-semibold">1. Adicionar domínio já registrado</span>
                  <span className="block text-xs text-muted-foreground font-normal mt-1">
                    Informe onde o domínio foi comprado e o endereço atual.
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-4 px-4 text-left justify-start whitespace-normal"
                  onClick={() => {
                    setComBrLabelDraft("");
                    setDialogMode("novo");
                  }}
                >
                  <span className="font-semibold">2. Registrar um novo domínio (www)</span>
                  <span className="block text-xs text-muted-foreground font-normal mt-1">
                    Solicite um novo domínio com sufixo .com.br.
                  </span>
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogMode === "existente" && (
            <>
              <DialogHeader>
                <DialogTitle>Adicionar domínio já registrado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Plataforma de registro</Label>
                  <Select value={plataformaDraft || undefined} onValueChange={setPlataformaDraft}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Onde o domínio foi comprado?" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATAFORMAS_REGISTRO.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dom-existente">Domínio existente</Label>
                  <Input
                    id="dom-existente"
                    value={fqdnExistenteDraft}
                    onChange={(e) => setFqdnExistenteDraft(e.target.value)}
                    placeholder="ex.: minhaempresa.com.br"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDialogMode("choose")}>
                  Voltar
                </Button>
                <Button type="button" onClick={() => void handleSaveExistente()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogMode === "novo" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar um novo domínio (www)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="dom-novo-label">Nome do domínio</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Edite apenas o nome antes de <span className="font-mono text-foreground">.com.br</span> (sufixo
                    fixo). A disponibilidade é verificada automaticamente.
                  </p>
                  <div className="flex flex-wrap items-stretch gap-0 rounded-md border border-input bg-background shadow-sm overflow-hidden">
                    <Input
                      id="dom-novo-label"
                      className="border-0 rounded-none shadow-none focus-visible:ring-0 min-w-[140px] flex-1"
                      placeholder="nomedodominio"
                      value={comBrLabelDraft}
                      onChange={(e) => setComBrLabelDraft(sanitizeComBrLabel(e.target.value))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="flex items-center px-3 bg-muted/60 border-l border-border text-sm font-mono text-foreground select-none shrink-0">
                      .com.br
                    </div>
                  </div>

                  {sanitizeComBrLabel(comBrLabelDraft).length > 0 && (
                    <div className="mt-3 space-y-1">
                      {checkingDomain ? (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                          Verificando disponibilidade…
                        </p>
                      ) : domainAvailable === true ? (
                        <p className="text-sm font-medium text-green-600 dark:text-green-500">
                          {domainCheckMessage || "Domínio disponível para registro."}
                        </p>
                      ) : domainAvailable === false ? (
                        <p className="text-sm font-medium text-destructive">
                          Este domínio já está em uso. Escolha outro nome.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {domainCheckMessage || "Não foi possível confirmar a disponibilidade."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDialogMode("choose")}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleClickSalvarNovo()}
                  disabled={saving || !podeSalvarNovo}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmNovoOpen}
        onOpenChange={(open) => {
          if (!open && confirmLockRemaining > 0) return;
          if (!open) setConfirmNovoOpen(false);
        }}
      >
        <AlertDialogContent
          className="z-[100]"
          onEscapeKeyDown={(e) => {
            if (confirmLockRemaining > 0) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (confirmLockRemaining > 0) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar solicitação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p className="text-sm text-foreground">
                  Após a solicitação do domínio, não será possível reverter esta ação.
                </p>
                {confirmLockRemaining > 0 ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    Aguarde {confirmLockRemaining} segundo{confirmLockRemaining !== 1 ? "s" : ""} para continuar…
                  </p>
                ) : null}
                {fqdnNovoPreview ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Domínio: </span>
                    <span className="font-mono font-semibold text-foreground">{fqdnNovoPreview}</span>
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="default"
              disabled={confirmLockRemaining > 0 || saving}
              onClick={handleConfirmNovoConfirmar}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={confirmLockRemaining > 0}
              onClick={handleConfirmNovoEditar}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={confirmLockRemaining > 0}
              onClick={handleConfirmNovoCancelar}
            >
              Cancelar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
