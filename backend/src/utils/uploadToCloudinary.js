import cloudinary from "../config/cloudinary.js";

export const uploadBufferToCloudinary = (
  fileBuffer,
  folder,
  resourceType = "auto",
) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
