import "server-only";
import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "./env";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Stores an image in Vercel Blob, or under public/uploads when no token is set. */
export async function storeImage(file: File, folder: "posters" | "payments" | "gcash") {
  if (!ALLOWED.has(file.type)) throw new Error("Only JPEG, PNG, WebP or GIF images are allowed");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 8 MB or smaller");
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `${folder}/${nanoid(12)}.${ext}`;

  if (env.blobToken) {
    const blob = await put(key, file, {
      access: "public",
      token: env.blobToken,
      contentType: file.type,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), "public", "uploads", key), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${key}`;
}
