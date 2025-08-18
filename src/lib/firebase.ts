// // Import the functions you need from the SDKs you need
// import { error } from "console";
// import { initializeApp } from "firebase/app";
// import {getDownloadURL, getStorage, ref, uploadBytesResumable} from "firebase/storage";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyA_k8q6YdvlXX-kTCL6wdPimsfjk8nGyQ0",
//   authDomain: "rune-23f31.firebaseapp.com",
//   projectId: "rune-23f31",
//   storageBucket: "rune-23f31.firebasestorage.app",
//   messagingSenderId: "559958197212",
//   appId: "1:559958197212:web:94406a669199d0a52c4519"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// export const storage = getStorage(app);


// //function for uploading the video file to the firebase 
// export async function uplaodFile(file: File,setProgress?: (progress: number)=>void){
//     return new Promise((resolve, reject)=>{
//         try{
//             const storageRef = ref(storage,file.name)
//             const uploadTask = uploadBytesResumable(storageRef, file);

//             uploadTask.on('state_changed', (snapshot) => {
//                 const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
//                 if(setProgress) setProgress(progress);
//                 switch (snapshot.state) {
//                     case 'paused':
//                         console.log('Upload is paused');
//                         break;
//                     case 'running':
//                         console.log('Upload is running');
//                         break;
//                 }
//             },error=>{
//                 console.error('Upload failed:', error);
//                 reject(error);
//             }, ()=>{
//                 getDownloadURL(uploadTask.snapshot.ref).then(downloadURL=>{
//                     resolve(downloadURL);
//                 })
//             });
//         }catch(error){
//             console.error('Error uploading file:', error);
//             reject(error);
//         }
//     })
// }

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ✅ SAME FUNCTION NAME - just replace the implementation
export async function uplaodFile(file: File, setProgress?: (progress: number) => void) {
    return new Promise(async (resolve, reject) => {
        try {
            // Create unique filename with timestamp
            const timestamp = Date.now()
            const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            
            // Simulate upload progress since Supabase doesn't provide real-time progress
            let progress = 0
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15
                if (progress > 90) progress = 90
                if (setProgress) setProgress(Math.floor(progress))
            }, 200)

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('meetings')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            // Clear progress interval
            clearInterval(progressInterval)
            if (setProgress) setProgress(100)

            if (error) {
                console.error('Upload failed:', error)
                reject(error)
                return
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('meetings')
                .getPublicUrl(fileName)

            console.log('✅ Upload successful:', urlData.publicUrl)
            resolve(urlData.publicUrl as string)

        } catch (error) {
            console.error('Error uploading file:', error)
            reject(error)
        }
    })
}

// ✅ Keep the storage export for compatibility (optional)
export const storage = supabase.storage