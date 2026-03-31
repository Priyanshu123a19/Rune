import {GithubRepoLoader} from '@langchain/community/document_loaders/web/github';
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
    const octokit= new Octokit({auth: githubToken || process.env.GITHUB_TOKEN})
    const githubOwner = githubUrl.split('/')[3];
    const githubRepo = githubUrl.split('/')[4];
    if(!githubOwner || !githubRepo) {
        throw new Error('Invalid GitHub URL');
    }

    const fileCount = await getFileCount('',octokit,githubOwner,githubRepo,0);
    return fileCount;
}

// ─── File filtering ────────────────────────────────────────────────────────────

const SKIP_EXTENSIONS = new Set([
    // Binaries / media
    '.png','.jpg','.jpeg','.gif','.ico','.webp','.avif','.svg',
    '.woff','.woff2','.ttf','.eot','.otf',
    '.mp4','.mp3','.wav','.ogg','.webm',
    '.zip','.tar','.gz','.rar','.7z','.pdf',
    // Compiled / minified
    '.min.js','.min.css','.bundle.js','.chunk.js','.map','.d.ts',
    // Lock files
    '.lock', '.lockb',
])

const SKIP_FILENAMES = new Set([
    'package-lock.json','yarn.lock','pnpm-lock.yaml','bun.lockb',
    '.prettierrc','.eslintrc','.eslintignore','.gitignore','.gitattributes',
    '.editorconfig','LICENSE','LICENCE','CODEOWNERS',
    'next-env.d.ts', 'tsconfig.json', 'tsconfig.node.json',
    'postcss.config.js','postcss.config.mjs','tailwind.config.js','tailwind.config.ts',
    'jest.config.js','jest.config.ts','vitest.config.ts','vitest.config.js',
])

const SKIP_PATH_SEGMENTS = [
    '/node_modules/', '/.next/', '/dist/', '/build/', '/coverage/',
    '/__snapshots__/', '/fixtures/', '/.git/',
]

function shouldSkip(src: string): boolean {
    const lower = src.toLowerCase()
    const filename = src.split('/').pop() ?? ''

    if (SKIP_FILENAMES.has(filename)) return true

    const ext = '.' + lower.split('.').pop()
    // Handle double extensions like .min.js
    if (SKIP_EXTENSIONS.has(ext)) return true
    if (lower.endsWith('.min.js') || lower.endsWith('.min.css') ||
        lower.endsWith('.bundle.js') || lower.endsWith('.chunk.js') ||
        lower.endsWith('.d.ts')) return true

    if (SKIP_PATH_SEGMENTS.some(seg => lower.includes(seg))) return true

    return false
}

// ─── Smart chunker for TS/JS files ────────────────────────────────────────────
// Files ≤ 150 lines → kept as-is (single chunk)
// Files > 150 lines → split at top-level declaration boundaries every ~100 lines

const TOP_LEVEL_DECL = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/

function chunkDocument(doc: Document): Document[] {
    const src: string = doc.metadata.source ?? ''

    // Only chunk TypeScript / JavaScript
    if (!src.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) return [doc]

    const lines = doc.pageContent.split('\n')
    if (lines.length <= 150) return [doc]

    const chunks: Document[] = []
    const CHUNK_LINES = 100

    let chunkStart = 0

    while (chunkStart < lines.length) {
        let chunkEnd = Math.min(chunkStart + CHUNK_LINES, lines.length)

        // Try to extend to the next top-level declaration boundary (up to 30 lines)
        if (chunkEnd < lines.length) {
            for (let i = chunkEnd; i < Math.min(chunkEnd + 30, lines.length); i++) {
                if (TOP_LEVEL_DECL.test(lines[i]!)) {
                    chunkEnd = i
                    break
                }
            }
        }

        const chunkLines = lines.slice(chunkStart, chunkEnd)
        if (chunkLines.join('').trim().length < 50) {
            chunkStart = chunkEnd
            continue
        }

        // Extract dominant symbol name for the chunk ID
        let symbolName = ''
        for (const line of chunkLines) {
            const m = TOP_LEVEL_DECL.exec(line)
            if (m?.[1]) { symbolName = m[1]; break }
        }

        const chunkId = symbolName
            ? `${src}#${symbolName}`
            : `${src}#L${chunkStart + 1}`

        chunks.push(new Document({
            pageContent: chunkLines.join('\n'),
            metadata: {
                ...doc.metadata,
                source:     src,
                chunkId,
                startLine:  chunkStart + 1,
                endLine:    chunkEnd,
                isChunk:    true,
            },
        }))

        chunkStart = chunkEnd
    }

    return chunks.length > 0 ? chunks : [doc]
}

export const loadGithubRepo = async (githubUrl: string, githubToken?: string) => {
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken:    githubToken || process.env.GITHUB_TOKEN || '',
        branch:         'main',
        ignoreFiles:    ['package-lock.json','yarn.lock','pnpm-lock.yaml','bun.lockb'],
        recursive:      true,
        unknown:        'warn',
        maxConcurrency: 5,
    })

    const raw  = await loader.load()
    const docs = raw.filter(d => !shouldSkip(d.metadata.source ?? ''))
                    .filter(d => d.pageContent.trim().length >= 50)  // skip empty/trivial files

    // Chunk large TS/JS files — expand each doc into ≤100-line chunks
    return docs.flatMap(chunkDocument)
}

