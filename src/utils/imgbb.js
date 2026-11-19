import { env } from "../config/env.js"

/**
 * Uploads an image buffer to ImgBB and returns the hosted URL.
 * ImgBB API: POST https://api.imgbb.com/1/upload?key=<KEY> (multipart/form-data)
 */
export async function uploadToImgbb(buffer, filename = "image.jpg") {
  if (!env.imgbbApiKey) {
    const error = new Error(
      "Image hosting is not configured. Set IMGBB_API_KEY on the server."
    )
    error.status = 503
    throw error
  }

  const form = new FormData()
  form.append(
    "image",
    new Blob([buffer], { type: "application/octet-stream" }),
    filename
  )

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.imgbbApiKey)}`,
    { method: "POST", body: form }
  )
  const json = await res.json().catch(() => null)

  if (!res.ok || !json?.data?.url) {
    const error = new Error(
      json?.error?.message ?? "Image upload failed. Please try again."
    )
    error.status = 502
    throw error
  }

  return json.data.url
}
