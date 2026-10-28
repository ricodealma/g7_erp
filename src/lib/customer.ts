/**
 * Chave da conta de fiado: o nome é único sem diferenciar maiúsculas, acentos e espaços
 * ("Ricardo", " ricardo" e "RICARDO" são a mesma pessoa; "José" e "Jose" também).
 */
export function customerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

/** Nome exibido: espaços extras removidos, grafia mantida como digitada na primeira vez. */
export function cleanCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
