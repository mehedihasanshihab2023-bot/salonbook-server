import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import morgan from "morgan"

import { connectDb } from "./config/db.js"
import { env } from "./config/env.js"
import { createAuth, toNodeHandler } from "./lib/auth.js"
import { seedDemoData } from "./lib/seed.js"
import { errorHandler, notFoundHandler } from "./middleware/errors.js"
import appointmentRoutes from "./routes/appointment.js"
import authRoutes from "./routes/auth.js"
import paymentRoutes, { stripeWebhookHandler } from "./routes/payment.js"
import serviceRoutes from "./routes/service.js"
import statsRoutes from "./routes/stats.js"
import transactionRoutes from "./routes/transaction.js"
import uploadRoutes from "./routes/upload.js"
import userRoutes from "./routes/user.js"
import { attachJsonTransforms } from "./utils/serialize.js"

async function main() {
  attachJsonTransforms()
  await connectDb()

  // Better Auth must be created after the DB connection is open.
  const auth = createAuth()

  // First-run convenience (development only): seed the admin account, a
  // demo customer and the service catalogue when the database is empty.
  // In production the admin is provisioned with `npm run create-admin`.
  if (!env.isProd) {
    await seedDemoData(auth)
  }

  const app = express()

  // ---- Stripe webhook FIRST (needs the raw body for signature verify) ----
  app.post(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookHandler
  )

  // ---- CORS: only the Next.js client may send credentials ----
  app.use(
    cors({
      origin: [env.clientUrl, env.serverUrl],
      credentials: true,
    })
  )

  app.use(morgan("dev"))
  app.use(cookieParser())
  app.use(express.json())

  // ---- Better Auth (email/password + Google OAuth) ----
  app.use("/api/auth", toNodeHandler(auth))

  // ---- REST API v1 ----
  app.use("/api/v1/auth", authRoutes)
  app.use("/api/v1/services", serviceRoutes)
  app.use("/api/v1/appointments", appointmentRoutes)
  app.use("/api/v1/users", userRoutes)
  app.use("/api/v1/transactions", transactionRoutes)
  app.use("/api/v1/payments", paymentRoutes)
  app.use("/api/v1/uploads", uploadRoutes)
  app.use("/api/v1/stats", statsRoutes)

  app.get("/api/health", (_req, res) =>
    res.json({ data: { status: "ok", time: new Date().toISOString() } })
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.listen(env.port, () => {
    console.log(`[server] SalonBook API listening on ${env.serverUrl}`)
    console.log(`[server] client origin: ${env.clientUrl}`)
  })
}

main().catch((err) => {
  console.error("[server] failed to start:", err)
  process.exit(1)
})
