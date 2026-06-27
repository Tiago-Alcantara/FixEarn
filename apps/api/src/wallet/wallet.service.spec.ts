import { WalletService } from './wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const VALID_ADDRESS = 'GDUKN35CP3SQ67QMZL5SKCUCX6MB47TX4SZBTS5UHKFMGTF35Z3723DY';

function deps(findResult: any = null) {
  const prisma = {
    wallet: {
      upsert: vi.fn().mockResolvedValue({ stellarAddress: VALID_ADDRESS }),
      findUnique: vi.fn().mockResolvedValue(findResult),
    },
  } as any;
  const stellar = { ensureAccountFunded: vi.fn().mockResolvedValue(undefined) } as any;
  return { prisma, stellar };
}

it('funds the account then registers it', async () => {
  const { prisma, stellar } = deps();
  const r = await new WalletService(prisma, stellar).register('co_1', VALID_ADDRESS);

  expect(stellar.ensureAccountFunded).toHaveBeenCalledWith(VALID_ADDRESS);
  expect(prisma.wallet.upsert).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    create: { companyId: 'co_1', stellarAddress: VALID_ADDRESS },
    update: { stellarAddress: VALID_ADDRESS },
  });
  expect(r.stellarAddress).toBe(VALID_ADDRESS);
});

it('rejects an invalid address without funding or persisting', async () => {
  const { prisma, stellar } = deps();
  await expect(
    new WalletService(prisma, stellar).register('co_1', 'not-a-key'),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(stellar.ensureAccountFunded).not.toHaveBeenCalled();
  expect(prisma.wallet.upsert).not.toHaveBeenCalled();
});

it('throws when the address is missing', async () => {
  const { prisma, stellar } = deps(null);
  await expect(
    new WalletService(prisma, stellar).getAddress('co_x'),
  ).rejects.toBeInstanceOf(NotFoundException);
});
