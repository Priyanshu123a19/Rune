'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap, Loader2, RefreshCw, ChevronDown, ChevronRight,
  Map, Calendar, FileCode, Sparkles, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LearningStep, Milestones } from '@/lib/onboarding-agent'

// ─── Role / Experience selectors ──────────────────────────────────────────────

const ROLES = [
  { value: 'frontend',  label: 'Frontend'      },
  { value: 'backend',   label: 'Backend'       },
  { value: 'fullstack', label: 'Full Stack'    },
  { value: 'devops',    label: 'DevOps / Infra' },
] as const

const LEVELS = [
  { value: 'junior', label: 'Junior  0–2 yrs' },
  { value: 'mid',    label: 'Mid  2–5 yrs'    },
  { value: 'senior', label: 'Senior  5+ yrs'  },
] as const

type Role       = typeof ROLES[number]['value']
type Experience = typeof LEVELS[number]['value']

// ─── Learning Path ────────────────────────────────────────────────────────────

function LearningPathPanel({ steps }: { steps: LearningStep[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-4 bg-gray-50/80 hover:bg-gray-100 transition-colors text-left border-b border-gray-200"
      >
        {open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
        <Map className="size-4 text-indigo-600" />
        <span className="font-semibold text-sm text-gray-800">Learning Path</span>
        <Badge variant="secondary" className="text-xs ml-auto">{steps.length} steps</Badge>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {steps.map(step => (
            <div key={step.order} className="p-4 flex gap-4 items-start hover:bg-gray-50/50 transition-colors">
              <span className="shrink-0 size-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <FileCode className="size-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-mono text-gray-800 font-semibold">{step.file}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium">{step.concept}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Milestones ───────────────────────────────────────────────────────────────

const WEEK_STYLES = [
  { border: 'border-blue-200',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-400'   },
  { border: 'border-purple-200', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  { border: 'border-green-200',  bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-400'  },
] as const

function MilestonesPanel({ milestones }: { milestones: Milestones }) {
  const weeks = [
    { label: 'Week 1 — Foundations',    goals: milestones.week1 },
    { label: 'Week 2 — Core Flows',     goals: milestones.week2 },
    { label: 'Week 3 — Deep Dive',      goals: milestones.week3 },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 p-4 bg-gray-50/80 border-b border-gray-200">
        <Calendar className="size-4 text-green-600" />
        <span className="font-semibold text-sm text-gray-800">3-Week Milestones</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {weeks.map((week, i) => {
          const s = WEEK_STYLES[i]!
          return (
            <div key={week.label} className={`p-4 ${s.bg}`}>
              <p className={`text-xs font-bold mb-3 px-2.5 py-1 rounded-full border w-fit ${s.badge}`}>
                {week.label}
              </p>
              <ul className="space-y-2">
                {week.goals.map((goal, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle2 className="size-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { project } = Useproject()
  const utils = api.useUtils()

  const [role, setRole]               = useState<Role>('fullstack')
  const [experience, setExperience]   = useState<Experience>('mid')
  const [background, setBackground]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm]       = useState(false)

  const { data: plan, isLoading } = api.project.getOnboardingPlan.useQuery(
    { projectId: project?.id! },
    {
      enabled:         !!project?.id,
      refetchInterval: (data) => data?.status === 'GENERATING' ? 5000 : false,
    }
  )

  const { mutate: generate } = api.project.generateOnboardingPlan.useMutation({
    onMutate: () => setIsSubmitting(true),
    onSuccess: () => {
      setIsSubmitting(false)
      setShowForm(false)
      toast.success('Generating your onboarding plan…')
      void utils.project.getOnboardingPlan.invalidate({ projectId: project?.id })
    },
    onError: (err) => {
      setIsSubmitting(false)
      toast.error(err.message || 'Failed to generate plan')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project?.id || background.trim().length < 5) return
    generate({ projectId: project.id, role, experience, background: background.trim() })
  }

  const isGenerating = plan?.status === 'GENERATING'
  const isCompleted  = plan?.status === 'COMPLETED'
  const hasPlan      = !!plan

  const learningPath = (plan?.learningPath as LearningStep[]) ?? []
  const milestones   = (plan?.milestones  as Milestones)     ?? { week1: [], week2: [], week3: [] }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding Path Generator</h1>
          </div>
          <p className="text-sm text-gray-500">
            Tell us your background — the agent analyses the codebase and builds a personalised learning roadmap for you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <Badge variant="outline" className="text-sm px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />Generating…
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="outline" className="text-sm px-3 py-1 bg-green-50 text-green-700 border-green-200">
              <Sparkles className="size-3.5 mr-1.5" />Plan Ready
            </Badge>
          )}
          {hasPlan && !isGenerating && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(o => !o)}>
              <RefreshCw className="size-3.5 mr-1.5" />
              {showForm ? 'Cancel' : 'Regenerate'}
            </Button>
          )}
        </div>
      </div>

      {/* Input form */}
      {(!hasPlan || showForm) && !isGenerating && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">Your Developer Profile</h2>
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Role</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        role === r.value
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Experience</label>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setExperience(l.value)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        experience === l.value
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Your background & what you already know
              </label>
              <Textarea
                placeholder='e.g. "3 years React experience, comfortable with TypeScript, new to Next.js and databases. I mainly work on UI components."'
                value={background}
                onChange={e => setBackground(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" disabled={isSubmitting || background.trim().length < 5}>
              {isSubmitting
                ? <><Loader2 className="size-4 mr-2 animate-spin" />Starting…</>
                : <><GraduationCap className="size-4 mr-2" />Generate My Path</>}
            </Button>
          </form>
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 py-14 text-center">
          <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="size-7 text-blue-500 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-blue-700">Analysing codebase & building your path…</p>
          <p className="text-xs text-blue-400 mt-1">Usually takes 20–40 seconds</p>
        </div>
      )}

      {/* Results */}
      {isCompleted && !showForm && (
        <div className="space-y-5">
          {plan.summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Your Personalised Plan</span>
                <Badge variant="outline" className="ml-auto text-xs capitalize border-primary/20 text-primary">
                  {plan.experience} {plan.role}
                </Badge>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{plan.summary}</p>
            </div>
          )}

          {learningPath.length > 0 && <LearningPathPanel steps={learningPath} />}

          {(milestones.week1.length > 0 || milestones.week2.length > 0) && (
            <MilestonesPanel milestones={milestones} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasPlan && !showForm && (
        <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
          <GraduationCap className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No onboarding plan yet</p>
          <p className="text-xs mt-1">Fill in your profile above to generate one.</p>
        </div>
      )}
    </div>
  )
}
