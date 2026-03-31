'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Kanban, Loader2, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, ExternalLink, Calendar, Layers, Target,
  Bug, Wrench, Zap, Package, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SprintItem, FeatureCluster, WeekPlan } from '@/lib/sprint-planning-agent'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EFFORT_LABEL: Record<string, string> = { S: '½ day', M: '1 day', L: '2-3 days', XL: '5+ days' }
const EFFORT_COLOR: Record<string, string> = {
  S:  'bg-green-50 text-green-700 border-green-200',
  M:  'bg-blue-50 text-blue-700 border-blue-200',
  L:  'bg-orange-50 text-orange-700 border-orange-200',
  XL: 'bg-red-50 text-red-700 border-red-200',
}
const PRIORITY_COLOR: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-400',
  3: 'bg-gray-300',
}
const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

function TypeIcon({ type }: { type: string }) {
  if (type === 'bug')     return <Bug     className="size-3.5 text-red-500" />
  if (type === 'refactor') return <Wrench className="size-3.5 text-purple-500" />
  if (type === 'infra')   return <Zap    className="size-3.5 text-orange-500" />
  if (type === 'chore')   return <Package className="size-3.5 text-gray-400" />
  return <Sparkles className="size-3.5 text-blue-500" />
}

// ─── Sprint Item Card ─────────────────────────────────────────────────────────

