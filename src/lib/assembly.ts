// import {AssemblyAI} from 'assemblyai'
// const client= new AssemblyAI({
//     apiKey: process.env.ASSEMBLYAI_API_KEY!
// })


// function msToTime(ms: number){
//     const seconds = ms/1000
//     const minutes= Math.floor(seconds/60)
//     const remainingSeconds = Math.floor(seconds % 60)

//     return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
// }

// export const processMeeting= async (meetingUrl: string)=>{
//     const transcript=await client.transcripts.transcribe({
//         audio:meetingUrl,
//         auto_chapters:true
//     }
//     )


// const summaries= transcript.chapters?.map(chapter=> ({
//     start:msToTime(chapter.start),
//     end:msToTime(chapter.end),
//     gist: chapter.gist,
//     headline: chapter.headline,
//     summary: chapter.summary
// })) || []
// if(!transcript.text) throw new Error("Transcription failed")

//     return {
//         summaries
//     }

// }

// const FILE_URL='https://assembly.ai/sports_injuries.mp3';

// const response = await processMeeting(FILE_URL);

// console.log(response);

import {AssemblyAI} from 'assemblyai'

const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!
})

function msToTime(ms: number){
    const seconds = ms/1000
    const minutes = Math.floor(seconds/60)
    const remainingSeconds = Math.floor(seconds % 60)

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export const processMeeting = async (meetingUrl: string) => {
    console.log('🎵 Starting transcription for:', meetingUrl);
    
    try {
        // ✅ Submit transcription request
        let transcript = await client.transcripts.transcribe({
            audio: meetingUrl,
            auto_chapters: true,
            speaker_labels: true,
            punctuate: true,
            format_text: true
        });

        console.log('📊 Initial status:', transcript.status);
        console.log('📝 Transcript ID:', transcript.id);

        // ✅ Poll until transcription is complete
        while (transcript.status === 'queued' || transcript.status === 'processing') {
            console.log(`⏳ Status: ${transcript.status}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            
            // ✅ Get updated status
            transcript = await client.transcripts.get(transcript.id);
        }

        console.log('🏁 Final status:', transcript.status);

        // ✅ Check for errors
        if (transcript.status === 'error') {
            console.error('❌ Transcription error:', transcript.error);
            throw new Error(`Transcription failed: ${transcript.error}`);
        }

        // ✅ Check if completed successfully
        if (transcript.status !== 'completed') {
            throw new Error(`Transcription failed with status: ${transcript.status}`);
        }

        // ✅ Validate transcript text
        if (!transcript.text || transcript.text.trim().length === 0) {
            throw new Error('No speech detected in audio file');
        }

        console.log('✅ Transcription completed successfully');
        console.log(`📄 Text length: ${transcript.text.length} characters`);
        console.log(`🎯 Confidence: ${transcript.confidence}`);

        // ✅ Process chapters with fallback
        const summaries = transcript.chapters?.map(chapter => ({
            start: msToTime(chapter.start),
            end: msToTime(chapter.end),
            gist: chapter.gist || 'No summary available',
            headline: chapter.headline || 'Untitled Section',
            summary: chapter.summary || 'No detailed summary available'
        })) || [];

        // ✅ Create default chapter if none found
        if (summaries.length === 0) {
            console.log('📝 No chapters found, creating default summary');
            summaries.push({
                start: '00:00',
                end: '99:99',
                gist: transcript.text.substring(0, 100) + '...',
                headline: 'Full Meeting Transcript',
                summary: transcript.text.substring(0, 500) + '...'
            });
        }

        console.log(`📚 Generated ${summaries.length} summaries`);

        return {
            transcript,
            summaries
        };

    } catch (error) {
        console.error('❌ Assembly AI error:', error);
        throw error;
    }
};

// ✅ Test function
export async function testAssemblyAI() {
    console.log('🧪 Testing Assembly AI...');
    
    const sampleUrl = 'https://storage.googleapis.com/aai-docs-samples/nbc.wav';
    
    try {
        const result = await processMeeting(sampleUrl);
        console.log('✅ Test Success!');
        console.log('📝 Preview:', result.transcript.text?.substring(0, 200) + '...');
        console.log('📊 Chapters:', result.summaries.length);
        return true;
    } catch (error) {
        console.error('❌ Test Failed:', error);
        return false;
    }
}