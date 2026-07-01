'use client';

import { useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import type { OfframpResult } from '@yield2pay/shared';
import { useWallet } from './useWallet';
import { createApi } from './api';
import { toBaseUnits } from './money';

export type WithdrawState =
  | 'idle'
  | 'processing'
  | 'done'
  | 'error';

/**
 * Saque via Pix, escondendo o web3. Encadeia:
 *   1. saca USDC do cofre pra carteira (buildWithdraw + assina)
 *   2. cria off-ramp (USDC → BRL)
 *   3. assina a burnTransaction pra liberar o Pix
 * São 2 assinaturas atrás do gesto `start`. Guarda sub-progresso pra retry.
 */
export function useWithdrawFlow() {
  const { getAccessToken, user } = usePrivy();
  const { ensureWallet } = useWallet();
  const { signRawHash } = useSignRawHash();
  const api = createApi(getAccessToken);

  const [state, setState] = useState<WithdrawState>('idle');
  const [order, setOrder] = useState<OfframpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const withdrawnRef = useRef(false);
  const orderRef = useRef<OfframpResult | null>(null);

  async function start(amountUsdc: string): Promise<void> {
    setError(null);
    setState('processing');
    try {
      const address = await ensureWallet();
      const baseUnits = toBaseUnits(amountUsdc);

      // Garante que a rampa está pronta (wallet + conta Pix compliant).
      const status = await api.getRampStatus();
      if (!status.ready) {
        const email = user?.email?.address ?? 'demo@fixearn.com';
        const displayName = user?.email?.address?.split('@')[0] ?? 'Demo User';
        await api.rampSetup({ email, displayName });
      }

      // 1) Saca USDC do cofre pra carteira (uma vez só).
      if (!withdrawnRef.current) {
        const w = await api.buildWithdraw(baseUnits);
        const { signature } = await signRawHash({
          address, chainType: 'stellar', hash: w.hash as `0x${string}`,
        });
        await api.submitWithdraw({
          xdr: w.xdr, signatureHex: signature, stellarAddress: address, amount: baseUnits,
        });
        withdrawnRef.current = true;
      }

      // 2) Cria a order de off-ramp (uma vez só).
      let off = orderRef.current;
      if (!off) {
        off = await api.startOfframp({ amountToken: amountUsdc });
        orderRef.current = off;
        setOrder(off);
      }

      // 3) Pega a burnTransaction (pollando até ready) e assina.
      let burn = await api.getOrderBurn(off.orderId);
      for (let i = 0; i < 10 && !burn.ready; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        burn = await api.getOrderBurn(off.orderId);
      }
      if (burn.ready && burn.xdr && burn.hash) {
        const { signature } = await signRawHash({
          address, chainType: 'stellar', hash: burn.hash as `0x${string}`,
        });
        await api.submitOrderBurn(off.orderId, {
          xdr: burn.xdr, signatureHex: signature, stellarAddress: address,
        });
      }

      setState('done');
    } catch (e) {
      setError(getErr(e));
      setState('error');
      throw e;
    }
  }

  function reset(): void {
    setState('idle');
    setOrder(null);
    setError(null);
    withdrawnRef.current = false;
    orderRef.current = null;
  }

  return { state, order, error, start, reset };
}

function getErr(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'Algo deu errado. Tente de novo.';
}
