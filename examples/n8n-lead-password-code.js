/**
 * Cole este bloco no nó Code do n8n ("Montar Card WhatsApp" ou equivalente).
 * Mantém a mesma regra que `supabase/functions/_shared/lead_password.ts`
 * e `webhook-solicitacao` (acentos removidos, só letras nas 3 primeiras,
 * últimos 4 dígitos do telefone, sufixo ETP).
 */
function stripAccents(input) {
  return String(input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function onlyLettersUpper(input) {
  return stripAccents(input).replace(/[^a-zA-Z]/g, "").toUpperCase();
}
function computeLeadPassword(nome, telefone) {
  const letters = onlyLettersUpper(nome);
  const first3 = (letters.slice(0, 3) || "").padEnd(3, "X");
  const digits = String(telefone || "").replace(/\D/g, "");
  const last4 = (digits.slice(-4) || "").padStart(4, "0");
  return `${first3}${last4}ETP`;
}

const body = $input.first().json.body;

const telefoneRaw = (body.telefone || "").replace(/\D/g, "");
const telefone = telefoneRaw.startsWith("55") ? telefoneRaw : "55" + telefoneRaw;

const senha = computeLeadPassword(body.nome || "", body.telefone || "");

const texto =
  `Olá, *${body.nome}*! 👋\n\n` +
  `Seja bem-vindo(a) ao *E-Transporte.pro*!\n\n` +
  `Seu acesso foi criado com sucesso. Para entrar na plataforma, use as credenciais abaixo:\n\n` +
  `*ID:* ${body.email}\n*Senha:* ${senha}\n\n` +
  `⚠️ _Recomendamos alterar sua senha no primeiro acesso._`;

const payload = {
  number: telefone,
  type: "button",
  text: texto,
  imageButton: "https://i.postimg.cc/k5CV8mtD/Chat-GPT-Image-25-03-2026-20-13-44.png",
  footerText: "© E-Transporte.pro | Sua gestão em movimento",
  choices: ["Acessar plataforma|https://app.e-transporte.pro", "Falar com suporte"],
};

return [{ json: payload }];
