"use client";

import { uploadFileAction } from "@/app/actions/upload";

/**
 * Upload file to Uploadthing storage
 * @param file - File to upload
 * @param setProgress - Optional callback for upload progress
 * @returns Promise with the public URL of uploaded file
 */
export async function uplaodFile(
  file: File,
  setProgress?: (progress: number) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate file
      if (!file || file.size === 0) {
        throw new Error("Invalid file provided");
      }

      console.log(
        "📤 Uploading file:",
        file.name,
        `(${(file.size / 1024 / 1024).toFixed(2)} MB)`
      );

      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 90) progress = 90;
        if (setProgress) setProgress(Math.floor(progress));
      }, 300);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);

      // Upload using server action
      const result = await uploadFileAction(formData);

      // Clear progress interval
      clearInterval(progressInterval);
      if (setProgress) setProgress(100);

      if (!result.success || !result.url) {
        throw new Error(result.error || "Upload failed - no URL returned");
      }

      console.log("✅ Upload successful:", result.url);
      resolve(result.url); // Now TypeScript knows result.url exists
    } catch (error) {
      console.error("❌ Error uploading file:", error);
      reject(error);
    }
  });
}