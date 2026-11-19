import mongoose from "mongoose"

/**
 * Shared JSON serialisation rules for every Mongoose model:
 * - `_id` becomes a plain string (the client never gets ObjectIds)
 * - `__v` is dropped
 */
export function attachJsonTransforms() {
  mongoose.set("toJSON", {
    versionKey: false,
    transform: (_doc, ret) => {
      if (ret._id) ret._id = ret._id.toString()
      return ret
    },
  })
}

/** Normalises a lean user document for the client. */
export function serializeUser(user) {
  if (!user) return null
  return {
    _id: user._id?.toString(),
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
    role: user.role ?? "customer",
    isBlocked: Boolean(user.isBlocked),
    phoneNumber: user.phoneNumber ?? null,
    createdAt: user.createdAt ?? null,
  }
}
