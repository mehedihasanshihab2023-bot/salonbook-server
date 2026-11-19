/**
 * End-to-end API smoke test against a RUNNING server.
 *
 * Usage:
 *   node scripts/smoke.js              (default base http://localhost:5000)
 *   node scripts/smoke.js <base-url>
 *
 * Covers: health, admin login, JWT exchange, services CRUD + search/sort,
 * customer signup, booking rules (inactive service, duplicate slot,
 * role protection), admin confirm, cancel rules, users, stats,
 * transactions and profile-security checks.
 * Stripe checkout is skipped when STRIPE keys are not configured.
 */
const BASE = process.argv[2] ?? "http://localhost:5000"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@salonbook.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123"
const CUSTOMER_EMAIL = `smoke-${Date.now()}@example.com`
const CUSTOMER_PASSWORD = "Smoke123"

let passed = 0
let failed = 0

function check(label, condition, extra = "") {
  if (condition) {
    passed += 1
    console.log(`  ✔ ${label}`)
  } else {
    failed += 1
    console.error(`  ✖ ${label} ${extra}`)
  }
}

/** Simple cookie jar so Better Auth sessions work without a browser. */
class Jar {
  constructor() {
    this.cookies = new Map()
  }
  store(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";")
      const eq = pair.indexOf("=")
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ")
  }
  get(name) {
    return this.cookies.get(name)
  }
}

async function call(jar, method, path, { body, bearer } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // Better Auth requires a trusted Origin on auth endpoints (CSRF check).
      Origin: BASE,
      ...(jar && jar.header() ? { Cookie: jar.header() } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (jar) jar.store(res)
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, json }
}

