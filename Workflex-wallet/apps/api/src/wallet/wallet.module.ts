import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { WalletAdminController } from './wallet-admin.controller';
import { WalletAdminService } from './wallet-admin.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * The wallet: a ledger this system owns end to end.
 *
 * There is no payment gateway behind it. Money is added by sending it to the
 * platform's own bKash, Nagad or bank account and declaring the transaction
 * id, which someone approves against the receiving statement; it moves
 * between accounts as a transfer, including by scanning a wallet's QR; and it
 * leaves as a withdrawal that is paid out by hand and then marked paid.
 *
 * Every one of those is a row in this database rather than a call to anyone
 * else, so nothing here can be left half-done by a third party going quiet.
 */
@Module({
  controllers: [WalletController, WalletAdminController],
  providers: [WalletService, DepositService, WalletAdminService],
  exports: [WalletService, DepositService],
})
export class WalletModule {}
