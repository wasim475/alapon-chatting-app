import multer from "multer";
import { AppError } from "../utils/AppError.js";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const isImage = file.mimetype.startsWith("image/");
  const isAudio = file.mimetype.startsWith("audio/");

  if (isImage || isAudio) {
    cb(null, true);
    return;
  }

  cb(new AppError("Only image and audio uploads are allowed", 400), false);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024 },
});
