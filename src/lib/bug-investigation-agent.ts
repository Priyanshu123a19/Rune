// ============================================================
//  Bug Investigation Agent — LangGraph ReAct Loop
//
//  Loop: agent reasons → picks tool → observes result → repeats
//  until it finds the root cause or hits max iterations (6).
//
//  Tools:
//    search_embeddings  — pgvector similarity search
//    read_file          — read indexed source from DB (or GitHub)
//    get_commit_history — recent commits touching a file
//    grep_codebase      — exact text search across all indexed files
// ============================================================

import { StateGraph, Annotation, END, START } from '@langchain/langgraph'
import Groq from 'groq-sdk'
import { db } from '@/server/db'
import { generateEmbedding } from '@/lib/gemini'
import { octokit } from '@/lib/github'
import { notifyProject } from '@/lib/notifications'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const MAX_ITERATIONS = 10
const FORCE_CONCLUDE_AFTER = 7  // inject "conclude now" instruction after this many iterations

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReActStep = {
  thought:     string
  action?:     string   // tool name
  actionInput?: string  // tool input
  observation?: string  // tool output
  isFinal:     boolean
}

// ─── State ────────────────────────────────────────────────────────────────────

const BugState = Annotation.Root({
  // Inputs
  investigationId: Annotation<string>(),
  projectId:       Annotation<string>(),
  githubUrl:       Annotation<string>(),
  bugDescription:  Annotation<string>(),
  fileName:        Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  // Accumulates each Thought→Action→Observation cycle
  steps: Annotation<ReActStep[]>({
    reducer:  (a, b) => [...a, ...b],
    default:  () => [],
  }),

  // Full ReAct trace as text (fed back to LLM each round)
  trace: Annotation<string>({
    reducer:  (_, b) => b,
    default:  () => '',
  }),

  // Set when agent writes "Final Answer:"
  rootCause:    Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  fixLocation:  Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  suggestedFix: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  iterations: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  done:       Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
})

type BugStateType = typeof BugState.State

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function toolSearchEmbeddings(query: string, projectId: string): Promise<string> {
  try {
    const embedding = await generateEmbedding(query)
    const vectorQuery = `[${embedding.join(',')}]`
    const results = await db.$queryRaw`
      SELECT "fileName", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
      FROM "sourceCodeEmbedding"
      WHERE "projectId" = ${projectId}
        AND 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.35
      ORDER BY similarity DESC
      LIMIT 6
    ` as { fileName: string; summary: string; similarity: number }[]

    if (results.length === 0) {
      // Fall back to listing all indexed files so the agent can read_file directly
      const allFiles = await db.sourceCodeEmbedding.findMany({
        where:  { projectId },
        select: { fileName: true },
      })
      if (allFiles.length === 0) return 'No files are indexed for this project.'
      const list = allFiles.map(f => `• ${f.fileName}`).join('\n')
      return `No files matched the query with sufficient similarity.\n\nAll indexed files (use read_file to read any of them):\n${list}`
    }
    return results
      .map(r => `• ${r.fileName} (score: ${(r.similarity * 100).toFixed(0)}%)\n  ${r.summary}`)
      .join('\n\n')
  } catch (err) {
    return `search_embeddings error: ${err instanceof Error ? err.message : 'unknown'}`
  }
}

async function toolReadFile(filename: string, projectId: string, githubUrl: string): Promise<string> {
  // Try DB first (already indexed)
  const indexed = await db.sourceCodeEmbedding.findFirst({
    where: { projectId, fileName: { contains: filename } },
    select: { sourceCode: true, fileName: true },
  })
  if (indexed) {
    return `// ${indexed.fileName}\n${indexed.sourceCode.slice(0, 6000)}`
  }

  // Fall back to GitHub API
  try {
    const parts = githubUrl.replace('https://github.com/', '').split('/')
    const owner = parts[0]!
    const repo  = parts[1]!
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filename })
    if ('content' in data && typeof data.content === 'string') {
      return Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 6000)
    }
  } catch {
    // ignore
  }
  return `File "${filename}" not found in indexed files or GitHub.`
}

