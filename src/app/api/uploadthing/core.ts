import { createUploadthing, type FileRouter } from 'uploadthing/next'

const f = createUploadthing()

export const ourFileRouter = {
    meetingUploader: f({ audio: { maxFileSize: '128MB', maxFileCount: 1 } })
        .middleware(async () => {
            return {}
        })
        .onUploadComplete(async ({ file }) => {
            console.log('✅ UploadThing upload complete:', file.name, file.url)
            return { url: file.url }
        }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
