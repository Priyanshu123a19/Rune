'use client'

import Useproject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import {
    Activity, Bug, FileCode, GitCommit, MessageSquare,
    ShieldCheck, FlaskConical, Loader2, CheckCircle,
    AlertTriangle, Link as LinkIcon,
} from 'lucide-react'
import React from 'react'
import Link from 'next/link'

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
    const r    = 54
    const circ = 2 * Math.PI * r
    const offset = circ * (1 - score / 100)

    const color   = score >= 80 ? '#10b981' : score >= 60 ? '#818cf8' : score >= 40 ? '#f59e0b' : '#f87171'
    const glow    = score >= 80 ? '#10b98140' : score >= 60 ? '#818cf840' : score >= 40 ? '#f59e0b40' : '#f8717140'
    const grade   = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 35 ? 'D' : 'F'
    const gradeColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-indigo-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
    const gradeLabel = score >= 90 ? 'Excellent'
        : score >= 75 ? 'Good'
        : score >= 55 ? 'Fair'
        : score >= 35 ? 'Poor'
        : 'Critical'

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <svg width={148} height={148} className="-rotate-90">
                    <circle cx={74} cy={74} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={13} />
                    <circle
                        cx={74} cy={74} r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth={13}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{
                            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)',
                            filter: `drop-shadow(0 0 10px ${glow})`,
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white tabular-nums leading-none">{score}</span>
                    <span className="text-xs text-white/40 font-medium mt-0.5">/ 100</span>
                </div>
            </div>
            <div className={`text-2xl font-black ${gradeColor}`}>
                Grade {grade}
            </div>
            <span className="text-xs text-white/40">{gradeLabel}</span>
        </div>
    )
}

