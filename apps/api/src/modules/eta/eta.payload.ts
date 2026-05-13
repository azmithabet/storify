import Decimal from 'decimal.js'

/**
 * Builds the ETA canonical JSON document from an invoice.
 * Must conform to ETA e-Invoice SDK v1.0 spec exactly.
 * Decimal precision: amounts use 5 decimal places per ETA spec.
 */
export function buildEtaPayload(params: EtaPayloadParams): EtaDocument {
  const {
    invoice,
    items,
    issuer,
    receiver,
    branchCode,
  } = params

  const invoiceLines = items.map((item, idx) => buildInvoiceLine(item, idx + 1))

  const totalSalesAmount = invoiceLines.reduce(
    (s, l) => s.plus(l.salesTotal),
    new Decimal(0),
  )
  const totalDiscountAmount = new Decimal(0)
  const netAmount = totalSalesAmount.minus(totalDiscountAmount)
  const totalTaxableFees = new Decimal(0)
  const totalItemsDiscountAmount = new Decimal(0)

  const taxTotals = computeTaxTotals(invoiceLines)
  const totalAmount = netAmount.plus(taxTotals.reduce((s, t) => s.plus(t.amount), new Decimal(0)))
  const extraDiscountAmount = new Decimal(0)
  const totalValueAdded = totalAmount

  return {
    issuer: {
      address: issuer.address,
      type: 'B',
      id: issuer.taxpayerId,
      name: issuer.name,
    },
    receiver: receiver
      ? {
          address: receiver.address,
          type: receiver.type ?? 'P',
          id: receiver.nationalId ?? '',
          name: receiver.name,
        }
      : undefined,
    documentType: 'I',
    documentTypeVersion: '1.0',
    dateTimeIssued: invoice.issuedAt.toISOString().replace(/\.\d+Z$/, 'Z'),
    taxpayerActivityCode: issuer.activityCode,
    internalId: invoice.invoiceNumber,
    branchId: branchCode ?? '0',
    invoiceLines,
    totalDiscountAmount: totalDiscountAmount.toDecimalPlaces(5).toNumber(),
    totalSalesAmount: totalSalesAmount.toDecimalPlaces(5).toNumber(),
    netAmount: netAmount.toDecimalPlaces(5).toNumber(),
    taxTotals,
    totalAmount: totalAmount.toDecimalPlaces(5).toNumber(),
    totalItemsDiscountAmount: totalItemsDiscountAmount.toDecimalPlaces(5).toNumber(),
    extraDiscountAmount: extraDiscountAmount.toDecimalPlaces(5).toNumber(),
    totalValueAdded: totalValueAdded.toDecimalPlaces(5).toNumber(),
    totalTaxableFees: totalTaxableFees.toDecimalPlaces(5).toNumber(),
  }
}

function buildInvoiceLine(item: EtaInvoiceItem, lineNo: number): EtaInvoiceLine {
  const unitValue = new Decimal(item.unitPrice.toString())
  const qty = new Decimal(item.quantity.toString())
  const salesTotal = unitValue.times(qty)
  const discountAmount = new Decimal(item.discountAmount?.toString() ?? '0')
  const netTotal = salesTotal.minus(discountAmount)
  const vatRate = new Decimal(item.vatRate?.toString() ?? '14')
  const vatAmount = netTotal.times(vatRate).dividedBy(100)
  const total = netTotal.plus(vatAmount)

  const taxableItems: EtaTaxableItem[] = []
  if (!vatRate.isZero()) {
    taxableItems.push({
      taxType: 'T1',
      amount: vatAmount.toDecimalPlaces(5).toNumber(),
      subType: 'V009',
      rate: vatRate.toNumber(),
    })
  }

  return {
    description: item.description,
    itemType: item.itemType ?? 'EGS',
    itemCode: item.itemCode ?? item.internalCode,
    internalCode: item.internalCode,
    unitType: item.unitType ?? 'EA',
    quantity: item.quantity,
    unitValue: {
      currencySold: item.currency ?? 'EGP',
      amountEGP: unitValue.toDecimalPlaces(5).toNumber(),
      amountSold: unitValue.toDecimalPlaces(5).toNumber(),
      currencyExchangeRate: 1,
    },
    salesTotal: salesTotal.toDecimalPlaces(5).toNumber(),
    discount: {
      rate: 0,
      amount: discountAmount.toDecimalPlaces(5).toNumber(),
    },
    taxableItems,
    netTotal: netTotal.toDecimalPlaces(5).toNumber(),
    itemsDiscount: 0,
    valueDifference: 0,
    totalTaxableFees: 0,
    total: total.toDecimalPlaces(5).toNumber(),
    lineNo,
  }
}

function computeTaxTotals(lines: EtaInvoiceLine[]): EtaTaxTotal[] {
  const byType: Record<string, Decimal> = {}
  for (const line of lines) {
    for (const ti of line.taxableItems) {
      byType[ti.taxType] = (byType[ti.taxType] ?? new Decimal(0)).plus(ti.amount)
    }
  }
  return Object.entries(byType).map(([taxType, amount]) => ({
    taxType,
    amount: amount.toDecimalPlaces(5).toNumber(),
  }))
}

// ------------- Types -------------

export interface EtaPayloadParams {
  invoice: { invoiceNumber: string; issuedAt: Date }
  items: EtaInvoiceItem[]
  issuer: { name: string; taxpayerId: string; activityCode: string; address: EtaAddress }
  receiver?: { name: string; nationalId?: string; type?: string; address: EtaAddress }
  branchCode?: string
}

interface EtaInvoiceItem {
  description: string
  internalCode: string
  quantity: number
  unitPrice: string | number
  vatRate?: string | number
  discountAmount?: string | number
  itemType?: string
  itemCode?: string
  unitType?: string
  currency?: string
}

interface EtaAddress {
  branchId?: string
  country: string
  governate: string
  regionCity: string
  street: string
  buildingNumber: string
  postalCode?: string
  floor?: string
  room?: string
  landmark?: string
  additionalInformation?: string
}

interface EtaInvoiceLine {
  description: string
  itemType: string
  itemCode: string
  internalCode: string
  unitType: string
  quantity: number
  unitValue: { currencySold: string; amountEGP: number; amountSold: number; currencyExchangeRate: number }
  salesTotal: number
  discount: { rate: number; amount: number }
  taxableItems: EtaTaxableItem[]
  netTotal: number
  itemsDiscount: number
  valueDifference: number
  totalTaxableFees: number
  total: number
  lineNo: number
}

interface EtaTaxableItem {
  taxType: string
  amount: number
  subType: string
  rate: number
}

interface EtaTaxTotal {
  taxType: string
  amount: number
}

interface EtaDocument {
  issuer: object
  receiver?: object
  documentType: string
  documentTypeVersion: string
  dateTimeIssued: string
  taxpayerActivityCode: string
  internalId: string
  branchId: string
  invoiceLines: EtaInvoiceLine[]
  totalDiscountAmount: number
  totalSalesAmount: number
  netAmount: number
  taxTotals: EtaTaxTotal[]
  totalAmount: number
  totalItemsDiscountAmount: number
  extraDiscountAmount: number
  totalValueAdded: number
  totalTaxableFees: number
}
