/**
 * Demo data seeding, shared by `npm run seed-demo` and the automatic
 * first-run seeding in server.js. Every step is idempotent: existing
 * accounts and services are never duplicated or overwritten.
 */
import { createAuth, getAuth } from "./auth.js"
import { Service } from "../models/service.js"
import { User } from "../models/user.js"

export const DEMO_SERVICES = [
  {
    serviceName: "Signature Haircut & Style",
    category: "Haircut & Styling",
    description:
      "A tailored cut with a relaxing wash, blow-dry and finish shaped around your face and lifestyle.",
    price: 35,
    duration: 45,
    image:
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Precision Color & Grey Blend",
    category: "Hair Coloring",
    description:
      "Hand-blended colour that softens greys and adds depth for a natural, low-maintenance finish.",
    price: 120,
    duration: 150,
    image:
      "https://images.unsplash.com/photo-1605497788044-5a32c7078486?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Keratin Smoothing Treatment",
    category: "Hair Treatment",
    description:
      "A smoothing keratin ritual that tames frizz and adds mirror-like shine for weeks.",
    price: 95,
    duration: 120,
    image:
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Gentleman's Hydra Facial",
    category: "Facial & Skincare",
    description:
      "Deep cleansing, gentle exfoliation and a hydrating mask to leave your skin plump and luminous.",
    price: 65,
    duration: 60,
    image:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Event Makeup & Styling",
    category: "Makeup",
    description:
      "Camera-ready makeup with a trial consultation, long-wear products and a flawless finish.",
    price: 150,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Luxury Gel Manicure",
    category: "Manicure & Pedicure",
    description:
      "Cuticle care, shaping and a chip-resistant gel polish in the shade of your choice.",
    price: 40,
    duration: 50,
    image:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Aromatherapy Full-Body Massage",
    category: "Spa & Massage",
    description:
      "A 90-minute essential-oil massage that melts away tension from shoulders to soles.",
    price: 110,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Signature Fade & Finish",
    category: "Haircut & Styling",
    description:
      "A crisp, detailed fade with a hot-towel finish — sharp edges, easy styling.",
    price: 28,
    duration: 40,
    image:
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Root Touch-Up & Gloss",
    category: "Hair Coloring",
    description:
      "A quick root refresh with a shine-boosting gloss that blends away regrowth.",
    price: 70,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1587909209111-5097ee578ec3?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Deep Tissue Scalp Ritual",
    category: "Spa & Massage",
    description:
      "A focused scalp and neck ritual that relieves tension and stimulates healthy hair growth.",
    price: 85,
    duration: 75,
    image:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Express Glow Cleanup",
    category: "Facial & Skincare",
    description:
      "A quick 30-minute cleanup, steam and mask for instantly brighter, fresher skin.",
    price: 30,
    duration: 30,
    image:
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?q=80&w=900&auto=format&fit=crop",
    status: "active",
  },
  {
    serviceName: "Classic Spa Pedicure",
    category: "Manicure & Pedicure",
    description:
      "Soak, scrub, callus care and a polish finish — the full reset for tired feet.",
    price: 32,
    duration: 45,
    image:
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?q=80&w=900&auto=format&fit=crop",
    status: "inactive",
  },
]

/** Demo credentials come from env so deployments can rotate them. */
export const DEMO_ADMIN = {
  name: "Salon Admin",
  email: process.env.ADMIN_EMAIL ?? "admin@salonbook.com",
  password: process.env.ADMIN_PASSWORD ?? "Admin123",
}

export const DEMO_CUSTOMER = {
  name: "Demo Customer",
  email: "customer@salonbook.com",
  password: "Customer123",
}

/**
 * Seeds the administrator, a demo customer and the service catalogue.
 * Call AFTER the database connection is open. `auth` may be an existing
 * Better Auth instance (server.js) or omitted (the seed CLI creates one).
 */
export async function seedDemoData(auth) {
  const instance = auth ?? getAuth() ?? createAuth()

  // ---- Administrator ----
  const existingAdmin = await User.findOne({ email: DEMO_ADMIN.email }).lean()
  if (!existingAdmin) {
    await instance.api.signUpEmail({
      body: {
        name: DEMO_ADMIN.name,
        email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password,
      },
    })
    await User.updateOne(
      { email: DEMO_ADMIN.email },
      { $set: { role: "admin" } }
    )
    console.log(`[seed] admin created: ${DEMO_ADMIN.email}`)
  } else if (existingAdmin.role !== "admin") {
    await User.updateOne(
      { _id: existingAdmin._id },
      { $set: { role: "admin" } }
    )
    console.log(`[seed] promoted ${DEMO_ADMIN.email} to admin`)
  }

  // ---- Demo customer ----
  const existingCustomer = await User.findOne({
    email: DEMO_CUSTOMER.email,
  }).lean()
  if (!existingCustomer) {
    await instance.api.signUpEmail({
      body: {
        name: DEMO_CUSTOMER.name,
        email: DEMO_CUSTOMER.email,
        password: DEMO_CUSTOMER.password,
      },
    })
    console.log(`[seed] demo customer created: ${DEMO_CUSTOMER.email}`)
  }

  // ---- Services ----
  const count = await Service.countDocuments({})
  if (count === 0) {
    await Service.insertMany(DEMO_SERVICES)
    console.log(`[seed] ${DEMO_SERVICES.length} services created`)
  }
}
