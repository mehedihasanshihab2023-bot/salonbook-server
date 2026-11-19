import { Router } from "express"
import mongoose from "mongoose"

import { User } from "../models/user.js"
import { requireAdmin } from "../middleware/auth.js"
import { ApiError } from "../middleware/errors.js"
import { serializeUser } from "../utils/serialize.js"

const router = Router()

/** GET /api/v1/users — admin lists all registered users. */
router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean()
    res.json({ data: users.map(serializeUser) })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/users/:id/block — admin blocks or unblocks a customer.
 * Blocking also revokes their Better Auth sessions so a blocked user can't
 * stay signed in anywhere.
 */
router.patch("/:id/block", requireAdmin, async (req, res, next) => {
  try {
    const isBlocked = Boolean(req.body?.isBlocked)

    const user = await User.findById(req.params.id).lean()
    if (!user) throw new ApiError(404, "User not found.")
    if (user.role === "admin") {
      throw new ApiError(400, "Administrator accounts cannot be blocked.")
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isBlocked } },
      { new: true }
    ).lean()

    if (isBlocked) {
      // Drop every active session for this user.
      const sessions = mongoose.connection.db.collection("sessions")
      await sessions.deleteMany({ userId: req.params.id })
    }

    res.json({ data: serializeUser(updated) })
  } catch (err) {
    next(err)
  }
})

export default router
