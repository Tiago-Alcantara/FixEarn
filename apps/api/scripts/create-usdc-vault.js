const { Asset, Networks, Keypair, TransactionBuilder, rpc, scValToNative } = require('@stellar/stellar-sdk');
const { DefindexSDK, SupportedNetworks } = require('@defindex/sdk');

const RPC = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const sdk = new DefindexSDK({ apiKey: process.env.DEFINDEX_API_KEY, baseUrl: process.env.DEFINDEX_BASE_URL });

(async () => {
  const kp = Keypair.fromSecret(process.env.FEE_SPONSOR_SECRET_KEY);
  const caller = kp.publicKey();
  // USDC underlying used by DeFindex's Blend USDC strategy on testnet.
  // Must match the strategy's `asset()` or createVault rejects the strategy.
  const sac = process.env.USDC_ADDRESS || 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU';
  const blendUsdc = 'CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY';
  console.log('caller:', caller, '\nUSDC:', sac, '\nBlend USDC strategy:', blendUsdc);

  const { xdr } = await sdk.createVault({
    caller,
    roles: { emergencyManager: caller, rebalanceManager: caller, feeReceiver: caller, manager: caller },
    vaultFeeBps: 0, name: 'Yield2Pay-USDC', symbol: 'Y2PUSDC',
    assets: [{ address: sac, strategies: [{ address: blendUsdc, name: 'blend_usdc', paused: false }] }],
    upgradable: true,
  }, SupportedNetworks.TESTNET);
  console.log('createVault xdr len:', xdr.length);

  const server = new rpc.Server(RPC);
  let tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) { console.error('SIM ERROR:', sim.error); process.exit(1); }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(kp);
  const sent = await server.sendTransaction(tx);
  console.log('sent status:', sent.status, 'hash:', sent.hash);
  if (sent.status === 'ERROR') { console.error(JSON.stringify(sent.errorResult)); process.exit(1); }
  let gr = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && gr.status === 'NOT_FOUND'; i++) { await new Promise(r=>setTimeout(r,2000)); gr = await server.getTransaction(sent.hash); }
  console.log('final tx status:', gr.status);
  if (gr.status === 'SUCCESS' && gr.returnValue) {
    try { console.log('VAULT_ADDRESS:', scValToNative(gr.returnValue)); }
    catch(e) { console.log('returnValue(base64):', gr.returnValue.toXDR('base64')); }
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
