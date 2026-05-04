import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { uploadCadastroClienteDocs } from "@/lib/cadastroClienteStorage";

export type ClienteTipo = "pf" | "pj";

export type ClienteEnderecoLinha = { rotulo: string; endereco: string };

export type CadastroClienteRow = {
  id: string;
  user_id: string;
  tipo: ClienteTipo;
  nome_exibicao: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  enderecos: Json;
  documentos: Json;
  created_at: string;
  updated_at: string;
};

function parseEnderecos(raw: Json): ClienteEnderecoLinha[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const rotulo = String(o.rotulo ?? "").trim();
      const endereco = String(o.endereco ?? "").trim();
      if (!rotulo && !endereco) return null;
      return { rotulo, endereco };
    })
    .filter(Boolean) as ClienteEnderecoLinha[];
}

function parseDocumentos(raw: Json): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  editRow?: CadastroClienteRow | null;
}

export default function CadastrarClienteDialog({ open, onOpenChange, onSaved, editRow = null }: Props) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<ClienteTipo>("pf");
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [tel1, setTel1] = useState("");
  const [tel2, setTel2] = useState("");
  const [enderecos, setEnderecos] = useState<ClienteEnderecoLinha[]>([{ rotulo: "", endereco: "" }]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setTipo(editRow.tipo === "pj" ? "pj" : "pf");
      setNome(editRow.nome_exibicao || "");
      setCpfCnpj(editRow.cpf_cnpj || "");
      setEmail(editRow.email || "");
      setTel1(editRow.telefone_1 || "");
      setTel2(editRow.telefone_2 || "");
      const lines = parseEnderecos(editRow.enderecos);
      setEnderecos(lines.length ? lines : [{ rotulo: "", endereco: "" }]);
      setPendingFiles([]);
      return;
    }
    setTipo("pf");
    setNome("");
    setCpfCnpj("");
    setEmail("");
    setTel1("");
    setTel2("");
    setEnderecos([{ rotulo: "", endereco: "" }]);
    setPendingFiles([]);
  }, [open, editRow]);

  const addEndereco = () => setEnderecos((prev) => [...prev, { rotulo: "", endereco: "" }]);
  const removeEndereco = (i: number) => setEnderecos((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      toast.error(tipo === "pj" ? "Informe a razão social ou nome fantasia." : "Informe o nome completo.");
      return;
    }
    const endOk = enderecos
      .map((l) => ({ rotulo: l.rotulo.trim(), endereco: l.endereco.trim() }))
      .filter((l) => l.rotulo || l.endereco);
    for (const l of endOk) {
      if (!l.rotulo || !l.endereco) {
        toast.error('Em cada endereço, preencha o tipo (ex.: casa) e o texto do endereço, ou apague a linha vazia.');
        return;
      }
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        tipo,
        nome_exibicao: nomeTrim,
        cpf_cnpj: cpfCnpj.trim() || null,
        email: email.trim() || null,
        telefone_1: tel1.trim() || null,
        telefone_2: tel2.trim() || null,
        enderecos: endOk as unknown as Json,
        documentos: (editRow ? parseDocumentos(editRow.documentos) : {}) as unknown as Json,
      };

      if (editRow?.id) {
        const { error: upErr } = await supabase.from("cadastro_clientes").update(basePayload).eq("id", editRow.id);
        if (upErr) throw new Error(upErr.message);
        let mergedDocs = parseDocumentos(editRow.documentos);
        if (pendingFiles.length > 0) {
          const uploaded = await uploadCadastroClienteDocs(
            supabase,
            user.id,
            editRow.id,
            pendingFiles.map((f, i) => ({ slug: `doc_${Date.now()}_${i}`, file: f })),
          );
          mergedDocs = { ...mergedDocs, ...uploaded };
          const { error: docErr } = await supabase
            .from("cadastro_clientes")
            .update({ documentos: mergedDocs as unknown as Json })
            .eq("id", editRow.id);
          if (docErr) toast.warning(`Cliente guardado; anexos: ${docErr.message}`);
        }
        toast.success("Cliente atualizado.");
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("cadastro_clientes")
          .insert({ user_id: user.id, ...basePayload })
          .select("id")
          .single();
        if (insErr || !inserted?.id) throw new Error(insErr?.message || "Erro ao criar cliente.");
        const newId = inserted.id as string;
        if (pendingFiles.length > 0) {
          const uploaded = await uploadCadastroClienteDocs(
            supabase,
            user.id,
            newId,
            pendingFiles.map((f, i) => ({ slug: `doc_${Date.now()}_${i}`, file: f })),
          );
          const { error: docErr } = await supabase
            .from("cadastro_clientes")
            .update({ documentos: uploaded as unknown as Json })
            .eq("id", newId);
          if (docErr) toast.warning(`Cliente criado; anexos: ${docErr.message}`);
        }
        toast.success("Cliente cadastrado.");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle>{editRow ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle>
          <p className="text-left text-sm text-muted-foreground">
            Dados visíveis apenas para a sua conta. Documentos são opcionais e ficam no seu espaço seguro.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as ClienteTipo)}
              className="flex flex-wrap gap-4"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pf" id="pf" />
                Pessoa física
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="pj" id="pj" />
                Pessoa jurídica
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === "pj" ? "Razão social / nome da empresa *" : "Nome completo *"}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder={tipo === "pj" ? "Empresa Lda." : "Nome e apelidos"} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>CPF / CNPJ (opcional)</Label>
              <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone 1</Label>
              <Input value={tel1} onChange={(e) => setTel1(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone 2</Label>
              <Input value={tel2} onChange={(e) => setTel2(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Endereços</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEndereco}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Linha
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Primeiro o tipo (ex.: casa, trabalho, escola), depois o endereço. Linhas vazias são ignoradas.
            </p>
            {enderecos.map((linha, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full space-y-1 sm:max-w-[140px]">
                  <Label className="text-xs">Tipo</Label>
                  <Input
                    placeholder="casa…"
                    value={linha.rotulo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnderecos((prev) => prev.map((p, j) => (j === i ? { ...p, rotulo: v } : p)));
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    placeholder="Rua, número, cidade…"
                    value={linha.endereco}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnderecos((prev) => prev.map((p, j) => (j === i ? { ...p, endereco: v } : p)));
                    }}
                  />
                </div>
                {enderecos.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeEndereco(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Documentos (opcional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
              <Upload className="h-4 w-4 shrink-0 text-[#FF6600]" />
              <span>Escolher ficheiros</span>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
              />
            </label>
            {pendingFiles.length > 0 ? (
              <ul className="text-xs text-muted-foreground">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`}>{f.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#FF6600] text-white hover:bg-[#e65c00]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editRow ? "Guardar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
