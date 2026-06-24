import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(async () => {
    service = new PrismaService();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('connects to the database', async () => {
    // If $connect succeeds the service is reachable
    await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
});
