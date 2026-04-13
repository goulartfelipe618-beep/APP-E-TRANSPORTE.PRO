import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Car, User, Upload, Save, Key, Shield, RefreshCw, Type, Pencil, FileText, Users, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import MapboxAddressInput from "@/components/mapbox/MapboxAddressInput";
import { isMapboxConfigured } from "@/lib/mapboxGeocode";
import { persistNetworkRetornoSolicitado, persistNetworkSair } from "@/lib/networkNacionalPrefs";
import LoginConfiguracoesSection from "@/pages/dashboard/LoginConfiguracoesSection";

const FONT_OPTIONS = [
  { value: "montserrat", label: "Montserrat" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "opensans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
  { value: "poppins", label: "Poppins" },
];

const COOLDOWN_DAYS = 60;

function NetworkSection() {
  const networkAceito = localStorage.getItem("network_nacional_aceito") === "sim";
  const saida = localStorage.getItem("network_saida_data");
  const [confirmando, setConfirmando] = useState(false);

  if (!networkAceito && !saida) return null;

  let diasRestantes = 0;
  let emCooldown = false;
  if (saida) {
    const diff = Date.now() - new Date(saida).getTime();
    const diasPassados = Math.floor(diff / (1000 * 60 * 60 * 24));
    diasRestantes = Math.max(0, COOLDOWN_DAYS - diasPassados);
    emCooldown = diasRestantes > 0;
  }

  const handleSair = async () => {
    localStorage.setItem("network_nacional_aceito", "nao");
    localStorage.setItem("network_saida_data", new Date().toISOString());
    localStorage.removeItem("network_highlight_shown");
    const ok = await persistNetworkSair();
    if (!ok) toast.error("Não foi possível sincronizar com o servidor; os dados locais foram atualizados.");
    window.dispatchEvent(new Event("network-status-changed"));
    setConfirmando(false);
    toast.success("Você saiu do Network Nacional. Poderá retornar após 60 dias.");
    window.location.reload();
  };

  const handleVoltar = async () => {
    if (emCooldown) {
      toast.error(`Você só poderá retornar ao Network em ${diasRestantes} dias.`);
      return;
    }
    localStorage.removeItem("network_nacional_aceito");
    localStorage.removeItem("network_saida_data");
    localStorage.removeItem("network_highlight_shown");
    const ok = await persistNetworkRetornoSolicitado();
    if (!ok) toast.error("Não foi possível sincronizar com o servidor; os dados locais foram atualizados.");
    window.dispatchEvent(new Event("network-status-changed"));
    toast.success("Agora você pode aceitar os termos novamente na página Home.");
    window.location.reload();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-foreground" />
        <h3 className="font-semibold text-foreground">Network Nacional</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Gerencie sua participação no Network Nacional E-Transporte.pro
      </p>
      {networkAceito ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20">Ativo</Badge>
            <span className="text-sm text-muted-foreground">Você é membro do Network Nacional</span>
          </div>
          {!confirmando ? (
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setConfirmando(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" /> Sair do Network Nacional
            </Button>
          ) : (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">⚠️ Tem certeza que deseja sair?</p>
              <p className="text-xs text-muted-foreground">
                Ao sair, você perderá acesso ao menu Network e ao canal colaborativo de oportunidades entre motoristas.
                <strong className="text-foreground"> Você só poderá retornar após 60 dias corridos.</strong>
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleSair}>Confirmar Saída</Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmando(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Inativo</Badge>
            <span className="text-sm text-muted-foreground">Você não faz parte do Network</span>
          </div>
          {emCooldown ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                🕐 Você saiu do Network. Poderá solicitar retorno em <strong className="text-foreground">{diasRestantes} dias</strong>.
              </p>
            </div>
          ) : (
            <Button variant="outline" onClick={handleVoltar}>Solicitar Retorno ao Network</Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SistemaConfiguracoesPage() {
  const { config, refreshConfig } = useConfiguracoes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoContratualRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profileEditing, setProfileEditing] = useState(true);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [enderecoLat, setEnderecoLat] = useState<number | null>(null);
  const [enderecoLng, setEnderecoLng] = useState<number | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpjPerfil, setCnpjPerfil] = useState("");

  // Global
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [fonteGlobal, setFonteGlobal] = useState("montserrat");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logoEditing, setLogoEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [nomeProjetoEditing, setNomeProjetoEditing] = useState(false);
  const [fonteEditing, setFonteEditing] = useState(false);

  // Informações Contratuais
  const [contratualEditing, setContratualEditing] = useState(true);
  const [contratualSaved, setContratualSaved] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [enderecoSede, setEnderecoSede] = useState("");
  const [representanteLegal, setRepresentanteLegal] = useState("");
  const [logoContratualUrl, setLogoContratualUrl] = useState("");
  const [telefoneContratual, setTelefoneContratual] = useState("");
  const [whatsappContratual, setWhatsappContratual] = useState("");
  const [emailOficial, setEmailOficial] = useState("");
  const [uploadingLogoContratual, setUploadingLogoContratual] = useState("");

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA (TOTP)
  const [twoFaDialogOpen, setTwoFaDialogOpen] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string>("");
  const [mfaSecret, setMfaSecret] = useState<string>("");
  const [mfaVerifyCode, setMfaVerifyCode] = useState<string>("");
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [enablingMfa, setEnablingMfa] = useState(false);
  const [mfaSetupError, setMfaSetupError] = useState<string>("");
  const [isAdminMaster, setIsAdminMaster] = useState(false);

  useEffect(() => {
    loadSettings();
    loadContratual();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("is_admin_master", { _user_id: user.id });
      if (!error) setIsAdminMaster(Boolean(data));
    })();
  }, []);

  const loadContratual = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("cabecalho_contratual" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setRazaoSocial(d.razao_social || "");
      setCnpj(d.cnpj || "");
      setEnderecoSede(d.endereco_sede || "");
      setRepresentanteLegal(d.representante_legal || "");
      setLogoContratualUrl(d.logo_contratual_url || "");
      setTelefoneContratual(d.telefone || "");
      setWhatsappContratual(d.whatsapp || "");
      setEmailOficial(d.email_oficial || "");
      setContratualEditing(false);
      setContratualSaved(true);
    }
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("configuracoes" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setNomeCompleto(d.nome_completo || "");
      setTelefone(d.telefone || "");
      setEmail(d.email || "");
      setCidade(d.cidade || "");
      setEstado(d.estado || "");
      setEnderecoCompleto(d.endereco_completo || "");
      setEnderecoLat(
        d.endereco_latitude != null && !Number.isNaN(Number(d.endereco_latitude))
          ? Number(d.endereco_latitude)
          : null
      );
      setEnderecoLng(
        d.endereco_longitude != null && !Number.isNaN(Number(d.endereco_longitude))
          ? Number(d.endereco_longitude)
          : null
      );
      setNomeEmpresa(d.nome_empresa || "");
      setCnpjPerfil(d.cnpj || "");
      setNomeProjeto(d.nome_projeto || "E-Transporte.pro");
      setFonteGlobal(d.fonte_global || "montserrat");
      setLogoUrl(d.logo_url || "");
      if (d.nome_completo && d.telefone && d.email && d.cidade && d.nome_empresa && d.cnpj) {
        setProfileEditing(false);
      }
    } else {
      setNomeProjeto("E-Transporte.pro");
      setProfileEditing(true);
    }
  };

  const upsertField = async (fields: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); return false; }

    // Check if exists
    const { data: existing } = await supabase
      .from("configuracoes" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("configuracoes" as any)
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      if (error) { toast.error("Erro ao salvar"); return false; }
    } else {
      const { error } = await supabase
        .from("configuracoes" as any)
        .insert({ user_id: user.id, ...fields } as any);
      if (error) { toast.error("Erro ao salvar"); return false; }
    }
    return true;
  };

  const handleSaveProfile = async () => {
    if (!nomeCompleto.trim() || !email.trim() || !telefone.trim() || !cidade.trim() || !nomeEmpresa.trim() || !cnpjPerfil.trim()) {
      toast.error("Todos os campos do perfil são obrigatórios!");
      return;
    }
    const ok = await upsertField({
      nome_completo: nomeCompleto,
      telefone,
      email,
      cidade,
      estado,
      endereco_completo: enderecoCompleto,
      endereco_latitude: enderecoLat,
      endereco_longitude: enderecoLng,
      nome_empresa: nomeEmpresa,
      cnpj: cnpjPerfil,
    });
    if (ok) {
      toast.success("Perfil salvo");
      setProfileEditing(false);
      await refreshConfig();
      window.dispatchEvent(new Event("configuracoes-updated"));
    }
  };

  const handleSaveNomeProjeto = async () => {
    const ok = await upsertField({ nome_projeto: nomeProjeto });
    if (ok) { toast.success("Nome do projeto salvo"); setNomeProjetoEditing(false); await refreshConfig(); }
  };

  const handleSaveFonte = async () => {
    const ok = await upsertField({ fonte_global: fonteGlobal });
    if (ok) { toast.success("Fonte global salva"); setFonteEditing(false); await refreshConfig(); }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
  };

  const handleSaveLogoUpload = async () => {
    if (!logoFile) {
      toast.error("Selecione uma imagem para salvar.");
      return;
    }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setUploading(false); return; }

    const filePath = `${user.id}/logo-${Date.now()}.${logoFile.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(filePath, logoFile, { upsert: true });
    if (upErr) { toast.error("Erro no upload"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const ok = await upsertField({ logo_url: publicUrl });
    if (ok) {
      setLogoUrl(publicUrl);
      setLogoFile(null);
      setLogoEditing(false);
      toast.success("Logomarca atualizada");
      await refreshConfig();
    }
    setUploading(false);
  };

  const handleSaveContratual = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); return; }

    const payload = {
      user_id: user.id,
      nome: "Cabeçalho 1",
      razao_social: razaoSocial,
      cnpj,
      endereco_sede: enderecoSede,
      representante_legal: representanteLegal,
      logo_contratual_url: logoContratualUrl,
      telefone: telefoneContratual,
      whatsapp: whatsappContratual,
      email_oficial: emailOficial,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("cabecalho_contratual" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from("cabecalho_contratual" as any).update(payload as any).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("cabecalho_contratual" as any).insert(payload as any));
    }

    if (error) { toast.error("Erro ao salvar informações contratuais"); return; }
    toast.success("Cabeçalho 1 salvo com sucesso");
    setContratualEditing(false);
    setContratualSaved(true);
    window.dispatchEvent(new Event("configuracoes-updated"));
  };

  const handleLogoContratualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogoContratual("uploading");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setUploadingLogoContratual(""); return; }

    const filePath = `${user.id}/logo-contratual-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (upErr) { toast.error("Erro no upload"); setUploadingLogoContratual(""); return; }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    setLogoContratualUrl(urlData.publicUrl);
    toast.success("Logotipo contratual enviado");
    setUploadingLogoContratual("");
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const resetTwoFaSetup = () => {
    setMfaFactorId(null);
    setMfaQrCode("");
    setMfaSecret("");
    setMfaVerifyCode("");
    setEnrollingMfa(false);
    setEnablingMfa(false);
    setMfaSetupError("");
  };

  const startEnrollTwoFa = async () => {
    resetTwoFaSetup();
    setEnrollingMfa(true);
    setMfaSetupError("");

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (error) throw error;

      setMfaFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao iniciar o enrolamento de 2FA.";
      setMfaSetupError(message);
      toast.error(message);
    } finally {
      setEnrollingMfa(false);
    }
  };

  const handleEnableTwoFa = async () => {
    if (!mfaFactorId) return;
    if (mfaVerifyCode.trim().length !== 6) {
      setMfaSetupError("Digite o código completo (6 dígitos).");
      return;
    }

    setMfaSetupError("");
    setEnablingMfa(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaVerifyCode.trim(),
      });
      if (verify.error) throw verify.error;

      toast.success("2FA ativado com sucesso.");
      setTwoFaDialogOpen(false);
      resetTwoFaSetup();

      // Garante que o JWT seja atualizado para aal2.
      await supabase.auth.refreshSession();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Código inválido. Tente novamente.";
      setMfaSetupError(message);
      toast.error(message);
    } finally {
      setEnablingMfa(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não coincide com a nova senha.");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("A nova senha deve ser diferente da atual.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      toast.error("Não foi possível obter o e-mail da conta.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        const msg = signInErr.message?.toLowerCase().includes("invalid") || signInErr.message?.includes("Invalid login")
          ? "Senha atual incorreta."
          : signInErr.message;
        toast.error(msg);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        toast.error(updateErr.message || "Não foi possível atualizar a senha.");
        return;
      }

      toast.success("Senha alterada com sucesso.");
      resetPasswordForm();
      setPasswordDialogOpen(false);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      {/* Meu Perfil */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Meu Perfil</h3>
          </div>
          {!profileEditing && (
            <Button variant="outline" size="sm" onClick={() => setProfileEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">Seus dados pessoais de cadastro</p>

        <div className={`space-y-4 ${!profileEditing ? "opacity-60 pointer-events-none" : ""}`}>
          <div>
            <label className="text-sm font-medium text-foreground">Nome Completo *</label>
            <Input placeholder="Seu nome completo" className="mt-1" value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} disabled={!profileEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">E-mail *</label>
            <Input placeholder="seu@email.com" className="mt-1" value={email} onChange={e => setEmail(e.target.value)} disabled={!profileEditing} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Telefone *</label>
              <Input placeholder="(00) 00000-0000" className="mt-1" value={telefone} onChange={e => setTelefone(e.target.value)} disabled={!profileEditing} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Nome da Empresa *</label>
              <Input placeholder="Sua empresa" className="mt-1" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} disabled={!profileEditing} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">CNPJ *</label>
            <Input placeholder="00.000.000/0000-00" className="mt-1" value={cnpjPerfil} onChange={e => setCnpjPerfil(e.target.value)} disabled={!profileEditing} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Cidade *</label>
              <Input placeholder="Ex: São Paulo" className="mt-1" value={cidade} onChange={e => setCidade(e.target.value)} disabled={!profileEditing} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Estado</label>
              <Input placeholder="Ex: SP" className="mt-1" value={estado} onChange={e => setEstado(e.target.value)} disabled={!profileEditing} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Endereço Completo</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              {isMapboxConfigured()
                ? "Selecione um endereço na lista para enviar sua localização ao mapa de Abrangência do administrador."
                : "Com Mapbox configurado (VITE_MAPBOX_ACCESS_TOKEN), a busca habilita o pin exato no mapa do admin."}
            </p>
            {isMapboxConfigured() ? (
              <MapboxAddressInput
                value={enderecoCompleto}
                onChangeAddress={(v) => setEnderecoCompleto(v)}
                onCoordinatesChange={(lat, lng) => {
                  setEnderecoLat(lat);
                  setEnderecoLng(lng);
                }}
                onPlaceContext={(c, e) => {
                  if (c?.trim()) setCidade(c.trim());
                  if (e?.trim()) setEstado(e.trim());
                }}
                disabled={!profileEditing}
                className="mt-1"
              />
            ) : (
              <Input
                placeholder="Rua, número, bairro, CEP"
                className="mt-1"
                value={enderecoCompleto}
                onChange={(e) => {
                  setEnderecoCompleto(e.target.value);
                  setEnderecoLat(null);
                  setEnderecoLng(null);
                }}
                disabled={!profileEditing}
              />
            )}
          </div>
        </div>
        {profileEditing && (
          <Button className="bg-primary text-primary-foreground mt-4" onClick={handleSaveProfile}>
            <Save className="h-4 w-4 mr-2" /> Salvar Perfil
          </Button>
        )}
      </div>

      {/* Logomarca Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Logomarca Global</h3>
          </div>
          {!logoEditing && (
            <Button variant="outline" size="sm" onClick={() => setLogoEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera a logomarca em todo o sistema (painel, contratos, etc.)</p>

        <div className={`space-y-4 ${!logoEditing ? "opacity-70 pointer-events-none" : ""}`}>
          <div className="bg-muted/30 rounded-lg p-8 flex items-center justify-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 max-w-[200px] object-contain" />
          ) : (
            <Car className="h-16 w-16 text-foreground" />
          )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoFileSelect}
            disabled={!logoEditing}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !logoEditing}>
              <Upload className="h-4 w-4 mr-2" /> {logoFile ? "Trocar imagem" : "Escolher imagem"}
            </Button>
            {logoFile ? <span className="text-xs text-muted-foreground self-center">{logoFile.name}</span> : null}
          </div>
        </div>
        {logoEditing && (
          <Button className="bg-primary text-primary-foreground mt-4" onClick={handleSaveLogoUpload} disabled={uploading}>
            <Save className="h-4 w-4 mr-2" /> {uploading ? "Enviando..." : "Salvar Logomarca"}
          </Button>
        )}
      </div>

      {/* Nome do Projeto */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Nome do Projeto</h3>
          </div>
          {!nomeProjetoEditing && (
            <Button variant="outline" size="sm" onClick={() => setNomeProjetoEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera o nome exibido em todo o sistema (painel, contratos, etc.)</p>
        <div className={`${!nomeProjetoEditing ? "opacity-70 pointer-events-none" : ""}`}>
          <Input value={nomeProjeto} onChange={e => setNomeProjeto(e.target.value)} className="mb-3" disabled={!nomeProjetoEditing} />
        </div>
        {nomeProjetoEditing && (
          <Button className="bg-primary text-primary-foreground" onClick={handleSaveNomeProjeto}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        )}
      </div>

      {/* Fonte Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Fonte Global</h3>
          </div>
          {!fonteEditing && (
            <Button variant="outline" size="sm" onClick={() => setFonteEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera a fonte de todo o sistema, inclusive contratos</p>
        <div className={`space-y-2 ${!fonteEditing ? "opacity-70 pointer-events-none" : ""}`}>
          <Select value={fonteGlobal} onValueChange={setFonteGlobal} disabled={!fonteEditing}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2" style={{ fontFamily: FONT_OPTIONS.find(f => f.value === fonteGlobal)?.label }}>
            Exemplo de texto com a fonte <strong>{FONT_OPTIONS.find(f => f.value === fonteGlobal)?.label}</strong>
          </p>
        </div>
        {fonteEditing && (
          <Button className="bg-primary text-primary-foreground mt-3" onClick={handleSaveFonte}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        )}
      </div>

      {isAdminMaster ? <LoginConfiguracoesSection /> : null}

      {/* Informações Contratuais */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Informações Contratuais</h3>
          </div>
          {contratualSaved && !contratualEditing && (
            <Button variant="outline" size="sm" onClick={() => setContratualEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {contratualSaved ? "Cabeçalho 1" : "Preencha os dados de identificação do motorista/empresa para contratos"}
        </p>

        <div className={`space-y-4 ${!contratualEditing ? "opacity-60 pointer-events-none" : ""}`}>
          <div>
            <label className="text-sm font-medium text-foreground">Nome Empresarial / Razão Social (igual ao CNPJ) *</label>
            <Input className="mt-1" placeholder="Razão Social conforme CNPJ" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">CNPJ *</label>
            <Input className="mt-1" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Endereço da Sede *</label>
            <Input className="mt-1" placeholder="Rua, número, bairro, cidade - UF" value={enderecoSede} onChange={e => setEnderecoSede(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Representante Legal (se houver)</label>
            <Input className="mt-1" placeholder="Nome do representante legal" value={representanteLegal} onChange={e => setRepresentanteLegal(e.target.value)} disabled={!contratualEditing} />
          </div>

          {/* Logotipo Contratual */}
          <div>
            <label className="text-sm font-medium text-foreground">Logotipo Contratual (fundo branco)</label>
            <div className="bg-muted/30 rounded-lg p-6 flex items-center justify-center mt-1 mb-2 border border-dashed border-border">
              {logoContratualUrl ? (
                <img src={logoContratualUrl} alt="Logo Contratual" className="h-14 max-w-[180px] object-contain" />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <input ref={logoContratualRef} type="file" accept="image/*" className="hidden" onChange={handleLogoContratualUpload} />
            {contratualEditing && (
              <Button variant="outline" size="sm" onClick={() => logoContratualRef.current?.click()} disabled={!!uploadingLogoContratual}>
                <Upload className="h-4 w-4 mr-2" /> {uploadingLogoContratual ? "Enviando..." : "Enviar Logotipo"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Telefone *</label>
              <Input className="mt-1" placeholder="(00) 0000-0000" value={telefoneContratual} onChange={e => setTelefoneContratual(e.target.value)} disabled={!contratualEditing} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">WhatsApp *</label>
              <Input className="mt-1" placeholder="(00) 00000-0000" value={whatsappContratual} onChange={e => setWhatsappContratual(e.target.value)} disabled={!contratualEditing} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">E-mail Oficial *</label>
            <Input className="mt-1" placeholder="contato@empresa.com" value={emailOficial} onChange={e => setEmailOficial(e.target.value)} disabled={!contratualEditing} />
          </div>
        </div>

        {contratualEditing && (
          <Button className="bg-primary text-primary-foreground mt-4" onClick={handleSaveContratual}>
            <Save className="h-4 w-4 mr-2" /> Salvar Cabeçalho 1
          </Button>
        )}
      </div>

      {/* Segurança */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Segurança</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altere sua senha e configure autenticação em dois fatores</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Alteração de Senha</p>
              <p className="text-sm text-muted-foreground">Alterar a senha de acesso</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetPasswordForm(); setPasswordDialogOpen(true); }}>
              <Key className="h-4 w-4 mr-2" /> Alterar
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Autenticação em 2 Fatores (2FA)</p>
              <p className="text-sm text-muted-foreground">Camada extra de segurança via app autenticador (TOTP)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setTwoFaDialogOpen(true);
                startEnrollTwoFa();
              }}
            >
              <Shield className="h-4 w-4 mr-2" /> Configurar
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={twoFaDialogOpen}
        onOpenChange={(open) => {
          setTwoFaDialogOpen(open);
          if (!open) resetTwoFaSetup();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Autenticação em 2 Fatores</DialogTitle>
            <DialogDescription>
              Use seu app autenticador (TOTP) para habilitar a camada extra de segurança.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {enrollingMfa ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando QR Code...
              </div>
            ) : (
              <>
                {mfaQrCode ? (
                  <div className="flex justify-center">
                    <img
                      src={mfaQrCode}
                      alt="QR Code para 2FA"
                      className="h-44 w-44"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aguardando QR Code...</p>
                )}

                {mfaSecret ? (
                  <p className="text-xs text-muted-foreground break-all">
                    Secret: <span className="font-medium text-foreground">{mfaSecret}</span>
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label>Digite o código do autenticador</Label>
                  <InputOTP
                    maxLength={6}
                    value={mfaVerifyCode}
                    onChange={(v) => setMfaVerifyCode(v)}
                    aria-label="Código TOTP"
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }, (_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </>
            )}

            {mfaSetupError ? <p className="text-sm text-destructive">{mfaSetupError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" disabled={enrollingMfa || enablingMfa} onClick={() => setTwoFaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!mfaFactorId || enrollingMfa || enablingMfa}
              className="bg-primary text-primary-foreground"
              onClick={handleEnableTwoFa}
            >
              {enablingMfa ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ativando...
                </>
              ) : (
                "Ativar 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) resetPasswordForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              Informe sua senha atual e a nova senha. A alteração é feita no Supabase Auth (conta segura).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={savingPassword} onClick={() => setPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={savingPassword} onClick={handleChangePassword}>
              {savingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Network Nacional */}
      <NetworkSection />

      {/* Hard Refresh */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Hard Refresh</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Recarregar o sistema completamente</p>
        <Button variant="destructive" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar Sistema
        </Button>
      </div>
    </div>
  );
}
