import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';

const BIG_BALANCE = (RESERVE_BUFFER_BASE_UNITS + 1_000_000_000n).toString(); // reserva + 100 XLM

it('build: checa saldo, monta o xdr do vault e retorna o hash (sem fundClient)', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn().mockResolvedValue({ xdr: 'XDR1' }) };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(BigInt(BIG_BALANCE)),
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xabc' }),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.build('co_1', 1000000n);

  expect(stellar.fundClient).not.toHaveBeenCalled();
  expect(stellar.getNativeBalance).toHaveBeenCalledWith('GADDR');
  expect(vault.buildDeposit).toHaveBeenCalledWith('GADDR', 1000000n);
  expect(r).toEqual({ xdr: 'XDR1', hash: '0xabc' });
});

it('build: rejeita quando amount > spendable (saldo insuficiente)', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(RESERVE_BUFFER_BASE_UNITS + 5_000000n), // só 0.5 XLM spendable
    hashForSigning: vi.fn(),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 1_000000000n)).rejects.toThrow(BadRequestException);
  expect(vault.buildDeposit).not.toHaveBeenCalled();
});

it('build: traduz InsufficientBalance da simulação do vault em 400 saldo insuficiente', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  // A simulação da DeFindex lança quando o SAC não tem saldo suficiente (deixa
  // menos que a reserva base). O erro chega como objeto do SDK, não Error.
  const vault = {
    buildDeposit: vi.fn().mockRejectedValue({
      message: 'VaultErrors.InsufficientBalance',
      errorCode: 111,
      error: 'Simulation Failed',
    }),
  };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(BigInt(BIG_BALANCE)),
    hashForSigning: vi.fn(),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 1_000_000n)).rejects.toThrow(BadRequestException);
  await expect(svc.build('co_1', 1_000_000n)).rejects.toThrow('saldo insuficiente');
});

it('build: repassa erros do vault que não são InsufficientBalance', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn().mockRejectedValue(new Error('depositToVault returned null xdr')) };
  const stellar = {
    getNativeBalance: vi.fn().mockResolvedValue(BigInt(BIG_BALANCE)),
    hashForSigning: vi.fn(),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 1_000_000n)).rejects.toThrow('null xdr');
});

it('build: rejeita amount acima do teto MAX_DEPOSIT', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = { getNativeBalance: vi.fn(), hashForSigning: vi.fn(), fundClient: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 100_000_000_001n)).rejects.toThrow(BadRequestException);
  expect(vault.buildDeposit).not.toHaveBeenCalled();
});

it('fund: funda a carteira do cliente via sponsor e retorna o txHash', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = {
    fundClient: vi.fn().mockResolvedValue('FUNDTX'),
    getNativeBalance: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.fund('co_1', 1_000_000_000n); // 100 XLM

  expect(stellar.fundClient).toHaveBeenCalledWith('GADDR', 1_000_000_000n);
  expect(vault.buildDeposit).not.toHaveBeenCalled(); // funda a carteira, NÃO aporta no vault
  expect(ledger.recordDeposit).not.toHaveBeenCalled();
  expect(r).toEqual({ txHash: 'FUNDTX' });
});

it('fund: rejeita amount acima do teto MAX_DEPOSIT (protege o sponsor)', async () => {
  const wallet = { getAddress: vi.fn() };
  const vault = { buildDeposit: vi.fn() };
  const stellar = { fundClient: vi.fn(), getNativeBalance: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.fund('co_1', 100_000_000_001n)).rejects.toThrow(BadRequestException);
  expect(wallet.getAddress).not.toHaveBeenCalled();
  expect(stellar.fundClient).not.toHaveBeenCalled();
});

it('submit: attaches sig, submits, records deposit', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TX9' }) };
  const ledger = { recordDeposit: vi.fn().mockResolvedValue(undefined) };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GADDR', amount: '1000000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
  expect(ledger.recordDeposit).toHaveBeenCalledWith('co_1', 1000000n, 'TX9');
  expect(r).toEqual({ txHash: 'TX9' });
});

it('submit: rejeita com Forbidden quando o address não bate com a wallet registrada', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  await expect(
    svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GEVIL', amount: '1000000' }),
  ).rejects.toThrow(ForbiddenException);
  expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
  expect(ledger.recordDeposit).not.toHaveBeenCalled();
});
