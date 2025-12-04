import crypto from "node:crypto";

import supabase from "../supabase.js";

const DEFAULT_BUCKET = (process.env.SUPABASE_BUCKET ?? "fotos").trim();

const sanitizeFileName = (value) => {
  if (!value) {
    return "upload.bin";
  }

  return value.replace(/[^a-zA-Z0-9.\-_]/g, "_");
};

export const uploadBufferToSupabase = async ({
  buffer,
  contentType,
  fileName,
  prefix,
  objectPath,
  bucket = DEFAULT_BUCKET,
  cacheControl = "3600",
  upsert = false,
}) => {
  if (!bucket) {
    throw new Error("Supabase bucket name is required.");
  }

  if (!buffer || buffer.length === 0) {
    throw new Error("Upload buffer is empty.");
  }

  const safePrefix = prefix ? prefix.replace(/^\/+|\/+$/g, "") : "";
  const safeFileName = sanitizeFileName(fileName);
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const computedPath =
    objectPath?.replace(/^\/+/, "") ||
    [safePrefix, upsert ? safeFileName : `${uniqueSuffix}-${safeFileName}`]
      .filter(Boolean)
      .join("/");

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(computedPath, buffer, {
      contentType,
      cacheControl,
      upsert,
    });

  if (uploadError) {
    const err = new Error(uploadError.message);
    err.statusCode = uploadError.statusCode ?? uploadError.status ?? null;
    err.cause = uploadError;
    throw err;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(computedPath);

  if (!data?.publicUrl) {
    throw new Error("Supabase did not return a public URL.");
  }

  return {
    bucket,
    path: computedPath,
    publicUrl: data.publicUrl,
  };
};

export default uploadBufferToSupabase;
