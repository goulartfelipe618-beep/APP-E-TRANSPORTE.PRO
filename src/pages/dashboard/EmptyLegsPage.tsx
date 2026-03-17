import { useState, useEffect } from "react";
import { Plane, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SlideCarousel from "@/components/SlideCarousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmptyLag {
  id: string;
  origem: string;
  destino: string;
  data_hora: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  data_expiracao: string | null;
}

const isExpired = (item: EmptyLag) => {
  if (!item.data_hora) return false;
  return new Date(item.data_hora) < new Date();
};

export default function EmptyLegsPage() {
  const [items, setItems] = useState<EmptyLag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApproved = async () => {
      const { data } = await supabase
        .from("empty_lags")
        .select("*")
        .eq("status", "aprovado")
        .order("created_at", { ascending: false });
      setItems((data as EmptyLag[]) || []);
      setLoading(false);
    };
    fetchApproved();
  }, []);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" />
          Empty Legs
        </h1>
        <p className="text-muted-foreground mt-1">
          Voos comerciais dentro do Brasil com até <span className="font-bold text-primary">70% de desconto</span>
        </p>
      </div>

      <SlideCarousel pagina="empty_legs" />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : items.length === 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center space-y-2">
            <Plane className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhuma oferta Empty Leg disponível no momento.</p>
            <p className="text-xs text-muted-foreground">Novas ofertas serão publicadas em breve. Fique atento!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const expired = isExpired(item);
            return (
              <Card
                key={item.id}
                className={`border-border transition-all ${expired ? "opacity-40 grayscale pointer-events-none select-none" : "hover:shadow-md"}`}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    {expired ? (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
                        ⏰ Expirado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                        ✈️ Disponível
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{item.origem || "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-foreground">{item.destino || "—"}</span>
                  </div>
                  {item.data_hora && (
                    <p className="text-sm text-muted-foreground">📅 {formatDate(item.data_hora)}</p>
                  )}
                  {item.observacoes && (
                    <p className="text-sm text-muted-foreground">📝 {item.observacoes}</p>
                  )}
                  {item.data_hora && (
                    <p className={`text-xs flex items-center gap-1 ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                      <Clock className="h-3 w-3" />
                      {expired ? "Oferta expirada — voo já partiu" : `Válido até ${formatDate(item.data_hora)}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            O que são Empty Legs?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Empty Legs são trechos de voos que estariam vazios — quando a aeronave precisa retornar à base ou seguir para outro destino sem passageiros.
            Isso permite oferecer passagens aéreas com descontos de até <strong className="text-primary">70%</strong> em relação ao preço normal.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ideal para quem tem flexibilidade de datas e quer economizar em viagens domésticas pelo Brasil.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