async function toolGetCommitHistory(file: string, projectId: string): Promise<string> {
  const commits = await db.commit.findMany({
    where:   { projectId },
    orderBy: { commitDate: 'desc' },
    take:    20,
  })
  const relevant = commits.filter(c =>
    c.summary.toLowerCase().includes(file.toLowerCase()) ||
    c.commitMessage.toLowerCase().includes(file.toLowerCase())
  )
  if (relevant.length === 0) {
    return `No recent commits found that mention "${file}". Showing latest 5 commits:\n` +
      commits.slice(0, 5)
        .map(c => `• ${c.commitHash.slice(0, 7)} — ${c.commitAuthorName} — ${c.commitMessage}`)
        .join('\n')
  }
  return relevant
    .map(c =>
      `• ${c.commitHash.slice(0, 7)} by ${c.commitAuthorName} on ${new Date(c.commitDate).toLocaleDateString()}\n` +
      `  Message: ${c.commitMessage}\n  Summary: ${c.summary}`
    )
    .join('\n\n')
}

async function toolGrepCodebase(pattern: string, projectId: string): Promise<string> {
  // Strip surrounding quotes the LLM sometimes wraps around its input
  const cleanPattern = pattern.replace(/^["']|["']$/g, '').trim()

  const files = await db.sourceCodeEmbedding.findMany({
    where:  { projectId },
    select: { fileName: true, sourceCode: true },
  })

  if (files.length === 0) {
    return 'No files are indexed for this project. The codebase may not have been indexed yet.'
  }

  // Build regex WITHOUT the `g` flag to avoid lastIndex state bugs
  let safePattern: string
  try {
    new RegExp(cleanPattern, 'i') // validate
    safePattern = cleanPattern
  } catch {
    safePattern = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const matches: string[] = []

  for (const file of files) {
    const lines = file.sourceCode.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      // Create a fresh regex per test to avoid any lastIndex bleed
      if (new RegExp(safePattern, 'i').test(line)) {
        matches.push(`${file.fileName}:${i + 1}:  ${line.trim()}`)
      }
      if (matches.length >= 30) break
    }
    if (matches.length >= 30) break
  }

  if (matches.length > 0) return matches.join('\n')

  // Nothing found — tell the agent which files ARE indexed so it can read them directly
  const fileList = files.map(f => `• ${f.fileName}`).join('\n')
  return `No matches found for "${cleanPattern}" across ${files.length} indexed file(s).\n\nIndexed files available to read_file:\n${fileList}`
}

// ─── Tool Dispatcher ──────────────────────────────────────────────────────────

async function executeTool(
  action: string,
  input: string,
  projectId: string,
  githubUrl: string,
): Promise<string> {
  const tool = action.trim().toLowerCase()
  if (tool === 'search_embeddings') return toolSearchEmbeddings(input, projectId)
  if (tool === 'read_file')         return toolReadFile(input, projectId, githubUrl)
  if (tool === 'get_commit_history') return toolGetCommitHistory(input, projectId)
  if (tool === 'grep_codebase')     return toolGrepCodebase(input, projectId)
  return `Unknown tool "${action}". Available: search_embeddings, read_file, get_commit_history, grep_codebase`
}

// ─── ReAct Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a bug investigation agent. Your job is to trace through a codebase and find the exact root cause of a reported bug.

You have access to 4 tools:

1. search_embeddings
   Use: Semantic search — find files related to a concept
   Input: natural language query (e.g., "user authentication middleware")

2. read_file
   Use: Read full source code of a specific file
   Input: exact filename (e.g., "src/lib/auth.ts")

3. get_commit_history
   Use: See recent commits that modified a file
   Input: filename (e.g., "src/middleware.ts")

4. grep_codebase
   Use: Search for exact text/pattern across all files
   Input: text or regex (e.g., "validateToken" or "throw new Error")

To use a tool, respond EXACTLY in this format (no extra text before it):
Thought: [your reasoning about what to look at next]
Action: [tool_name]
Action Input: [tool input]

When you have found the root cause, respond EXACTLY in this format:
Thought: [your final reasoning]
Final Answer:
ROOT CAUSE: [2-3 sentences explaining the exact root cause of the bug]
FIX LOCATION: [specific file + function/line where fix should be made]
SUGGESTED FIX: [concrete code change or approach to fix it]

Rules:
- Always start by searching for relevant code, then read specific files
- Use grep_codebase when you know an exact function/variable name to find
- Be specific — name exact files and functions in your Final Answer
- If the codebase doesn't have enough info, say so clearly in Final Answer`
}

function buildUserPrompt(bugDescription: string, trace: string, fileName: string, iterations: number): string {
  const fileHint = fileName
    ? `\nThe user suspects the bug is in or related to this file: ${fileName}\nStart by calling read_file with this filename, then trace outward from there.\n`
    : ''

  const forceConclude = iterations >= FORCE_CONCLUDE_AFTER
    ? `\n\n⚠️ You have used ${iterations} iterations. You MUST write your Final Answer NOW — do not call any more tools. Summarize what you found (or explain why the bug could not be located in the indexed codebase) using the Final Answer format.`
    : ''

  return `Bug to investigate: ${bugDescription}${fileHint}${forceConclude}

${trace ? `Previous investigation steps:\n${trace}\n\nContinue the investigation:` : 'Begin your investigation:'}`
}

// ─── Parse LLM Output ────────────────────────────────────────────────────────

function parseLLMOutput(text: string): {
  thought: string
  action?: string
  actionInput?: string
  isFinal: boolean
  rootCause?: string
  fixLocation?: string
  suggestedFix?: string
} {
  const thoughtMatch   = text.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i)
  const actionMatch    = text.match(/Action:\s*([^\n]+)/i)
  const inputMatch     = text.match(/Action Input:\s*([\s\S]*?)(?=Thought:|Final Answer:|$)/i)
  const finalMatch     = text.match(/Final Answer:\s*([\s\S]*)/i)

  const thought = thoughtMatch?.[1]?.trim() ?? text.trim()

  if (finalMatch) {
    const body         = finalMatch[1] ?? ''
    const rootMatch    = body.match(/ROOT CAUSE:\s*([\s\S]*?)(?=FIX LOCATION:|SUGGESTED FIX:|$)/i)
    const fixLocMatch  = body.match(/FIX LOCATION:\s*([\s\S]*?)(?=SUGGESTED FIX:|ROOT CAUSE:|$)/i)
    const fixMatch     = body.match(/SUGGESTED FIX:\s*([\s\S]*)/i)
    return {
      thought,
      isFinal:      true,
      rootCause:    rootMatch?.[1]?.trim()   ?? body.slice(0, 300),
      fixLocation:  fixLocMatch?.[1]?.trim() ?? '',
      suggestedFix: fixMatch?.[1]?.trim()    ?? '',
    }
  }

  return {
    thought,
    isFinal:     false,
    action:      actionMatch?.[1]?.trim(),
    actionInput: inputMatch?.[1]?.trim(),
  }
}

