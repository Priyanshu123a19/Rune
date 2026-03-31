// ============================================================
//  Onboarding Path Generator Agent — LangGraph Sequential Graph
//
//  A new team member fills in their background → the agent:
//    1. analyzeCodebase   — reads all indexed summaries, identifies
//                          entry points, key files, complexity hotspots
//    2. generatePath      — builds a personalised ordered learning path
//    3. createMilestones  — breaks the path into week 1 / 2 / 3 goals
//    4. savePlan          — persists the result to DB
// ============================================================

import { StateGraph, Annotation, END, START } from '@langchain/langgraph'
import Groq from 'groq-sdk'
import { db } from '@/server/db'
import { notifyProject } from '@/lib/notifications'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningStep = {
  order:   number
  file:    string
  concept: string
  reason:  string
}

export type Milestones = {
  week1: string[]
  week2: string[]
  week3: string[]
}

// ─── State ────────────────────────────────────────────────────────────────────

const OnboardingState = Annotation.Root({
  // Inputs
  planId:     Annotation<string>(),
  projectId:  Annotation<string>(),
  userId:     Annotation<string>(),
  role:       Annotation<string>(),
  experience: Annotation<string>(),
  background: Annotation<string>(),

  // Intermediate
  codebaseAnalysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  fileList:         Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  // Output
  learningPath: Annotation<LearningStep[]>({ reducer: (_, b) => b, default: () => [] }),
  milestones:   Annotation<Milestones>({
    reducer:  (_, b) => b,
    default:  () => ({ week1: [], week2: [], week3: [] }),
  }),
  summary: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  error:   Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
})

type OnboardingStateType = typeof OnboardingState.State

// ─── Groq JSON helper ─────────────────────────────────────────────────────────

async function callGroqJSON<T>(prompt: string, fallback: T): Promise<T> {
  await new Promise(r => setTimeout(r, 1500))
  try {
    const res = await groq.chat.completions.create({
      model:       GROQ_MODEL,
      max_tokens:  2000,
      temperature: 0.3,
      messages: [
        {
          role:    'system',
          content: 'You are a helpful engineering assistant. Always respond with valid JSON only — no markdown, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
    })
    const text = res.choices[0]?.message?.content ?? ''
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!match) return fallback
    return JSON.parse(match[0]) as T
  } catch (err) {
    console.error('Groq call failed:', err)
    return fallback
  }
}

// ─── Node 1: Analyze Codebase ─────────────────────────────────────────────────

async function analyzeCodebaseNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  console.log('🔍 Onboarding: analyzing codebase...')

  const files = await db.sourceCodeEmbedding.findMany({
    where:  { projectId: state.projectId },
    select: { fileName: true, summary: true },
  })

  if (files.length === 0) {
    return { error: 'No indexed files found for this project.' }
  }

  const fileList = files.map(f => `• ${f.fileName}: ${f.summary.slice(0, 120)}`).join('\n')

  const analysis = await callGroqJSON<{
    entryPoints:         string[]
    keyFiles:            string[]
    complexityHotspots:  string[]
    techStack:           string[]
    overallSummary:      string
  }>(
    `You are analyzing a software project for a new team member onboarding.

Here are all the indexed source files and their summaries:
${fileList}

Respond with a JSON object:
{
  "entryPoints": ["list of main entry point files"],
  "keyFiles": ["list of 5-8 most important files to understand the project"],
  "complexityHotspots": ["list of 3-5 files that are complex or critical"],
  "techStack": ["list of technologies/frameworks detected"],
  "overallSummary": "2-3 sentence summary of what this codebase does"
}`,
    { entryPoints: [], keyFiles: [], complexityHotspots: [], techStack: [], overallSummary: '' }
  )

  const codebaseAnalysis = `
Tech Stack: ${analysis.techStack.join(', ')}
Summary: ${analysis.overallSummary}
Entry Points: ${analysis.entryPoints.join(', ')}
Key Files: ${analysis.keyFiles.join(', ')}
Complexity Hotspots: ${analysis.complexityHotspots.join(', ')}
`.trim()

  console.log('✅ Codebase analysis done')
  return { codebaseAnalysis, fileList }
}