// ─── Concurrency helpers ───────────────────────────────────────────────────────

async function runInBatches<T, R>(
    items:     T[],
    fn:        (item: T, index: number) => Promise<R>,
    batchSize: number,
    delayMs:   number = 800,
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = []
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(batch.map((item, j) => fn(item, i + j)))
        results.push(...batchResults)
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, delayMs))
        }
    }
    return results
}

// ─── Index ─────────────────────────────────────────────────────────────────────

export const indexGithubRepo = async (projectId: string, githubUrl: string, githubToken?: string) => {
    const docs = await loadGithubRepo(githubUrl, githubToken)
    console.log(`📦 Loaded ${docs.length} chunks to index`)

    // Remove stale embeddings before re-indexing so there are no duplicates
    await db.sourceCodeEmbedding.deleteMany({ where: { projectId } })

    await runInBatches(docs, async (doc, idx) => {
        console.log(`⚙️  [${idx + 1}/${docs.length}] ${doc.metadata.chunkId ?? doc.metadata.source}`)

        const summary   = await summariseCode(doc)
        // Embed the file path + structured summary — path itself is now semantically searchable
        const embedText = `${doc.metadata.chunkId ?? doc.metadata.source}\n${summary}`
        const embedding = await generateEmbedding(embedText)

        const row = await db.sourceCodeEmbedding.create({
            data: {
                summary,
                sourceCode: doc.pageContent,
                // For chunks: store "src/lib/auth.ts#validateToken", for whole files: just path
                fileName:   (doc.metadata.chunkId ?? doc.metadata.source) as string,
                projectId,
            },
        })

        await db.$executeRaw`
            UPDATE "sourceCodeEmbedding"
            SET    "summaryEmbedding" = ${embedding}::vector
            WHERE  "id" = ${row.id}
        `
    }, /* batchSize */ 4, /* delayMs */ 1000)

    console.log(`✅ Indexed ${docs.length} chunks for project ${projectId}`)
}

// ─── Incremental re-index on commit sync ──────────────────────────────────────
// Called after pollCommits — re-embeds only the files changed in new commits.
// Handles: added/modified (upsert embedding) and removed (delete embedding).

export async function reIndexChangedFiles(
    projectId:     string,
    githubUrl:     string,
    commitHashes:  string[],
) {
    const octokit     = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const owner       = githubUrl.split('/')[3]
    const repo        = githubUrl.split('/')[4]
    if (!owner || !repo) return

    // Collect unique changed files across all new commits
    const toUpsert  = new Map<string, string>() // filePath → decoded content
    const toRemove  = new Set<string>()

    for (const hash of commitHashes) {
        try {
            const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: hash })
            for (const file of data.files ?? []) {
                if (!file.filename) continue
                if (shouldSkip(file.filename)) continue

                if (file.status === 'removed') {
                    toRemove.add(file.filename)
                    toUpsert.delete(file.filename)
                } else {
                    toRemove.delete(file.filename)
                    toUpsert.set(file.filename, '') // mark for content fetch
                }
            }
        } catch (err) {
            console.error(`⚠️  Could not fetch commit ${hash}:`, err)
        }
    }

    // Fetch content for each changed file
    for (const filePath of toUpsert.keys()) {
        try {
            const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filePath })
            if (!Array.isArray(data) && data.type === 'file' && data.content) {
                toUpsert.set(filePath, Buffer.from(data.content, 'base64').toString('utf-8'))
            }
        } catch {
            toUpsert.delete(filePath) // skip if fetch fails
        }
    }

    // Delete removed files
    for (const filePath of toRemove) {
        await db.sourceCodeEmbedding.deleteMany({
            where: { projectId, fileName: { contains: filePath } },
        })
        console.log(`🗑️  Removed embedding for ${filePath}`)
    }

    // Upsert changed files
    const filesToEmbed = [...toUpsert.entries()].filter(([, content]) => content.trim().length >= 50)
    if (filesToEmbed.length === 0) return

    console.log(`🔄 Re-indexing ${filesToEmbed.length} changed file(s)`)

    await runInBatches(filesToEmbed, async ([filePath, content]) => {
        // Remove old chunks for this file before writing fresh ones
        await db.sourceCodeEmbedding.deleteMany({
            where: { projectId, fileName: { contains: filePath } },
        })

        const doc    = new Document({ pageContent: content, metadata: { source: filePath } })
        const chunks = chunkDocument(doc)

        for (const chunk of chunks) {
            const chunkId   = (chunk.metadata.chunkId ?? filePath) as string
            const summary   = await summariseCode(chunk)
            const embedText = `${chunkId}\n${summary}`
            const embedding = await generateEmbedding(embedText)

            const row = await db.sourceCodeEmbedding.create({
                data: { summary, sourceCode: chunk.pageContent, fileName: chunkId, projectId },
            })
            await db.$executeRaw`
                UPDATE "sourceCodeEmbedding"
                SET    "summaryEmbedding" = ${embedding}::vector
                WHERE  "id" = ${row.id}
            `
        }
        console.log(`✅ Re-indexed ${filePath} (${chunks.length} chunk${chunks.length !== 1 ? 's' : ''})`)
    }, /* batchSize */ 3, /* delayMs */ 1000)
}