// ─── Graph Nodes ──────────────────────────────────────────────────────────────

async function agentNode(state: BugStateType): Promise<Partial<BugStateType>> {
  const iterations = state.iterations + 1
  if (iterations > MAX_ITERATIONS) {
    return {
      done:       true,
      iterations,
      rootCause:  'Max investigation iterations reached. Could not conclusively determine root cause.',
      fixLocation: 'Unable to determine — please investigate manually.',
      suggestedFix: '',
      steps: [{
        thought:  'Reached maximum iterations without a conclusive answer.',
        isFinal:  true,
      }],
    }
  }

  try {
    await new Promise(r => setTimeout(r, 1500)) // rate limit buffer

    const response = await groq.chat.completions.create({
      model:      GROQ_MODEL,
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: buildUserPrompt(state.bugDescription, state.trace, state.fileName, iterations) },
      ],
    })

    const text   = response.choices[0]?.message?.content ?? ''
    const parsed = parseLLMOutput(text)

    console.log(`🔍 Bug agent iteration ${iterations}: thought="${parsed.thought.slice(0, 80)}..."`)

    if (parsed.isFinal) {
      return {
        done:        true,
        iterations,
        rootCause:   parsed.rootCause   ?? '',
        fixLocation: parsed.fixLocation ?? '',
        suggestedFix: parsed.suggestedFix ?? '',
        steps: [{
          thought:  parsed.thought,
          isFinal:  true,
        }],
        trace: state.trace + `\nThought: ${parsed.thought}\nFinal Answer reached.`,
      }
    }

    return {
      iterations,
      done: false,
      steps: [{
        thought:     parsed.thought,
        action:      parsed.action,
        actionInput: parsed.actionInput,
        isFinal:     false,
      }],
      trace: state.trace +
        `\nThought: ${parsed.thought}\nAction: ${parsed.action}\nAction Input: ${parsed.actionInput}`,
    }
  } catch (err) {
    console.error('Bug agent LLM error:', err)
    return {
      done: true,
      iterations,
      rootCause: `Agent error: ${err instanceof Error ? err.message : 'unknown'}`,
      fixLocation: '',
      suggestedFix: '',
    }
  }
}

