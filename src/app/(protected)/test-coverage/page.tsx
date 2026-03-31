'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FlaskConical, Loader2, Copy, Check, ChevronDown, ChevronRight,
  FileCode, Sparkles, Search, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
    >
      {copied ? <><Check className="size-3.5" />Copied!</> : <><Copy className="size-3.5" />Copy</>}
    </button>
  )
}

// ─── Framework badge ──────────────────────────────────────────────────────────

function FrameworkBadge({ fw }: { fw: string }) {
  const colors: Record<string, string> = {
    'React Component (Testing Library)': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Next.js API Route':                 'bg-orange-50 text-orange-700 border-orange-200',
    'tRPC Router':                       'bg-violet-50 text-violet-700 border-violet-200',
    'TypeScript Utility':                'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <Badge variant="outline" className={`text-xs ${colors[fw] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {fw}
    </Badge>
  )
}

// ─── Suite Row ────────────────────────────────────────────────────────────────

type Suite = {
  id: string; fileName: string; framework: string; summary: string
  testCode: string; status: string; createdAt: Date
}

function SuiteRow({ suite }: { suite: Suite }) {
  const [open, setOpen] = useState(false)
  const isDone    = suite.status === 'COMPLETED'
  const isFailed  = suite.status === 'FAILED'
  const isRunning = suite.status === 'GENERATING'

  // Poll while generating
  api.project.getTestSuiteById.useQuery(
    { suiteId: suite.id },
    { enabled: isRunning, refetchInterval: isRunning ? 3000 : false }
  )

  const testLines = suite.testCode ? suite.testCode.split('\n') : []

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => isDone && setOpen(o => !o)}
        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${isDone ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
      >
        <span className="mt-0.5 shrink-0">
          {isRunning
            ? <Loader2 className="size-4 animate-spin text-primary" />
            : isFailed
              ? <AlertCircle className="size-4 text-red-400" />
              : open
                ? <ChevronDown  className="size-4 text-gray-400" />
                : <ChevronRight className="size-4 text-gray-400" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FileCode className="size-3.5 text-gray-400 shrink-0" />
            <span className="text-sm font-mono font-semibold text-gray-800 truncate">{suite.fileName}</span>
          </div>
          <p className="text-xs text-gray-500">
            {isRunning
              ? <span className="text-primary animate-pulse">Generating tests…</span>
              : suite.summary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{new Date(suite.createdAt).toLocaleDateString()}</span>
          {suite.framework && <FrameworkBadge fw={suite.framework} />}
          <Badge variant="outline" className={`text-xs ${
            isDone   ? 'bg-green-50 text-green-700 border-green-200' :
            isFailed ? 'bg-red-50 text-red-700 border-red-200' :
                       'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isRunning ? <><Clock className="size-3 mr-1" />Generating</> : isDone ? <><CheckCircle2 className="size-3 mr-1" />Done</> : 'Failed'}
          </Badge>
        </div>
      </button>

      {open && isDone && suite.testCode && (
        <div className="border-t border-gray-100">
          {/* Code header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
            <span className="text-xs text-gray-400 font-mono">
              {suite.fileName.replace(/\.(ts|tsx)$/, '.test.$1').replace(/^.*\//, '')}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{testLines.length} lines</span>
              <CopyButton text={suite.testCode} />
            </div>
          </div>
          {/* Code body */}
          <div className="bg-gray-950 overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="text-xs w-full">
              <tbody>
                {testLines.map((line, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="select-none text-right text-gray-600 pl-4 pr-3 py-0 w-10 font-mono text-[11px] leading-5">
                      {i + 1}
                    </td>
                    <td className="font-mono text-gray-200 pr-4 leading-5 whitespace-pre">
                      {colorize(line)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && isFailed && (
        <div className="border-t border-red-100 p-4 bg-red-50">
          <p className="text-sm text-red-700">{suite.summary || 'Generation failed.'}</p>
        </div>
      )}
    </div>
  )
}

// ─── Minimal syntax highlight ─────────────────────────────────────────────────

function colorize(line: string): React.ReactNode {
  const keyword = /\b(import|from|export|const|let|var|function|async|await|return|if|else|for|of|in|new|throw|try|catch|describe|it|test|expect|beforeEach|afterEach|jest|vi)\b/g
  const string  = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g
  const comment = /(\/\/.*$)/

  if (comment.test(line)) {
    return <span className="text-gray-500">{line}</span>
  }

  const parts: React.ReactNode[] = []
  let last = 0
  const pattern = /(\b(?:import|from|export|const|let|var|function|async|await|return|if|else|for|of|in|new|throw|try|catch|describe|it|test|expect|beforeEach|afterEach|jest|vi)\b|["'`](?:[^"'`\\]|\\.)*["'`])/g
  let m: RegExpExecArray | null

  while ((m = pattern.exec(line)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{line.slice(last, m.index)}</span>)
    const tok = m[0]!
    if (/^["'`]/.test(tok))  parts.push(<span key={m.index} className="text-amber-300">{tok}</span>)
    else                      parts.push(<span key={m.index} className="text-violet-400">{tok}</span>)
    last = m.index + tok.length
  }
  if (last < line.length) parts.push(<span key={last}>{line.slice(last)}</span>)
  return <>{parts}</>
}

// ─── File autocomplete ────────────────────────────────────────────────────────

function FileSearch({
  projectId,
  value,
  onChange,
  disabled,
}: {
  projectId: string; value: string; onChange: (v: string) => void; disabled: boolean
}) {
  const [query, setQuery]       = useState(value)
  const [showDrop, setShowDrop] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: results } = api.project.searchIndexedFiles.useQuery(
    { projectId, query },
    { enabled: query.length >= 2 }
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
        <Input
          placeholder="Type a file path, e.g. src/lib/auth.ts"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setShowDrop(true) }}
          onFocus={() => query.length >= 2 && setShowDrop(true)}
          className="pl-9 font-mono text-sm"
          disabled={disabled}
        />
      </div>
      {showDrop && results && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map(r => (
            <button
              key={r.fileName}
              className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-primary/5 text-gray-700 hover:text-primary transition-colors flex items-center gap-2"
              onClick={() => { setQuery(r.fileName); onChange(r.fileName); setShowDrop(false) }}
            >
              <FileCode className="size-3.5 text-gray-400 shrink-0" />
              {r.fileName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestCoveragePage() {
  const { project } = Useproject()
  const utils = api.useUtils()
  const [fileName, setFileName]       = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: suites, isLoading } = api.project.getTestSuites.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id, refetchInterval: 8000 }
  )

  const { mutate: generate } = api.project.generateTestSuite.useMutation({
    onMutate:  () => setIsSubmitting(true),
    onSuccess: () => {
      setIsSubmitting(false)
      setFileName('')
      toast.success('Generating tests — results appear below in ~20s')
      void utils.project.getTestSuites.invalidate({ projectId: project?.id })
    },
    onError: err => {
      setIsSubmitting(false)
      toast.error(err.message || 'Failed to generate tests')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project?.id || fileName.trim().length < 2) return
    generate({ projectId: project.id, fileName: fileName.trim() })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FlaskConical className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Test Coverage Agent</h1>
          </div>
          <p className="text-sm text-gray-500">
            Pick any indexed file — the agent reads it and generates ready-to-paste Jest/Vitest tests.
          </p>
        </div>
        {suites && suites.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {suites.length} suite{suites.length !== 1 ? 's' : ''} generated
          </Badge>
        )}
      </div>

      {/* Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-700">Generate Tests for a File</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              File path <span className="font-normal text-gray-400">(start typing to see indexed files)</span>
            </label>
            {project?.id && (
              <FileSearch
                projectId={project.id}
                value={fileName}
                onChange={setFileName}
                disabled={isSubmitting}
              />
            )}
          </div>
          <Button type="submit" disabled={isSubmitting || fileName.trim().length < 2}>
            {isSubmitting
              ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating…</>
              : <><FlaskConical className="size-4 mr-2" />Generate Tests</>}
          </Button>
        </form>

        {/* Info strip */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500 flex flex-wrap gap-4">
          {[
            { label: 'React components', hint: '@testing-library/react' },
            { label: 'Next.js API routes', hint: 'fetch mocks + auth mocks' },
            { label: 'tRPC routers',      hint: 'createCaller + mock ctx' },
            { label: 'Utility functions', hint: 'pure Jest + jest.mock()' },
          ].map(({ label, hint }) => (
            <span key={label}><span className="font-medium text-gray-700">{label}</span> → {hint}</span>
          ))}
        </div>
      </div>

      {/* Results */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Generated Test Suites</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !suites?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
            <FlaskConical className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No tests generated yet</p>
            <p className="text-xs mt-1">Search for a file above and click Generate.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suites.map(s => <SuiteRow key={s.id} suite={s as Suite} />)}
          </div>
        )}
      </section>
    </div>
  )
}
