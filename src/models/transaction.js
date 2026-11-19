import mongoose from "mongoose"

const transactionSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    serviceName: { type: String, required: true },
    appointmentDate: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, default: "USD" },
    stripeSessionId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["paid", "failed"],
      default: "paid",
    },
  },
  { timestamps: true }
)

export const Transaction = mongoose.model("Transaction", transactionSchema)
