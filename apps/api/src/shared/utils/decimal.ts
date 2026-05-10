import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }
export const ZERO = new Decimal(0)

export function toDecimal(v: number | string | Decimal | null | undefined): Decimal {
  if (v == null) return ZERO
  return new Decimal(v)
}

export function roundMoney(v: Decimal): Decimal {
  return v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}
