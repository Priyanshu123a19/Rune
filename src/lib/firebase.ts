import { generateReactHelpers } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'

const { uploadFiles } = generateReactHelpers<OurFileRouter>()

export async function uplaodFile(file: File, setProgress?: (progress: number) => void) {
    let progress = 0
    const progressInterval = setInterval(() => {
        progress += Math.random() * 12
        if (progress > 85) progress = 85
        if (setProgress) setProgress(Math.floor(progress))
    }, 300)

    try {
        const [res] = await uploadFiles('meetingUploader', { files: [file] })
        clearInterval(progressInterval)
        if (setProgress) setProgress(100)

        const url = res?.url ?? (res as any)?.ufsUrl
        if (!url) throw new Error('No URL returned from UploadThing')
        return url as string
    } catch (error) {
        clearInterval(progressInterval)
        throw error
    }
}
