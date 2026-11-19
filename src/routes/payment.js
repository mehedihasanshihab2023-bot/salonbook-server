import { Router } from "express"

import { env } from "../config/env.js"
import { Appointment } from "../models/appointment.js"
import { Transaction } from "../models/transaction.js"
import { requireCustomer } from "../middleware/auth.js"
import { ApiError } from "../middleware/errors.js"
import { assertStripeConfigured, stripeClient } from "../lib/stripe.js"

const router = Router()

/**
 * POST /api/v1/payments/create-checkout-session
 * Only confirmed + unpaid appointments (and their owner) can be paid for.
 * Returns `{ url }` — the Stripe Checkout redirect URL.
 */
router.post(
  "/create-checkout-session",
  requireCustomer,
  async (req, res, next) => {
    try {
      assertStripeConfigured()

      const { appointmentId } = req.body ?? {}
      if (!appointmentId) {
        throw new ApiError(400, "Appointment ID is required.")
      }

      const appointment = await Appointment.findById(appointmentId).lean()
      if (!appointment) throw new ApiError(404, "Appointment not found.")

      if (appointment.customerId !== req.user.id) {
        throw new ApiError(403, "You can only pay for your own appointments.")
      }
      if (appointment.status !== "confirmed") {
        throw new ApiError(
          400,
          "Only confirmed appointments can be paid for."
        )
      }
      if (appointment.paymentStatus === "paid") {
        throw new ApiError(400, "This appointment is already paid.")
      }

      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        customer_email: appointment.customerEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(appointment.servicePrice * 100),
              product_data: { name: appointment.serviceName },
            },
          },
        ],
        success_url: `${env.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.clientUrl}/payment/cancel?appointmentId=${appointment._id}`,
        metadata: {
          appointmentId: appointment._id.toString(),
        },
      })

      // Remember the session so the webhook can match this appointment.
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { stripeSessionId: session.id } }
      )

      res.json({ url: session.url })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/payments/webhook — the ONLY place payment status is updated.
 * Mounted with express.raw in server.js so the signature can be verified.
 */
export async function stripeWebhookHandler(req, res, next) {
  try {
    assertStripeConfigured()

    let event
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        env.stripe.webhookSecret
      )
    } catch (err) {
      throw new ApiError(
        400,
        `Stripe webhook signature verification failed: ${err.message}`
      )
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object
      const appointmentId = session.metadata?.appointmentId

      const appointment = appointmentId
        ? await Appointment.findById(appointmentId)
        : null
      if (appointment) {
        // Idempotent: only flip unpaid -> paid and record the transaction once.
        if (appointment.paymentStatus !== "paid") {
          await Appointment.updateOne(
            { _id: appointment._id },
            { $set: { paymentStatus: "paid", stripeSessionId: session.id } }
          )
          await Transaction.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              $set: {
                appointmentId: appointment._id.toString(),
                customerId: appointment.customerId,
                customerName: appointment.customerName,
                serviceName: appointment.serviceName,
                appointmentDate: appointment.appointmentDate,
                amount: appointment.servicePrice,
                currency: "USD",
                status: "paid",
              },
            },
            { upsert: true, setDefaultsOnInsert: true }
          )
          console.log(`[stripe] appointment ${appointmentId} marked as paid`)
        }
      } else {
        console.warn(
          `[stripe] completed session ${session.id} has no matching appointment`
        )
      }
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
}

export default router
