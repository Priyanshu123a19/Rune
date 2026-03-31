import { db } from '@/server/db'
import Groq from 'groq-sdk'
import { Octokit } from 'octokit'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { notifyProject } from './notifications'

const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL  = 'llama-3.3-70b-versatile'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SprintItem = {
  title:       string
  type:        'feature' | 'bug' | 'refactor' | 'infra' | 'chore'
  effort:      'S' | 'M' | 'L' | 'XL'   // S≈0.5d  M≈1d  L≈2-3d  XL≈5d+
  priority:    1 | 2 | 3                  // 1=high 2=medium 3=low
  area:        string
  rationale:   string
  issueNumber?: number
  issueUrl?:   string
}

export type FeatureCluster = {
  area:        string
  theme:       string
  issueCount:  number
  commitCount: number
}

export type WeekPlan = {
  week1: string[]
  week2: string[]
}

type GithubIssue = {
  number: number
  title:  string
  body:   string | null
  labels: string[]
  url:    string
}

// ─── State ────────────────────────────────────────────────────────────────────

const SprintState = Annotation.Root({
  planId:     Annotation<string>(),
  projectId:  Annotation<string>(),
  githubUrl:  Annotation<string>(),

  issues:         Annotation<GithubIssue[]>({ reducer: (_, b) => b, default: () => [] }),
  commitMessages: Annotation<string[]>({     reducer: (_, b) => b, default: () => [] }),

  featureClusters: Annotation<FeatureCluster[]>({ reducer: (_, b) => b, default: () => [] }),
  sprintItems:     Annotation<SprintItem[]>({     reducer: (_, b) => b, default: () => [] }),
  weekPlan:        Annotation<WeekPlan>({         reducer: (_, b) => b, default: () => ({ week1: [], week2: [] }) }),
  summary:         Annotation<string>({           reducer: (_, b) => b, default: () => '' }),

  error: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
})

type SprintStateType = typeof SprintState.State

// ─── LLM helper ───────────────────────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens = 1500): Promise<string> {
  await new Promise(r => setTimeout(r, 1200))
  const resp = await groq.chat.completions.create({
    model:       MODEL,
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens:  maxTokens,
  })
  return resp.choices[0]?.message?.content ?? ''
}

function extractJSON<T>(text: string, fallback: T): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]
  const raw   = fence ?? text
  const match = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (!match) return fallback
  try { return JSON.parse(match[0]) as T } catch { return fallback }
}

// ─── Node 1: Fetch GitHub issues ──────────────────────────────────────────────

async function fetchIssuesNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const owner   = state.githubUrl.split('/')[3]
    const repo    = state.githubUrl.split('/')[4]
    if (!owner || !repo) return { error: 'Invalid GitHub URL' }

    const { data } = await octokit.rest.issues.listForRepo({
      owner, repo, state: 'open', per_page: 30, sort: 'created', direction: 'desc',
    })

    const issues: GithubIssue[] = data
      .filter(i => !i.pull_request) // exclude PRs
      .map(i => ({
        number: i.number,
        title:  i.title,
        body:   i.body ? i.body.slice(0, 300) : null,
        labels: i.labels.map((l: any) => (typeof l === 'string' ? l : l.name ?? '')),
        url:    i.html_url,
      }))

    console.log(`📋 Fetched ${issues.length} open issues`)
    return { issues }
  } catch (err) {
    // If issues are disabled or repo is private, continue with empty
    console.warn('⚠️  Could not fetch issues:', err)
    return { issues: [] }
  }
}

// ─── Node 2: Fetch commit patterns ────────────────────────────────────────────

async function fetchCommitPatternsNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  const commits = await db.commit.findMany({
    where:   { projectId: state.projectId },
    orderBy: { commitDate: 'desc' },
    take:    25,
    select:  { commitMessage: true, summary: true },
  })

  const commitMessages = commits.map(c =>
    c.summary ? `${c.commitMessage} — ${c.summary}` : c.commitMessage
  )

  console.log(`📦 Fetched ${commitMessages.length} recent commits`)
  return { commitMessages }
}

// ─── Node 3: Cluster by feature area ─────────────────────────────────────────

async function clusterNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  if (state.error) return {}

  const issueList    = state.issues.map(i => `#${i.number}: ${i.title}`).join('\n') || 'No open issues.'
  const commitSample = state.commitMessages.slice(0, 20).join('\n')                 || 'No recent commits.'

  const prompt = `You are a tech lead planning a sprint. Analyse the open issues and recent commit history to identify 3–6 distinct feature areas being worked on.

OPEN ISSUES (${state.issues.length}):
${issueList}

RECENT COMMIT MESSAGES (${state.commitMessages.length}):
${commitSample}

Output a JSON array of feature clusters. Each cluster:
{
  "area": "short name (2-4 words)",
  "theme": "one sentence describing what this area covers",
  "issueCount": <number of issues that belong here>,
  "commitCount": <number of commits related to this area>
}

Output ONLY valid JSON array, no other text.`

  const raw      = await callGroq(prompt, 800)
  const clusters = extractJSON<FeatureCluster[]>(raw, [])

  console.log(`🗂️  Identified ${clusters.length} feature clusters`)
  return { featureClusters: clusters }
}

// ─── Node 4: Build sprint items ────────────────────────────────────────────────

