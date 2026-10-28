/**
 * Prepara texto para a impressora térmica (RF-03a): remove acentos, converte para
 * maiúsculas e troca qualquer caractere fora do ASCII imprimível por "?".
 */
export function toPrinterText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, "?");
}

export function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + " ".repeat(width - value.length);
}

export function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : " ".repeat(width - value.length) + value;
}

/** Quebra o texto em linhas de no máximo `width` colunas, preferindo espaços. */
export function wrap(value: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    if (word.length > width) {
      if (current) lines.push(current);
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      current = lines.pop() ?? "";
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
