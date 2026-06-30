import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  DEFINDEX_API_KEY: z.string().min(1),
  DEFINDEX_BASE_URL: z.string().url(),
  VAULT_ADDRESS: z.string().min(1),
  USDC_ADDRESS: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'public']),
  SOROBAN_RPC_URL: z.string().url(),
  FEE_SPONSOR_SECRET_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  // Demo only: injeta rendimento sintético (basis points sobre o principal).
  // 0 = desligado (produção). Ex.: 320 = 3,2% de rendimento fictício.
  DEMO_YIELD_BPS: z.coerce.number().int().nonnegative().default(0),
  // Demo only: variação "vs mês anterior" exibida quando NÃO há histórico de
  // snapshot suficiente. Só usada quando DEMO_YIELD_BPS > 0. Ex.: "3.2".
  DEMO_RETURNS_CHANGE_PERCENT: z.string().default('3.2'),
});

export type Env = {
  databaseUrl: string;
  privyAppId: string;
  privyAppSecret: string;
  defindexApiKey: string;
  defindexBaseUrl: string;
  vaultAddress: string;
  usdcAddress: string;
  stellarNetwork: 'testnet' | 'public';
  sorobanRpcUrl: string;
  feeSponsorSecretKey: string;
  port: number;
  demoYieldBps: number;
  demoReturnsChangePercent: string;
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const parsed = schema.parse(raw);
  return {
    databaseUrl: parsed.DATABASE_URL,
    privyAppId: parsed.PRIVY_APP_ID,
    privyAppSecret: parsed.PRIVY_APP_SECRET,
    defindexApiKey: parsed.DEFINDEX_API_KEY,
    defindexBaseUrl: parsed.DEFINDEX_BASE_URL,
    vaultAddress: parsed.VAULT_ADDRESS,
    usdcAddress: parsed.USDC_ADDRESS,
    stellarNetwork: parsed.STELLAR_NETWORK,
    sorobanRpcUrl: parsed.SOROBAN_RPC_URL,
    feeSponsorSecretKey: parsed.FEE_SPONSOR_SECRET_KEY,
    port: parsed.PORT,
    demoYieldBps: parsed.DEMO_YIELD_BPS,
    demoReturnsChangePercent: parsed.DEMO_RETURNS_CHANGE_PERCENT,
  };
}
