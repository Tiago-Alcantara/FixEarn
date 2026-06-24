import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionBuilder, Keypair, Networks, xdr as StellarXdr, rpc,
} from '@stellar/stellar-sdk';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

@Injectable()
export class StellarService {
  private readonly passphrase: string;
  constructor(@Inject(APP_CONFIG) private readonly cfg: Env) {
    this.passphrase = cfg.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
  }

  hashForSigning(xdr: string): { hash: string } {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    return { hash: '0x' + tx.hash().toString('hex') };
  }

  async attachAndSubmit(xdr: string, stellarAddress: string, signatureHex: string): Promise<{ txHash: string }> {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    const kp = Keypair.fromPublicKey(stellarAddress);
    const sig = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    const decorated = new StellarXdr.DecoratedSignature({ hint: kp.signatureHint(), signature: sig });
    tx.signatures.push(decorated);

    const server = new rpc.Server(this.cfg.sorobanRpcUrl);
    const sent = await server.sendTransaction(tx);
    if (sent.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
    return { txHash: sent.hash };
  }
}
