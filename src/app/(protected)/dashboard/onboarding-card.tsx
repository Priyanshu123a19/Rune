'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  { value: 'frontend',  label: 'Frontend' },
  { value: 'backend',   label: 'Backend' },
  { value: 'fullstack', label: 'Full Stack' },
  { value: 'devops',    label: 'DevOps / Infra' },
] as const

const LEVELS = [
  { value: 'junior', label: 'Junior (0–2 yrs)' },
  { value: 'mid',    label: 'Mid (2–5 yrs)' },
  { value: 'senior', label: 'Senior (5+ yrs)' },
] as const

type Role       = typeof ROLES[number]['value']
type Experience = typeof LEVELS[number]['value']

// ─── Learning Path Display ────────────────────────────────────────────────────

function LearningPathPanel({ steps }: { steps: LearningStep[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {open ? <ChevronDown className="size-4 text-gray-500" /> : <ChevronRight className="size-4 text-gray-500" />}
        <Map className="size-4 text-indigo-600" />
        <span className="font-semibold text-sm text-gray-800">Learning Path</span>
        <Badge variant="secondary" className="text-xs ml-auto">{steps.length} steps</Badge>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {steps.map(step => (
            <div key={step.order} className="p-3 flex gap-3 items-start">
              <span className="shrink-0 size-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileCode className="size-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-mono text-gray-800 font-medium truncate">{step.file}</span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5 font-medium">{step.concept}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Milestones Display ───────────────────────────────────────────────────────

const WEEK_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-purple-50 border-purple-200 text-purple-800',
  'bg-green-50 border-green-200 text-green-800',
] as const

function MilestonesPanel({ milestones }: { milestones: Milestones }) {
  const weeks = [
    { label: 'Week 1', goals: milestones.week1 },
    { label: 'Week 2', goals: milestones.week2 },
    { label: 'Week 3', goals: milestones.week3 },
  ]

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-200">
        <Calendar className="size-4 text-green-600" />
        <span className="font-semibold text-sm text-gray-800">3-Week Milestones</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {weeks.map((week, i) => (
          <div key={week.label} className="p-3">
            <p className={`text-xs font-bold mb-2 px-2 py-0.5 rounded-full border w-fit ${WEEK_COLORS[i]}`}>
              {week.label}
            </p>
            <ul className="space-y-1.5">
              {week.goals.map((goal, j) => (
                <li key={j} className="flex items-start gap-1.5 text-xs text-gray-700">
                  <CheckCircle2 className="size-3.5 text-green-500 mt-0.5 shrink-0" />
                  {goal}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Card ────────────────────────────────────────────────────────────────

const OnboardingCard = () => {
  const { project } = Useproject()
  const utils = api.useUtils()

  const [role, setRole]           = useState<Role>('fullstack')
  const [experience, setExperience] = useState<Experience>('mid')
  const [background, setBackground] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm]   = useState(false)

  const { data: plan, isLoading } = api.project.getOnboardingPlan.useQuery(
    { projectId: project?.id! },
    {
      enabled:         !!project?.id,
      refetchInterval: (data) =>
        data?.status === 'GENERATING' ? 5000 : false,
    },
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
  const milestones   = (plan?.milestones as Milestones) ?? { week1: [], week2: [], week3: [] }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" />
          <span className="font-semibold text-lg">Onboarding Path Generator</span>
          {isGenerating && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              <Loader2 className="size-3 mr-1 animate-spin" />Generating…
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <Sparkles className="size-3 mr-1" />Ready
            </Badge>
          )}
        </div>
        {hasPlan && !isGenerating && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(o => !o)}>
            <RefreshCw className="size-3.5 mr-1.5" />
            {showForm ? 'Cancel' : 'Regenerate'}
          </Button>
        )}
      </div>

      {/* Form — shown when no plan yet, or when regenerating */}
      {(!hasPlan || showForm) && !isGenerating && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tell us about yourself — we'll generate a personalised onboarding path
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role + Experience row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Your Role</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          role === r.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Experience Level</label>
                  <div className="flex flex-wrap gap-1.5">
                    {LEVELS.map(l => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setExperience(l.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          experience === l.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  Your background & what you already know
                </label>
                <Textarea
                  placeholder='e.g. "3 years React experience, comfortable with TypeScript, new to Next.js and databases. I mainly work on UI components."'
                  value={background}
                  onChange={e => setBackground(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  disabled={isSubmitting}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || background.trim().length < 5}
                className="w-full sm:w-auto"
              >
                {isSubmitting
                  ? <><Loader2 className="size-4 mr-2 animate-spin" />Starting…</>
                  : <><GraduationCap className="size-4 mr-2" />Generate My Path</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 py-10 text-center">
          <Loader2 className="size-8 mx-auto mb-3 text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-blue-700">Agent is analyzing the codebase…</p>
          <p className="text-xs text-blue-500 mt-1">This usually takes 20–40 seconds</p>
        </div>
      )}

      {/* Results */}
      {isCompleted && !showForm && (
        <div className="space-y-4">
          {/* Summary */}
          {plan.summary && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">Your Personalised Plan</span>
                <span className="ml-auto text-xs text-indigo-500 capitalize">
                  {plan.experience} {plan.role}
                </span>
              </div>
              <p className="text-sm text-indigo-800">{plan.summary}</p>
            </div>
          )}

          {/* Learning path */}
          {learningPath.length > 0 && <LearningPathPanel steps={learningPath} />}

          {/* Milestones */}
          {(milestones.week1.length > 0 || milestones.week2.length > 0) && (
            <MilestonesPanel milestones={milestones} />
          )}
        </div>
      )}

      {/* Empty state */}
      {isLoading && (
        <div className="text-sm text-gray-500 py-4 text-center">Loading…</div>
      )}
    </div>
  )
}

export default OnboardingCard
