import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { DepositService } from './deposit.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway/payment-gateway';
import { SimulatorGateway } from './gateway/simulator.gateway';
import { SslcommerzGateway } from './gateway/sslcommerz.gateway';
import { PaymentCallbacksController } from './payment-callbacks.controller';
import { TopUpService } from './top-up.service';
import { WalletAdminController } from './wallet-admin.controller';
import { WalletAdminService } from './wallet-admin.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * The wallet.
 *
 * Money comes in two ways: through the payment gateway, which charges a card
 * or a mobile wallet and credits on the gateway's own confirmation, or
 * declared by hand — money the person sent to the platform's account, which
 * someone checks before crediting. Both end at the same ledger.
 *
 * It moves between accounts as a payment or a transfer, including by QR, and
 * leaves as a withdrawal: a request that a person pays out and marks paid.
 * The gateway takes money in; it does not send money out.
 */
function createGateway(config: ConfigService<Env, true>): PaymentGateway | null {
  switch (config.get('PAYMENT_PROVIDER', { infer: true })) {
    case 'sslcommerz':
      return new SslcommerzGateway(
        config.get('SSLCOMMERZ_STORE_ID', { infer: true })!,
        config.get('SSLCOMMERZ_STORE_PASSWORD', { infer: true })!,
        config.get('SSLCOMMERZ_SANDBOX', { infer: true }),
      );
    case 'simulator':
      return new SimulatorGateway();
    default:
      return null;
  }
}

@Module({
  controllers: [WalletController, WalletAdminController, PaymentCallbacksController],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: createGateway,
    },
    WalletService,
    TopUpService,
    DepositService,
    WalletAdminService,
  ],
  exports: [WalletService, DepositService],
})
export class WalletModule {}
