import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const automacaoId = url.searchParams.get("automacao_id");

    if (!automacaoId) {
      return new Response(
        JSON.stringify({ error: "automacao_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up the automação
    const { data: automacao, error: autoError } = await supabase
      .from("automacoes")
      .select("*")
      .eq("id", automacaoId)
      .single();

    if (autoError || !automacao) {
      return new Response(
        JSON.stringify({ error: "Automação não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!automacao.ativo) {
      return new Response(
        JSON.stringify({ error: "Automação desativada", received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const tipo = automacao.tipo;
    const userId = automacao.user_id;

    let insertError;

    if (tipo === "transfer") {
      const { error } = await supabase.from("solicitacoes_transfer").insert({
        user_id: userId,
        nome_cliente: body.nome_completo || body.nome || "Sem nome",
        contato: body.telefone || body.whatsapp || null,
        tipo: body.tipo_viagem || null,
        embarque: body.embarque_ida || body.endereco_inicio || null,
        desembarque: body.destino_ida || body.ponto_encerramento || null,
        data_viagem: body.data_ida || body.data || null,
        num_passageiros: body.passageiros_ida ? parseInt(body.passageiros_ida) : (body.passageiros ? parseInt(body.passageiros) : null),
        mensagem: body.mensagem_ida || body.itinerario_mensagem || body.mensagem || null,
        status: "pendente",
      });
      insertError = error;
    } else if (tipo === "grupo") {
      const { error } = await supabase.from("solicitacoes_grupos").insert({
        user_id: userId,
        nome_cliente: body.nome_completo || body.nome || "Sem nome",
        whatsapp: body.telefone || body.whatsapp || null,
        tipo_veiculo: body.tipo_veiculo || null,
        embarque: body.embarque || null,
        destino: body.destino || null,
        data_ida: body.data_ida || null,
        num_passageiros: body.num_passageiros ? parseInt(body.num_passageiros) : null,
        mensagem: body.observacoes || body.mensagem || null,
        status: "pendente",
      });
      insertError = error;
    } else if (tipo === "motorista") {
      const { error } = await supabase.from("solicitacoes_motoristas").insert({
        user_id: userId,
        nome: body.nome_completo || body.nome || "Sem nome",
        email: body.email || null,
        telefone: body.telefone || body.whatsapp || null,
        cpf: body.cpf || null,
        cnh: body.numero_cnh || null,
        cidade: body.cidade || null,
        mensagem: body.mensagem_observacoes || body.experiencia || body.mensagem || null,
        status: "pendente",
      });
      insertError = error;
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de automação inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar solicitação", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Solicitação recebida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
