import { db } from '@/server/db'
import Groq from 'groq-sdk'
import { Octokit } from 'octokit'
import { notifyProject } from './notifications'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── Framework Detection ──────────────────────────────────────────────────────

type Framework = 'react-component' | 'nextjs-api' | 'trpc-router' | 'typescript-util'

function detectFramework(code: string, fileName: string): Framework {
  if (
    fileName.endsWith('route.ts') ||
    fileName.endsWith('route.tsx') ||
    (fileName.includes('/api/') && !fileName.includes('router'))
  ) return 'nextjs-api'

  if (
    code.includes('createTRPCRouter') ||
    code.includes('protectedProcedure') ||
    code.includes('publicProcedure')
  ) return 'trpc-router'

  if (
    code.includes("'use client'") ||
    code.includes('"use client"') ||
    (fileName.endsWith('.tsx') && (code.includes('return (') || code.includes('JSX')))
  ) return 'react-component'

  return 'typescript-util'
}

const FRAMEWORK_HINTS: Record<Framework, string> = {
  'react-component': `
- Use @testing-library/react (render, screen, fireEvent, waitFor)
- Use @testing-library/user-event for interactions
- Mock Next.js with: jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/test' }))
- Mock Clerk with: jest.mock('@clerk/nextjs', () => ({ useUser: () => ({ user: { id: 'user_1' } }) }))
- Wrap async interactions in waitFor()`,

  'nextjs-api': `
- Use jest with node-fetch mocks or jest.fn() for Request/Response
- Mock Prisma: jest.mock('@/server/db', () => ({ db: { <model>: { findMany: jest.fn(), create: jest.fn(), ... } } }))
- Mock Clerk auth: jest.mock('@clerk/nextjs/server', () => ({ auth: () => ({ userId: 'user_1' }) }))
- Test: 200 success, 400 bad input, 401 unauthorized, 500 server error`,

  'trpc-router': `
- Use jest with a mock tRPC caller
- Mock Prisma: jest.mock('@/server/db', () => ({ db: { ... } }))
- Create mock ctx: const mockCtx = { db: mockDb, user: { userId: 'user_1' } }
- Use appRouter.createCaller(mockCtx) to test procedures
- Test: happy path, auth checks, not found, invalid input`,

  'typescript-util': `
- Use pure Jest with TypeScript
- Mock external modules (axios, fetch, Prisma) with jest.mock()
- Test: return values, thrown errors, edge cases (null/undefined/empty), boundary values`,
}

// ─── Core Generation ──────────────────────────────────────────────────────────