async function buildItemsNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  if (state.error) return {}

  const issueList    = state.issues.map(i =>
    `#${i.number} [${i.labels.join(',')||'unlabelled'}]: ${i.title}${i.body ? ` — ${i.body.slice(0, 150)}` : ''}`
  ).join('\n') || 'No open issues.'

  const clusterList  = state.featureClusters.map(c => `• ${c.area}: ${c.theme}`).join('\n')
  const commitSample = state.commitMessages.slice(0, 15).join('\n') || 'No commits.'

  const prompt = `You are a senior tech lead. Based on the open issues, commit history, and feature clusters below, produce a prioritised sprint backlog.

FEATURE CLUSTERS:
${clusterList}

OPEN ISSUES:
${issueList}

RECENT COMMITS (for context on active areas):
${commitSample}

Produce a JSON array of sprint items. Each item:
{
  "title":       "clear, actionable task title",
  "type":        "feature" | "bug" | "refactor" | "infra" | "chore",
  "effort":      "S" | "M" | "L" | "XL",
  "priority":    1 | 2 | 3,
  "area":        "<cluster area name>",
  "rationale":   "1 sentence why this is prioritised here",
  "issueNumber": <number or null>
}

Effort guide: S=half day, M=1 day, L=2-3 days, XL=5+ days.
Priority: 1=must-do this sprint, 2=should-do, 3=nice-to-have.
Generate 8–14 actionable items. Output ONLY the JSON array.`

  const raw   = await callGroq(prompt, 2000)
  const items = extractJSON<SprintItem[]>(raw, [])

  // Attach issue URLs
  for (const item of items) {
    if (item.issueNumber) {
      const issue = state.issues.find(i => i.number === item.issueNumber)
      if (issue) item.issueUrl = issue.url
    }
  }

  console.log(`✅ Built ${items.length} sprint items`)
  return { sprintItems: items }
}

// ─── Node 5: Week breakdown ────────────────────────────────────────────────────

async function weekBreakdownNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  if (state.error || state.sprintItems.length === 0) return {}

  const EFFORT_DAYS: Record<string, number> = { S: 0.5, M: 1, L: 2.5, XL: 5 }
  const SPRINT_DAYS = 10

  // Sort by priority then effort
  const sorted = [...state.sprintItems].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return (EFFORT_DAYS[a.effort] ?? 1) - (EFFORT_DAYS[b.effort] ?? 1)
  })

  const week1: string[] = []
  const week2: string[] = []
  let   week1Days       = 0

  for (const item of sorted) {
    const days = EFFORT_DAYS[item.effort] ?? 1
    if (week1Days + days <= SPRINT_DAYS / 2) {
      week1.push(item.title)
      week1Days += days
    } else {
      week2.push(item.title)
    }
  }

  const prompt = `Write a 3-sentence sprint summary for a development team.

Sprint contains ${state.sprintItems.length} items across ${state.featureClusters.length} areas.
Week 1 focus: ${week1.slice(0, 3).join(', ')}.
Week 2 focus: ${week2.slice(0, 3).join(', ')}.
Open issues being addressed: ${state.issues.length}.

Write 3 sentences: what the team is building, what the first priority is, and what the expected outcome is.`

  const summary = await callGroq(prompt, 200)

  return { weekPlan: { week1, week2 }, summary }
}

// ─── Node 6: Save ─────────────────────────────────────────────────────────────

async function saveNode(state: SprintStateType): Promise<Partial<SprintStateType>> {
  if (state.error) {
    await db.sprintPlan.update({
      where: { id: state.planId },
      data:  { status: 'FAILED', summary: state.error },
    })
    return {}
  }

  await db.sprintPlan.update({
    where: { id: state.planId },
    data:  {
      issuesAnalyzed:  state.issues.length,
      commitsAnalyzed: state.commitMessages.length,
      featureClusters: state.featureClusters,
      sprintItems:     state.sprintItems,
      weekPlan:        state.weekPlan,
      summary:         state.summary,
      status:          'COMPLETED',
    },
  })

  void notifyProject({
    projectId: state.projectId,
    type:  'SPRINT_PLAN',
    title: 'Sprint plan ready',
    body:  `${state.sprintItems.length} items across ${state.featureClusters.length} feature areas.`,
    url:   '/sprint-planning',
  })
  console.log(`🏁 Sprint plan saved (${state.sprintItems.length} items)`)
  return {}
}

// ─── Graph ────────────────────────────────────────────────────────────────────

const graph = new StateGraph(SprintState)
  .addNode('fetchIssues',    fetchIssuesNode)
  .addNode('fetchCommits',   fetchCommitPatternsNode)
  .addNode('cluster',        clusterNode)
  .addNode('buildItems',     buildItemsNode)
  .addNode('weekBreakdown',  weekBreakdownNode)
  .addNode('save',           saveNode)
  .addEdge(START,           'fetchIssues')
  .addEdge('fetchIssues',   'fetchCommits')
  .addEdge('fetchCommits',  'cluster')
  .addEdge('cluster',       'buildItems')
  .addEdge('buildItems',    'weekBreakdown')
  .addEdge('weekBreakdown', 'save')
  .addEdge('save',           END)

const compiled = graph.compile()

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runSprintPlanningAgent({
  planId,
  projectId,
  githubUrl,
}: {
  planId:    string
  projectId: string
  githubUrl: string
}) {
  try {
    await compiled.invoke({ planId, projectId, githubUrl })
  } catch (err) {
    console.error('Sprint planning agent failed:', err)
    await db.sprintPlan.update({
      where: { id: planId },
      data:  { status: 'FAILED', summary: String(err) },
    }).catch(() => {})
  }
}
