// One-shot tenant migration runner. Loads .env from the repo root then calls
// migrateAllTenants(). Intentionally tiny — exists so we can invoke it with a
// single `tsx` call without piping through stdin.
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import { migrateAllTenants } from './migrate-tenants'

migrateAllTenants()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.failed > 0 ? 1 : 0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
