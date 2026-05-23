import type { PaymentMethod } from '@hesba/database'
import { Decimal, toDecimal, roundMoney, ZERO } from './decimal'

export interface FeeResult {
  feeAmount: Decimal
  feeAddedToTotal: boolean
}

export function calculateFee(
  totalAmount: Decimal,
  paymentMethod: Pick<PaymentMethod, 'feeType' | 'feePercentage' | 'feeFixed' | 'feeBearer'>,
  bearerOverride?: string,
): FeeResult {
  if (paymentMethod.feeType === 'none') {
    return { feeAmount: ZERO, feeAddedToTotal: false }
  }

  let fee = ZERO

  if (paymentMethod.feeType === 'percentage' || paymentMethod.feeType === 'both') {
    fee = fee.plus(totalAmount.times(toDecimal(paymentMethod.feePercentage)).dividedBy(100))
  }

  if (paymentMethod.feeType === 'fixed' || paymentMethod.feeType === 'both') {
    fee = fee.plus(toDecimal(paymentMethod.feeFixed))
  }

  const bearer = bearerOverride ?? paymentMethod.feeBearer

  return {
    feeAmount: roundMoney(fee),
    feeAddedToTotal: bearer === 'customer',
  }
}
