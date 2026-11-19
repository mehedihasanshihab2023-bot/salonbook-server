import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    // Snapshots so dashboards render without extra joins
    serviceName: { type: String, required: true },
    serviceImage: { type: String, required: true },
    serviceCategory: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    appointmentDate: { type: String, required: true },
    timeSlot: { type: String, required: true },
    message: { type: String, default: "" },
    servicePrice: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    // Stripe Checkout session id, written when the customer starts payment
    // so the verified webhook can match this appointment.
    stripeSessionId: { type: String, default: null },
  },
  { timestamps: true }
)

appointmentSchema.index({ appointmentDate: 1, timeSlot: 1 })

export const Appointment = mongoose.model("Appointment", appointmentSchema)
