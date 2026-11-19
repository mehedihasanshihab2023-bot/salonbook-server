/**
 * Seeds a demo database: the first administrator account, a demo
 * customer and 12 salon services matching the public catalogue.
 * Useful for pointing reviewers at a fresh database.
 *
 * Usage:
 *   npm run seed-demo
 *   npm run seed-demo -- mongodb://127.0.0.1:27017/salonbook
 */
import mongoose from "mongoose"

import { connectDb, disconnectDb } from "../src/config/db.js"
import { createAuth } from "../src/lib/auth.js"
import { seedDemoData } from "../src/lib/seed.js"

async function main() {
  // An explicit URI argument wins (e.g. seeding a running memory server);
  // otherwise the shared .env configuration is used.
  const explicitUri = process.argv[2]
  if (explicitUri) {
    await mongoose.connect(explicitUri)
    console.log(`[seed] connected to ${explicitUri}`)
  } else {
    await connectDb()
  }

  const auth = createAuth()
  await seedDemoData(auth)
  console.log("[seed] done")
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err?.message ?? err)
    process.exitCode = 1
  })
  .finally(() => disconnectDb())
