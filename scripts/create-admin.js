/**
 * Creates the first administrator account.
 *
 * Usage:
 *   npm run create-admin
 *   npm run create-admin -- "Jane Doe" admin@salonbook.com "Secret123"
 *
 * Admin accounts are NEVER created through public registration — the role
 * is only assigned here (or manually in the database).
 */
import { connectDb, disconnectDb } from "../src/config/db.js"
import { env } from "../src/config/env.js"
import { createAuth } from "../src/lib/auth.js"
import { User } from "../src/models/user.js"

const [nameArg, emailArg, passwordArg] = process.argv.slice(2)

const name = nameArg ?? "Salon Admin"
const email = (emailArg ?? env.adminEmail ?? "admin@salonbook.com")
  .trim()
  .toLowerCase()
const password =
  passwordArg ?? env.adminPassword ?? "Admin123"

function validatePassword(password) {
  if (password.length < 6) return "at least 6 characters"
  if (!/[A-Z]/.test(password)) return "one uppercase letter"
  if (!/[a-z]/.test(password)) return "one lowercase letter"
  return null
}

async function main() {
  await connectDb()
  const auth = createAuth()

  const problem = validatePassword(password)
  if (problem) {
    console.error(`✖ Password must have ${problem}.`)
    process.exitCode = 1
    return
  }

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    if (existing.role === "admin") {
      console.log(`• ${email} is already an administrator.`)
      return
    }
    await User.updateOne({ _id: existing._id }, { $set: { role: "admin" } })
    console.log(`✔ Promoted ${email} to administrator.`)
    return
  }

  try {
    await auth.api.signUpEmail({ body: { name, email, password } })
  } catch (err) {
    console.error("✖ Better Auth sign-up failed:", err?.message ?? err)
    process.exitCode = 1
    return
  }

  await User.updateOne({ email }, { $set: { role: "admin" } })
  console.log(`✔ Admin created: ${email} (password: ${passwordArg ? "(as given)" : "default Admin123 — change it!"})`)
}

main()
  .catch((err) => {
    console.error("✖ create-admin failed:", err)
    process.exitCode = 1
  })
  .finally(() => disconnectDb())
