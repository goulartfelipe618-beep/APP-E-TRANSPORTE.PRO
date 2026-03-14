import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, CheckCircle, Send } from "lucide-react";

export default function SolicitarAcesso() {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [form, setForm] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    cidade: "",
    estado: "",
    mensagem: "",
    tipo_interesse: "conhecer",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo.trim() || !form.email.trim() || !form.telefone.trim()) {
      toast.error("Preencha todos os campos obrigatórios!");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("solicitacoes_acesso").insert({
      nome_completo: form.nome_completo.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      mensagem: form.mensagem.trim() || null,
      tipo_interesse: form.tipo_interesse,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
      return;
    }
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Solicitação Enviada!</h1>
          <p className="text-zinc-400">
            Recebemos sua solicitação com sucesso. Nossa equipe entrará em contato em breve para apresentar o sistema e tirar todas as suas dúvidas.
          </p>
          <Button variant="outline" onClick={() => { setEnviado(false); setForm({ nome_completo: "", email: "", telefone: "", cidade: "", estado: "", mensagem: "", tipo_interesse: "conhecer" }); }}>
            Enviar nova solicitação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Car className="h-10 w-10 text-amber-500" />
            <h1 className="text-3xl font-bold text-white tracking-tight">E-Transporte.pro</h1>
          </div>
          <p className="text-zinc-400 text-lg">
            Plataforma completa para motoristas executivos e taxistas
          </p>
          <p className="text-zinc-500 text-sm">
            Preencha o formulário abaixo para conhecer o sistema ou solicitar um teste gratuito.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-zinc-300">Nome Completo *</Label>
            <Input
              value={form.nome_completo}
              onChange={(e) => handleChange("nome_completo", e.target.value)}
              placeholder="Seu nome completo"
              className="bg-zinc-800 border-zinc-700 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="seu@email.com"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Telefone / WhatsApp *</Label>
              <Input
                value={form.telefone}
                onChange={(e) => handleChange("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => handleChange("cidade", e.target.value)}
                placeholder="Sua cidade"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Estado</Label>
              <Input
                value={form.estado}
                onChange={(e) => handleChange("estado", e.target.value)}
                placeholder="UF"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Interesse</Label>
            <Select value={form.tipo_interesse} onValueChange={(v) => handleChange("tipo_interesse", v)}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conhecer">Quero conhecer o sistema</SelectItem>
                <SelectItem value="teste">Quero fazer um teste gratuito</SelectItem>
                <SelectItem value="contratar">Quero contratar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Mensagem (opcional)</Label>
            <Textarea
              value={form.mensagem}
              onChange={(e) => handleChange("mensagem", e.target.value)}
              placeholder="Conte-nos mais sobre sua necessidade..."
              className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
            />
          </div>

          <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold" disabled={loading}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </form>

        <p className="text-center text-zinc-600 text-xs">
          Ao enviar, você concorda em ser contactado pela nossa equipe.
        </p>
      </div>
    </div>
  );
}
