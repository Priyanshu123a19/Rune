//now one highlighted thing over here is that we can directly run any typescript file directly individually with bun to test out the api more clearly

import { db } from '@/server/db';
import {Octokit} from 'octokit';
import axios from 'axios';
import { aiSummariseCommit } from './gemini';

export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
})

const githubUrl = ""

// here we have defined the type of response that we are going to get back from the api
type Response = {
    commitHash: string  // Changed from String
    commitAuthorName: string  // Changed from String
    commitAuthorAvatar: string  // Changed from String
    commitDate: string  // Changed from String
    commitMessage: string  // Changed from String
}

//over here we are fetching the commit hashes from the GitHub API
//and also sorting them according to the data
//the new commit we are also passing in the database

export const getCommitHashes = async(githubUrl: string) => {
    const urlParts = githubUrl.replace('https://github.com/', '').split('/')
    const owner = urlParts[0]
    const repo = urlParts[1]
    
    // Add validation
    if (!owner || !repo) {
        throw new Error('Invalid GitHub URL format')
    }
    
    const {data} = await octokit.rest.repos.listCommits({
        owner: owner,
        repo: repo
    })
    //sorting the commits over here by the date and then seding out the response
    const sortedCommits= data.sort((a:any , b:any)=> new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()) as any

    return sortedCommits.slice(0, 10).map((commit:any) => ({
        commitHash: commit.sha as string,
        commitAuthorName: commit.commit?.author?.name ?? "",
        commitAuthorAvatar: commit?.author?.avatar_url ?? "",
        commitDate: commit.commit?.author?.date ?? "",
        commitMessage: commit.commit?.message ?? ""
    }))
}

export const pollCommits = async (projectId: string)=> {
    const {project, githubUrl}=await fetchProjectGithubUrl(projectId)
    const commitHashes = await getCommitHashes(githubUrl)
    const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes)
    const summaryResponse = await Promise.allSettled(unprocessedCommits.map(async (commit) => {
        return summariseCommit(githubUrl, commit.commitHash)
    }))


    const summaries = summaryResponse.map((response)=>{
        if(response.status === 'fulfilled') {
            return response.value as string
        }
        return ""
    })

    console.log('🚀 Generated Summaries:');
summaries.forEach((summary, index) => {
    if (summary) {
        console.log(`\n📝 Commit ${index + 1}:`);
        console.log(`   Hash: ${unprocessedCommits[index]!.commitHash.slice(0, 7)}`);
        console.log(`   Message: ${unprocessedCommits[index]!.commitMessage.slice(0, 50)}...`);
        console.log(`   Summary: ${summary}`);
        console.log('   ' + '─'.repeat(50));
    }
});

    const commits = await db.commit.createMany({
        data: summaries.map((summary, index) =>{
            console.log(`processing commit ${index}`)

            console.log(`💾 Saving commit ${index + 1}:`);
        console.log(`   Summary: "${summary}"`);
        console.log(`   Summary length: ${summary?.length || 0}`);
            return {
                projectId: projectId,
                commitHash: unprocessedCommits[index]!.commitHash,
                commitAuthorName: unprocessedCommits[index]!.commitAuthorName,
                commitAuthorAvatar: unprocessedCommits[index]!.commitAuthorAvatar,
                commitDate: unprocessedCommits[index]!.commitDate,
                commitMessage: unprocessedCommits[index]!.commitMessage,
                summary
            }
        })
    })
}

async function summariseCommit(githubUrl: string, commitHash: string){
    const {data} = await axios.get(`${githubUrl}/commit/${commitHash}.diff`,{
        headers: {
            Accept: "application/vnd.github.v3.diff"
        }
    });
    return await aiSummariseCommit(data) || "";
}

async function fetchProjectGithubUrl(projectId: string) {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { githubUrl: true }
    })

    if(!project) throw new Error("Project not found")

    return { project, githubUrl: project?.githubUrl ?? "" }
}


async function filterUnprocessedCommits(projectId: string, commitHashes: Response[]) {
    const processedCommits = await db.commit.findMany({
        where: { projectId}
    })

    const unprocessedCommits = commitHashes.filter((commit) => !processedCommits.some((processedCommits)=>processedCommits.commitHash === commit.commitHash))
    return unprocessedCommits
}

//u can always run this to check that ur endpoint is working in the console or not ...this is a very effeicient way u can use the typescript to make sure that the api endpoints are working correctly
// getCommitHashes(githubUrl)

pollCommits('cme9l3pqe0003b204slsuccaq')