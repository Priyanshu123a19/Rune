import {GoogleGenerativeAI} from '@google/generative-ai';
import { Document } from '@langchain/core/documents';
import Groq from "groq-sdk"; // ✅ Add this line

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model=genAI.getGenerativeModel(
    {
        model: 'gemini-1.5-flash',
    }
)


// export const aiSummariseCommit = async (diff: string) => {
//     const response = await model.generateContent([
//         `You are an expert programmer, and you are trying to summarize a git diff.
// Reminders about the git diff format:
// For every file, there are a few metadata lines, like (for example):

// diff --git a/lib/index.js b/lib/index.js
// index aadf601..bfef603 100644
// --- a/lib/index.js
// +++ b/lib/index.js

// This means that 'lib/index.js' was modified in this commit. Note that this is only an example.
// Then there is a specifier of the lines that were modified.
// A line starting with '+' means it was added.
// A line starting with '-' means that line was deleted.
// A line that starts with neither '+' nor '-' is code given for context and better understanding.
// It is not part of the diff.

// EXAMPLE SUMMARY COMMENTS:
// * Raised the amount of returned recordings from '10' to '100' [packages/server/recordings_api.ts], [packages/server/constants.ts]
// * Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
// * Moved the 'octokit' initialization to a separate file [src/octokit.ts], [src/index.ts]
// * Added an OpenAI API for completions [packages/utils/apis/openai.ts]
// * Lowered numeric tolerance for test files

// Most commits will have less comments than this examples list.
// The last comment does not include the file names,
// because there were more than two relevant files in the hypothetical commit.
// Do not include parts of the example in your summary.
// It is given only as an example of appropriate comments.`,
//         `Please summarise the following diff file: \n\n${diff}`,
//     ]);
    
//     return response.response.text();
// }

// //this is the function where we generate the code snippet summary so that we can provide it to the further coming process so that we can make the vector from it as embedding 
// //then use that embedding for searching the most close vector / embedding /file that is related to the text

// export async function summariseCode(doc: Document) {
//     console.log("getting summary for document:", doc.metadata.source);
//     try {
//         const code = doc.pageContent.slice(0, 10000);
//         const response = await model.generateContent([
//             `You are an intelligent senior software engineer who specialises in onboarding junior software engineers into projects.`,
//             `You are onboarding a junior software engineer and explaining to them the purpose of the ${doc.metadata.source} file.`,
//             `Here is the code:\n---\n${code}\n---\n`,
//             `Give a summary no more than 100 words of the code above.`
//         ]);
        
//         return response.response.text();
//     } catch (error) {
//         console.error('❌ Error in code summary:', error);
//         return ''
//     }
// }



