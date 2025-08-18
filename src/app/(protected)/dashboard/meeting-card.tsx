// 'use client'
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { uplaodFile } from '@/lib/firebase';
// import { Presentation, Upload } from 'lucide-react';
// import React from 'react'
// import {useDropzone} from 'react-dropzone';
// import { CircularProgressbar, buildStyles} from 'react-circular-progressbar';
// import { api } from '@/trpc/react';
// import Useproject from '@/hooks/use-project';
// import { toast } from 'sonner';
// import { useRouter } from 'next/navigation';
// import { useMutation } from '@tanstack/react-query';
// import axios from 'axios';
// const MeetingCard = () => {
//     const {project} = Useproject();
//     const [progress, setProgress] = React.useState(0);

//     const processMeeting = useMutation({
//         mutationFn: async(data: {meetingUrl: string, meetingId: string, projectId: string})=>{
//             const {meetingUrl, meetingId, projectId} = data;
//             const response = await axios.post('/api/process-meeting', {
//                 meetingUrl,
//                 meetingId,
//                 projectId
//             })
//         }
//     })
//     const router = useRouter();
//     const uploadMeeting = api.project.uploadMeeting.useMutation();
//     const [isUploading, setisUploading] = React.useState(false);
//     const {getRootProps, getInputProps}=useDropzone({
//         accept: {
//             'audio/*': ['.mp3', '.wav', '.m4a'],
//         },
//         multiple: false,
//         maxSize: 50_000_000,
//         onDrop: async (acceptedFiles) => {
//             if (!project?.id) {
//                 alert('Please select a project first');
//                 return;
//             }
//             setisUploading(true);
//             console.log('Accepted files:', acceptedFiles);
//             const file= acceptedFiles[0];
//             if(!file) return;
//             const downloadUrl= await uplaodFile(file as File, setProgress) as string;
//             uploadMeeting.mutate({
//                 projectId: project.id,
//                 name: file.name,
//                 meetingUrl: downloadUrl
//             },{
//                 onSuccess: (meeting) => {
//                     toast.success('Meeting uploaded successfully');
//                     router.push('/meetings')
//                     processMeeting.mutate({
//                         meetingUrl: downloadUrl,
//                         meetingId: meeting.id,
//                         projectId: project.id
//                     })
//                 },

//                 onError: (error) => {
//                     toast.error('Failed to upload meeting');
//                 }

//             });
//             setisUploading(false);
//         }
//     })
//   return (
//     <Card className='col-span-2 flex flex-col items-center justify-center' {...getRootProps()}>
//         {!isUploading && (
//             <>
//             <Presentation className='h-10 w-10 animate-bounce'/>
//             <h3 className='mt-2 text-sm font-semibold text-gray-900'>Create a new Meeting</h3>
//             <p className='mt-1 text-center text-sm text-gray-500'>
//                 Analyze your meeting recordings with Rune.
//                 <br />
//                 Powered by AI
//             </p>
//             <div className='mt-6'>
//                 <Button disabled={isUploading}>
//                     <Upload className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden='true'/>
//                     Upload Meeting
//                     <input className='hidden' {...getInputProps()} />
//                 </Button>
//             </div>
//             </>
//             )}
//             {isUploading && (
//                 <div className='flex items-center justify-center'>
//                    <CircularProgressbar value={progress} text={`${progress}%`} className='size-20' styles={
//                     buildStyles({
//                         pathColor: '#2563eb',
//                         textColor: '#2563eb',
//                     })
//                    }/>
//                    <p className='text-sm text-gray-500 text-center'>Uploading your meeting...</p>
//                 </div>
//             )}
//     </Card>
//   )
// }

// export default MeetingCard

