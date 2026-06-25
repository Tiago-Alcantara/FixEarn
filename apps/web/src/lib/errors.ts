/**
 * Extrai uma mensagem legível de um valor desconhecido capturado num catch.
 * - Error  → a própria `message`
 * - outros → `fallback` se informado, senão `String(error)`
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) return error.message;
  return fallback ?? String(error);
}
