/** Chaves `activePage` do painel motorista executivo (Gestão de Frota). */
export const PAGINAS_MOTORISTA: { value: string; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "atualizacoes", label: "Atualizações" },
  { value: "metricas", label: "Métricas" },
  { value: "abrangencia", label: "Abrangência" },
  { value: "transfer/solicitacoes", label: "Transfer — Solicitações" },
  { value: "transfer/reservas", label: "Transfer — Reservas" },
  { value: "transfer/contrato", label: "Transfer — Contrato" },
  { value: "transfer/geolocalizacao", label: "Geolocalização" },
  { value: "grupos/solicitacoes", label: "Grupos — Solicitações" },
  { value: "grupos/reservas", label: "Grupos — Reservas" },
  { value: "grupos/contrato", label: "Grupos — Contrato" },
  { value: "motoristas/cadastros", label: "Motoristas — Cadastros" },
  { value: "motoristas/agendamentos", label: "Motoristas — Agendamentos" },
  { value: "veiculos", label: "Veículos" },
  { value: "empty-legs", label: "Empty Legs" },
  { value: "mentoria", label: "Mentoria" },
  { value: "campanhas/ativos", label: "Campanhas — Ativos" },
  { value: "campanhas/leads", label: "Campanhas — Leads" },
  { value: "marketing/receptivos", label: "Receptivos" },
  { value: "marketing/qrcode", label: "QR Codes" },
  { value: "network", label: "Network" },
  { value: "comunidade", label: "Comunidade" },
  { value: "google", label: "Google Maps" },
  { value: "email-business", label: "E-mail Business" },
  { value: "website", label: "Website" },
  { value: "dominios", label: "Domínios" },
  { value: "catalogo", label: "Catálogo" },
  { value: "disparador", label: "Disparador" },
  { value: "anotacoes", label: "Anotações" },
  { value: "sistema/configuracoes", label: "Sistema — Configurações" },
  { value: "sistema/automacoes", label: "Sistema — Automações" },
  { value: "sistema/comunicador", label: "Sistema — Comunicador" },
  { value: "tickets", label: "Tickets" },
];

/** Chaves `activePage` do painel táxi. */
export const PAGINAS_TAXI: { value: string; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "metricas", label: "Métricas" },
  { value: "abrangencia", label: "Abrangência" },
  { value: "chamadas", label: "Chamadas" },
  { value: "atendimentos", label: "Atendimentos" },
  { value: "clientes", label: "Clientes" },
  { value: "comunidade", label: "Comunidade" },
  { value: "anotacoes", label: "Anotações" },
  { value: "sistema/configuracoes", label: "Sistema — Configurações" },
  { value: "sistema/automacoes", label: "Sistema — Automações" },
  { value: "tickets", label: "Tickets" },
];

export type PainelTipo = "motorista" | "taxi";

export function storageKeyAvisoDismiss(avisoId: string): string {
  return `etp_aviso_dismissed:${avisoId}`;
}
