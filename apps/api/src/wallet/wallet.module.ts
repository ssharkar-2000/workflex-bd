import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
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
 * One gateway per process, chosen by PAYMENT_PROVIDER. Null when it is off:
 * the wallet still pays and withdraws, it just cannot be topped up. The
 * credentials were checked at boot (see env.schema.ts), so the non-null
 * assertions below cannot fail.
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
    WalletAdminService,
  ],
})
export class WalletModule {}
