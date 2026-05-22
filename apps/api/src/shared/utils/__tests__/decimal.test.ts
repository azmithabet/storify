import { describe, it, expect } from 'vitest'
import { Decimal, toDecimal, roundMoney, ZERO } from '../decimal'

describe('toDecimal', () => {
  it('returns ZERO for null', () => {
    expect(toDecimal(null).toString()).toBe(ZERO.toString())
  })

  it('returns ZERO for undefined', () => {
    expect(toDecimal(undefined).toString()).toBe(ZERO.toString())
  })

  it('parses string input', () => {
    expect(toDecimal('12.345').toNumber()).toBe(12.345)
  })

  it('passes through Decimal input', () => {
    const d = new Decimal('7.5')
    expect(toDecimal(d).equals(d)).toBe(true)
  })

  it('parses numeric input', () => {
    expect(toDecimal(0.1).plus(toDecimal(0.2)).toNumber()).toBe(0.3)
  })
})

describe('roundMoney', () => {
  it('rounds to 4 decimal places half-up', () => {
    expect(roundMoney(toDecimal('1.23455')).toString()).toBe('1.2346')
    expect(roundMoney(toDecimal('1.23454')).toString()).toBe('1.2345')
  })

  it('leaves already-rounded values untouched', () => {
    expect(roundMoney(toDecimal('1.23')).toString()).toBe('1.23')
  })

  it('handles negative values', () => {
    // Half-up on negatives rounds away from zero — 0.5 → 1, -0.5 → -1.
    expect(roundMoney(toDecimal('-0.12345')).toString()).toBe('-0.1235')
  })
})

describe('Decimal arithmetic — IEEE float trap regression', () => {
  // The whole point of Decimal.js: native floats fail this; we shouldn't.
  it('0.1 + 0.2 === 0.3 (not 0.30000000000000004)', () => {
    const sum = toDecimal('0.1').plus(toDecimal('0.2'))
    expect(sum.toString()).toBe('0.3')
  })
})
