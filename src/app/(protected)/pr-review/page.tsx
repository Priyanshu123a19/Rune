'use client'

import Useproject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import {
    GitPullRequest, Bot, Loader2, CheckCircle2, XCircle,
    Clock, ExternalLink, GitMerge, FileCode, MessageSquare,
    ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { type PrComment } from '@/lib/pr-review-agent'

// ─── Severity badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
    const style =
        severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200'
        : severity === 'HIGH'   ? 'bg-orange-100 text-orange-700 border-orange-200'
        : severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
    return (
        <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full uppercase ${style}`}>
            {severity}
        </span>
    )
}

// ─── PR Card (open PR from GitHub) ───────────────────────────────────────────
function PrCard({
    pr, onReview, reviewing,
}: {
    pr: {
        number: number; title: string; user: string; userAvatar: string
        url: string; headSha: string; headRef: string; baseRef: string
        createdAt: string; draft: boolean
        labels: { name: string; color: string }[]
    }
    onReview: () => void
    reviewing: boolean
}) {
    return (
        <div className="flex items-start gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-primary/20 hover:shadow-sm transition-all">
            <img src={pr.userAvatar} alt={pr.user} className="size-8 rounded-full ring-2 ring-gray-100 shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link href={pr.url} target="_blank" className="text-sm font-semibold text-gray-800 hover:text-primary transition-colors truncate">
                        {pr.title}
                    </Link>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">#{pr.number}</span>
                    {pr.draft && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                            Draft
                        </span>
                    )}
                    {pr.labels.map(l => (
                        <span
                            key={l.name}
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{ background: `#${l.color}22`, color: `#${l.color}`, border: `1px solid #${l.color}44` }}
                        >
                            {l.name}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                        <GitMerge className="size-3" />
                        <span className="font-mono">{pr.headRef}</span>
                        <span>→</span>
                        <span className="font-mono">{pr.baseRef}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(pr.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Link href={pr.url} target="_blank">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <ExternalLink className="size-3.5" />
                    </Button>
                </Link>
                <Button size="sm" className="gap-1.5 text-xs" onClick={onReview} disabled={reviewing}>
                    {reviewing ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                    {reviewing ? 'Reviewing…' : 'AI Review'}
                </Button>
            </div>
        </div>
    )
}

// ─── Review Card (past review from DB) ───────────────────────────────────────
function ReviewCard({ review }: {
    review: {
        id: string; prNumber: number; prTitle: string; prUrl: string
        summary: string; comments: unknown; postedToGithub: boolean
        status: string; createdAt: Date
    }
}) {
    const [open, setOpen] = React.useState(false)
    const comments = (Array.isArray(review.comments) ? review.comments : []) as PrComment[]

    const statusIcon =
        review.status === 'COMPLETED' ? <CheckCircle2 className="size-4 text-emerald-500" />
        : review.status === 'FAILED'  ? <XCircle className="size-4 text-red-400" />
        : <Loader2 className="size-4 animate-spin text-amber-500" />

    const highestSeverity = comments.reduce<string>((acc, c) => {
        const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        return order.indexOf(c.severity) < order.indexOf(acc) ? c.severity : acc
    }, 'LOW')

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => review.status === 'COMPLETED' && setOpen(o => !o)}
            >
                {statusIcon}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{review.prTitle}</span>
                        <span className="text-xs text-gray-400 shrink-0">#{review.prNumber}</span>
                        {review.status === 'COMPLETED' && comments.length > 0 && (
                            <SeverityBadge severity={highestSeverity} />
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" />
                            {comments.length} comment{comments.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                        {review.postedToGithub && (
                            <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="size-3" />
                                Posted to GitHub
                            </span>
                        )}
                        {review.status === 'COMPLETED' && !review.postedToGithub && (
                            <span className="text-amber-500 flex items-center gap-1">
                                <AlertCircle className="size-3" />
                                Not posted
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {review.prUrl && (
                        <Link href={review.prUrl} target="_blank" onClick={e => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="gap-1 text-xs">
                                <ExternalLink className="size-3.5" />
                            </Button>
                        </Link>
                    )}
                    {review.status === 'COMPLETED' && (
                        <Button variant="ghost" size="sm" className="text-gray-400">
                            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                    )}
                </div>
            </div>

            {/* Expanded detail */}
            {open && review.status === 'COMPLETED' && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Summary */}
                    {review.summary && (
                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Summary</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{review.summary}</p>
                        </div>
                    )}

                    {/* Inline comments */}
                    {comments.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Inline Comments ({comments.length})
                            </p>
                            <div className="space-y-2">
                                {comments.map((c, i) => (
                                    <div key={i} className="rounded-lg border border-gray-100 p-3 bg-white">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <FileCode className="size-3.5 text-gray-400 shrink-0" />
                                            <span className="text-xs font-mono text-gray-600 truncate">{c.path}</span>
                                            <span className="text-[10px] text-gray-400 shrink-0">:{c.position}</span>
                                            <SeverityBadge severity={c.severity} />
                                            <span className="text-[10px] text-gray-400 capitalize shrink-0">{c.type}</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed pl-5">{c.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {comments.length === 0 && (
                        <div className="text-center py-4 text-gray-400">
                            <CheckCircle2 className="size-7 mx-auto mb-1.5 text-emerald-400" />
                            <p className="text-xs">No issues found — looks good!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const PrReviewPage = () => {
    const { projectId } = Useproject()
    const [reviewingPr, setReviewingPr] = React.useState<number | null>(null)

    const { data: openPRs, isLoading: prsLoading } = api.project.getOpenPRs.useQuery(
        { projectId }, { enabled: !!projectId, refetchInterval: 30_000 }
    )
    const { data: reviews, refetch: refetchReviews } = api.project.getPrReviews.useQuery(
        { projectId }, { enabled: !!projectId, refetchInterval: 5000 }
    )

    const startReview = api.project.startPrReview.useMutation({
        onSuccess: () => {
            toast.success('Review started — agent is analysing the PR…')
            void refetchReviews()
        },
        onError: () => toast.error('Failed to start review'),
        onSettled: () => setReviewingPr(null),
    })

    const isReviewingPr = (prNumber: number) =>
        reviewingPr === prNumber ||
        reviews?.some(r => r.prNumber === prNumber && r.status === 'REVIEWING')

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">

            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GitPullRequest className="size-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">PR Review</h1>
                </div>
                <p className="text-sm text-gray-500">
                    AI reviews open pull requests and posts inline comments directly on GitHub.
                </p>
            </div>

            {/* Info strip */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-700 space-y-1">
                        <p className="font-semibold">How it works</p>
                        <p>The agent fetches the PR diff, analyses each changed file for bugs, security issues, and improvements, then posts an inline review comment directly on the PR using your GitHub token.</p>
                        <p className="text-indigo-500">Requires <code className="bg-indigo-100 px-1 rounded">GITHUB_TOKEN</code> with <code className="bg-indigo-100 px-1 rounded">pull_requests: write</code> scope.</p>
                    </div>
                </div>
            </div>

            {/* Open PRs */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <GitPullRequest className="size-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        Open Pull Requests
                        {openPRs && openPRs.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">({openPRs.length})</span>
                        )}
                    </h2>
                </div>

                {prsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                        <Loader2 className="size-4 animate-spin" /> Fetching open PRs…
                    </div>
                ) : !openPRs?.length ? (
                    <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                        <GitPullRequest className="size-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No open pull requests</p>
                        <p className="text-xs mt-1">Open a PR on GitHub and it will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {openPRs.map(pr => (
                            <PrCard
                                key={pr.number}
                                pr={pr}
                                reviewing={!!isReviewingPr(pr.number)}
                                onReview={() => {
                                    setReviewingPr(pr.number)
                                    startReview.mutate({
                                        projectId,
                                        prNumber:  pr.number,
                                        prTitle:   pr.title,
                                        prUrl:     pr.url,
                                        prHeadSha: pr.headSha,
                                    })
                                }}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Past reviews */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Bot className="size-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        Past Reviews
                        {reviews && reviews.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">({reviews.length})</span>
                        )}
                    </h2>
                </div>

                {!reviews?.length ? (
                    <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                        <Bot className="size-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No reviews yet</p>
                        <p className="text-xs mt-1">Click "AI Review" on an open PR above to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                    </div>
                )}
            </section>
        </div>
    )
}

export default PrReviewPage
