import { toAgendaDayKey } from "@/lib/painelAgendaReservas";

/** Data civil de São Paulo, no formato YYYY-MM-DD. */
export function hojeSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function deslocarDia(dayKey: string, dias: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + dias));
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mes}-${dia}`;
}

/** Ontem, hoje ou amanhã em relação ao calendário de São Paulo. */
export function diaNaJanelaOperacional(dayKey: string | null, agora = new Date()): boolean {
  if (!dayKey) return false;
  const hoje = hojeSaoPaulo(agora);
  return dayKey === deslocarDia(hoje, -1) || dayKey === hoje || dayKey === deslocarDia(hoje, 1);
}

/** Com o Financeiro bloqueado, o valor só aparece se alguma data do serviço cair na janela. */
export function mostrarValorReserva(
  financeiroBloqueado: boolean,
  datas: (string | null | undefined)[],
  agora = new Date(),
): boolean {
  if (!financeiroBloqueado) return true;
  return datas.some((data) => diaNaJanelaOperacional(toAgendaDayKey(data), agora));
}

/** Tira preços escritos no texto (R$ 300,00 ou 300,00 reais) sem mexer no restante da mensagem. */
export function redigirValoresTexto(texto: string): string {
  return texto
    .replace(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi, "—")
    .replace(/\b\d{1,3}(?:\.\d{3})*,\d{2}\s*reais\b/gi, "—");
}
