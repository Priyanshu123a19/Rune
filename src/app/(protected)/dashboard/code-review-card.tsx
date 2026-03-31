'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Bot, ChevronDown, ChevronRight, ShieldAlert, Zap, Brain, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { SecurityFinding, PerformanceFinding, LogicFinding } from '@/lib/code-review-agent'

// ─── Severity helpers ─────────────────────────────────────────────────────────

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

function severityColor(s: Severity) {
  return {
    LOW:      'bg-green-100  text-green-800  border-green-200',
    MEDIUM:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    HIGH:     'bg-orange-100 text-orange-800 border-orange-200',
    CRITICAL: 'bg-red-100    text-red-800    border-red-200',
  }[s] ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

function severityIcon(s: Severity) {
  if (s === 'CRITICAL' || s === 'HIGH') return <XCircle className="size-3.5 shrink-0" />
  if (s === 'MEDIUM')                    return <AlertTriangle className="size-3.5 shrink-0" />
  return <CheckCircle2 className="size-3.5 shrink-0" />
}

// ─── Single review row ────────────────────────────────────────────────────────

type Review = {
  id: string
  commitHash: string
  commitMessage: string
  summary: string
  overallSeverity: string
  securityFindings:    unknown
  performanceFindings: unknown
  logicFindings:       unknown
  createdAt: Date
}

function ReviewRow({ review }: { review: Review }) {
  const [open, setOpen] = useState(false)

  const security    = (review.securityFindings    as SecurityFinding[])    ?? []
  const performance = (review.performanceFindings as PerformanceFinding[]) ?? []
  const logic       = (review.logicFindings       as LogicFinding[])       ?? []
  const totalIssues = security.length + performance.length + logic.length
  const sev         = review.overallSeverity as Severity

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="mt-0.5 text-gray-400">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              {review.commitHash.slice(0, 7)}
            </code>
            <span className="text-sm font-medium text-gray-900 truncate">
              {review.commitMessage.slice(0, 60)}
              {review.commitMessage.length > 60 ? '…' : ''}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{review.summary}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {totalIssues > 0 && (
            <span className="text-xs text-gray-500">{totalIssues} issue{totalIssues !== 1 ? 's' : ''}</span>
          )}
          <Badge className={`text-xs border ${severityColor(sev)}`} variant="outline">
            {sev}
          </Badge>
        </div>
      </button>

      {/* Expanded findings */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* Security */}
          {security.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ShieldAlert className="size-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-800">Security ({security.length})</span>
              </div>
              <div className="space-y-2">
                {security.map((f, i) => (
                  <div key={i} className={`rounded-md border p-3 ${severityColor(f.severity)}`}>
                    <div className="flex items-start gap-2">
                      {severityIcon(f.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.issue}</p>
                        <p className="text-xs mt-0.5 opacity-80">
                          <span className="font-mono">{f.file}</span>
                          {f.owaspCategory && <> · {f.owaspCategory}</>}
                        </p>
                        {f.recommendation && (
                          <p className="text-xs mt-1 opacity-90">💡 {f.recommendation}</p>
                        )}
                      </div>
                      <Badge className={`text-xs border shrink-0 ${severityColor(f.severity)}`} variant="outline">
                        {f.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance */}
          {performance.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="size-4 text-yellow-500" />
                <span className="text-sm font-semibold text-gray-800">Performance ({performance.length})</span>
              </div>
              <div className="space-y-2">
                {performance.map((f, i) => (
                  <div key={i} className={`rounded-md border p-3 ${severityColor(f.impact as Severity)}`}>
                    <div className="flex items-start gap-2">
                      {severityIcon(f.impact as Severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.issue}</p>
                        <p className="text-xs mt-0.5 opacity-80 font-mono">{f.file}</p>
                        {f.suggestion && (
                          <p className="text-xs mt-1 opacity-90">💡 {f.suggestion}</p>
                        )}
                      </div>
                      <Badge className={`text-xs border shrink-0 ${severityColor(f.impact as Severity)}`} variant="outline">
                        {f.impact}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logic */}
          {logic.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Brain className="size-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800">Logic ({logic.length})</span>
              </div>
              <div className="space-y-2">
                {logic.map((f, i) => (
                  <div key={i} className={`rounded-md border p-3 ${severityColor(f.severity as Severity)}`}>
                    <div className="flex items-start gap-2">
                      {severityIcon(f.severity as Severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.issue}</p>
                        <p className="text-xs mt-0.5 opacity-80 font-mono">{f.file}</p>
                        {f.suggestion && (
                          <p className="text-xs mt-1 opacity-90">💡 {f.suggestion}</p>
                        )}
                      </div>
                      <Badge className={`text-xs border shrink-0 ${severityColor(f.severity as Severity)}`} variant="outline">
                        {f.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean bill of health */}
          {totalIssues === 0 && (
            <div className="p-4 flex items-center gap-2 text-green-700 bg-green-50">
              <CheckCircle2 className="size-4" />
              <span className="text-sm">No issues found — code looks clean.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

const CodeReviewCard = () => {
  const { project } = Useproject()

  const { data: reviews, isLoading } = api.project.getCodeReviews.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 30_000 },
  )

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="size-5 text-primary" />
        <span className="font-semibold text-lg">AI Code Reviews</span>
        {reviews && reviews.length > 0 && (
          <Badge variant="secondary" className="text-xs">{reviews.length}</Badge>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500 py-6 text-center">Loading reviews…</div>
      )}

      {!isLoading && (!reviews || reviews.length === 0) && (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-gray-400">
          <Bot className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No reviews yet.</p>
          <p className="text-xs mt-1">Push a commit — the agent will review it automatically.</p>
        </div>
      )}

      {reviews && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review as Review} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CodeReviewCard