async function main() {
  console.log(`Smoke-testing ${BASE}\n`)

  const adminJar = new Jar()
  const customerJar = new Jar()
  const noJar = new Jar()

  // ---- 1. health ----
  const health = await call(noJar, "GET", "/api/health")
  check("GET /api/health is public and ok", health.status === 200 && health.json?.data?.status === "ok")

  // ---- 2. admin sign-in via Better Auth, then JWT exchange ----
  const adminSignIn = await call(adminJar, "POST", "/api/auth/sign-in/email", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  check(
    "admin signs in via Better Auth",
    adminSignIn.status === 200,
    JSON.stringify(adminSignIn.json).slice(0, 200)
  )
  const adminToken = await call(adminJar, "POST", "/api/v1/auth/token")
  const adminJwt = adminToken.json?.data?.token
  check("admin JWT exchange works", adminToken.status === 200 && Boolean(adminJwt))

  // ---- 3. customer sign-up + JWT ----
  const signUp = await call(customerJar, "POST", "/api/auth/sign-up/email", {
    body: {
      name: "Smoke Customer",
      email: CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    },
  })
  check(
    "customer sign-up works (Better Auth)",
    signUp.status === 200,
    JSON.stringify(signUp.json).slice(0, 200)
  )
  const customerToken = await call(customerJar, "POST", "/api/v1/auth/token")
  const customerJwt = customerToken.json?.data?.token
  check("customer JWT exchange works", customerToken.status === 200 && Boolean(customerJwt))

  // ---- 4. services: public list, admin create ----
  const publicServices = await call(noJar, "GET", "/api/v1/services")
  check("GET /services is public", publicServices.status === 200)

  const unique = `Smoke Service ${Date.now()}`
  const create = await call(adminJar, "POST", "/api/v1/services", {
    bearer: adminJwt,
    body: {
      serviceName: unique,
      category: "Haircut & Styling",
      description: "Created by the smoke test.",
      price: 25.5,
      duration: 30,
      image: "https://i.ibb.co/example/smoke.jpg",
      status: "active",
    },
  })
  const serviceId = create.json?.data?._id
  check("admin can create a service", create.status === 201 && Boolean(serviceId), JSON.stringify(create.json))

  const forbidden = await call(customerJar, "POST", "/api/v1/services", {
    bearer: customerJwt,
    body: { serviceName: "x", category: "x", description: "x", price: 1, duration: 1, image: "x" },
  })
  check("customer CANNOT create a service (403)", forbidden.status === 403)

  const unauth = await call(noJar, "GET", "/api/v1/services", {})
  check("GET /services/:id requires auth", (await call(noJar, "GET", `/api/v1/services/${serviceId}`)).status === 401)

  const search = await call(noJar, "GET", `/api/v1/services?search=${encodeURIComponent(unique)}`)
  check("search by service name finds it", search.json?.data?.some?.((s) => s._id === serviceId))

  const sort = await call(noJar, "GET", "/api/v1/services?sort=price-asc")
  const prices = (sort.json?.data ?? []).map((s) => s.price)
  check("price sort asc is ordered", prices.every((p, i) => i === 0 || prices[i - 1] <= p))

  // ---- 5. booking rules ----
  const bookInactive = await call(customerJar, "POST", "/api/v1/appointments", {
    bearer: customerJwt,
    body: { serviceId, appointmentDate: "2030-01-01", timeSlot: "10:00 AM - 11:00 AM" },
  })
  const deactivate = await call(adminJar, "PATCH", `/api/v1/services/${serviceId}`, {
    bearer: adminJwt,
    body: { status: "inactive" },
  })
  check("admin can deactivate a service", deactivate.status === 200 && deactivate.json?.data?.status === "inactive")
  const blockedBooking = await call(customerJar, "POST", "/api/v1/appointments", {
    bearer: customerJwt,
    body: { serviceId, appointmentDate: "2030-01-01", timeSlot: "10:00 AM - 11:00 AM" },
  })
  check("cannot book an INACTIVE service (400)", blockedBooking.status === 400)
  await call(adminJar, "PATCH", `/api/v1/services/${serviceId}`, {
    bearer: adminJwt,
    body: { status: "active" },
  })

  const book = await call(customerJar, "POST", "/api/v1/appointments", {
    bearer: customerJwt,
    body: {
      serviceId,
      appointmentDate: "2030-01-02",
      timeSlot: "11:00 AM - 12:00 PM",
      message: "Smoke test booking",
    },
  })
  const appointmentId = book.json?.data?._id
  check(
    "customer books an appointment (pending/unpaid)",
    book.status === 201 &&
      book.json?.data?.status === "pending" &&
      book.json?.data?.paymentStatus === "unpaid",
    JSON.stringify(book.json)
  )

  const duplicate = await call(customerJar, "POST", "/api/v1/appointments", {
    bearer: customerJwt,
    body: { serviceId, appointmentDate: "2030-01-02", timeSlot: "11:00 AM - 12:00 PM" },
  })
  check("duplicate slot is rejected (409)", duplicate.status === 409)

  const adminBook = await call(adminJar, "POST", "/api/v1/appointments", {
    bearer: adminJwt,
    body: { serviceId, appointmentDate: "2030-01-03", timeSlot: "11:00 AM - 12:00 PM" },
  })
  check("admin CANNOT book appointments (403)", adminBook.status === 403)

  const myList = await call(customerJar, "GET", "/api/v1/appointments/me", { bearer: customerJwt })
  check("customer sees own appointments", myList.json?.data?.some?.((a) => a._id === appointmentId))

  const adminList = await call(adminJar, "GET", "/api/v1/appointments", { bearer: adminJwt })
  check("admin sees all appointments", adminList.json?.data?.some?.((a) => a._id === appointmentId))

  const adminConfirmForbidden = await call(customerJar, "PATCH", `/api/v1/appointments/${appointmentId}/status`, {
    bearer: customerJwt,
    body: { status: "confirmed" },
  })
  check("customer CANNOT confirm appointments (403)", adminConfirmForbidden.status === 403)

  const confirm = await call(adminJar, "PATCH", `/api/v1/appointments/${appointmentId}/status`, {
    bearer: adminJwt,
    body: { status: "confirmed" },
  })
  check("admin confirms a pending appointment", confirm.json?.data?.status === "confirmed")

  const confirmAgain = await call(adminJar, "PATCH", `/api/v1/appointments/${appointmentId}/status`, {
    bearer: adminJwt,
    body: { status: "confirmed" },
  })
  check("cannot confirm twice (only pending)", confirmAgain.status === 400)

  const cancelConfirmed = await call(customerJar, "PATCH", `/api/v1/appointments/${appointmentId}/cancel`, {
    bearer: customerJwt,
  })
  check("customer CANNOT cancel a confirmed appointment (400)", cancelConfirmed.status === 400)

  const stats = await call(customerJar, "GET", "/api/v1/appointments/me/stats", { bearer: customerJwt })
  check("customer appointment stats work", stats.status === 200 && stats.json?.total >= 1)

  // ---- 6. payments (needs Stripe keys; skipped gracefully) ----
  const checkout = await call(customerJar, "POST", "/api/v1/payments/create-checkout-session", {
    bearer: customerJwt,
    body: { appointmentId },
  })
  if (checkout.status === 200) {
    check("Stripe checkout session created", Boolean(checkout.json?.url))
  } else {
    console.log(`  ⚠ Stripe checkout skipped (${checkout.status}: ${checkout.json?.message ?? ""}) — add STRIPE_SECRET_KEY to test`)
  }

  // ---- 7. users, transactions, stats ----
  const users = await call(adminJar, "GET", "/api/v1/users", { bearer: adminJwt })
  check("admin lists users", users.status === 200)

  const meId = customerToken.json?.data?.user?.id
  const userBlockForbidden = await call(customerJar, "PATCH", `/api/v1/users/${meId}/block`, {
    bearer: customerJwt,
    body: { isBlocked: true },
  })
  check("customer CANNOT manage users (403)", userBlockForbidden.status === 403)

  const txAdmin = await call(adminJar, "GET", "/api/v1/transactions", { bearer: adminJwt })
  check("admin lists transactions (read-only)", txAdmin.status === 200)
  const txCustomer = await call(customerJar, "GET", "/api/v1/transactions", { bearer: customerJwt })
  check("customer CANNOT list all transactions (403)", txCustomer.status === 403)
  const txMe = await call(customerJar, "GET", "/api/v1/transactions/me", { bearer: customerJwt })
  check("customer lists own transactions", txMe.status === 200)

  const adminStats = await call(adminJar, "GET", "/api/v1/stats/admin", { bearer: adminJwt })
  check(
    "admin dashboard stats work",
    adminStats.status === 200 && adminStats.json?.customers !== undefined
  )

  // ---- 8. JWT-only access (no session cookie) ----
  const bearerOnly = await call(new Jar(), "GET", "/api/v1/auth/me", { bearer: customerJwt })
  check(
    "Bearer-only JWT access works",
    bearerOnly.status === 200 && bearerOnly.json?.data?.user?.email === CUSTOMER_EMAIL
  )

  const expired = await call(new Jar(), "GET", "/api/v1/services", {})
  check("unauthenticated /auth/me rejected", (await call(new Jar(), "GET", "/api/v1/auth/me")).status === 401)

  const notFound = await call(noJar, "GET", "/api/v1/definitely-not-a-route")
  check("404 handler returns JSON", notFound.status === 404)

  // ---- 9. cleanup: delete the smoke service ----
  const del = await call(adminJar, "DELETE", `/api/v1/services/${serviceId}`, { bearer: adminJwt })
  check("admin deletes the smoke service", del.status === 200 || del.status === 204)

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exitCode = failed > 0 ? 1 : 0
}

main().catch((err) => {
  console.error("smoke test crashed:", err)
  process.exitCode = 1
})
