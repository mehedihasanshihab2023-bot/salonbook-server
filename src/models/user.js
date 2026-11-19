import mongoose from "mongoose"

/**
 * Better Auth manages its own `users` collection — we just need a
 * read-friendly model over it for admin queries (list / block / stats).
 * `usePlural: true` on the adapter makes Better Auth write to the same
 * pluralized collections that Mongoose generates.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, default: "customer" },
    isBlocked: { type: Boolean, default: false },
    phoneNumber: { type: String, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { strict: false }
)

export const User = mongoose.model("User", userSchema)
