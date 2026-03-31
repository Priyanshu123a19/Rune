'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Bug, Loader2, ChevronDown, ChevronRight,
  Search, FileCode, GitCommit, TextSearch,
  MapPin, Lightbulb, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ReActStep } from '@/lib/bug-investigation-agent'

// ─── Tool icon ────────────────────────────────────────────────────────────────

function ToolIcon({ tool }: { tool: string }) {
  const t = tool.toLowerCase()
  if (t === 'search_embeddings')   return <Search     className="size-3.5 text-blue-500" />
  if (t === 'read_file')           return <FileCode   className="size-3.5 text-purple-500" />
  if (t === 'get_commit_history')  return <GitCommit  className="size-3.5 text-orange-500" />
  if (t === 'grep_codebase')       return <TextSearch className="size-3.5 text-green-500" />
  return null
}

// ─── Investigation Row ────────────────────────────────────────────────────────

type Investigation = {
  id: string; bugDescription: string; status: string
  rootCause: string; fixLocation: string; suggestedFix: string
  steps: unknown; createdAt: Date
}

function InvestigationRow({ inv }: { inv: Investigation }) {
  const [open, setOpen] = useState(false)
  const steps     = (inv.steps as ReActStep[]) ?? []
  const isDone    = inv.status === 'COMPLETED'
  const isFailed  = inv.status === 'FAILED'
  const isRunning = inv.status === 'INVESTIGATING'

  api.project.getBugInvestigationById.useQuery(
    { investigationId: inv.id },
    { enabled: isRunning, refetchInterval: isRunning ? 4000 : false }
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => !isRunning && setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="mt-0.5 shrink-0">
          {isRunning
            ? <Loader2 className="size-4 animate-spin text-primary" />
            : open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{inv.bugDescription}</p>
          {isDone && inv.rootCause && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-1">{inv.rootCause}</p>
          )}
          {isRunning && (
            <p className="mt-1 text-xs text-primary animate-pulse">
              Agent investigating… ({steps.length} step{steps.length !== 1 ? 's' : ''} so far)
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">
            {new Date(inv.createdAt).toLocaleDateString()}
          </span>
          <Badge variant="outline" className={`text-xs ${
            isDone   ? 'bg-green-50 text-green-700 border-green-200' :
            isFailed ? 'bg-red-50 text-red-700 border-red-200' :
                       'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isRunning ? 'Investigating…' : isDone ? 'Completed' : 'Failed'}
          </Badge>
        </div>
      </button>

      {open && !isRunning && (
        <div className="border-t border-gray-100">
          {inv.rootCause && (
            <div className="p-4 bg-red-50 border-b border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="size-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">Root Cause</span>
              </div>
              <p className="text-sm text-red-800">{inv.rootCause}</p>
            </div>
          )}
          {inv.fixLocation && (
            <div className="p-4 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="size-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">Fix Location</span>
              </div>
              <p className="text-sm font-mono text-orange-800">{inv.fixLocation}</p>
            </div>
          )}
          {inv.suggestedFix && (
            <div className="p-4 bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="size-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Suggested Fix</span>
              </div>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{inv.suggestedFix}</p>
            </div>
          )}
          {steps.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Investigation Trace ({steps.length} steps)
              </p>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="text-xs space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 font-mono font-bold text-gray-300 w-5 text-right">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        <p className="font-medium text-gray-500 mb-0.5 text-xs">💭 Thought</p>
                        <p className="text-gray-700">{step.thought}</p>
                      </div>
                    </div>
                    {step.action && (
                      <div className="ml-7 flex items-start gap-2 bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                        <ToolIcon tool={step.action} />
                        <div>
                          <span className="font-semibold text-blue-700">{step.action}</span>
                          <span className="text-blue-400 ml-1">({step.actionInput})</span>
                        </div>
                      </div>
                    )}
                    {step.observation && (
                      <div className="ml-7 bg-gray-100 rounded-lg p-2.5 border border-gray-200 max-h-36 overflow-y-auto">
                        <p className="font-medium text-gray-400 mb-0.5 text-xs">👁 Observation</p>
                        <pre className="whitespace-pre-wrap text-gray-600 leading-relaxed">{step.observation}</pre>
                      </div>
                    )}
                    {step.isFinal && (
                      <div className="ml-7 flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="size-3.5" />
                        <span className="font-medium">Conclusion reached</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BugInvestigationPage() {
  const { project } = Useproject()
  const utils = api.useUtils()

  const [bugDescription, setBugDescription] = useState('')
  const [fileName, setFileName]             = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)

  const { data: investigations, isLoading } = api.project.getBugInvestigations.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 8000 }
  )

  const { mutate: startInvestigation } = api.project.startBugInvestigation.useMutation({
    onMutate:  () => setIsSubmitting(true),
    onSuccess: () => {
      setIsSubmitting(false)
      setBugDescription('')
      setFileName('')
      toast.success('Investigation started — agent is tracing the bug…')
      void utils.project.getBugInvestigations.invalidate({ projectId: project?.id })
    },
    onError: (err) => {
      setIsSubmitting(false)
      toast.error(err.message || 'Failed to start investigation')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project?.id || bugDescription.trim().length < 10) return
    startInvestigation({
      projectId:      project.id,
      bugDescription: bugDescription.trim(),
      fileName:       fileName.trim() || undefined,
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bug className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Bug Investigation Agent</h1>
          </div>
          <p className="text-sm text-gray-500">
            Describe a bug — the ReAct agent traces through your codebase to find the exact root cause.
          </p>
        </div>
        {investigations && investigations.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {investigations.length} investigation{investigations.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Start New Investigation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Suspected file <span className="font-normal text-gray-400">(optional — anchors the agent)</span>
            </label>
            <Input
              placeholder="e.g. src/lib/auth.ts or api/users/route.ts"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              className="text-sm font-mono"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Bug description</label>
            <Textarea
              placeholder={'e.g. "The /execute endpoint uses eval() which allows arbitrary code execution from user input"\n\nor: "Users can see other users\' private data in the /users endpoint"'}
              value={bugDescription}
              onChange={e => setBugDescription(e.target.value)}
              rows={4}
              className="resize-none text-sm"
              disabled={isSubmitting}
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || bugDescription.trim().length < 10}
          >
            {isSubmitting
              ? <><Loader2 className="size-4 mr-2 animate-spin" />Starting…</>
              : <><Bug className="size-4 mr-2" />Investigate Bug</>}
          </Button>
        </form>
      </div>

      {/* Results */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Past Investigations</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !investigations?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
            <Bug className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No investigations yet</p>
            <p className="text-xs mt-1">Describe a bug above and the agent will trace it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {investigations.map(inv => (
              <InvestigationRow key={inv.id} inv={inv as Investigation} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
