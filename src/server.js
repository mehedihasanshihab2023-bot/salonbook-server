import { getApp } from "./app.js"
import { env } from "./config/env.js"

async function main() {
  const app = await getApp()

  app.listen(env.port, () => {
    console.log(`[server] SalonBook API listening on ${env.serverUrl}`)
    console.log(`[server] client origin: ${env.clientUrl}`)
  })
}

main().catch((err) => {
  console.error("[server] failed to start:", err)
  process.exit(1)
})
