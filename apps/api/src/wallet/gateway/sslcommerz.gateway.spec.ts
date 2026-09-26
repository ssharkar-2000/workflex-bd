import { toGatewayPayment } from './sslcommerz.gateway';

describe('toGatewayPayment', () => {
  it('reads a validated payment, with the numbers the gateway sends as strings', () => {
    const payment = toGatewayPayment({
      status: 'VALID',
      tran_id: 'WF0123456789ABCDEF0123',
      val_id: '2409121234567abcdef',
      amount: '500.00',
      currency: 'BDT',
      bank_tran_id: '240912123456789',
      card_type: 'BKASH-BKash',
      risk_level: '0',
      risk_title: 'Safe',
    });

    expect(payment).toEqual({
      status: 'VALID',
      tranId: 'WF0123456789ABCDEF0123',
      valId: '2409121234567abcdef',
      amount: 500,
      currency: 'BDT',
      bankTranId: '240912123456789',
      cardType: 'BKASH-BKash',
      riskLevel: 0,
      riskTitle: 'Safe',
    });
  });

  it('treats VALIDATED — a payment validated before — as valid', () => {
    expect(toGatewayPayment({ status: 'VALIDATED', tran_id: 'WF1' }).status).toBe('VALID');
  });

  it('never reads an unfamiliar status as success', () => {
    for (const status of ['', 'SUCCESS', 'OK', 'PAID', 'INVALID', undefined]) {
      expect(toGatewayPayment({ status, tran_id: 'WF1' }).status).not.toBe('VALID');
    }
  });

  it('maps the failure statuses', () => {
    expect(toGatewayPayment({ status: 'INVALID_TRANSACTION' }).status).toBe('FAILED');
    expect(toGatewayPayment({ status: 'FAILED' }).status).toBe('FAILED');
    expect(toGatewayPayment({ status: 'CANCELLED' }).status).toBe('CANCELLED');
    expect(toGatewayPayment({ status: 'UNATTEMPTED' }).status).toBe('PENDING');
  });

  it('leaves missing or malformed fields empty rather than guessing', () => {
    const payment = toGatewayPayment({ status: 'VALID', amount: 'abc', risk_level: '' });
    expect(payment.amount).toBeNull();
    expect(payment.riskLevel).toBeNull();
    expect(payment.tranId).toBe('');
    expect(payment.valId).toBeNull();
  });
});
