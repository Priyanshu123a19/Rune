"use server";

import { UTApi } from "uploadthing/server";

// UTApi automatically reads UPLOADTHING_SECRET from environment
const utapi = new UTApi();

export async function uploadFileAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    console.log("📤 Uploading:", file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const response = await utapi.uploadFiles(file);

    if (response.error) {
      console.error("❌ Upload failed:", response.error);
      throw new Error(response.error.message);
    }

    console.log("✅ Upload complete:", response.data.url);

    return {
      success: true,
      url: response.data.url,
      name: response.data.name,
      size: response.data.size,
    };
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}