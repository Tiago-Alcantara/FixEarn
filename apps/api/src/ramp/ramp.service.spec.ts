import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RampService } from './ramp.service';

function make(overrides: {
  order?: any;
  efOrder?: any;
  registered?: string;
} = {}) {
  const prisma = {
    rampOrder: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.order ?? { orderId: 'o1', companyId: 'co_1', status: 'funded' },
      ),
      update: vi.fn().mockResolvedValue(undefined),
    },
    etherfuseCustomer: { findUnique: vi.fn() },
  };
  const wallet = {
    getAddress: vi.fn().mockResolvedValue(overrides.registered ?? 'GADDR'),
  };
  const stellar = {
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xhash' }),
    attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'CLAIMTX' }),
  };
  const ef = {
    getOrder: vi.fn().mockResolvedValue(
      overrides.efOrder ?? { orderId: 'o1', status: 'completed' },
    ),
  };
  const svc = new RampService(
    prisma as any,
    wallet as any,
    stellar as any,
    ef as any,
  );
  return { svc, prisma, wallet, stellar, ef };
}

it('getOrderClaim: skip=true quando a order não tem claimable', async () => {
  const { svc } = make({ efOrder: { orderId: 'o1', status: 'completed' } });
  const r = await svc.getOrderClaim('co_1', 'o1');
  expect(r).toEqual({ skip: true });
});

it('getOrderClaim: retorna xdr+hash quando há stellarClaimTransaction', async () => {
  const { svc } = make({
    efOrder: { orderId: 'o1', status: 'completed', stellarClaimTransaction: 'AAAA' },
  });
  const r = await svc.getOrderClaim('co_1', 'o1');
  expect(r).toEqual({ skip: false, xdr: 'AAAA', hash: '0xhash' });
});

it('getOrderClaim: 404 quando a order não é da company', async () => {
  const { svc } = make({ order: { orderId: 'o1', companyId: 'outra', status: 'funded' } });
  await expect(svc.getOrderClaim('co_1', 'o1')).rejects.toThrow(NotFoundException);
});

it('submitOrderClaim: anexa assinatura, submete e marca claimed', async () => {
  const { svc, prisma, stellar } = make();
  const r = await svc.submitOrderClaim('co_1', 'o1', {
    xdr: 'X',
    signatureHex: '0xsig',
    stellarAddress: 'GADDR',
  });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
  expect(prisma.rampOrder.update).toHaveBeenCalledWith({
    where: { orderId: 'o1' },
    data: { status: 'claimed' },
  });
  expect(r).toEqual({ txHash: 'CLAIMTX' });
});

it('submitOrderClaim: Forbidden quando o address não bate com a wallet registrada', async () => {
  const { svc, stellar } = make({ registered: 'GADDR' });
  await expect(
    svc.submitOrderClaim('co_1', 'o1', {
      xdr: 'X',
      signatureHex: '0xsig',
      stellarAddress: 'GEVIL',
    }),
  ).rejects.toThrow(ForbiddenException);
  expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
});
