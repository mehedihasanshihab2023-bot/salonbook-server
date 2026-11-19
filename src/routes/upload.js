import { Router } from "express"
import multer from "multer"

import { requireAuth } from "../middleware/auth.js"
import { uploadToImgbb } from "../utils/imgbb.js"

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true)
    cb(new Error("Only image files are allowed."))
  },
})

/**
 * POST /api/v1/uploads/image — any signed-in user can upload (service
 * images by admins, profile photos by anyone). The server forwards the
 * binary to ImgBB and responds with `{ url }`.
 */
router.post("/image", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please choose an image file." })
    }
    const url = await uploadToImgbb(req.file.buffer, req.file.originalname)
    res.json({ url })
  } catch (err) {
    next(err)
  }
})

export default router
