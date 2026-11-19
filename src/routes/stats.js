import { Router } from "express"

import { Appointment } from "../models/appointment.js"
import { Service } from "../models/service.js"
import { Transaction } from "../models/transaction.js"
import { User } from "../models/user.js"
import { requireAdmin } from "../middleware/auth.js"

const router = Router()

/**
 * GET /api/v1/stats/admin — admin dashboard overview.
 * Shape matches the client's AdminStats type exactly (bare JSON, no envelope).
 */
router.get("/admin", requireAdmin, async (_req, res, next) => {
  try {
    const [customers, activeServices, appointments, pending, confirmed, payments] =
      await Promise.all([
        User.countDocuments({ role: "customer" }),
        Service.countDocuments({ status: "active" }),
        Appointment.countDocuments({}),
        Appointment.countDocuments({ status: "pending" }),
        Appointment.countDocuments({ status: "confirmed" }),
        Transaction.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ])

    res.json({
      customers,
      activeServices,
      appointments,
      pending,
      confirmed,
      payments: payments[0]?.total ?? 0,
    })
  } catch (err) {
    next(err)
  }
})

export default router
