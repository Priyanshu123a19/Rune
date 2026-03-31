'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck, ChevronDown, ChevronRight,
  ShieldAlert, Zap, Brain, GitCommit,
  ExternalLink, Bot, Loader2, CheckCircle2, RefreshCw,
  AlertTriangle, Info,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Finding = {
  title:      string
  file:       string
  line?:      string
  severity:   'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category:   string
  suggestion: string
}

type Review = {
  id:                  string
  commitHash:          string
  commitMessage:       string
  summary:             string
  overallSeverity:     'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status:              string
  securityFindings:    unknown
  performanceFindings: unknown
  logicFindings:       unknown
  createdAt:           Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200'
  if (s === 'HIGH')     return 'bg-orange-100 text-orange-700 border-orange-200'
  if (s === 'MEDIUM')   return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

function severityIcon(s: string) {
  if (s === 'CRITICAL' || s === 'HIGH') return <ShieldAlert className="size-3.5" />
  if (s === 'MEDIUM') return <AlertTriangle className="size-3.5" />
  return <Info className="size-3.5" />
}

// ─── Review Button ────────────────────────────────────────────────────────────

function ReviewButton({ projectId, commitHash, commitMessage }: {
  projectId: string; commitHash: string; commitMessage: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const utils = api.useUtils()

  const { mutate: runReview } = api.project.runCodeReview.useMutation({
    onMutate: () => setStatus('loading'),
    onSuccess: () => {
      setStatus('done')
      toast.success('Review queued — results appear below in ~20s')
      setTimeout(() => void utils.project.getCodeReviews.invalidate({ projectId }), 5000)
    },
    onError: (err) => {
      setStatus('idle')
      if (err.message.includes('already exists')) toast.info('Review already exists for this commit')
      else toast.error('Failed to start review')
    },
  })

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-3 text-xs gap-1.5"
      disabled={status !== 'idle'}
      onClick={() => runReview({ projectId, commitHash, commitMessage })}
    >
      {status === 'loading' ? <><Loader2 className="size-3 animate-spin" />Reviewing…</>
      : status === 'done'   ? <><CheckCircle2 className="size-3 text-green-500" />Queued</>
      :                       <><Bot className="size-3" />Review</>}
    </Button>
  )
}

// ─── Finding Card ─────────────────────────────────────────────────────────────

function FindingCard({ f }: { f: Finding }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-800">{f.title}</p>
        <Badge variant="outline" className={`text-xs shrink-0 flex items-center gap-1 ${severityColor(f.severity)}`}>
          {severityIcon(f.severity)}
          {f.severity}
        </Badge>
      </div>
      <p className="text-xs font-mono text-gray-500">{f.file}{f.line ? `:${f.line}` : ''}</p>
      <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{f.suggestion}</p>
    </div>
  )
}

// ─── Review Row ───────────────────────────────────────────────────────────────

function ReviewRow({ review, githubUrl }: { review: Review; githubUrl: string }) {
  const [open, setOpen] = useState(false)

  const security    = (review.securityFindings    as Finding[]) ?? []
  const performance = (review.performanceFindings as Finding[]) ?? []
  const logic       = (review.logicFindings       as Finding[]) ?? []
  const total       = security.length + performance.length + logic.length

  const isProcessing = review.status === 'PROCESSING'

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => !isProcessing && setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="mt-0.5 text-gray-400 shrink-0">
          {isProcessing
            ? <Loader2 className="size-4 animate-spin text-primary" />
            : open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
              {review.commitHash.slice(0, 7)}
            </code>
            <span className="text-sm font-medium text-gray-800 truncate">{review.commitMessage}</span>
          </div>
          {review.summary && (
            <p className="text-xs text-gray-500 line-clamp-1">{review.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {total > 0 && (
            <span className="text-xs text-gray-400">{total} finding{total !== 1 ? 's' : ''}</span>
          )}
          <Badge variant="outline" className={`text-xs ${severityColor(review.overallSeverity)}`}>
            {review.overallSeverity}
          </Badge>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {[
            { label: 'Security',    icon: <ShieldAlert className="size-4 text-red-500" />,    items: security,    color: 'text-red-600'    },
            { label: 'Performance', icon: <Zap         className="size-4 text-orange-500" />, items: performance, color: 'text-orange-600' },
            { label: 'Logic',       icon: <Brain        className="size-4 text-purple-500" />, items: logic,       color: 'text-purple-600' },
          ].map(({ label, icon, items, color }) => items.length > 0 && (
            <div key={label} className="p-4">
              <div className={`flex items-center gap-2 mb-3 ${color}`}>
                {icon}
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-gray-400 ml-auto">{items.length} issue{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {items.map((f, i) => <FindingCard key={i} f={f} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CodeReviewPage() {
  const { project } = Useproject()
  const [isManualSyncing, setIsManualSyncing] = useState(false)

  const { data: commits, isLoading: commitsLoading, refetch } = api.project.getCommits.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 60000 }
  )

  const { data: reviews, isLoading: reviewsLoading } = api.project.getCodeReviews.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 15000 }
  )

  const { mutate: syncCommits } = api.project.syncCommits.useMutation({
    onSuccess: () => { void refetch(); setIsManualSyncing(false) },
    onError:   () => setIsManualSyncing(false),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI Code Review</h1>
          </div>
          <p className="text-sm text-gray-500 ml-13">
            Select any commit to trigger an AI-powered security, performance, and logic review.
          </p>
        </div>
        {reviews && reviews.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Commits section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Recent Commits</h2>
          <Button
            variant="outline" size="sm"
            onClick={() => { setIsManualSyncing(true); syncCommits({ projectId: project?.id! }) }}
            disabled={isManualSyncing}
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
            {isManualSyncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>

        {commitsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading commits…
          </div>
        ) : !commits?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
            <GitCommit className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No commits found. Push code or sync.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commits.map(commit => (
              <div
                key={commit.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-primary/30 transition-colors"
              >
                <img
                  src={commit.commitAuthorAvatar || '/default-avatar.png'}
                  alt={commit.commitAuthorName}
                  className="size-8 rounded-full shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{commit.commitMessage}</p>
                  <p className="text-xs text-gray-400">
                    {commit.commitAuthorName} · {new Date(commit.commitDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {project?.id && (
                    <ReviewButton
                      projectId={project.id}
                      commitHash={commit.commitHash}
                      commitMessage={commit.commitMessage}
                    />
                  )}
                  <Link
                    href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                    target="_blank"
                    className="text-gray-400 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                  <code className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                    {commit.commitHash.slice(0, 7)}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviews section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Review Results</h2>

        {reviewsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading reviews…
          </div>
        ) : !reviews?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
            <ShieldCheck className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No reviews yet.</p>
            <p className="text-xs mt-1">Click "Review" on any commit above to start.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <ReviewRow key={r.id} review={r as Review} githubUrl={project?.githubUrl ?? ''} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
