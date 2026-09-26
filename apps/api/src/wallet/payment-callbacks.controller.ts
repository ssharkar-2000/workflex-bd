import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { TopUp } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway/payment-gateway';
import {
  SIMULATOR_OUTCOMES,
  SimulatorGateway,
  type SimulatorOutcome,
} from './gateway/simulator.gateway';
import {
  noMatchPage,
  PAGE_CSP,
  returnPage,
  simulatorContinuePage,
  simulatorPage,
} from './pages';
import { withTopUpParam } from './return-url';
import { TopUpService } from './top-up.service';

/**
 * What the payment gateway calls.
 *
 * Public by necessity: the gateway's servers and the payer's browser carry no
 * token. That is safe because nothing here is taken on trust — every result
 * is re-checked with the gateway before it changes anything (see
 * TopUpService.settle).
 *
 * The success, fail and cancel routes are the payer's browser arriving back
 * from the gateway's page; they end by sending that browser on to the app.
 * The IPN route is the gateway's server calling ours directly.
 */
@ApiExcludeController()
@Public()
@Controller('payments')
export class PaymentCallbacksController {
  constructor(
    private readonly topUps: TopUpService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway | null,
  ) {}

  @Post('sslcommerz/success')
  async success(@Body() body: Record<string, unknown>, @Res() res: Response) {
    this.sendBack(res, await this.topUps.handleReturn('success', body), body);
  }

  @Post('sslcommerz/fail')
  async fail(@Body() body: Record<string, unknown>, @Res() res: Response) {
    this.sendBack(res, await this.topUps.handleReturn('fail', body), body);
  }

  @Post('sslcommerz/cancel')
  async cancel(@Body() body: Record<string, unknown>, @Res() res: Response) {
    this.sendBack(res, await this.topUps.handleReturn('cancel', body), body);
  }

  @Post('sslcommerz/ipn')
  @HttpCode(200)
  async ipn(@Body() body: Record<string, unknown>) {
    await this.topUps.handleIpn(body);
    return { received: true };
  }

  // --- development simulator ---

  @Get('simulator/:tranId')
  simulatorPage(
    @Param('tranId') tranId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const session = this.simulator().session(tranId);
    if (!session) throw AppException.notFound('No such simulated payment');

    const self = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    this.html(res, simulatorPage(tranId, session.amount, self));
  }

  @Post('simulator/:tranId/:outcome')
  simulate(
    @Param('tranId') tranId: string,
    @Param('outcome') outcome: string,
    @Res() res: Response,
  ) {
    if (!(SIMULATOR_OUTCOMES as readonly string[]).includes(outcome)) {
      throw AppException.notFound('No such outcome');
    }
    const result = this.simulator().complete(tranId, outcome as SimulatorOutcome);
    if (!result) throw AppException.notFound('No such simulated payment');

    this.html(
      res,
      simulatorContinuePage(result.paid, outcome as SimulatorOutcome, result.action, result.fields),
    );
  }

  /** The simulator, or a 404 — these routes do not exist on a real gateway. */
  private simulator(): SimulatorGateway {
    if (this.gateway instanceof SimulatorGateway) return this.gateway;
    throw AppException.notFound('Not found');
  }

  /**
   * Sends the payer's browser back to the app.
   *
   * The web app gets a plain redirect. A phone gets a page with the app's
   * link, because a redirect from here straight into an app is something
   * mobile browsers are free to refuse without a fresh tap.
   */
  private sendBack(res: Response, topUp: TopUp | null, body: Record<string, unknown>) {
    if (!topUp) {
      const reference = typeof body.tran_id === 'string' ? body.tran_id : null;
      this.html(res, noMatchPage(reference), 404);
      return;
    }

    const target = withTopUpParam(topUp.returnUrl, topUp.id);
    if (/^https?:/i.test(target)) {
      res.redirect(303, target);
      return;
    }
    this.html(res, returnPage(target, topUp.status, topUp.amount));
  }

  private html(res: Response, page: string, status = 200) {
    res
      .status(status)
      .setHeader('Content-Security-Policy', PAGE_CSP)
      .type('html')
      .send(page);
  }
}