'use client'
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { uplaodFile } from '@/lib/firebase';
import { Presentation, Upload, Brain, Loader2 } from 'lucide-react';
import React from 'react'
import {useDropzone} from 'react-dropzone';
import { CircularProgressbar, buildStyles} from 'react-circular-progressbar';
import { api } from '@/trpc/react';
import Useproject from '@/hooks/use-project';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const MeetingCard = () => {
    const {project} = Useproject();
    const [progress, setProgress] = React.useState(0);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const deleteMeeting = api.project.deleteMeeting.useMutation();

    const processMeeting = useMutation({
        mutationFn: async(data: {meetingUrl: string, meetingId: string}) => {
            const {meetingUrl, meetingId} = data;
            const response = await axios.post('/api/process-meeting', {
                meetingUrl,
                meetingId
            });
            return response.data; // ✅ Added return statement
        },
        onSuccess: (data) => {
            console.log('✅ Processing complete:', data);
            toast.success(`Meeting processed! Created ${data.issuesCreated || 0} summaries.`);
            setIsProcessing(false);
        },
        onError: (error) => {
            console.error('❌ Processing failed:', error);
            toast.error('Failed to process meeting with AI');
            setIsProcessing(false);
        }
    });

    const router = useRouter();
    const uploadMeeting = api.project.uploadMeeting.useMutation();

    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        accept: {
            'audio/*': ['.mp3', '.wav', '.m4a'],
        },
        multiple: false,
        maxSize: 50_000_000,
        onDrop: async (acceptedFiles) => {
            if (!project?.id) {
                toast.error('Please select a project first');
                return;
            }

            const file = acceptedFiles[0];
            if (!file) return;

            setIsUploading(true);
            setProgress(0);
            console.log('🚀 Starting upload:', file.name);

            try {
                // ✅ Upload file
                const downloadUrl = await uplaodFile(file as File, setProgress) as string;
                console.log('✅ File uploaded:', downloadUrl);

                // ✅ Save to database
                uploadMeeting.mutate({
                    projectId: project.id,
                    name: file.name,
                    meetingUrl: downloadUrl
                }, {
                    onSuccess: (meeting) => {
                        console.log('✅ Meeting saved:', meeting.id);
                        toast.success('Meeting uploaded successfully!');
                        setIsUploading(false); // ✅ Move this here
                        setIsProcessing(true); // ✅ Start processing state
                        

                        // ✅ Start AI processing
                        processMeeting.mutate({
                            meetingUrl: downloadUrl,
                            meetingId: meeting.id
                        });
                    },
                    onError: (error) => {
                        console.error('❌ Upload failed:', error);
                        toast.error('Failed to save meeting');
                        setIsUploading(false);
                    }
                });

            } catch (error) {
                console.error('❌ File upload error:', error);
                toast.error('Failed to upload file');
                setIsUploading(false);
            }
        },
        onDropRejected: (fileRejections) => {
            const error = fileRejections[0]?.errors[0];
            if (error?.code === 'file-too-large') {
                toast.error('File too large! Maximum size is 50MB.');
            } else {
                toast.error('Invalid file type! Please upload audio files only.');
            }
        }
    });

    // ✅ Project check
    if (!project) {
        return (
            <Card className='col-span-2 flex flex-col items-center justify-center p-6'>
                <div className='text-center text-gray-500'>
                    <Presentation className='h-8 w-8 mx-auto mb-2 opacity-50'/>
                    <p className='text-sm'>Please select a project first</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className={`col-span-2 flex flex-col items-center justify-center p-6 transition-colors ${
            isDragActive ? 'border-primary bg-primary/5 border-2' : ''
        }`} {...getRootProps()}>
            
            {/* ✅ Default State */}
            {!isUploading && !isProcessing && (
                <>
                    <Presentation className='h-10 w-10 animate-bounce text-primary'/>
                    <h3 className='mt-2 text-sm font-semibold text-gray-900'>Create a new Meeting</h3>
                    <p className='mt-1 text-center text-sm text-gray-500'>
                        {isDragActive ? (
                            "Drop the audio file here..."
                        ) : (
                            <>
                                Analyze your meeting recordings with Rune.
                                <br />
                                <span className="text-xs">Project: {project.name}</span>
                            </>
                        )}
                    </p>
                    <div className='mt-6'>
                        <Button disabled={isUploading || isProcessing}>
                            <Upload className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden='true'/>
                            Upload Meeting
                            <input className='hidden' {...getInputProps()} />
                        </Button>
                    </div>
                </>
            )}

            {/* ✅ Upload Progress */}
            {isUploading && (
                <div className='flex flex-col items-center justify-center space-y-4'>
                    <CircularProgressbar 
                        value={progress} 
                        text={`${progress}%`} 
                        className='size-20' 
                        styles={buildStyles({
                            pathColor: '#2563eb',
                            textColor: '#2563eb',
                            trailColor: '#e5e7eb'
                        })}
                    />
                    <p className='text-sm text-gray-500 text-center'>Uploading your meeting...</p>
                </div>
            )}

            {/* ✅ AI Processing */}
            {isProcessing && (
                <div className='flex flex-col items-center justify-center space-y-4'>
                    <div className="relative">
                        <Brain className='h-10 w-10 text-purple-500'/>
                        <Loader2 className='h-4 w-4 animate-spin absolute -top-1 -right-1 text-blue-500'/>
                    </div>
                    <h3 className='text-sm font-semibold text-gray-900'>AI Processing...</h3>
                    <p className='text-xs text-gray-500 text-center'>
                        Transcribing and analyzing your meeting
                        <br />
                        This may take a few minutes
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => router.push('/meetings')}
                    >
                        View Meetings
                    </Button>
                    
                </div>
            )}
        </Card>
    );
};

export default MeetingCard;