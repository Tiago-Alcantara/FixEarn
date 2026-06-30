/**
 * Buffer de reserva mantido na carteira do cliente (não aportável).
 * Cobre a reserva mínima base da conta Stellar (1 XLM) + folga. O path do
 * vault XLM nativo não cria subentries/trustline, então a reserva fica no mínimo.
 * 1.5 XLM em base units (7 casas).
 */
export const RESERVE_BUFFER_BASE_UNITS = 15_000_000n;
