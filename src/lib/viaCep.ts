export type ViaCepResposta = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

export async function fetchViaCep(cepDigits: string): Promise<ViaCepResposta | null> {
  const d = cepDigits.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!res.ok) return null;
  const j = (await res.json()) as ViaCepResposta;
  if (j?.erro) return null;
  return j;
}
