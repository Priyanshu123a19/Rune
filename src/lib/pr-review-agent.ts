import Groq from 'groq-sdk'
import { octokit } from './github'
import { db } from '@/server/db'
import { notifyProject } from './notifications'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export type PrComment = {
    path:     string
    position: number
    body:     string
    type:     'issue' | 'suggestion' | 'nitpick'
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

function parseGithubUrl(githubUrl: string) {
    const parts = githubUrl.replace('https://github.com/', '').split('/')
    return { owner: parts[0]!, repo: parts[1]! }
}

// Returns valid positions (1-indexed) for RIGHT-side inline comments
// Positions on deleted lines (-) are not valid for RIGHT side
function getValidPositions(patch: string): Set<number> {
    const valid = new Set<number>()
    patch.split('\n').forEach((line, idx) => {
        if (!line.startsWith('-')) valid.add(idx + 1)
    })
    return valid
}

async function analyzeFilePatch(filePath: string, patch: string): Promise<PrComment[]> {
    const truncated = patch.slice(0, 2500)
    const numbered  = truncated.split('\n').map((l, i) => `[${i + 1}] ${l}`).join('\n')
    const valid     = getValidPositions(truncated)

    try {
        await sleep(1200)
        const res = await groq.chat.completions.create({
            model:       GROQ_MODEL,
            max_tokens:  800,
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert code reviewer. Analyze git diffs and return ONLY a valid JSON array.
Rules:
- Only flag real bugs, security issues, or meaningful improvements (not style nitpicks)
- Use the [N] position numbers shown in the diff
- Never pick a position that starts with '-' (deleted lines)
- Maximum 3 comments per file, return [] if nothing significant
Format: [{"position": N, "body": "Markdown comment", "type": "issue|suggestion|nitpick", "severity": "LOW|MEDIUM|HIGH|CRITICAL"}]`
                },
                {
                    role: 'user',
                    content: `File: ${filePath}\n\nNumbered diff:\n${numbered}\n\nReturn JSON array of review comments only.`
                }
            ]
        })

        const raw   = res.choices[0]?.message?.content ?? ''
        const match = raw.match(/\[[\s\S]*\]/)
        if (!match) return []

        const parsed = JSON.parse(match[0]) as Array<{
            position: number; body: string; type: string; severity: string
        }>

        return parsed
            .filter(c => valid.has(c.position) && c.body?.trim())
            .map(c => ({
                path:     filePath,
                position: c.position,
                body:     c.body,
                type:     (c.type     as PrComment['type'])     ?? 'suggestion',
                severity: (c.severity as PrComment['severity']) ?? 'LOW',
            }))
            .slice(0, 3)
    } catch (err) {
        console.error(`Error analyzing ${filePath}:`, err)
        return []
    }
}

export async function runPrReviewAgent(params: {
    reviewId:  string
    projectId: string
    githubUrl: string
    prNumber:  number
    prHeadSha: string
}): Promise<void> {
    const { reviewId, githubUrl, prNumber, prHeadSha } = params
    const { owner, repo } = parseGithubUrl(githubUrl)

    try {
        // 1. Fetch changed files
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner, repo, pull_number: prNumber, per_page: 30,
        })

        const reviewable = files
            .filter(f => f.patch && f.status !== 'removed')
            .filter(f => /\.(ts|tsx|js|jsx|py|go|java|rs|rb|cs|cpp|c)$/.test(f.filename))
            .slice(0, 6)

        console.log(`📋 PR #${prNumber}: reviewing ${reviewable.length} files`)

        // 2. Analyse each file
        const allComments: PrComment[] = []
        for (const file of reviewable) {
            if (!file.patch) continue
            console.log(`  🔍 ${file.filename}`)
            const comments = await analyzeFilePatch(file.filename, file.patch)
            allComments.push(...comments)
        }

        // 3. Build summary
        await sleep(1200)
        const summaryRes = await groq.chat.completions.create({
            model:      GROQ_MODEL,
            max_tokens: 300,
            messages: [
                { role: 'system', content: 'Write a concise PR review summary as a senior engineer. Be direct and actionable. Use markdown with relevant emojis.' },
                { role: 'user',   content: `PR changes ${reviewable.length} files. Found ${allComments.length} comment(s):\n${allComments.map(c => `- [${c.severity}] ${c.path}: ${c.body.slice(0, 100)}`).join('\n') || 'No significant issues.'}\n\nWrite a 2-3 sentence review summary.` }
            ]
        })
        const summary = summaryRes.choices[0]?.message?.content
            ?? `Reviewed ${reviewable.length} files with ${allComments.length} comment(s).`

        // 4. Choose event based on severity
        const hasCritical = allComments.some(c => c.severity === 'CRITICAL' || c.severity === 'HIGH')
        const event = hasCritical ? 'REQUEST_CHANGES' as const
                    : allComments.length > 0 ? 'COMMENT' as const
                    : 'APPROVE' as const

        // 5. Post review to GitHub
        let postedToGithub = false
        try {
            await octokit.rest.pulls.createReview({
                owner, repo,
                pull_number: prNumber,
                commit_id:   prHeadSha,
                body:        summary,
                event,
                comments:    allComments.map(c => ({
                    path:     c.path,
                    position: c.position,
                    body:     `**[${c.severity}]** ${c.body}`,
                })),
            })
            postedToGithub = true
            console.log(`✅ Posted review to GitHub PR #${prNumber} (event: ${event})`)
        } catch (err) {
            console.warn('Inline comments failed, retrying without them:', err)
            // Fallback: post body-only review
            try {
                const bodyWithComments = allComments.length > 0
                    ? `${summary}\n\n---\n### Findings\n${allComments.map(c => `**\`${c.path}\`** — **[${c.severity}]** ${c.body}`).join('\n\n')}`
                    : summary
                await octokit.rest.pulls.createReview({
                    owner, repo,
                    pull_number: prNumber,
                    commit_id:   prHeadSha,
                    body:        bodyWithComments,
                    event:       'COMMENT',
                    comments:    [],
                })
                postedToGithub = true
                console.log(`✅ Posted body-only review to GitHub PR #${prNumber}`)
            } catch (err2) {
                console.error('Failed to post review to GitHub:', err2)
            }
        }

        // 6. Persist
        await db.prReview.update({
            where: { id: reviewId },
            data:  { summary, comments: allComments as object[], postedToGithub, status: 'COMPLETED' },
        })

        void notifyProject({
            projectId: params.projectId,
            type:  'PR_REVIEW',
            title: `PR #${prNumber} review complete`,
            body:  summary.slice(0, 120),
            url:   '/pr-review',
        })

    } catch (err) {
        console.error(`PR review agent failed for PR #${prNumber}:`, err)
        await db.prReview.update({
            where: { id: reviewId },
            data:  { status: 'FAILED', summary: err instanceof Error ? err.message : 'Agent error' },
        }).catch(console.error)
    }
}
