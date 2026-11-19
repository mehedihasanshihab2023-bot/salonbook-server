import { Router } from "express"

import { Service } from "../models/service.js"
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
} from "../middleware/auth.js"
import { ApiError } from "../middleware/errors.js"

const router = Router()

const POSITIVE_NUMBER = (value) => typeof value === "number" && value > 0

/** Validates + normalises a service payload (shared by POST and PATCH). */
function parseServicePayload(body, { partial = false } = {}) {
  const payload = {}

  if (body.serviceName !== undefined || !partial) {
    const name = String(body.serviceName ?? "").trim()
    if (!name) throw new ApiError(400, "Service name is required.")
    payload.serviceName = name
  }
  if (body.category !== undefined || !partial) {
    const category = String(body.category ?? "").trim()
    if (!category) throw new ApiError(400, "Service category is required.")
    payload.category = category
  }
  if (body.description !== undefined || !partial) {
    const description = String(body.description ?? "").trim()
    if (!description) throw new ApiError(400, "Service description is required.")
    payload.description = description
  }
  if (body.image !== undefined || !partial) {
    const image = String(body.image ?? "").trim()
    if (!image) throw new ApiError(400, "Service image is required.")
    payload.image = image
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price)
    if (!POSITIVE_NUMBER(price)) {
      throw new ApiError(400, "Price must be a positive number.")
    }
    payload.price = price
  }
  if (body.duration !== undefined || !partial) {
    const duration = Number(body.duration)
    if (!POSITIVE_NUMBER(duration)) {
      throw new ApiError(400, "Duration must be a positive number of minutes.")
    }
    payload.duration = Math.round(duration)
  }
  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status)) {
      throw new ApiError(400, "Status must be either active or inactive.")
    }
    payload.status = body.status
  }

  return payload
}

const SORTS = { "price-asc": { price: 1 }, "price-desc": { price: -1 } }

/**
 * GET /api/v1/services?search=&category=&sort=
 * Public listing — anonymous visitors see active services only; a signed-in
 * admin sees every service (needed by the Manage Services dashboard).
 */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const query = {}
    if (req.query.search) {
      query.serviceName = {
        $regex: String(req.query.search).trim(),
        $options: "i",
      }
    }
    if (req.query.category) {
      query.category = String(req.query.category).trim()
    }

    const isAdmin = req.user?.role === "admin"
    if (!isAdmin) query.status = "active"

    const sort = SORTS[req.query.sort] ?? { createdAt: -1 }
    const services = await Service.find(query).sort(sort).lean()

    res.json({ data: services })
  } catch (err) {
    next(err)
  }
})

/** GET /api/v1/services/featured — 6 most recent active services. */
router.get("/featured", async (_req, res, next) => {
  try {
    const services = await Service.find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()
    res.json({ data: services })
  } catch (err) {
    next(err)
  }
})

/** GET /api/v1/services/:id — protected service details page. */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).lean()
    if (!service) {
      throw new ApiError(404, "Service not found.")
    }
    res.json({ data: service })
  } catch (err) {
    next(err)
  }
})

/** POST /api/v1/services — admin only. */
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const payload = parseServicePayload(req.body ?? {})
    const service = await Service.create(payload)
    res.status(201).json({ data: service })
  } catch (err) {
    next(err)
  }
})

/** PATCH /api/v1/services/:id — admin only. */
router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const payload = parseServicePayload(req.body ?? {}, { partial: true })
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).lean()
    if (!service) throw new ApiError(404, "Service not found.")
    res.json({ data: service })
  } catch (err) {
    next(err)
  }
})

/** DELETE /api/v1/services/:id — admin only. */
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id).lean()
    if (!service) throw new ApiError(404, "Service not found.")
    res.json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
})

export default router
