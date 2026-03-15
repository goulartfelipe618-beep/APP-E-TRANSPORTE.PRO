import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface ClienteRegistro {
  nome_cliente: string;
  telefone: string;
  numero_atendimento: number;
}

export default function TaxiClientes() {
  const [clientes, setClientes] = useState<ClienteRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("chamadas_taxi")
        .select("nome_cliente, telefone, numero_atendimento")
        .eq("user_id", user.id)
        .in("status", ["aceito", "concluido"])
        .order("numero_atendimento", { ascending: false });
      setClientes((data as ClienteRegistro[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
      </div>
      <p className="text-muted-foreground">Clientes registrados automaticamente a partir dos atendimentos aceitos.</p>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Atendimento</TableHead>
              <TableHead>Nome Completo</TableHead>
              <TableHead>Telefone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : clientes.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum cliente registrado. Aceite chamadas para gerar registros aqui.</TableCell></TableRow>
            ) : clientes.map((c, i) => (
              <TableRow key={`${c.numero_atendimento}-${i}`}>
                <TableCell className="font-mono text-primary font-semibold">{c.numero_atendimento}</TableCell>
                <TableCell className="font-medium text-foreground">{c.nome_cliente}</TableCell>
                <TableCell className="text-muted-foreground">{c.telefone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
