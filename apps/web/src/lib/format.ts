// Arabic locale with the Unicode `nu-latn` extension — keeps Arabic month and
// weekday names but forces Latin (0–9) digits everywhere numbers appear.
const LOCALE = 'ar-EG-u-nu-latn'

type DateInput = Date | string | number

const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d))

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(LOCALE, options)
}

export function formatMoney(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}

export function formatDate(d: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(d).toLocaleDateString(LOCALE, options)
}

export function formatDateTime(d: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(d).toLocaleString(LOCALE, options)
}

export function formatTime(d: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', ...options })
}