//! GROK CODE FOR THE SAME PURPOSE TESTED AND FUCKING VARIFIED BY ME U CAN USE THIS SHIT EFFORTLESSLY IF U ARE GAREEB LIKE ME AND DOESNT HAVE PRO VERSION IN GOOGLE AI STUDIO

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export const aiSummariseCommit = async (diff: string) => {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
For every file, there are a few metadata lines, like (for example):

diff --git a/lib/index.js b/lib/index.js
index aadf601..bfef603 100644
--- a/lib/index.js
+++ b/lib/index.js

This means that 'lib/index.js' was modified in this commit. Note that this is only an example.
Then there is a specifier of the lines that were modified.
A line starting with '+' means it was added.
A line starting with '-' means that line was deleted.
A line that starts with neither '+' nor '-' is code given for context and better understanding.
It is not part of the diff.

EXAMPLE SUMMARY COMMENTS:
* Raised the amount of returned recordings from '10' to '100' [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the 'octokit' initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files

Most commits will have less comments than this examples list.
The last comment does not include the file names,
because there were more than two relevant files in the hypothetical commit.
Do not include parts of the example in your summary.
It is given only as an example of appropriate comments.`
                },
                {
                    role: "user", 
                    content: `Please summarise the following diff file: \n\n${diff}`
                }
            ],
            model: "llama-3.1-8b-instant",
            max_tokens: 200,
        });

        // ✅ Add delay and better logging
        console.log('🔹 Commit summary generated:', response.choices[0]?.message?.content?.slice(0, 100) + '...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        return response.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('❌ Error in aiSummariseCommit:', error);
        return ''; // Or throw the error to see what's happening
    }
}

export async function summariseCode(doc: Document) {
    console.log("getting summary for document:", doc.metadata.source);
    try {
        const code = doc.pageContent.slice(0, 10000);
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an intelligent senior software engineer who specialises in onboarding junior software engineers into projects."
                },
                {
                    role: "user",
                    content: `You are onboarding a junior software engineer and explaining to them the purpose of the ${doc.metadata.source} file.\n\nHere is the code:\n---\n${code}\n---\n\nGive a summary no more than 100 words of the code above.`
                }
            ],
            model: "llama-3.1-8b-instant",
            max_tokens: 150,
        });
        
        const summary = response.choices[0]?.message?.content || '';
        console.log(`🔹 Summary for ${doc.metadata.source}:`, summary.slice(0, 100) + '...');
        
        //✅ Add delay
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        return summary;
    } catch (error) {
        console.error(`❌ Error summarizing ${doc.metadata.source}:`, error);
        return '';
    }
}



// here we will be writing the coolest function of getting the embedding form of this new summary
export async function generateEmbedding(summary: string){
    const model= genAI.getGenerativeModel({
        model: "text-embedding-004"
    })
    const result = await model.embedContent(summary)
    const embedding = result.embedding
    return embedding.values
} 





// //!TESTER CODE FOR API HEALTH CHECK IN CASE THE REQ DONT GO AS PLANNED IN THE EMBEDDING,AISUMMARY,CONTENTSUMMARY BEFORE EMBEDDING GENERATION


async function testCommitSummary() {
    console.log('🧪 Testing commit summary...');
    
    const sampleDiff = `diff --git a/src/controllers/user.controller.js b/src/controllers/user.controller.js
index 06e927e..eb141de 100644
--- a/src/controllers/user.controller.js
+++ b/src/controllers/user.controller.js
@@ -3,6 +3,7 @@ import {ApiError} from '../utils/ApiError.js';
 import {User} from '../models/user.model.js';
 import {uploadOnCloudinary} from '../utils/cloudinary.js';
 import { ApiResponse } from '../utils/ApiResponse.js';
+import e from 'express';
 
 //writing a saperate function for refresh and access token handeling
 const generateAcessAndRefreshToken = async (userId)=> {
@@ -360,6 +361,89 @@ const updateUserCoverImage = asyncHandler(async (req, res) => {
 
 })
 
+const getUserChannelProfile =asyncHandler(async (req, res) => {
+    const {username} = req.params;
+    if(!username){
+        throw new ApiError(400, "Username is required");
+    }
+    // ...rest of the function
+});`;

    try {
        const summary = await aiSummariseCommit(sampleDiff);
        console.log('✅ Commit Summary:', summary);
    } catch (error) {
        console.error('❌ Error in commit summary:', error);
    }
}

async function testCodeSummary() {
    console.log('🧪 Testing code summary...');
    
    const sampleDoc = {
        pageContent: `
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(\`Server running at http://localhost:\${port}\`);
});
        `,
        metadata: {
            source: 'server.js'
        }
    };

    try {
        const summary = await summariseCode(sampleDoc as any);
        console.log('✅ Code Summary:', summary);
    } catch (error) {
        console.error('❌ Error in code summary:', error);
    }
}

async function testEmbedding() {
    console.log('🧪 Testing embedding generation...');
    
    const sampleSummary = "This is a simple Express.js server that creates a basic web application listening on port 3000 and responds with 'Hello World!' to GET requests.";

    try {
        const embedding = await generateEmbedding(sampleSummary);
        console.log('✅ Embedding generated successfully');
        console.log('   Length:', embedding?.length || 0);
        console.log('   First 5 values:', embedding?.slice(0, 5) || 'none');
    } catch (error) {
        console.error('❌ Error in embedding generation:', error);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Gemini API tests...\n');
    
    await testCommitSummary();
    console.log('\n' + '─'.repeat(50) + '\n');
    
    await testCodeSummary();
    console.log('\n' + '─'.repeat(50) + '\n');
    
    await testEmbedding();
    console.log('\n✨ All tests completed!');
}

//Only run tests when this file is executed directly
if (require.main === module) {
    runAllTests();
}
