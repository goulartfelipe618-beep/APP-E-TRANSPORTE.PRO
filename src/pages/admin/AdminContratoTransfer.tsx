import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type PlanContractConfig = {
  titulo: string;
  versao: string;
  conteudo: string;
  ativo: boolean;
  vigencia_inicio: string | null;
};

const DEFAULT_CONTEUDO = `1. OBJETO
1.1. Este contrato define as condições de uso dos planos FREE, STANDART e PRÓ da plataforma E-Transporte.pro.
1.2. O plano contratado determina os módulos, limites operacionais, automações, integrações e recursos comerciais disponíveis no painel do usuário.

2. PLANOS E ABRANGÊNCIA
2.1. O plano FREE permite utilização inicial da plataforma com limites operacionais de reservas, cadastros e geolocalização.
2.2. O plano STANDART remove os principais limites operacionais e libera contratos, campanhas e recursos comerciais essenciais.
2.3. O plano PRÓ é o plano máximo da plataforma, incluindo os recursos do STANDART, solicitações, mini painel do motorista, presença digital, domínios, e-mail business, website, automações e integrações premium.

3. ATIVAÇÃO, PAGAMENTO E ALTERAÇÃO DE PLANO
3.1. A ativação de plano pago ocorre após confirmação do pagamento pela Stripe ou confirmação administrativa.
3.2. Upgrades podem liberar recursos imediatamente após a confirmação. Downgrades ou cancelamentos podem suspender recursos premium no término ou interrupção do plano pago.

4. DADOS E RETENÇÃO
4.1. A mudança, cancelamento ou expiração de plano não apaga os dados do usuário.
4.2. Quando um recurso premium fica indisponível por plano, os dados relacionados podem permanecer visíveis em modo restrito, bloqueado ou somente leitura até nova ativação.

5. USO RESPONSÁVEL
5.1. O usuário é responsável pelos dados inseridos no painel, pelas informações enviadas a clientes e motoristas e pelo cumprimento das leis aplicáveis ao seu negócio.
5.2. É proibido usar a plataforma para envio abusivo de mensagens, conteúdo ilegal, fraude, violação de privacidade ou qualquer prática que comprometa a segurança da plataforma.

6. SUPORTE E DISPONIBILIDADE
6.1. A plataforma emprega esforços razoáveis para manter a disponibilidade dos serviços, podendo realizar manutenções, melhorias e atualizações.
6.2. Integrações externas, como Stripe, provedores de e-mail, WhatsApp, domínios, mapas e automações, dependem também da disponibilidade e regras dos respetivos fornecedores.

7. ACEITE
7.1. Ao utilizar, assinar ou solicitar ativação de plano, o usuário declara ciência das condições deste contrato e dos limites do plano atualmente ativo em sua conta.`;

const DEFAULT_CONTRACT: PlanContractConfig = {
  titulo: "Contrato de Assinatura dos Planos E-Transporte.pro",
  versao: "1.0",
  conteudo: DEFAULT_CONTEUDO,
  ativo: true,
  vigencia_inicio: new Date().toISOString().slice(0, 10),
};

export default function AdminContratoTransfer() {
  const [form, setForm] = useState<PlanContractConfig>(DEFAULT_CONTRACT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("planos_contrato_config")
        .select("titulo, versao, conteudo, ativo, vigencia_inicio")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        toast.error("Não foi possível carregar o contrato dos planos.");
        return;
      }

      const row = data as PlanContractConfig | null;
      if (row) {
        setForm({
          titulo: row.titulo || DEFAULT_CONTRACT.titulo,
          versao: row.versao || DEFAULT_CONTRACT.versao,
          conteudo: row.conteudo || DEFAULT_CONTRACT.conteudo,
          ativo: row.ativo !== false,
          vigencia_inicio: row.vigencia_inicio || DEFAULT_CONTRACT.vigencia_inicio,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchForm = (patch: Partial<PlanContractConfig>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const validate = () => {
    const titulo = form.titulo.trim();
    const versao = form.versao.trim();
    const conteudo = form.conteudo.trim();
    if (titulo.length < 3 || titulo.length > 180) return "Título deve ter entre 3 e 180 caracteres.";
    if (versao.length < 1 || versao.length > 40) return "Versão deve ter entre 1 e 40 caracteres.";
    if (conteudo.length < 20 || conteudo.length > 30000) return "Contrato deve ter entre 20 e 30.000 caracteres.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("planos_contrato_config").upsert(
        {
          id: 1,
          titulo: form.titulo.trim(),
          versao: form.versao.trim(),
          conteudo: form.conteudo.trim(),
          ativo: form.ativo,
          vigencia_inicio: form.vigencia_inicio || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return;
      }

      toast.success("Contrato dos planos atualizado.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FileText className="h-6 w-6 text-primary" />
            Contrato dos Planos
          </h1>
          <p className="mt-1 text-muted-foreground">
            Edite o contrato que aparece na página <strong>Planos</strong> do painel dos usuários.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={loading || saving} className="shrink-0 bg-[#FF6600] text-white hover:bg-[#e65c00]">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar contrato
        </Button>
      </div>

      <Card className="border-[#FF6600]/25 bg-[#1a1208]/40">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6600]" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Segurança e isolamento</p>
            <p>
              Este contrato é global e não contém dados pessoais. Usuários autenticados apenas leem o contrato ativo;
              somente o <strong>admin_master</strong> consegue inserir ou editar, por RLS.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          A carregar contrato…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Editor</CardTitle>
              <CardDescription>As alterações salvas aparecem para os usuários na página Planos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem_12rem]">
                <div className="space-y-2">
                  <Label htmlFor="planos-contrato-titulo">Título</Label>
                  <Input
                    id="planos-contrato-titulo"
                    value={form.titulo}
                    maxLength={180}
                    onChange={(e) => patchForm({ titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planos-contrato-versao">Versão</Label>
                  <Input
                    id="planos-contrato-versao"
                    value={form.versao}
                    maxLength={40}
                    onChange={(e) => patchForm({ versao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planos-contrato-vigencia">Vigência</Label>
                  <Input
                    id="planos-contrato-vigencia"
                    type="date"
                    value={form.vigencia_inicio ?? ""}
                    onChange={(e) => patchForm({ vigencia_inicio: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="planos-contrato-ativo" className="text-foreground">
                    Publicar contrato no painel dos usuários
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se desligar, usuários deixam de ler a linha ativa e verão o texto padrão de indisponibilidade.
                  </p>
                </div>
                <Switch
                  id="planos-contrato-ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => patchForm({ ativo: Boolean(v) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="planos-contrato-conteudo">Texto do contrato</Label>
                <Textarea
                  id="planos-contrato-conteudo"
                  value={form.conteudo}
                  onChange={(e) => patchForm({ conteudo: e.target.value })}
                  className="min-h-[520px] resize-y font-mono text-sm"
                  maxLength={30000}
                />
                <p className="text-right text-xs text-muted-foreground">{form.conteudo.length}/30000 caracteres</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>Como o contrato será lido no painel do usuário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="font-semibold text-foreground">{form.titulo || "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  Versão {form.versao || "—"} · Vigência: {form.vigencia_inicio || "A definir"} ·{" "}
                  {form.ativo ? "Publicado" : "Rascunho/inativo"}
                </p>
              </div>
              <div className="max-h-[620px] overflow-y-auto rounded-xl border border-border bg-background p-4">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                  {form.conteudo || "Nenhum conteúdo preenchido."}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
