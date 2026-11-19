import mongoose from "mongoose"

const serviceSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0.01 },
    duration: { type: Number, required: true, min: 1 },
    image: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
)

export const Service = mongoose.model("Service", serviceSchema)
