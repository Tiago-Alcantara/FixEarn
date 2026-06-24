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
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = {
  databaseUrl: string; privyAppId: string; privyAppSecret: string;
  defindexApiKey: string; defindexBaseUrl: string; vaultAddress: string;
  usdcAddress: string; stellarNetwork: 'testnet' | 'public';
  sorobanRpcUrl: string; port: number;
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const p = schema.parse(raw);
  return {
    databaseUrl: p.DATABASE_URL, privyAppId: p.PRIVY_APP_ID,
    privyAppSecret: p.PRIVY_APP_SECRET, defindexApiKey: p.DEFINDEX_API_KEY,
    defindexBaseUrl: p.DEFINDEX_BASE_URL, vaultAddress: p.VAULT_ADDRESS,
    usdcAddress: p.USDC_ADDRESS, stellarNetwork: p.STELLAR_NETWORK,
    sorobanRpcUrl: p.SOROBAN_RPC_URL, port: p.PORT,
  };
}