async function toolsNode(state: BugStateType): Promise<Partial<BugStateType>> {
  const lastStep = state.steps.at(-1)
  if (!lastStep?.action || !lastStep.actionInput) {
    return {
      trace: state.trace + '\nObservation: (no tool called)',
    }
  }

  console.log(`🔧 Executing tool: ${lastStep.action}("${lastStep.actionInput.slice(0, 60)}")`)

  const observation = await executeTool(
    lastStep.action,
    lastStep.actionInput,
    state.projectId,
    state.githubUrl,
  )

  // Annotate the last step with the observation
  const updatedSteps = [...state.steps]
  const last = updatedSteps.at(-1)
  if (last) last.observation = observation.slice(0, 1200)

  console.log(`👁 Observation: ${observation.slice(0, 100)}...`)

  return {
    steps: [], // already mutated above (reducer appends — send empty to avoid dup)
    trace: state.trace + `\nObservation: ${observation.slice(0, 800)}\n`,
  }
}

async function saveResultNode(state: BugStateType): Promise<Partial<BugStateType>> {
  try {
    await db.bugInvestigation.update({
      where: { id: state.investigationId },
      data: {
        steps:        state.steps as object[],
        rootCause:    state.rootCause,
        fixLocation:  state.fixLocation,
        suggestedFix: state.suggestedFix,
        status:       state.rootCause.startsWith('Agent error') ? 'FAILED' : 'COMPLETED',
      },
    })
    if (!state.rootCause.startsWith('Agent error')) {
      void notifyProject({
        projectId: state.projectId,
        type:  'BUG_INVESTIGATION',
        title: 'Bug investigation complete',
        body:  state.rootCause.slice(0, 120),
        url:   '/bug-investigation',
      })
    }
    console.log(`✅ Bug investigation saved: ${state.investigationId}`)
  } catch (err) {
    console.error('Failed to save bug investigation:', err)
  }
  return {}
}

// ─── Routing ─────────────────────────────────────────────────────────────────

function shouldContinue(state: BugStateType): 'tools' | 'save' {
  return state.done ? 'save' : 'tools'
}

// ─── Build Graph ──────────────────────────────────────────────────────────────

const workflow = new StateGraph(BugState)
  .addNode('agent', agentNode)
  .addNode('tools', toolsNode)
  .addNode('save',  saveResultNode)
  .addEdge(START,   'agent')
  .addConditionalEdges('agent', shouldContinue, { tools: 'tools', save: 'save' })
  .addEdge('tools', 'agent')   // loop back after tool execution
  .addEdge('save',   END)

const bugInvestigationApp = workflow.compile()

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runBugInvestigationAgent(params: {
  investigationId: string
  projectId:       string
  githubUrl:       string
  bugDescription:  string
  fileName?:       string
}): Promise<void> {
  console.log(`\n🐛 Bug investigation started: "${params.bugDescription.slice(0, 60)}"`)
  await bugInvestigationApp.invoke({
    investigationId: params.investigationId,
    projectId:       params.projectId,
    githubUrl:       params.githubUrl,
    bugDescription:  params.bugDescription,
    fileName:        params.fileName ?? '',
  })
  console.log(`🏁 Bug investigation complete: ${params.investigationId}\n`)
}
