'use client'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api, type RouterOutputs } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import {
    VideoIcon, Clock, CheckCircle2, ExternalLink,
    Github, Loader2, ArrowLeft, MessageSquare,
    AlertCircle, Lightbulb,
} from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { toast } from 'sonner'

type Issue = NonNullable<RouterOutputs['project']['getMeetingById']>['issues'][number]

// ─── Issue Card ───────────────────────────────────────────────────────────────
function IssueCard({ issue, projectId, onSelect }: {
    issue: Issue
    projectId: string
    onSelect: () => void
}) {
    const [githubUrl, setGithubUrl] = React.useState<string | null>(
        issue.githubIssueUrl ?? null
    )

    const createIssue = api.project.createGithubIssue.useMutation({
        onSuccess: ({ url }) => {
            setGithubUrl(url)
            toast.success('GitHub issue created!', {
                action: { label: 'View', onClick: () => window.open(url, '_blank') },
            })
        },
        onError: () => toast.error('Failed to create GitHub issue'),
    })

    const alreadyCreated = !!githubUrl

    return (
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 hover:border-primary/20 hover:shadow-sm transition-all overflow-hidden">
            {/* Card top accent */}
            <div className="h-1 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40" />

            <div className="p-4 flex flex-col flex-1 gap-3">
                {/* Icon + gist */}
                <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="size-4 text-primary/70" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{issue.gist}</p>
                </div>

                {/* Headline */}
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 pl-11">
                    {issue.headline}
                </p>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5 pl-11">
                    <Clock className="size-3 text-gray-300" />
                    <span className="text-[10px] text-gray-400 font-mono">
                        {issue.start} – {issue.end}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5 text-gray-500 hover:text-gray-700 flex-1"
                        onClick={onSelect}
                    >
                        <MessageSquare className="size-3.5" />
                        Details
                    </Button>

                    {alreadyCreated ? (
                        <Link href={githubUrl!} target="_blank" className="flex-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                            >
                                <CheckCircle2 className="size-3.5" />
                                View on GitHub
                            </Button>
                        </Link>
                    ) : (
                        <Button
                            size="sm"
                            className="flex-1 text-xs gap-1.5"
                            disabled={createIssue.isPending}
                            onClick={() => createIssue.mutate({ projectId, issueId: issue.id })}
                        >
                            {createIssue.isPending
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : <Github className="size-3.5" />
                            }
                            {createIssue.isPending ? 'Creating…' : 'Create Issue'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const IssuesList = ({ meetingId }: { meetingId: string }) => {
    const { projectId } = Useproject()
    const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null)

    const { data: meeting, isLoading } = api.project.getMeetingById.useQuery(
        { meetingId },
        { refetchInterval: (query) => query.state.data?.status === 'PROCESSING' ? 4000 : false }
    )

    if (isLoading) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex items-center gap-2 text-gray-400 py-24 justify-center">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Loading meeting…</span>
            </div>
        )
    }

    if (!meeting) return null

    return (
        <Sheet open={!!selectedIssue} onOpenChange={open => !open && setSelectedIssue(null)}>
            <div className="p-6 max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <Link
                        href="/meetings"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                    >
                        <ArrowLeft className="size-3.5" />
                        Back to meetings
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <VideoIcon className="size-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{meeting.name}</h1>
                            <p className="text-sm text-gray-400">
                                {meeting.createdAt.toLocaleDateString(undefined, {
                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Processing state */}
                {meeting.status === 'PROCESSING' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
                        <Loader2 className="size-4 text-amber-500 animate-spin shrink-0" />
                        <p className="text-sm text-amber-700">
                            AI is still processing this meeting — action items will appear shortly.
                        </p>
                    </div>
                )}

                {/* Issues grid */}
                {meeting.issues.length === 0 && meeting.status !== 'PROCESSING' ? (
                    <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
                        <AlertCircle className="size-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No action items found</p>
                        <p className="text-xs mt-1">The AI didn't detect any notable issues in this recording.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <Lightbulb className="size-4 text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                                Action Items
                                <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                                    ({meeting.issues.length})
                                </span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {meeting.issues.map(issue => (
                                <IssueCard
                                    key={issue.id}
                                    issue={issue}
                                    projectId={projectId}
                                    onSelect={() => setSelectedIssue(issue)}
                                />
                            ))}
                        </div>

                        {/* Helper note */}
                        <p className="text-xs text-gray-400 text-center">
                            Click <strong>Create Issue</strong> to push an action item directly to your GitHub repo as an issue.
                        </p>
                    </>
                )}
            </div>

            {/* Detail Sheet */}
            {selectedIssue && (
                <SheetContent className="sm:max-w-lg flex flex-col">
                    <SheetHeader className="border-b pb-4 shrink-0">
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Lightbulb className="size-4 text-primary" />
                            </div>
                            <SheetTitle className="text-left leading-snug">{selectedIssue.gist}</SheetTitle>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 overflow-auto py-5 space-y-5">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Headline</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{selectedIssue.headline}</p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Summary</p>
                            <blockquote className="border-l-4 border-primary/30 bg-gray-50 rounded-r-lg p-4">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Clock className="size-3 text-gray-400" />
                                    <span className="text-xs font-mono text-gray-400">
                                        {selectedIssue.start} – {selectedIssue.end}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed italic">
                                    {selectedIssue.summary}
                                </p>
                            </blockquote>
                        </div>

                        {selectedIssue.githubIssueUrl && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-emerald-700">GitHub issue created</p>
                                    <Link
                                        href={selectedIssue.githubIssueUrl}
                                        target="_blank"
                                        className="text-xs text-emerald-600 hover:underline truncate block"
                                    >
                                        {selectedIssue.githubIssueUrl}
                                    </Link>
                                </div>
                                <Link href={selectedIssue.githubIssueUrl} target="_blank">
                                    <ExternalLink className="size-3.5 text-emerald-500" />
                                </Link>
                            </div>
                        )}
                    </div>
                </SheetContent>
            )}
        </Sheet>
    )
}

export default IssuesList
