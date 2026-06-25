'use client';

import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import type { BuildTxResponse, SubmitTxDto, SubmitTxResponse } from '@fixearn/shared';
import { useWallet } from './useWallet';
import { createApi } from './api';
import { usePrivy } from '@privy-io/react-auth';

/**
 * Returns deposit and withdraw functions that orchestrate the full transaction flow:
 * 1. Ensure wallet exists
 * 2. Build transaction (XDR + hash)
 * 3. Sign the hash with Privy
 * 4. Submit the signed transaction
 * 5. Return the transaction hash
 *
 * deposit e withdraw seguem exatamente o mesmo fluxo, mudando apenas quais
 * endpoints de build/submit são chamados — por isso compartilham `runStellarTx`.
 *
 * Non-custodial: private key signing is entirely Privy's responsibility.
 * Errors propagate to the caller (UI catches them).
 */
export function useStellarTx(): {
  deposit(amountBaseUnits: string): Promise<string>;
  withdraw(amountBaseUnits: string): Promise<string>;
} {
  const { getAccessToken } = usePrivy();
  const { ensureWallet } = useWallet();
  const { signRawHash } = useSignRawHash();
  const api = createApi(getAccessToken);

  async function runStellarTx(
    build: (amountBaseUnits: string) => Promise<BuildTxResponse>,
    submit: (body: SubmitTxDto) => Promise<SubmitTxResponse>,
    amountBaseUnits: string,
  ): Promise<string> {
    // 1. Ensure wallet exists
    const address = await ensureWallet();

    // 2. Build transaction
    const { xdr, hash } = await build(amountBaseUnits);

    // 3. Sign the hash
    const { signature } = await signRawHash({
      address,
      chainType: 'stellar',
      hash: hash as `0x${string}`,
    });

    // 4. Submit the signed transaction
    const { txHash } = await submit({
      xdr,
      signatureHex: signature,
      stellarAddress: address,
      amount: amountBaseUnits,
    });

    // 5. Return transaction hash
    return txHash;
  }

  return {
    deposit: (amountBaseUnits) =>
      runStellarTx(api.buildDeposit, api.submitDeposit, amountBaseUnits),
    withdraw: (amountBaseUnits) =>
      runStellarTx(api.buildWithdraw, api.submitWithdraw, amountBaseUnits),
  };
}
