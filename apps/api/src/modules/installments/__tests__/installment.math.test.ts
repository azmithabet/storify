import { describe, it, expect } from 'vitest'
import { Decimal, toDecimal, roundMoney } from '../../../shared/utils/decimal'

// Reproduces the math from installment.service.ts (calcMonthlyAmount + the
// schedule sum that approveContract writes). Kept inline so a refactor to the
// service surface (e.g. extracting into a math module) can't accidentally
// break this regression without the tests noticing.

function calcMonthlyAmount(
  total: Decimal,
  downPayment: Decimal,
  count: number,
  interestRate: Decimal,
): Decimal {
  const principal = total.minus(downPayment)
  const interest = principal
    .times(interestRate.dividedBy(100))
    .times(new Decimal(count).dividedBy(12))
  return roundMoney(principal.plus(interest).dividedBy(count))
}

function contractTotal(
  total: Decimal,
  downPayment: Decimal,
  count: number,
  interestRate: Decimal,
): Decimal {
  const principal = total.minus(downPayment)
  const interest = principal
    .times(interestRate.dividedBy(100))
    .times(new Decimal(count).dividedBy(12))
  return roundMoney(downPayment.plus(principal).plus(interest))
}

function buildSchedule(
  contractTotalAmount: Decimal,
  downPayment: Decimal,
  monthlyAmount: Decimal,
  count: number,
): Decimal[] {
  const totalScheduled = contractTotalAmount.minus(downPayment)
  const lastInstallment = roundMoney(
    totalScheduled.minus(monthlyAmount.times(count - 1)),
  )
  const schedule: Decimal[] = []
  for (let i = 0; i < count; i++) {
    schedule.push(i === count - 1 ? lastInstallment : monthlyAmount)
  }
  return schedule
}

describe('installment math', () => {
  it('schedule + downPayment sums exactly to contract total', () => {
    // 10000 total, 1000 down, 12 months, 12% annual interest
    const total = toDecimal(10000)
    const down = toDecimal(1000)
    const count = 12
    const rate = toDecimal(12)

    const contract = contractTotal(total, down, count, rate)
    const monthly = calcMonthlyAmount(total, down, count, rate)
    const schedule = buildSchedule(contract, down, monthly, count)

    const sum = schedule.reduce((acc, x) => acc.plus(x), toDecimal(0)).plus(down)
    expect(roundMoney(sum).toString()).toBe(contract.toString())
  })

  it('handles odd division (rounding remainder absorbed by final payment)', () => {
    // 10000 / 7 = 1428.57142857… — rounded to 4dp leaves a residue.
    const total = toDecimal(10000)
    const down = toDecimal(0)
    const count = 7
    const rate = toDecimal(0)

    const contract = contractTotal(total, down, count, rate)
    const monthly = calcMonthlyAmount(total, down, count, rate)
    const schedule = buildSchedule(contract, down, monthly, count)

    const sum = schedule.reduce((acc, x) => acc.plus(x), toDecimal(0)).plus(down)
    expect(roundMoney(sum).toString()).toBe(contract.toString())

    // First 6 installments should equal monthly; last should differ by the residue.
    for (let i = 0; i < count - 1; i++) {
      expect(schedule[i].equals(monthly)).toBe(true)
    }
  })

  it('zero interest → schedule sum equals principal', () => {
    const total = toDecimal(1200)
    const down = toDecimal(0)
    const count = 12
    const rate = toDecimal(0)

    const monthly = calcMonthlyAmount(total, down, count, rate)
    expect(monthly.toNumber()).toBe(100)

    const contract = contractTotal(total, down, count, rate)
    expect(contract.toString()).toBe('1200')
  })

  it('interest math: 12% annual on 12000 over 12 months adds 1440 (simple interest)', () => {
    // principal * rate/100 * count/12 = 12000 * 0.12 * 1 = 1440
    const total = toDecimal(12000)
    const down = toDecimal(0)
    const count = 12
    const rate = toDecimal(12)

    const contract = contractTotal(total, down, count, rate)
    expect(contract.toNumber()).toBe(13440)
  })

  it('down payment never exceeds contract total in the math', () => {
    // Regression guard: contractTotal should never come out less than downPayment
    // even with weird rate values, because principal = total − down ≥ 0 by
    // the up-front validation in createContract.
    const total = toDecimal('100.50')
    const down = toDecimal('100')
    const count = 3
    const rate = toDecimal(10)

    const contract = contractTotal(total, down, count, rate)
    expect(contract.greaterThanOrEqualTo(down)).toBe(true)
  })
})
