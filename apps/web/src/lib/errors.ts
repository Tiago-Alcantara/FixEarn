import { ApiError } from './api';

/**
 * Extrai uma mensagem legível de um valor desconhecido capturado num catch.
 * - ApiError → mensagem do body do backend (message field), ou "Error {status}"
 * - Error    → a própria `message`
 * - outros   → `fallback` se informado, senão `String(error)`
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | null;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message[0] : body.message;
    }
    return `Error ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return fallback ?? String(error);
}