// ─── Node 2: Generate Learning Path ──────────────────────────────────────────

async function generatePathNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  if (state.error) return {}
  console.log('📚 Onboarding: generating learning path...')

  const learningPath = await callGroqJSON<LearningStep[]>(
    `You are creating a personalised onboarding learning path for a new developer.

Developer Profile:
- Role: ${state.role}
- Experience Level: ${state.experience}
- Background: ${state.background}

Codebase Analysis:
${state.codebaseAnalysis}

Create an ordered list of 8-12 files/concepts the developer should explore, starting from the simplest entry points and progressing to complex areas. Tailor it to their role and experience.

Respond with a JSON array:
[
  {
    "order": 1,
    "file": "filename or concept name",
    "concept": "what they will learn from this",
    "reason": "why this is important for their specific role and level"
  },
  ...
]`,
    []
  )

  console.log(`✅ Learning path generated: ${learningPath.length} steps`)
  return { learningPath }
}

// ─── Node 3: Create Milestones ────────────────────────────────────────────────

async function createMilestonesNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  if (state.error) return {}
  console.log('🗓️ Onboarding: creating milestones...')

  const pathSummary = state.learningPath
    .map(s => `${s.order}. ${s.file} — ${s.concept}`)
    .join('\n')

  const result = await callGroqJSON<{ milestones: Milestones; summary: string }>(
    `You are creating a 3-week onboarding milestone plan for a new ${state.experience} ${state.role} developer.

Their learning path:
${pathSummary}

Create realistic weekly goals and an overall summary.

Respond with a JSON object:
{
  "milestones": {
    "week1": ["goal 1", "goal 2", "goal 3"],
    "week2": ["goal 1", "goal 2", "goal 3"],
    "week3": ["goal 1", "goal 2", "goal 3"]
  },
  "summary": "2-3 sentence personalised onboarding summary for this developer"
}`,
    { milestones: { week1: [], week2: [], week3: [] }, summary: '' }
  )

  console.log('✅ Milestones created')
  return {
    milestones: result.milestones,
    summary:    result.summary,
  }
}

// ─── Node 4: Save Plan ────────────────────────────────────────────────────────

async function savePlanNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  try {
    const isFailed = !!state.error
    await db.onboardingPlan.update({
      where: { id: state.planId },
      data: {
        codebaseAnalysis: state.error || state.codebaseAnalysis,
        learningPath:     state.learningPath as object[],
        milestones:       state.milestones as object,
        summary:          state.summary,
        status:           isFailed ? 'FAILED' : 'COMPLETED',
      },
    })
    if (!isFailed) {
      void notifyProject({
        projectId: state.projectId,
        type:  'ONBOARDING',
        title: 'Onboarding path ready',
        body:  state.summary.slice(0, 120),
        url:   '/onboarding',
      })
    }
    console.log(`✅ Onboarding plan saved: ${state.planId}`)
  } catch (err) {
    console.error('Failed to save onboarding plan:', err)
  }
  return {}
}

// ─── Build Graph ──────────────────────────────────────────────────────────────

const workflow = new StateGraph(OnboardingState)
  .addNode('analyzeCodebase',   analyzeCodebaseNode)
  .addNode('generatePath',      generatePathNode)
  .addNode('createMilestones',  createMilestonesNode)
  .addNode('savePlan',          savePlanNode)
  .addEdge(START,              'analyzeCodebase')
  .addEdge('analyzeCodebase',  'generatePath')
  .addEdge('generatePath',     'createMilestones')
  .addEdge('createMilestones', 'savePlan')
  .addEdge('savePlan',          END)

const onboardingApp = workflow.compile()

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runOnboardingAgent(params: {
  planId:     string
  projectId:  string
  userId:     string
  role:       string
  experience: string
  background: string
}): Promise<void> {
  console.log(`\n🚀 Onboarding agent started for user ${params.userId}`)
  await onboardingApp.invoke(params)
  console.log(`🏁 Onboarding agent complete: ${params.planId}\n`)
}
