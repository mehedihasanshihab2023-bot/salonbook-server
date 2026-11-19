import { mkdirSync } from "node:fs"
import path from "node:path"

import mongoose from "mongoose"

import { env } from "./env.js"

/** Connects to MongoDB (or a throw-away in-memory DB for local demos). */
export async function connectDb() {
  mongoose.set("strictQuery", true)

  if (env.useMemoryDb) {
    const { MongoMemoryServer } = await import("mongodb-memory-server")
    // Some Windows temp paths confuse mongod — keep the data directory
    // inside the project folder (gitignored) instead of os.tmpdir().
    const dbPath = path.join(process.cwd(), ".mongo-data")
    mkdirSync(dbPath, { recursive: true })
    const memoryServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: "wiredTiger" },
    })
    await mongoose.connect(memoryServer.getUri("salonbook"))
    console.log(
      `[db] connected to in-memory MongoDB (${memoryServer.getUri()})`
    )
    return
  }

  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required when USE_MEMORY_DB is not 1")
  }
  await mongoose.connect(env.mongodbUri)
  console.log(`[db] connected to MongoDB`)
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
