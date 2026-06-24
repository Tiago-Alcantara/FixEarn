import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.module';
import type { Env } from './config/env';

// JSON cannot serialize BigInt; encode as decimal string at the boundary.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS: the web app is served from a different origin (localhost:3000 in dev,
  // the Vercel domain in prod). Allow the origins listed in CORS_ORIGIN
  // (comma-separated); if unset, reflect any origin (fine for MVP — lock down
  // to the real web domain before production).
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  const config = app.get<Env>(APP_CONFIG);
  await app.listen(config.port);
}
bootstrap();
