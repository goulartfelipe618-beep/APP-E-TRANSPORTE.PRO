export const COMUNICAR_PH_CLIENTE = "{{nome_cliente}}";
export const COMUNICAR_PH_MOTORISTA = "{{nome_motorista}}";

export type ComunicarNomes = { cliente: string; motorista: string };

/** Converte saudações antigas (nome já “assado”) em placeholders. */
export function hidratarTextoComunicar(texto: string): string {
  return texto
    .replace(/^Olá [^,\n]+, a sua reserva está confirmada!/m, `Olá ${COMUNICAR_PH_CLIENTE}, a sua reserva está confirmada!`)
    .replace(
      /^Olá [^,\n]+, recebemos a sua solicitação de viagem!/m,
      `Olá ${COMUNICAR_PH_CLIENTE}, recebemos a sua solicitação de viagem!`,
    )
    .replace(/^Olá [^,\n]+, você tem uma nova reserva!/m, `Olá ${COMUNICAR_PH_MOTORISTA}, você tem uma nova reserva!`);
}

export function interpolarTextoComunicar(texto: string, nomes: ComunicarNomes): string {
  const cliente = nomes.cliente.trim() || "Cliente";
  const motorista = nomes.motorista.trim() || "Motorista";
  return hidratarTextoComunicar(texto).split(COMUNICAR_PH_CLIENTE).join(cliente).split(COMUNICAR_PH_MOTORISTA).join(motorista);
}

/** Guarda só o molde. Não grava o nome da reserva actual. */
export function persistirTextoComunicar(textoUi: string, nomes: ComunicarNomes): string {
  const cliente = nomes.cliente.trim();
  const motorista = nomes.motorista.trim();
  let t = textoUi;
  if (cliente.length >= 2) t = t.split(`Olá ${cliente},`).join(`Olá ${COMUNICAR_PH_CLIENTE},`);
  if (motorista.length >= 2 && motorista !== cliente) {
    t = t.split(`Olá ${motorista},`).join(`Olá ${COMUNICAR_PH_MOTORISTA},`);
  }
  return hidratarTextoComunicar(t);
}
