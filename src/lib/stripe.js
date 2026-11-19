import Stripe from "stripe"

import { env } from "../config/env.js"

export const stripeClient = env.stripe.secretKey
  ? new Stripe(env.stripe.secretKey)
  : null

export function assertStripeConfigured() {
  if (!stripeClient) {
    const error = new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment."
    )
    error.status = 503
    throw error
  }
}
