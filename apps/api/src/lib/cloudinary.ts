import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

// picks up CLOUDINARY_URL from env automatically
export { cloudinary };

export function uploadBuffer(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}