// ─── Pillar Bar ───────────────────────────────────────────────────────────────
function PillarBar({ label, score, trackColor, weight }: {
    label: string; score: number; trackColor: string; weight: string
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-sm text-white/60 font-medium">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-bold tabular-nums">{score}<span className="text-white/30 text-xs font-normal">%</span></span>
                    <span className="text-[10px] text-white/25 border border-white/10 rounded px-1">{weight}</span>
                </div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${trackColor}`}
                    style={{ width: `${score}%`, transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)' }}
                />
            </div>
        </div>
    )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, borderColor }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string; borderColor: string
}) {
    return (
        <div className={`rounded-xl border bg-white p-4 ${borderColor}`}>
            <div className="flex items-center gap-1.5 mb-2">
                {icon}
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{value}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const CodeHealthPage = () => {
    const { projectId } = Useproject()
    const { data, isLoading } = api.project.getCodeHealth.useQuery(
        { projectId },
        { enabled: !!projectId }
    )

    if (isLoading) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex items-center gap-2 text-gray-400 py-24 justify-center">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Loading health metrics…</span>
            </div>
        )
    }

    if (!data) return null

    const totalSev = Object.values(data.severityBreakdown).reduce((a, b) => a + b, 0)
    const coveragePct = data.totalFiles > 0
        ? Math.round(data.testedCount / data.totalFiles * 100)
        : 0

    const gradeDesc = data.overallScore >= 90 ? 'Your codebase is in great shape'
        : data.overallScore >= 75 ? 'Minor improvements recommended'
        : data.overallScore >= 55 ? 'Some areas need attention'
        : data.overallScore >= 35 ? 'Several issues detected'
        : 'Immediate attention needed'

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Activity className="size-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Code Health</h1>
                </div>
                <p className="text-sm text-gray-500">AI-aggregated health metrics across tests, bugs, and code reviews.</p>
            </div>

            {/* ── Hero ── */}
            <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>

                {/* Top accent line */}
                <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                <div className="p-8 flex flex-col sm:flex-row items-center gap-10">
                    {/* Score ring */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                        <ScoreRing score={data.overallScore} />
                        <p className="text-xs text-white/30 text-center mt-1 max-w-[140px] leading-relaxed">
                            {gradeDesc}
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block w-px self-stretch bg-white/10 shrink-0" />

                    {/* Pillar scores */}
                    <div className="flex-1 w-full space-y-5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">
                            Score Breakdown
                        </p>
                        <PillarBar label="Test Coverage"   score={data.testScore}   trackColor="bg-emerald-400" weight="35%" />
                        <PillarBar label="Bug Health"      score={data.bugScore}    trackColor="bg-violet-400"  weight="35%" />
                        <PillarBar label="Review Coverage" score={data.reviewScore} trackColor="bg-sky-400"     weight="30%" />
                    </div>
                </div>

                {/* Bottom accent line */}
                <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            </div>

            {/* ── Stat Strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard
                    icon={<FileCode className="size-3.5 text-indigo-500" />}
                    label="Indexed"
                    value={data.totalFiles}
                    sub="total files"
                    borderColor="border-indigo-100"
                />
                <StatCard
                    icon={<FlaskConical className="size-3.5 text-emerald-500" />}
                    label="Tested"
                    value={data.testedCount}
                    sub={`${coveragePct}% coverage`}
                    borderColor="border-emerald-100"
                />
                <StatCard
                    icon={<Bug className="size-3.5 text-red-400" />}
                    label="Bug Flags"
                    value={data.resolvedBugCount}
                    sub="investigations"
                    borderColor="border-red-100"
                />
                <StatCard
                    icon={<ShieldCheck className="size-3.5 text-violet-500" />}
                    label="Reviews"
                    value={data.reviewCount}
                    sub="commits reviewed"
                    borderColor="border-violet-100"
                />
                <StatCard
                    icon={<GitCommit className="size-3.5 text-sky-500" />}
                    label="Commits"
                    value={data.totalCommits}
                    sub="total"
                    borderColor="border-sky-100"
                />
                <StatCard
                    icon={<MessageSquare className="size-3.5 text-amber-500" />}
                    label="Q&A"
                    value={data.questionCount}
                    sub="questions"
                    borderColor="border-amber-100"
                />
            </div>

            {/* ── File Lists ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Tested files */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="size-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <CheckCircle className="size-3.5 text-emerald-500" />
                        </div>
                        <h2 className="text-sm font-semibold text-gray-800">Files with Tests</h2>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
                            {data.recentTestSuites.length}
                        </span>
                    </div>

                    {data.recentTestSuites.length === 0 ? (
                        <div className="text-center py-10 text-gray-300">
                            <FlaskConical className="size-9 mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-medium text-gray-400">No test suites yet</p>
                            <Link href="/test-coverage" className="text-xs text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
                                Generate tests <LinkIcon className="size-3" />
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {data.recentTestSuites.map((t, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <FileCode className="size-3.5 text-gray-300 shrink-0" />
                                    <span className="text-xs text-gray-700 font-mono truncate flex-1">
                                        {t.fileName.split('/').pop() ?? t.fileName}
                                    </span>
                                    {t.framework && (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                                            {t.framework}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Flagged files */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="size-7 rounded-lg bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="size-3.5 text-red-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-gray-800">Flagged in Bug Reports</h2>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
                            {data.flaggedFiles.length}
                        </span>
                    </div>

                    {data.flaggedFiles.length === 0 ? (
                        <div className="text-center py-10">
                            <Bug className="size-9 mx-auto mb-2 opacity-20 text-gray-400" />
                            <p className="text-xs font-medium text-gray-400">No bug flags — looking clean!</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {data.flaggedFiles.map((f, i) => (
                                <div key={i} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <Bug className="size-3.5 text-red-300 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-700 font-mono font-medium truncate">
                                            {f.file.split('/').pop() || f.file}
                                        </p>
                                        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Review Severity ── */}
            {data.reviewCount > 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="size-7 rounded-lg bg-violet-50 flex items-center justify-center">
                            <ShieldCheck className="size-3.5 text-violet-500" />
                        </div>
                        <h2 className="text-sm font-semibold text-gray-800">Review Severity Distribution</h2>
                        <span className="ml-auto text-xs text-gray-400">{data.reviewCount} reviews</span>
                    </div>

                    <div className="space-y-3 mb-6">
                        {([
                            { key: 'LOW',      label: 'Low',      track: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                            { key: 'MEDIUM',   label: 'Medium',   track: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-600 border-amber-200'       },
                            { key: 'HIGH',     label: 'High',     track: 'bg-orange-400',  pill: 'bg-orange-50 text-orange-600 border-orange-200'     },
                            { key: 'CRITICAL', label: 'Critical', track: 'bg-red-500',     pill: 'bg-red-50 text-red-600 border-red-200'             },
                        ] as const).map(({ key, label, track, pill }) => {
                            const count = data.severityBreakdown[key]
                            const pct   = totalSev > 0 ? Math.round(count / totalSev * 100) : 0
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold w-14 shrink-0 ${pill.split(' ')[1]}`}>{label}</span>
                                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${track}`}
                                            style={{ width: `${pct}%`, transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)' }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500 w-5 text-right tabular-nums shrink-0">{count}</span>
                                    <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded-full w-9 text-center tabular-nums shrink-0 ${pill}`}>
                                        {pct}%
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Recent reviews list */}
                    {data.recentReviews.length > 0 && (
                        <div className="border-t border-gray-100 pt-4 space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Reviews</p>
                            {data.recentReviews.map((r, i) => {
                                const badge =
                                    r.severity === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-200'
                                    : r.severity === 'HIGH'   ? 'bg-orange-50 text-orange-600 border-orange-200'
                                    : r.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                return (
                                    <div key={i} className="flex items-center gap-2.5 text-xs">
                                        <span className={`border text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge}`}>
                                            {r.severity}
                                        </span>
                                        <span className="text-gray-500 truncate">{r.commitMessage || 'Unnamed commit'}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
                    <ShieldCheck className="size-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">No code reviews yet</p>
                    <p className="text-xs text-gray-300 mt-1">Run code reviews on commits to see severity trends here.</p>
                    <Link href="/code-review" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
                        Start reviewing <LinkIcon className="size-3" />
                    </Link>
                </div>
            )}
        </div>
    )
}

export default CodeHealthPage
