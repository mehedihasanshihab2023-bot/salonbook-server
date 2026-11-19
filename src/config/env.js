import dotenv from "dotenv"

dotenv.config()

const required = (name, fallback) => process.env[name] ?? fallback

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  serverUrl: process.env.SERVER_URL ?? "http://localhost:5000",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/salonbook",
  useMemoryDb: process.env.USE_MEMORY_DB === "1",
  betterAuthSecret:
    required("BETTER_AUTH_SECRET", "insecure-dev-secret-change-me"),
  jwtSecret: required("JWT_SECRET", "insecure-dev-jwt-change-me"),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },
  imgbbApiKey: process.env.IMGBB_API_KEY ?? "",
  // Admin bootstrap credentials for scripts/create-admin.js (optional).
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  isProd: process.env.NODE_ENV === "production",
}
