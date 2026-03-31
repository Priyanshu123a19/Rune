'use client'

import Useproject from '@/hooks/use-project'
import { ExternalLink, GitBranch } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import CommitLog from './commit-log'
import AskQuestionCard from './ask-question-card'
import MeetingCard from './meeting-card'
import ArchiveButton from './archiveButton'
import TeamMembers from './team-members'
import dynamic from 'next/dynamic'

const InviteButton = dynamic(() => import('./invite-button'), { ssr: false })

const DashboardPage = () => {
    const { project } = Useproject()

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* Top bar — GitHub link + team controls */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                {/* GitHub banner */}
                <div className="flex items-center gap-3 rounded-xl bg-primary px-4 py-2.5 shadow-sm">
                    <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        <GitBranch className="size-4 text-white" />
                    </div>
                    <p className="text-sm font-medium text-white">
                        Linked to{' '}
                        <Link
                            href={project?.githubUrl ?? ''}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-white/80 hover:text-white underline-offset-2 hover:underline transition-colors"
                        >
                            {project?.githubUrl}
                            <ExternalLink className="size-3.5" />
                        </Link>
                    </p>
                </div>

                {/* Team controls */}
                <div className="flex items-center gap-2">
                    <TeamMembers />
                    <InviteButton />
                    <ArchiveButton />
                </div>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <AskQuestionCard />
                <MeetingCard />
            </div>

            {/* Commit log */}
            <CommitLog />
        </div>
    )
}

export default DashboardPage
