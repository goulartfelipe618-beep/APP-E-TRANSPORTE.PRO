/** Desliga o autenticador e, se o Financeiro estiver bloqueado, libera o menu antes de apagar o fator. */

export async function desativarAutenticador(input: {
  codigo: string;
  financeiroBloqueado: boolean;
  fatores: { id: string; status: string }[];
  confirmar: (factorId: string, codigo: string) => Promise<void>;
  liberarFinanceiro: () => Promise<void>;
  remover: (factorId: string) => Promise<void>;
}): Promise<void> {
  const code = input.codigo.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Digite o código de 6 dígitos.");
  const verificados = input.fatores.filter((f) => f.status === "verified" && f.id);
  if (!verificados.length) throw new Error("O autenticador já está desativado.");
  await input.confirmar(verificados[0].id, code);
  if (input.financeiroBloqueado) await input.liberarFinanceiro();
  for (const fator of verificados) await input.remover(fator.id);
}
