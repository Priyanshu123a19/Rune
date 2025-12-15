import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Audio uploader for meeting recordings
  audioUploader: f({ 
    audio: { 
      maxFileSize: "128MB",
      maxFileCount: 1 
    } 
  })
    .onUploadComplete(async ({ file }) => {
      console.log("✅ Upload complete!");
      console.log("📁 File URL:", file.url);
      console.log("📦 File name:", file.name);
      console.log("📏 File size:", file.size);
      
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;