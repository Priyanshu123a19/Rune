//here we will be using the lang chain to get the details about the GitHub repository
//lang chain is the super cool thing that helps us communicate or channel the energy of LLMs

import {GithubRepoLoader} from '@langchain/community/document_loaders/web/github';
import { doc } from 'prettier';
import {Document} from '@langchain/core/documents';
import { generateEmbedding, summariseCode } from './gemini';
import { db } from '@/server/db';
import { Octokit } from 'octokit';

//making a function to fetch the amount of files there are in the project
const getFileCount= async(path:string,octokit:Octokit,githubOwner:string,githubRepo:string,acc:number=0)=>{
        const {data} = await octokit.rest.repos.getContent({
            owner: githubOwner,
            repo: githubRepo,
            path
        })

        //getting the saperate file and dir...so addign the dir if they exist in the end and then showing the credits req of if the file solo exits then solo filecount returned
        if(!Array.isArray(data) && data.type === 'file') {
            return acc+1;
        }
        if(Array.isArray(data)) {
            let fileCount=0;
            const directories: string[]=[]
            for(const item of data){
                if(item.type ==='dir'){
                    directories.push(item.path);
                }else{
                    fileCount++;
                }
            }

            if(directories.length > 0){
                const directoryCounts = await Promise.all(
                    directories.map(dirPath =>getFileCount(dirPath,octokit,githubOwner,githubRepo,0))
                )
                fileCount+=directoryCounts.reduce((acc, count) => acc + count, 0);
            }
            return acc+fileCount;
        }
        return acc;
}

//making the function that will check the credits that we will be using to create a project and if not enouhg then buy 
export const checkCredits = async(githubUrl: string,githubToken?: string) => {
    const octokit= new Octokit({auth:githubToken})
    const githubOwner = githubUrl.split('/')[3];
    const githubRepo = githubUrl.split('/')[4];
    if(!githubOwner || !githubRepo) {
        throw new Error('Invalid GitHub URL');
    }

    const fileCount = await getFileCount('',octokit,githubOwner,githubRepo,0);
    return fileCount;
}

export const loadGithubRepo= async (githubUrl:string, githubToken?: string)=>{
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken ||  process.env.GITHUB_TOKEN || '',
        branch: 'main',
        ignoreFiles: ['package-lock.json','yarn.lock','pnpm-lock.yaml','bun.lockb'],
        recursive:true,
        unknown: 'warn',
        maxConcurrency:5
    },
    )
    const docs=await loader.load();
    return docs;
}

// console.log(await loadGithubRepo('https://github.com/Priyanshu123a19/Industry_Grade_Backend'))

export const indexGithubRepo = async(projectId: string, githubUrl: string, githubToken?: string) => {
    const docs = await loadGithubRepo(githubUrl, githubToken)
    // Index the documents in your database
    const allEmbeddings = await generateEmbeddings(docs)
    //now saving the embedding into the database
    //also one more thing is that we now try to save the vector also that is an array 
    //but postgres doesent support it now
    //all we can do is to write a shitty querry functino to do this for us actually
    await Promise.allSettled(allEmbeddings.map(async (embedding,index)=>{
        console.log(`processing ${index}th embedding of ${allEmbeddings.length} embeddings`)

        // Save the embedding to the database
        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
            data: {
                summary: embedding.summary,
                sourceCode: embedding.sourceCode,
                fileName: embedding.fileName,
                projectId
            }
        })

        //now we need to manually write a damn query to make sure that the vector also gets saved in the database
        await db.$executeRaw`
        UPDATE "sourceCodeEmbedding"
        SET "summaryEmbedding" = ${embedding.embedding}::vector
        WHERE "id"= ${sourceCodeEmbedding.id}
        `
    }))
}

//here in this function we are creating the embedding for each summary of the file that the current github repo has to offer
const generateEmbeddings = async (docs: Document[]) => {
    return await Promise.all(docs.map(async doc => {
        //got hte summary
        const summary = await summariseCode(doc);
        //got the embedding
        const embedding = await generateEmbedding(summary);

        return {
            summary,
            embedding,
            sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
            fileName: doc.metadata.source,
        }  
        
    }))
}




