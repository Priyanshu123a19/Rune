'use server'
import {streamText} from 'ai'
import {createStreamableValue} from 'ai/rsc'
import {createGoogleGenerativeAI} from '@ai-sdk/google'
import { generateEmbedding } from '@/lib/gemini'
import { db } from '@/server/db'
import Groq from 'groq-sdk'

// const google = createGoogleGenerativeAI({
//     apiKey: process.env.GEMINI_API_KEY,
// })

// export async function askQuestion(question:string, projectId:string){
//     const stream = createStreamableValue('');

//     //now over here we will try to make a function that will help us to comapare the different files according to thier embeddign score 
//     //this is the part of our rag model where we are trying to get the similar files which we have searched for in our context
//     //so just understand the flow....u got the embeddings for the code earlier for each file
//     //u noow want to see some specific part of a file by your input in the form
//     //now here we compare the embeddings of the files to find the most relevant ones accrding to your prompt
//     //so we got top 10 files then we send it to the ai for getting the final results ....these relavant fiels are sent as the context to our ai 
//     //which then gives us the relative things we want

//     const queryVector= await generateEmbedding(question)
//     const vectorQuery = `[${queryVector.join(',')}]`

//     const result = await db.$queryRaw`
//         SELECT "fileName", "sourceCode", "summary",
//         1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
//         FROM "sourceCodeEmbedding"
//         WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.5
//         AND "projectId" = ${projectId}
//         ORDER BY similarity DESC
//         LIMIT 10
//     ` as { fileName: string; sourceCode: string; summary: string; similarity: number; }[]

//     let context=''

//     //making the context by concatenating the file contents
//     for(const doc of result){
//         context+=`source: ${doc.fileName}\ncode content: ${doc.sourceCode}\n summary of file: ${doc.summary}\n\n`
//     }

//     (async ()=>{
//         const {textStream}=await streamText({
//             model: google('gemini-1.5-flash'),
//             prompt:`
//             You are an ai code assistant who answers questions about the codebase. Your target audience is a technical intern with limited experience.
// The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
// AI is a well-behaved and well-mannered individual.
// AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
// AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in general.
// If the question is asking about code or a specific file, AI will provide the detailed answer, giving step by step instructions.
// START CONTEXT BLOCK
// ${context}
// END OF CONTEXT BLOCK

// START QUESTION
// ${question}
// END OF QUESTION

// AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
// If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer."
// AI assistant will not apologize for previous responses, but instead will indicate new information was gained.
// AI assistant will not invent anything that is not drawn directly from the context.
// Answer in markdown syntax, with code snippets if needed. Be as detailed as possible when answering.
//             `
//         });

//         for await (const delta of textStream) {
//             stream.update(delta);
//         }

//         stream.done();
//     })();

//     return {
//         output: stream.value,
//         fileReferences: result
//     }
// }



//!...................................................................................................................................................................................
//!the implementataion for the groq to the same thing is given below again if u are gareeb and cant efford the billing u can use this shit over here



const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function askQuestion(question:string, projectId:string){
    const stream = createStreamableValue('');

    //now over here we will try to make a function that will help us to comapare the different files according to thier embeddign score 
    //this is the part of our rag model where we are trying to get the similar files which we have searched for in our context
    //so just understand the flow....u got the embeddings for the code earlier for each file
    //u noow want to see some specific part of a file by your input in the form
    //now here we compare the embeddings of the files to find the most relevant ones accrding to your prompt
    //so we got top 10 files then we send it to the ai for getting the final results ....these relavant fiels are sent as the context to our ai 
    //which then gives us the relative things we want

    const queryVector= await generateEmbedding(question)
    const vectorQuery = `[${queryVector.join(',')}]`

    const result = await db.$queryRaw`
        SELECT "fileName", "sourceCode", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
        FROM "sourceCodeEmbedding"
        WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.5
        AND "projectId" = ${projectId}
        ORDER BY similarity DESC
        LIMIT 10
    ` as { fileName: string; sourceCode: string; summary: string; similarity: number; }[]

    let context=''

    //making the context by concatenating the file contents
    for(const doc of result){
        context+=`source: ${doc.fileName}\ncode content: ${doc.sourceCode}\n summary of file: ${doc.summary}\n\n`
    }

    (async ()=>{
        try {
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an ai code assistant who answers questions about the codebase. Your target audience is a technical intern with limited experience.
The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
AI is a well-behaved and well-mannered individual.
AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in general.
If the question is asking about code or a specific file, AI will provide the detailed answer, giving step by step instructions.

START CONTEXT BLOCK
${context}
END OF CONTEXT BLOCK

AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer."
AI assistant will not apologize for previous responses, but instead will indicate new information was gained.
AI assistant will not invent anything that is not drawn directly from the context.
Answer in markdown syntax, with code snippets if needed. Be as detailed as possible when answering.`
                    },
                    {
                        role: "user",
                        content: question
                    }
                ],
                model: "llama-3.1-8b-instant",
                max_tokens: 2000,
                stream: true,
            });

            for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    stream.update(content);
                }
            }

            // Add delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error('❌ Error in askQuestion (Groq):', error);
            stream.update('Sorry, there was an error processing your question. Please try again.');
        }

        stream.done();
    })();

    return {
        output: stream.value,
        fileReferences: result
    }
}