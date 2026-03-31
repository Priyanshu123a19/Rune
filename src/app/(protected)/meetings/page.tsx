'use client'

import Useproject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import MeetingCard from '../dashboard/meeting-card'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import useRefetch from '@/hooks/use-refetch'
import { Presentation, Calendar, MessageSquare, Loader2, Trash2, ExternalLink, Clock } from 'lucide-react'

const MeetingsPage = () => {
    const { projectId } = Useproject()
    const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
        { projectId },
        { refetchInterval: 4000 }
    )
    const deleteMeeting = api.project.deleteMeeting.useMutation()
    const refetch = useRefetch()

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">

            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Presentation className="size-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
                </div>
                <p className="text-sm text-gray-500">Upload recordings and let AI extract action items and key issues.</p>
            </div>

            {/* Upload card */}
            <MeetingCard />

            {/* Meetings list */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        Recorded Meetings
                        {meetings && meetings.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                                ({meetings.length})
                            </span>
                        )}
                    </h2>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                        <Loader2 className="size-4 animate-spin" /> Loading meetings…
                    </div>
                ) : !meetings?.length ? (
                    <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                        <Presentation className="size-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No meetings yet</p>
                        <p className="text-xs mt-1">Upload a recording above to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meetings.map(meeting => (
                            <div
                                key={meeting.id}
                                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-primary/20 hover:shadow-sm transition-all"
                            >
                                {/* Icon */}
                                <div className="size-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                    <Presentation className="size-5 text-primary/60" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <Link
                                            href={`/meetings/${meeting.id}`}
                                            className="text-sm font-semibold text-gray-800 hover:text-primary transition-colors truncate"
                                        >
                                            {meeting.name}
                                        </Link>
                                        {meeting.status === 'PROCESSING' && (
                                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border text-xs gap-1 font-medium">
                                                <Loader2 className="size-3 animate-spin" />
                                                Processing
                                            </Badge>
                                        )}
                                        {meeting.status === 'PROCESSED' && (
                                            <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs font-medium">
                                                Ready
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="size-3" />
                                            {meeting.createdAt.toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {meeting.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="size-3" />
                                            {meeting.issues.length} issue{meeting.issues.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link href={`/meetings/${meeting.id}`}>
                                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                            <ExternalLink className="size-3.5" />
                                            View
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={deleteMeeting.isPending}
                                        className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300"
                                        onClick={() => deleteMeeting.mutate(
                                            { meetingId: meeting.id },
                                            {
                                                onSuccess: () => { toast.success('Meeting deleted'); refetch() },
                                                onError:   () => toast.error('Failed to delete meeting'),
                                            }
                                        )}
                                    >
                                        <Trash2 className="size-3.5" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default MeetingsPage
