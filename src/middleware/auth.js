import jwt from "jsonwebtoken"

import { env } from "../config/env.js"
import { User } from "../models/user.js"
import { ApiError } from "./errors.js"

export const TOKEN_COOKIE = "salonbook_token"
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 // 7 days, in seconds

/** Signs a short profile payload into a 7-day JWT. */
export function signApiToken(user) {
  return jwt.sign(
    { sub: user.id ?? user._id?.toString(), email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: "7d" }
  )
}

export function setTokenCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: env.isProd ? "none" : "lax",
    secure: env.isProd,
    path: "/",
    maxAge: TOKEN_MAX_AGE * 1000,
  })
}

export function clearTokenCookie(res) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: env.isProd ? "none" : "lax",
    secure: env.isProd,
    path: "/",
  })
}

function readToken(req) {
  const header = req.headers.authorization
  if (header?.startsWith("Bearer ")) return header.slice(7).trim()
  return req.cookies?.[TOKEN_COOKIE]
}

/** Fetches the freshest user document (role + block state) from the DB. */
async function loadUser(userId) {
  const user = await User.findById(userId).lean()
  if (!user) {
    throw new ApiError(401, "Your account no longer exists.")
  }
  if (user.isBlocked) {
    throw new ApiError(
      403,
      "Your account has been blocked. Please contact the salon administration."
    )
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? "customer",
    isBlocked: Boolean(user.isBlocked),
    phoneNumber: user.phoneNumber ?? null,
  }
}

/**
 * JWT verification middleware: reads the `salonbook_token` cookie (or
 * Authorization Bearer header), verifies the signature, then re-reads the
 * user from MongoDB so role changes and blocks take effect immediately.
 */
export async function requireAuth(req, _res, next) {
  try {
    const token = readToken(req)
    if (!token) {
      throw new ApiError(
        401,
        "Authentication required. Please sign in to continue."
      )
    }
    let payload
    try {
      payload = jwt.verify(token, env.jwtSecret)
    } catch {
      throw new ApiError(401, "Your session has expired. Please sign in again.")
    }
    req.user = await loadUser(payload.sub)
    next()
  } catch (err) {
    next(err)
  }
}

/** Role guards — each one first runs the full JWT verification chain. */
export const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (req.user?.role !== "admin") {
      return next(
        new ApiError(403, "Admin access required for this operation.")
      )
    }
    next()
  },
]

export const requireCustomer = [
  requireAuth,
  (req, res, next) => {
    if (req.user?.role !== "customer") {
      return next(
        new ApiError(
          403,
          "Only customer accounts can perform this action."
        )
      )
    }
    next()
  },
]

/**
 * Decodes the JWT when one is present but never fails — used by public
 * endpoints (e.g. listing services) that behave differently for admins.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = readToken(req)
    if (token) {
      const payload = jwt.verify(token, env.jwtSecret)
      req.user = await loadUser(payload.sub)
    }
  } catch {
    // Public endpoint — an invalid token simply means "not signed in".
  }
  next()
}
