import { Router } from "express"

import { getSessionUser } from "../lib/auth.js"
import { ApiError } from "../middleware/errors.js"
import {
  clearTokenCookie,
  requireAuth,
  setTokenCookie,
  signApiToken,
} from "../middleware/auth.js"

const router = Router()

/**
 * Exchanges a valid Better Auth session cookie for a signed JWT (stored in
 * an httpOnly `salonbook_token` cookie). The frontend calls this right
 * after sign-in / sign-up so the REST API layer can use JWT verification.
 */
router.post("/token", async (req, res, next) => {
  try {
    const user = await getSessionUser(req)
    if (!user) {
      throw new ApiError(401, "No active session. Please sign in first.")
    }

    const token = signApiToken(user)
    setTokenCookie(res, token)

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          role: user.role ?? "customer",
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

/** Clears the API token cookie (used by the frontend on sign-out). */
router.post("/logout", (_req, res) => {
  clearTokenCookie(res)
  res.json({ data: { ok: true } })
})

/** Returns the signed-in user, verifying the JWT on the server. */
router.get("/me", requireAuth, (req, res) => {
  res.json({ data: { user: req.user } })
})

export default router
