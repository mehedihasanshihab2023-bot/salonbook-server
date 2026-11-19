/**
 * Central API error + handler utilities.
 * Every failed request responds with `{ message }`.
 */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
  })
}

export function errorHandler(err, req, res, _next) {
  let status = err?.status ?? 500
  let message = err?.message ?? "Something went wrong on the server."

  // Mongoose / JWT / multer friends map to friendly responses.
  if (err?.name === "ValidationError") {
    status = 400
    message = Object.values(err.errors ?? {})
      .map((e) => e.message)
      .join(", ")
  } else if (err?.name === "CastError") {
    status = 404
    message = "The requested resource was not found."
  } else if (err?.name === "JsonWebTokenError") {
    status = 401
    message = "Your session is invalid. Please sign in again."
  } else if (err?.name === "TokenExpiredError") {
    status = 401
    message = "Your session has expired. Please sign in again."
  } else if (err?.name === "MulterError") {
    status = 400
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be under 5MB."
        : `Image upload failed: ${err.message}`
  } else if (err?.type === "entity.parse.failed") {
    status = 400
    message = "Invalid JSON payload."
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err)
  }

  res.status(status).json({ message })
}
