'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { Bell, BugPlay, FlaskConical, GitPullRequest, GraduationCap, Kanban, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
    PR_REVIEW:         { icon: <GitPullRequest className="size-3.5" />, color: 'text-violet-500' },
    CODE_REVIEW:       { icon: <ShieldCheck className="size-3.5" />,    color: 'text-blue-500'   },
    BUG_INVESTIGATION: { icon: <BugPlay className="size-3.5" />,        color: 'text-red-500'    },
    TEST_SUITE:        { icon: <FlaskConical className="size-3.5" />,   color: 'text-emerald-500'},
    SPRINT_PLAN:       { icon: <Kanban className="size-3.5" />,         color: 'text-amber-500'  },
    ONBOARDING:        { icon: <GraduationCap className="size-3.5" />,  color: 'text-sky-500'    },
    VULN_SCAN:         { icon: <ShieldAlert className="size-3.5" />,    color: 'text-orange-500' },
    MEETING:           { icon: <Bell className="size-3.5" />,           color: 'text-pink-500'   },
}

function timeAgo(date: Date | string): string {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60)   return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
}

export function NotificationBell() {
    const { projectId } = Useproject()
    const router        = useRouter()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const { data: notifications = [], refetch } = api.project.getNotifications.useQuery(
        { projectId },
        { enabled: !!projectId, refetchInterval: 10_000 }
    )
    const markRead    = api.project.markNotificationRead.useMutation({ onSuccess: () => void refetch() })
    const markAllRead = api.project.markAllNotificationsRead.useMutation({ onSuccess: () => void refetch() })

    const unread = notifications.filter(n => !n.read).length

    // Close on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    function handleClick(n: typeof notifications[0]) {
        markRead.mutate({ id: n.id })
        setOpen(false)
        router.push(n.url || '/')
    }

    return (
        <div ref={ref} className="relative">
            {/* Bell button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'relative flex items-center justify-center size-8 rounded-lg transition-colors',
                    open ? 'bg-gray-100' : 'hover:bg-gray-100'
                )}
            >
                <Bell className="size-4 text-gray-500" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary text-white text-[10px] font-bold px-1 leading-none">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">Notifications</span>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button
                                    onClick={() => markAllRead.mutate({ projectId })}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-sm text-gray-400">
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(n => {
                                const meta = TYPE_META[n.type] ?? TYPE_META['MEETING']!
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleClick(n)}
                                        className={cn(
                                            'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3',
                                            !n.read && 'bg-primary/5'
                                        )}
                                    >
                                        {/* Icon */}
                                        <div className={cn(
                                            'mt-0.5 size-7 rounded-lg flex items-center justify-center shrink-0 bg-gray-100',
                                            meta.color
                                        )}>
                                            {meta.icon}
                                        </div>
                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={cn('text-sm font-medium truncate', !n.read ? 'text-gray-900' : 'text-gray-600')}>
                                                    {n.title}
                                                </p>
                                                {!n.read && <span className="size-2 rounded-full bg-primary shrink-0" />}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                                            <p className="text-[11px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
