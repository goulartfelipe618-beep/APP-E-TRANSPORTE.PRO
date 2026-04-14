import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mergeLoginPainelConfig, type LoginPainelConfig } from "@/lib/loginPainelConfig";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Portugues (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Espanol" },
];

export default function LoginConfiguracoesSection() {
  const [form, setForm] = useState<LoginPainelConfig>(() => mergeLoginPainelConfig(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("login_painel_config").select("*").eq("id", 1).maybeSingle();
      if (error) {
        toast.error("Nao foi possivel carregar as configuracoes da tela de login.");
        setLoading(false);
        return;
      }
      setForm(mergeLoginPainelConfig(data as Partial<LoginPainelConfig>));
      setLoading(false);
    })();
  }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    let ext = "jpg";
    try {
      const { mime } = await assertUploadMagicBytes(file, "raster-image", 6 * 1024 * 1024);
      ext = extensionForDetectedMime(mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ficheiro inválido");
      return null;
    }
    const path = `login/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("login-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(`Erro no upload da imagem: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("login-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (!url) return;
    setForm((f) => ({ ...f, imagem_lateral_url: url }));
    toast.success("Imagem enviada. Clique em Salvar para publicar.");
  };

  const handleSave = async () => {
    if (form.seguranca_itens.filter((v) => v.trim()).length === 0) {
      toast.error("Informe ao menos um item de seguranca.");
      return;
    }
    setSaving(true);
    const payload = {
      id: 1,
      ...form,
      seguranca_itens: form.seguranca_itens.filter((v) => v.trim().length > 0),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("login_painel_config").upsert(payload);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar configuracoes da tela de login: ${error.message}`);
      return;
    }
    setEditing(false);
    toast.success("Configuracoes de login salvas com sucesso.");
  };

  return (
    <Card className="p-6 max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Configuracoes de login</h3>
          <p className="text-sm text-muted-foreground">
            Ajuste imagem lateral, titulos, legendas, placeholders e itens exibidos na tela de login.
          </p>
        </div>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className={`space-y-4 ${!editing ? "opacity-70 pointer-events-none" : ""}`}>
          <div className="space-y-2">
            <Label>Imagem lateral (coluna esquerda)</Label>
            <div className="overflow-hidden border bg-muted">
              <img src={form.imagem_lateral_url} alt="" className="h-40 w-full object-cover" />
            </div>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
            <Button type="button" variant="outline" onClick={() => imageRef.current?.click()} disabled={uploading || !editing}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando..." : "Enviar imagem"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-painel-titulo">Titulo principal</Label>
              <Input
                id="login-painel-titulo"
                value={form.painel_titulo}
                onChange={(e) => setForm((f) => ({ ...f, painel_titulo: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-painel-subtitulo">Subtitulo</Label>
              <Input
                id="login-painel-subtitulo"
                value={form.painel_subtitulo}
                onChange={(e) => setForm((f) => ({ ...f, painel_subtitulo: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-form-titulo">Titulo do formulario</Label>
              <Input
                id="login-form-titulo"
                value={form.form_titulo}
                onChange={(e) => setForm((f) => ({ ...f, form_titulo: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-form-legenda">Legenda do formulario</Label>
              <Input
                id="login-form-legenda"
                value={form.form_legenda}
                onChange={(e) => setForm((f) => ({ ...f, form_legenda: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-ph-user">Placeholder usuario</Label>
              <Input
                id="login-ph-user"
                value={form.placeholder_usuario}
                onChange={(e) => setForm((f) => ({ ...f, placeholder_usuario: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-ph-pass">Placeholder senha</Label>
              <Input
                id="login-ph-pass"
                value={form.placeholder_senha}
                onChange={(e) => setForm((f) => ({ ...f, placeholder_senha: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-ph-captcha">Placeholder captcha</Label>
              <Input
                id="login-ph-captcha"
                value={form.placeholder_captcha}
                onChange={(e) => setForm((f) => ({ ...f, placeholder_captcha: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-login-btn">Texto do botao login</Label>
              <Input
                id="login-login-btn"
                value={form.texto_botao_login}
                onChange={(e) => setForm((f) => ({ ...f, texto_botao_login: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-help-btn">Texto botao ajuda</Label>
              <Input
                id="login-help-btn"
                value={form.texto_botao_ajuda}
                onChange={(e) => setForm((f) => ({ ...f, texto_botao_ajuda: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-forgot">Texto esqueci senha</Label>
              <Input
                id="login-forgot"
                value={form.texto_esqueci_senha}
                onChange={(e) => setForm((f) => ({ ...f, texto_esqueci_senha: e.target.value }))}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-sec-title">Titulo bloco seguranca</Label>
            <Input
              id="login-sec-title"
              value={form.seguranca_titulo}
              onChange={(e) => setForm((f) => ({ ...f, seguranca_titulo: e.target.value }))}
              disabled={!editing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-sec-items">Itens de seguranca (1 por linha)</Label>
            <Textarea
              id="login-sec-items"
              rows={4}
              value={form.seguranca_itens.join("\n")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  seguranca_itens: e.target.value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter((v) => v.length > 0),
                }))
              }
              disabled={!editing}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login-footer">Rodape</Label>
              <Input
                id="login-footer"
                value={form.rodape_texto}
                onChange={(e) => setForm((f) => ({ ...f, rodape_texto: e.target.value }))}
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-lang">Idioma padrao</Label>
              <select
                id="login-lang"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.idioma_padrao}
                onChange={(e) => setForm((f) => ({ ...f, idioma_padrao: e.target.value }))}
                disabled={!editing}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editing && (
            <Button type="button" onClick={() => void handleSave()} disabled={saving || uploading}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar configuracoes de login"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
