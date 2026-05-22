import { describe, it, expect } from 'vitest'
import { calculateFee } from '../fee'
import { toDecimal, ZERO } from '../decimal'

// Minimal shape of a PaymentMethod row — calculateFee only reads four fields.
function pm(args: {
  feeType: 'none' | 'percentage' | 'fixed' | 'both'
  feePercentage?: number | string
  feeFixed?: number | string
  feeBearer?: 'merchant' | 'customer'
}) {
  return {
    feeType: args.feeType,
    feePercentage: toDecimal(args.feePercentage ?? 0),
    feeFixed: toDecimal(args.feeFixed ?? 0),
    feeBearer: args.feeBearer ?? 'merchant',
  } as const
}

describe('calculateFee', () => {
  it('returns zero fee when feeType is none', () => {
    const result = calculateFee(toDecimal(100), pm({ feeType: 'none', feePercentage: 5 }))
    expect(result.feeAmount.toString()).toBe(ZERO.toString())
    expect(result.feeAddedToTotal).toBe(false)
  })

  it('computes percentage fee', () => {
    const result = calculateFee(toDecimal(100), pm({ feeType: 'percentage', feePercentage: 2.5 }))
    expect(result.feeAmount.toNumber()).toBe(2.5)
  })

  it('computes fixed fee', () => {
    const result = calculateFee(toDecimal(100), pm({ feeType: 'fixed', feeFixed: 3 }))
    expect(result.feeAmount.toNumber()).toBe(3)
  })

  it('computes both percentage and fixed when feeType=both', () => {
    const result = calculateFee(
      toDecimal(100),
      pm({ feeType: 'both', feePercentage: 2, feeFixed: 1 }),
    )
    // 100 * 2% + 1 = 3
    expect(result.feeAmount.toNumber()).toBe(3)
  })

  it('flags feeAddedToTotal=true when customer bears the fee', () => {
    const result = calculateFee(
      toDecimal(100),
      pm({ feeType: 'percentage', feePercentage: 2, feeBearer: 'customer' }),
    )
    expect(result.feeAddedToTotal).toBe(true)
  })

  it('flags feeAddedToTotal=false when merchant bears the fee', () => {
    const result = calculateFee(
      toDecimal(100),
      pm({ feeType: 'percentage', feePercentage: 2, feeBearer: 'merchant' }),
    )
    expect(result.feeAddedToTotal).toBe(false)
  })

  it('respects bearer override over the payment-method default', () => {
    const result = calculateFee(
      toDecimal(100),
      pm({ feeType: 'percentage', feePercentage: 2, feeBearer: 'merchant' }),
      'customer',
    )
    expect(result.feeAddedToTotal).toBe(true)
  })

  it('rounds the resulting fee to money precision', () => {
    // 99.99 * 2.5% = 2.49975 → 2.4998 at 4dp (roundMoney precision)
    const result = calculateFee(toDecimal('99.99'), pm({ feeType: 'percentage', feePercentage: 2.5 }))
    expect(result.feeAmount.toNumber()).toBeCloseTo(2.4998, 4)
  })

  it('handles zero total without dividing by zero', () => {
    const result = calculateFee(ZERO, pm({ feeType: 'both', feePercentage: 5, feeFixed: 1 }))
    // 0 * 5% + 1 = 1
    expect(result.feeAmount.toNumber()).toBe(1)
  })
})
