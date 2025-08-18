// import { processMeeting } from "@/lib/assembly";
// import { db } from "@/server/db";
// import { auth } from "@clerk/nextjs/server";
// import { NextRequest, NextResponse } from "next/server";
// import { z } from "zod";

// const bodyParser = z.object({
//     meetingUrl: z.string(),
//     projectId: z.string(),
//     meetingId: z.string(),
// })

// export const maxDuration = 300

// export async function POST(req: NextRequest){
//     const {userId} = await auth();

//     if(!userId) throw new Error("Unauthorized");
//     try {
//         const body = await req.json();
//         const {meetingUrl, projectId, meetingId} = bodyParser.parse(body);
//         const {summaries} = await processMeeting(meetingUrl);
//          await db.issue.createMany({
//             data: summaries.map((summary) => ({  // ✅ Added return parentheses
//                 start: summary.start,
//                 end: summary.end,
//                 gist: summary.gist,
//                 headline: summary.headline,
//                 summary: summary.summary,
//                 meetingId
//             }))
//         })

//         await db.meeting.update({
//             where:{id: meetingId },data: {
//                     status: "PROCESSED",
//                     name: summaries[0]!.headline
//                 }
//         })

//     } catch (error) {
//         console.error("Error processing meeting:", error);
//         return NextResponse.json({ error: "Failed to process meeting" }, { status: 500 });
//     }
// }

import { processMeeting } from "@/lib/assembly";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodyParser = z.object({
    meetingUrl: z.string(),
    meetingId: z.string(),
})

export const maxDuration = 300

export async function POST(req: NextRequest){
    const {userId} = await auth();

    if(!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const {meetingUrl, meetingId} = bodyParser.parse(body); // ✅ meetingId is guaranteed to be string here
        
        console.log('🚀 Processing meeting:', meetingId);
        console.log('📁 Audio URL:', meetingUrl);

        // ✅ Process the meeting
        const {summaries} = await processMeeting(meetingUrl);
        
        console.log(`📚 Creating ${summaries.length} issues from summaries...`);

        // ✅ Create issues in database - meetingId is definitely a string
        await db.issue.createMany({
            data: summaries.map((summary) => ({
                start: summary.start,
                end: summary.end,
                gist: summary.gist,
                headline: summary.headline,
                summary: summary.summary,
                meetingId // ✅ TypeScript knows this is string
            }))
        });

        // ✅ Update meeting status to processed
        await db.meeting.update({
            where: { id: meetingId },
            data: {
                status: "PROCESSED",
                name: summaries[0]?.headline || "Processed Meeting"
            }
        });

        console.log('✅ Meeting processed successfully');
        
        return NextResponse.json({ 
            success: true,
            message: "Meeting processed successfully",
            issuesCreated: summaries.length,
            meetingId,
            summaries: summaries.map(s => ({
                headline: s.headline,
                gist: s.gist
            }))
        }, { status: 200 });

    } catch (error) {
        console.error("❌ Error processing meeting:", error);
        
        // ✅ For error handling, we'll try to get meetingId from the body again
        try {
            const body = await req.json();
            const {meetingId} = bodyParser.parse(body);
            
            await db.meeting.update({
                where: { id: meetingId },
                data: { 
                    status: "FAILED",
                    name: "Processing Failed"
                }
            });
        } catch (updateError) {
            console.error("Failed to update meeting status:", updateError);
        }

        return NextResponse.json({ 
            success: false,
            error: "Failed to process meeting",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}