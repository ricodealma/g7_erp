/** Erro de regra de negócio com mensagem pronta para exibir ao operador. */
export class DomainError extends Error {
  override readonly name = "DomainError";
}
