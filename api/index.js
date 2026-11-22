import { getApp } from "../src/app.js"

/**
 * Vercel serverless entry point. Every request is forwarded to the same
 * Express app that `npm start` runs locally.
 */
export default async function handler(req, res) {
  const app = await getApp()
  return app(req, res)
}
