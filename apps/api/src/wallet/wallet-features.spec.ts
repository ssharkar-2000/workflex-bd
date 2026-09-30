import { ConfigService } from '@nestjs/config';
import { createDepositSchema, WALLET_QR_PREFIX } from '@workflex/shared';
import { DepositService } from './deposit.service';
import { WalletService } from './wallet.service';
import { WalletAdminService } from './wallet-admin.service';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const dto = {requestId, amount: 100, method: 'BKASH' as const, senderAccount: '01712345678', reference: 'TX1234'};
const config = new ConfigService({WALLET_DEPOSIT_BKASH: '01700000000'});
const row = {...dto, id, gateway: 'manual', depositMethod: 'BKASH', status: 'PENDING', createdAt: new Date(), completedAt: null, reviewNote: null};

describe('Manual deposits', () => {
  it('normalizes transaction references before duplicate detection', () => {
    expect(createDepositSchema.parse({...dto, reference: ' tx1234 '}).reference).toBe('TX1234');
  });
  it('records a pending claim without crediting money', async () => {
    const prisma = {topUp: {findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(row)}};
    const wallet = {creditTopUp: jest.fn()};
    const service = new DepositService(prisma as any, wallet as any, config as any);
    expect((await service.declare(id, dto)).status).toBe('PENDING');
    expect(wallet.creditTopUp).not.toHaveBeenCalled();
  });
  it('rejects deposits to an unconfigured method', async () => {
    const prisma = {topUp: {findFirst: jest.fn().mockResolvedValue(null), create: jest.fn()}};
    const service = new DepositService(prisma as any, {} as any, new ConfigService() as any);
    await expect(service.declare(id, dto)).rejects.toThrow('not configured');
    expect(prisma.topUp.create).not.toHaveBeenCalled();
  });
  it('returns the winning declaration after a concurrent retry', async () => {
    const prisma = {topUp: {findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row), create: jest.fn().mockRejectedValue({code: 'P2002'})}};
    const service = new DepositService(prisma as any, {} as any, config as any);
    expect((await service.declare(id, dto)).id).toBe(id);
  });
  it('rejects a reference already claimed with another request id', async () => {
    const prisma = {topUp: {findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockRejectedValue({code: 'P2002'})}};
    await expect(new DepositService(prisma as any, {} as any, config as any).declare(id, dto)).rejects.toThrow('already been used');
  });
  it('never approves an unverified pending gateway top-up', async () => {
    const prisma = {topUp: {findUnique: jest.fn().mockResolvedValue({gateway: 'sslcommerz'})}};
    const wallet = {creditTopUp: jest.fn().mockResolvedValue(true)};
    const service = new WalletAdminService(prisma as any, wallet as any, config as any);
    await service.approveTopUp(id, other);
    expect(wallet.creditTopUp.mock.calls[0][1]).toEqual(['HELD']);
  });
  it('allows manual pending deposits through the atomic approval path', async () => {
    const prisma = {topUp: {findUnique: jest.fn().mockResolvedValue({gateway: 'manual'})}};
    const wallet = {creditTopUp: jest.fn().mockResolvedValue(true)};
    await new WalletAdminService(prisma as any, wallet as any, config as any).approveTopUp(id, other);
    expect(wallet.creditTopUp.mock.calls[0][1]).toEqual(['PENDING']);
  });
});

describe('Wallet transfers', () => {
  function setup(balance: number, withdrawable: number) {
    const tx = {walletPayment: {create: jest.fn().mockResolvedValue({id: requestId, amount: 100, createdAt: new Date()})}};
    const prisma = {$transaction: (fn: any) => fn(tx), user: {findUnique: jest.fn().mockResolvedValue({status: 'ACTIVE'})}};
    const service = new WalletService(prisma as any, config as any, null);
    jest.spyOn(service as any, 'paymentByRequest').mockResolvedValue(null);
    jest.spyOn(service, 'resolve').mockResolvedValue({userId: other, code: 'WF-222222', name: 'Recipient', phone: 'masked'});
    jest.spyOn(service as any, 'lock').mockImplementation(async (_tx, uid) => uid === id ? {id, balance, withdrawable} : {id: other, balance: 0, withdrawable: 0});
    const post = jest.spyOn(service as any, 'post').mockResolvedValue({balance: balance - 100});
    return {service, post, tx};
  }
  it('cannot turn topped-up funds into withdrawable money', async () => {
    const {service, post} = setup(150, 30);
    await service.transfer(id, {code: other, amount: 100, requestId});
    expect(post.mock.calls[0]![2]).toEqual({balance: -100, withdrawable: 0});
    expect(post.mock.calls[1]![2]).toEqual({balance: 100, withdrawable: 0});
  });
  it('preserves only the earned portion on a mixed transfer', async () => {
    const {service, post} = setup(150, 100);
    await service.transfer(id, {code: other, amount: 100, requestId});
    expect(post.mock.calls[0]![2]).toEqual({balance: -100, withdrawable: -50});
    expect(post.mock.calls[1]![2]).toEqual({balance: 100, withdrawable: 50});
  });
  it('rejects insufficient balance without a payment or ledger entry', async () => {
    const {service, post, tx} = setup(20, 0);
    await expect(service.transfer(id, {code: other, amount: 100, requestId})).rejects.toThrow('Not enough');
    expect(post).not.toHaveBeenCalled(); expect(tx.walletPayment.create).not.toHaveBeenCalled();
  });
  it('rejects paying yourself', async () => {
    const {service, post} = setup(150, 0);
    jest.spyOn(service, 'resolve').mockResolvedValue({userId: id, code: 'WF-111111', name: 'Me', phone: 'masked'});
    await expect(service.transfer(id, {code: id, amount: 100, requestId})).rejects.toThrow('own wallet');
    expect(post).not.toHaveBeenCalled();
  });
  it('returns an already committed retry before checking depleted funds', async () => {
    const {service, post, tx} = setup(0, 0);
    (service as any).paymentByRequest.mockResolvedValueOnce(null).mockResolvedValueOnce({id: requestId});
    expect(await service.transfer(id, {code: other, amount: 100, requestId})).toEqual({id: requestId});
    expect(post).not.toHaveBeenCalled(); expect(tx.walletPayment.create).not.toHaveBeenCalled();
  });
});

describe('Wallet identity and receipt isolation', () => {
  it('puts the account id in the QR and only a short display code beside it', async () => {
    const prisma = {user: {findUniqueOrThrow: jest.fn().mockResolvedValue({firstName: 'Asif', lastName: null, phone: '01712345678'})}};
    const result = await new WalletService(prisma as any, config as any, null).code(id);
    expect(result.payload).toBe(`${WALLET_QR_PREFIX}${id}`);
    expect(result.code).toBe('WF-111111');
  });
  it('only resolves active non-admin accounts', async () => {
    const prisma = {user: {findFirst: jest.fn().mockResolvedValue(null)}};
    await expect(new WalletService(prisma as any, config as any, null).resolve(id)).rejects.toThrow();
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {id, status: 'ACTIVE', isAdmin: false}}));
  });
  it('scopes receipts to the recipient', async () => {
    const prisma = {walletPayment: {findMany: jest.fn().mockResolvedValue([])}};
    const since = new Date('2026-09-27T00:00:00.000Z');
    await new WalletService(prisma as any, config as any, null).receivedSince(id, since);
    expect(prisma.walletPayment.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {payeeId: id, createdAt: {gt: since}}}));
  });
});
