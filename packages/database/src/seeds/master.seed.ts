import dotenv from 'dotenv'
import path from 'path'

// Load root .env (cwd = packages/database when running via pnpm db:seed)
dotenv.config({ path: path.join(process.cwd(), '../../.env') })

import { masterDb } from '../prisma'

const plans = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'للمتاجر الصغيرة',
    priceMonthly: 199,
    priceYearly: 1990,
    maxProducts: 100,
    maxOrders: 300,
    maxUsers: 3,
    maxStorage: 512,
    // Installments now unlocked at every tier (was the #1 differentiating
    // feature for Egyptian retail and the biggest leak in Starter). Volume
    // cap creates upgrade pressure instead of a hard feature wall.
    maxInstallmentPlansMonthly: 15,
    sortOrder: 1,
    features: {
      max_branches: 1,
      max_users: 3,
      installments: true,
      multi_currency: false,
      suppliers: false,
      expenses: false,
      advanced_reports: false,
      offline_mode: false,
      api_access: false,
      services: false,
    },
  },
  {
    name: 'Professional',
    slug: 'professional',
    description: 'للمتاجر المتوسطة والنامية',
    priceMonthly: 499,
    priceYearly: 4990,
    maxProducts: 1000,
    maxOrders: 3000,
    maxUsers: 10,
    maxStorage: 5120,
    maxInstallmentPlansMonthly: 100,
    sortOrder: 2,
    features: {
      max_branches: 5,
      max_users: 15,
      installments: true,
      multi_currency: true,
      suppliers: true,
      expenses: true,
      advanced_reports: true,
      offline_mode: false,
      api_access: false,
      services: false,
    },
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'للمتاجر الكبيرة — بلا حدود',
    priceMonthly: 999,
    priceYearly: 9990,
    maxProducts: 999999,
    maxOrders: 999999,
    maxUsers: 999999,
    maxStorage: 102400,
    maxInstallmentPlansMonthly: 999999,
    sortOrder: 3,
    features: {
      max_branches: -1,
      max_users: -1,
      installments: true,
      multi_currency: true,
      suppliers: true,
      expenses: true,
      advanced_reports: true,
      offline_mode: true,
      api_access: true,
      services: true,
    },
  },
]

async function main() {
  console.log('Seeding master DB plans...')
  for (const plan of plans) {
    await masterDb.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    })
    console.log(`  ✅ ${plan.name} — ${plan.priceMonthly} EGP/mo`)
  }
  console.log('Seeding complete.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => masterDb.$disconnect())
