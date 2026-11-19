import { Router } from "express"

import { Transaction } from "../models/transaction.js"
import { requireAdmin, requireCustomer } from "../middleware/auth.js"

const router = Router()

/**
 * GET /api/v1/transactions/me — the customer's own payment history.
 * Payment records are created exclusively by the verified Stripe webhook.
 */
router.get("/me", requireCustomer, async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      customerId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ data: transactions })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/transactions — admin only, read-only.
 * Payment records are created exclusively by the verified Stripe webhook,
 * so there are no write endpoints here by design.
 */
router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .lean()
    res.json({ data: transactions })
  } catch (err) {
    next(err)
  }
})

export default router
