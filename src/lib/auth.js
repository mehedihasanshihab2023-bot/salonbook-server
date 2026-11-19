import { betterAuth } from "better-auth"
import { mongodbAdapter } from "better-auth/adapters/mongodb"
import { toNodeHandler } from "better-auth/node"
import mongoose from "mongoose"

import { env } from "../config/env.js"
import { User } from "../models/user.js"

let instance = null

/**
 * Builds the Better Auth instance. Must be called AFTER the mongoose
 * connection is open, because the MongoDB adapter binds to the live
 * connection. `usePlural: true` writes to the same pluralized collections
 * (`users`, `sessions`, `accounts`, `verifications`) that our Mongoose
 * models use.
 */
export function createAuth() {
  if (instance) return instance
  instance = betterAuth({
    baseURL: env.serverUrl,
    trustedOrigins: [env.clientUrl],
    secret: env.betterAuthSecret,
    database: mongodbAdapter(mongoose.connection.db, {
      client: mongoose.connection.getClient(),
      usePlural: true,
      // Standalone MongoDB instances (local dev) don't support transactions.
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      password: {
        // Minimum 6 characters — uppercase/lowercase are validated client-side
        // and double-checked here so weak passwords never reach the database.
        verify: (password) => {
          if (password.length < 6) return false
          if (!/[A-Z]/.test(password)) return false
          if (!/[a-z]/.test(password)) return false
          return true
        },
        min: 6,
      },
    },
    socialProviders: {
      google: {
        clientId: env.google.clientId,
        clientSecret: env.google.clientSecret,
        enabled: Boolean(env.google.clientId && env.google.clientSecret),
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "customer",
          input: false, // never settable from the client — admins only
        },
        isBlocked: {
          type: "boolean",
          defaultValue: false,
          input: false, // never settable from the client — admins only
        },
        phoneNumber: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    advanced: {
      defaultCookieAttributes: env.isProd
        ? { sameSite: "none", secure: true }
        : { sameSite: "lax" },
    },
  })
  return instance
}

/** The active Better Auth instance (available after createAuth()). */
export function getAuth() {
  return instance
}

export { toNodeHandler }

/**
 * Reads a Better Auth session out of the incoming request cookies and
 * returns the freshest user document from MongoDB.
 */
export async function getSessionUser(req) {
  const auth = getAuth()
  if (!auth) return null
  const session = await auth.api.getSession({
    headers: {
      get: (name) => req.headers[name.toLowerCase()] ?? undefined,
      cookie: req.headers.cookie,
    },
  })
  if (!session?.user) return null
  // Always read the freshest role / blocked state from the database.
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser) return null
  return { ...session.user, ...dbUser, id: session.user.id }
}