async function generateTests(
  fileName: string,
  fileContent: string,
  framework: Framework,
): Promise<string> {
  // Truncate very large files — keep first 10k chars (enough context for a single file)
  const truncated = fileContent.length > 10_000
    ? fileContent.slice(0, 10_000) + '\n// ... (truncated for context window)'
    : fileContent

  const testFileName = fileName
    .replace(/\.(ts|tsx)$/, '.test.$1')
    .replace(/^src\//, '')

  const prompt = `You are an expert TypeScript/Jest test engineer. Generate a complete, production-ready test file for the code below.

## File being tested
Path: ${fileName}
Test file should be: ${testFileName}
Detected type: ${framework}

## Testing guidance for this file type
${FRAMEWORK_HINTS[framework]}

## Rules
- Output ONLY valid TypeScript test code — no markdown, no explanations, no code fences
- Start the file with the correct imports
- Use describe() blocks to group related tests
- Write clear, specific test names (it('should return 401 when user is not authenticated'))
- Cover: happy path, error cases, edge cases, boundary conditions
- Every external dependency must be mocked at the top
- Include at minimum 6-10 meaningful test cases

## Source code to test
${truncated}

Output the complete test file now (TypeScript only, no markdown):`.trim()

  const resp = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.15,
    max_tokens:  4096,
  })

  const raw = resp.choices[0]?.message?.content ?? ''

  // Strip any accidental markdown fences the model adds
  return raw
    .replace(/^```(?:typescript|javascript|ts|js|tsx)?\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim()
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── GitHub fallback ──────────────────────────────────────────────────────────
// Fetch file content directly from the repo when it isn't in sourceCodeEmbedding
// (e.g. file added after last index run)

async function fetchFromGitHub(
  githubUrl: string,
  filePath:  string,
): Promise<{ content: string; resolvedPath: string } | null> {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const owner   = githubUrl.split('/')[3]
    const repo    = githubUrl.split('/')[4]
    if (!owner || !repo) return null

    // Try the exact path first, then a recursive search for the filename
    const candidates = [filePath]
    const bare = filePath.split('/').pop()!
    if (bare !== filePath) candidates.push(bare)

    for (const candidate of candidates) {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path: candidate })
        if (!Array.isArray(data) && data.type === 'file' && data.content) {
          return {
            content:      Buffer.from(data.content, 'base64').toString('utf-8'),
            resolvedPath: data.path,
          }
        }
      } catch {
        // try next candidate
      }
    }

    // Last resort: search the tree for a file with that name
    const { data: tree } = await octokit.rest.git.getTree({ owner, repo, tree_sha: 'HEAD', recursive: '1' })
    const match = tree.tree.find(f =>
      f.path?.toLowerCase().endsWith(filePath.toLowerCase()) ||
      f.path?.toLowerCase().endsWith(`/${bare.toLowerCase()}`)
    )
    if (match?.path) {
      const { data: fileData } = await octokit.rest.repos.getContent({ owner, repo, path: match.path })
      if (!Array.isArray(fileData) && fileData.type === 'file' && fileData.content) {
        return {
          content:      Buffer.from(fileData.content, 'base64').toString('utf-8'),
          resolvedPath: fileData.path,
        }
      }
    }
  } catch { /* swallow */ }
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runTestCoverageAgent({
  suiteId,
  projectId,
  fileName,
}: {
  suiteId:   string
  projectId: string
  fileName:  string
}) {
  try {
    // 1️⃣  Try indexed DB first (fast path)
    const embedding = await db.sourceCodeEmbedding.findFirst({
      where:  { projectId, fileName: { contains: fileName, mode: 'insensitive' } },
      select: { sourceCode: true, fileName: true },
    })

    let sourceCode   = embedding?.sourceCode   ?? ''
    let resolvedName = embedding?.fileName     ?? fileName

    // 2️⃣  Fallback: fetch directly from GitHub (handles un-indexed / new files)
    if (!sourceCode) {
      const project = await db.project.findUnique({
        where:  { id: projectId },
        select: { githubUrl: true },
      })

      if (project?.githubUrl) {
        const gh = await fetchFromGitHub(project.githubUrl, fileName)
        if (gh) {
          sourceCode   = gh.content
          resolvedName = gh.resolvedPath
        }
      }
    }

    if (!sourceCode) {
      await db.testSuite.update({
        where: { id: suiteId },
        data:  {
          status:  'FAILED',
          summary: `"${fileName}" was not found in the indexed codebase or the GitHub repository. Check the file path and try again.`,
        },
      })
      return
    }

    const framework = detectFramework(sourceCode, resolvedName)

    const testCode = await generateTests(resolvedName, sourceCode, framework)

    const testCount  = (testCode.match(/\bit\s*\(|test\s*\(/g) ?? []).length
    const lineCount  = testCode.split('\n').length
    const frameworkLabel: Record<Framework, string> = {
      'react-component': 'React Component (Testing Library)',
      'nextjs-api':      'Next.js API Route',
      'trpc-router':     'tRPC Router',
      'typescript-util': 'TypeScript Utility',
    }

    await db.testSuite.update({
      where: { id: suiteId },
      data:  {
        testCode,
        framework: frameworkLabel[framework],
        summary:   `Generated ${testCount} test case${testCount !== 1 ? 's' : ''} (${lineCount} lines) for ${frameworkLabel[framework]}.`,
        status:    'COMPLETED',
      },
    })
    void notifyProject({
      projectId,
      type:  'TEST_SUITE',
      title: `Tests generated for ${fileName}`,
      body:  `Ready-to-paste test suite generated successfully.`,
      url:   '/test-coverage',
    })
  } catch (err) {
    await db.testSuite.update({
      where: { id: suiteId },
      data:  { status: 'FAILED', summary: `Generation failed: ${String(err)}` },
    })
  }
}
