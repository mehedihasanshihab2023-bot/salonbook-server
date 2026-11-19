import { Router } from "express"

import { Appointment } from "../models/appointment.js"
import { Service } from "../models/service.js"
import { requireAdmin, requireCustomer } from "../middleware/auth.js"
import { ApiError } from "../middleware/errors.js"

const router = Router()

/**
 * POST /api/v1/appointments — customers only (admins cannot book).
 * Creates a Pending / Unpaid request with denormalised snapshots so the
 * dashboards can render without extra joins.
 */
router.post("/", requireCustomer, async (req, res, next) => {
  try {
    const { serviceId, appointmentDate, timeSlot } = req.body ?? {}
    const message = String(req.body?.message ?? "").trim()

    if (!serviceId || !appointmentDate || !timeSlot) {
      throw new ApiError(
        400,
        "Service, appointment date and time slot are required."
      )
    }

    const service = await Service.findById(serviceId).lean()
    if (!service) {
      throw new ApiError(404, "Service not found.")
    }
    if (service.status !== "active") {
      throw new ApiError(
        400,
        "This service is currently unavailable for booking."
      )
    }

    // Prevent duplicate active appointments in the same slot.
    const duplicate = await Appointment.findOne({
      customerId: req.user.id,
      serviceId,
      appointmentDate,
      timeSlot,
      status: { $in: ["pending", "confirmed"] },
    }).lean()
    if (duplicate) {
      throw new ApiError(
        409,
        `You already have a ${duplicate.status} booking for this date and time slot. Please choose another slot.`
      )
    }

    const appointment = await Appointment.create({
      serviceId: service._id.toString(),
      customerId: req.user.id,
      serviceName: service.serviceName,
      serviceImage: service.image,
      serviceCategory: service.category,
      customerName: req.user.name,
      customerEmail: req.user.email,
      appointmentDate,
      timeSlot,
      message,
      servicePrice: service.price,
      status: "pending",
      paymentStatus: "unpaid",
    })

    res.status(201).json({ data: appointment })
  } catch (err) {
    next(err)
  }
})

/**
 * NOTE: specific paths are registered before `/:id` so `/me/stats`
 * is never swallowed by the admin status route.
 */

/** GET /api/v1/appointments/me/stats — customer dashboard overview. */
router.get("/me/stats", requireCustomer, async (req, res, next) => {
  try {
    const rows = await Appointment.aggregate([
      { $match: { customerId: req.user.id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    const counts = { total: 0, pending: 0, confirmed: 0, cancelled: 0 }
    for (const row of rows) {
      counts.total += row.count
      if (row._id in counts) counts[row._id] = row.count
    }
    res.json(counts)
  } catch (err) {
    next(err)
  }
})

/** GET /api/v1/appointments/me — the customer's own appointments. */
router.get("/me", requireCustomer, async (req, res, next) => {
  try {
    const appointments = await Appointment.find({
      customerId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ data: appointments })
  } catch (err) {
    next(err)
  }
})

/** GET /api/v1/appointments — admin sees every appointment request. */
router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const appointments = await Appointment.find({})
      .sort({ createdAt: -1 })
      .lean()
    res.json({ data: appointments })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/v1/appointments/:id/status — admin confirm / cancel. */
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status
    if (!["confirmed", "cancelled"].includes(status)) {
      throw new ApiError(
        400,
        "Status must be either confirmed or cancelled."
      )
    }

    const appointment = await Appointment.findById(req.params.id).lean()
    if (!appointment) throw new ApiError(404, "Appointment not found.")

    if (appointment.status === "cancelled") {
      throw new ApiError(400, "Cancelled appointments cannot be changed.")
    }
    if (status === "confirmed" && appointment.status !== "pending") {
      throw new ApiError(400, "Only pending appointments can be confirmed.")
    }

    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean()
    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/v1/appointments/:id/cancel — customer cancels own pending. */
router.patch("/:id/cancel", requireCustomer, async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id).lean()
    if (!appointment) throw new ApiError(404, "Appointment not found.")

    if (appointment.customerId !== req.user.id) {
      throw new ApiError(403, "You can only cancel your own appointments.")
    }
    if (appointment.status !== "pending") {
      throw new ApiError(
        400,
        `A ${appointment.status} appointment cannot be cancelled.`
      )
    }

    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "cancelled" } },
      { new: true, runValidators: true }
    ).lean()
    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

export default router
