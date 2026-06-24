import { config } from 'dotenv';
import { join } from 'path';

// Load apps/api/.env into process.env before tests run so jest can reach the
// local Postgres without requiring the developer to export env vars manually.
config({ path: join(__dirname, '..', '.env'), quiet: true });

// JSON cannot serialize BigInt; encode as decimal string at the boundary.
// Must mirror the shim in main.ts so tests exercise the same behaviour.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