function ItemCard({ item }: { item: SprintItem }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm hover:border-primary/20 hover:shadow-md transition-all">
      <div className="flex items-start gap-2 mb-2">
        <span className={`shrink-0 mt-1.5 size-2 rounded-full ${PRIORITY_COLOR[item.priority] ?? 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <TypeIcon type={item.type} />
            <p className="text-sm font-semibold text-gray-800 leading-snug">{item.title}</p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{item.rationale}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap ml-3.5">
        <Badge variant="outline" className={`text-xs ${EFFORT_COLOR[item.effort] ?? ''}`}>
          {item.effort} · {EFFORT_LABEL[item.effort]}
        </Badge>
        <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
          {PRIORITY_LABEL[item.priority] ?? ''} priority
        </Badge>
        <Badge variant="outline" className="text-xs text-gray-400 border-gray-100 capitalize">
          {item.type}
        </Badge>
        {item.issueNumber && item.issueUrl && (
          <a
            href={item.issueUrl}
            target="_blank"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            #{item.issueNumber}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Feature Cluster ──────────────────────────────────────────────────────────

function ClusterBadge({ cluster }: { cluster: FeatureCluster }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-gray-800">{cluster.area}</p>
        <div className="flex gap-1.5 shrink-0">
          {cluster.issueCount > 0 && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              {cluster.issueCount} issue{cluster.issueCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {cluster.commitCount > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              {cluster.commitCount} commit{cluster.commitCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{cluster.theme}</p>
    </div>
  )
}

// ─── Week Column ──────────────────────────────────────────────────────────────

function WeekColumn({
  label, items, allItems, accent,
}: {
  label: string; items: string[]; allItems: SprintItem[]; accent: string
}) {
  const matched = items
    .map(title => allItems.find(i => i.title === title))
    .filter(Boolean) as SprintItem[]

  const totalDays = matched.reduce((sum, i) => {
    const map: Record<string, number> = { S: 0.5, M: 1, L: 2.5, XL: 5 }
    return sum + (map[i.effort] ?? 1)
  }, 0)

  return (
    <div className={`rounded-xl border-2 ${accent} bg-white overflow-hidden`}>
      <div className="px-4 py-3 border-b border-current/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 opacity-60" />
          <span className="font-bold text-sm">{label}</span>
        </div>
        <span className="text-xs opacity-60">{totalDays} day{totalDays !== 1 ? 's' : ''}</span>
      </div>
      <div className="p-3 space-y-2">
        {matched.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">No items assigned</p>
          : matched.map((item, i) => <ItemCard key={i} item={item} />)
        }
      </div>
    </div>
  )
}

// ─── Plan Row ─────────────────────────────────────────────────────────────────

type Plan = {
  id: string; createdAt: Date; status: string; summary: string
  issuesAnalyzed: number; commitsAnalyzed: number
  featureClusters: unknown; sprintItems: unknown; weekPlan: unknown
}

function PlanRow({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false)

  const isGenerating = plan.status === 'GENERATING'
  const isCompleted  = plan.status === 'COMPLETED'
  const isFailed     = plan.status === 'FAILED'

  api.project.getSprintPlanById.useQuery(
    { planId: plan.id },
    { enabled: isGenerating, refetchInterval: isGenerating ? 5000 : false }
  )

  const clusters  = (plan.featureClusters as FeatureCluster[]) ?? []
  const items     = (plan.sprintItems     as SprintItem[])     ?? []
  const weekPlan  = (plan.weekPlan        as WeekPlan)         ?? { week1: [], week2: [] }
  const highCount = items.filter(i => i.priority === 1).length

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => isCompleted && setOpen(o => !o)}
        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${isCompleted ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
      >
        <span className="mt-0.5 shrink-0">
          {isGenerating
            ? <Loader2 className="size-4 animate-spin text-primary" />
            : open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-0.5">
            Sprint Plan · {new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {isGenerating
            ? <p className="text-xs text-primary animate-pulse">Analysing issues and commits…</p>
            : isCompleted
              ? <p className="text-xs text-gray-500 line-clamp-1">{plan.summary}</p>
              : <p className="text-xs text-red-500">{plan.summary || 'Generation failed'}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted && (
            <>
              <span className="text-xs text-gray-400">{items.length} items</span>
              {highCount > 0 && (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  {highCount} high priority
                </Badge>
              )}
            </>
          )}
          <Badge variant="outline" className={`text-xs ${
            isCompleted  ? 'bg-green-50 text-green-700 border-green-200' :
            isFailed     ? 'bg-red-50 text-red-700 border-red-200' :
                           'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isGenerating ? 'Generating…' : isCompleted ? 'Ready' : 'Failed'}
          </Badge>
        </div>
      </button>

      {open && isCompleted && (
        <div className="border-t border-gray-100 space-y-6 p-5">
          {/* Summary */}
          {plan.summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Sprint Summary</span>
                <div className="ml-auto flex gap-2">
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    {plan.issuesAnalyzed} issues analysed
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {plan.commitsAnalyzed} commits analysed
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{plan.summary}</p>
            </div>
          )}

          {/* Feature Clusters */}
          {clusters.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="size-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Feature Clusters
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clusters.map((c, i) => <ClusterBadge key={i} cluster={c} />)}
              </div>
            </section>
          )}

          {/* Sprint Board */}
          {items.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target className="size-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  2-Week Sprint Board
                </h3>
                <div className="ml-auto flex gap-3 text-xs text-gray-400">
                  {([1,2,3] as const).map(p => (
                    <span key={p} className="flex items-center gap-1">
                      <span className={`size-2 rounded-full ${PRIORITY_COLOR[p]}`} />
                      {PRIORITY_LABEL[p]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <WeekColumn label="Week 1 — Ship First" items={weekPlan.week1} allItems={items} accent="border-blue-300 text-blue-700" />
                <WeekColumn label="Week 2 — Expand"    items={weekPlan.week2} allItems={items} accent="border-purple-300 text-purple-700" />
              </div>
            </section>
          )}

          {/* Full backlog toggle */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="size-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Full Backlog ({items.length} items)
              </h3>
            </div>
            <div className="space-y-2">
              {[...items]
                .sort((a, b) => a.priority - b.priority)
                .map((item, i) => <ItemCard key={i} item={item} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SprintPlanningPage() {
  const { project } = Useproject()
  const utils = api.useUtils()
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: plans, isLoading } = api.project.getSprintPlans.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 10000 }
  )

  const { mutate: generate } = api.project.generateSprintPlan.useMutation({
    onMutate:  () => setIsGenerating(true),
    onSuccess: () => {
      setIsGenerating(false)
      toast.success('Sprint planning agent started — takes ~30s')
      void utils.project.getSprintPlans.invalidate({ projectId: project?.id })
    },
    onError: err => {
      setIsGenerating(false)
      toast.error(err.message || 'Failed to start planning')
    },
  })

  const activeGeneration = plans?.some(p => p.status === 'GENERATING')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Kanban className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sprint Planning Agent</h1>
          </div>
          <p className="text-sm text-gray-500">
            Analyses open GitHub issues and recent commit patterns to produce a prioritised 2-week sprint plan.
          </p>
        </div>
        <Button
          onClick={() => project?.id && generate({ projectId: project.id })}
          disabled={isGenerating || !!activeGeneration}
        >
          {isGenerating || activeGeneration
            ? <><Loader2 className="size-4 mr-2 animate-spin" />Planning…</>
            : <><RefreshCw className="size-4 mr-2" />Generate Sprint Plan</>}
        </Button>
      </div>

      {/* What it analyses */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {[
          { icon: <Target className="size-4 text-purple-500" />, label: 'Open GitHub Issues', desc: 'Pulled live from your repo — up to 30 most recent' },
          { icon: <Layers  className="size-4 text-blue-500"   />, label: 'Commit Patterns',   desc: 'Last 25 commits analysed for active feature areas' },
          { icon: <Kanban  className="size-4 text-green-500"  />, label: 'Sprint Output',      desc: 'Feature clusters, effort estimates, 2-week board' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="flex gap-3 items-start">
            <div className="size-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-700 text-xs">{label}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Sprint Plans</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !plans?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
            <Kanban className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No sprint plans yet</p>
            <p className="text-xs mt-1">Click "Generate Sprint Plan" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(p => <PlanRow key={p.id} plan={p as Plan} />)}
          </div>
        )}
      </section>
    </div>
  )
}
