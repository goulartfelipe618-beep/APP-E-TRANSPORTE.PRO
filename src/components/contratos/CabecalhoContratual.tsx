import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Phone, Mail, MapPin, User, FileText } from "lucide-react";

interface CabecalhoData {
  razao_social: string;
  cnpj: string;
  endereco_sede: string;
  representante_legal: string;
  logo_contratual_url: string;
  telefone: string;
  whatsapp: string;
  email_oficial: string;
}

export default function CabecalhoContratual() {
  const [data, setData] = useState<CabecalhoData | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: d } = await supabase
        .from("cabecalho_contratual" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (d) setData(d as any);
    })();
  }, []);

  if (!data || (!data.razao_social && !data.cnpj)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 max-w-full mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-5 w-5" />
          <p className="text-sm">Nenhuma informação contratual cadastrada. Vá em <strong>Configurações → Informações Contratuais</strong> para preencher.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <div className="flex items-start gap-6">
        {data.logo_contratual_url && (
          <img
            src={data.logo_contratual_url}
            alt="Logo Contratual"
            className="h-16 max-w-[160px] object-contain rounded-md border border-border bg-white p-1"
          />
        )}
        <div className="flex-1 space-y-2">
          <h3 className="font-bold text-foreground text-lg">{data.razao_social}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>CNPJ: <strong className="text-foreground">{data.cnpj}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{data.endereco_sede}</span>
            </div>
            {data.representante_legal && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Rep. Legal: {data.representante_legal}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>Tel: {data.telefone} | WhatsApp: {data.whatsapp}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>{data.email_oficial}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
