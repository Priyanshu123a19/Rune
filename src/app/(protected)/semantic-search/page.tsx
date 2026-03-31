'use client'

import { api } from '@/trpc/react'
import Useproject from '@/hooks/use-project'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  SearchCode, Loader2, FileCode, ChevronDown, ChevronRight,
  Layers, Sliders, Sparkles, Copy, Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchResult = {
  id:         string
  fileName:   string
  summary:    string
  sourceCode: string
  similarity: number
}

// ─── Similarity bar ───────────────────────────────────────────────────────────

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 60 ? 'bg-blue-500'  :
    pct >= 45 ? 'bg-yellow-400' : 'bg-gray-300'

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${
        pct >= 80 ? 'text-green-600' :
        pct >= 60 ? 'text-blue-600'  :
        pct >= 45 ? 'text-yellow-600' : 'text-gray-400'
      }`}>{pct}%</span>
    </div>
  )
}

// ─── File icon by extension ───────────────────────────────────────────────────

function FileIcon({ fileName }: { fileName: string }) {
  const base = fileName.split('#')[0] ?? fileName
  const ext  = base.split('.').pop() ?? ''
  const colors: Record<string, string> = {
    ts: 'text-blue-600', tsx: 'text-cyan-600',
    js: 'text-yellow-500', jsx: 'text-yellow-400',
    prisma: 'text-purple-600', md: 'text-gray-500',
    json: 'text-orange-400', css: 'text-pink-500',
  }
  return <FileCode className={`size-4 shrink-0 ${colors[ext] ?? 'text-gray-400'}`} />
}

// ─── Summary parser ───────────────────────────────────────────────────────────
// The new structured summary has TYPE:, EXPORTS:, FUNCTIONS:, etc.

function StructuredSummary({ summary }: { summary: string }) {
  if (!summary.includes('TYPE:') && !summary.includes('EXPORTS:')) {
    return <p className="text-xs text-gray-500 leading-relaxed">{summary}</p>
  }

  const lines = summary.split('\n').filter(Boolean)
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) return <p key={i} className="text-xs text-gray-500">{line}</p>
        const label = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()
        const labelColor: Record<string, string> = {
          TYPE: 'text-purple-600', EXPORTS: 'text-blue-600',
          FUNCTIONS: 'text-green-600', DEPENDENCIES: 'text-orange-500',
          PURPOSE: 'text-gray-700',
        }
        return (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className={`font-bold shrink-0 ${labelColor[label] ?? 'text-gray-500'}`}>{label}:</span>
            <span className="text-gray-600">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Code snippet ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all"
    >
      {copied ? <><Check className="size-3" />Copied</> : <><Copy className="size-3" />Copy</>}
    </button>
  )
}

function CodeSnippet({ code, query }: { code: string; query: string }) {
  const lines = code.split('\n')

  // Find lines containing query terms (best-effort highlight anchor)
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  let startLine = 0
  for (let i = 0; i < lines.length; i++) {
    if (terms.some(t => lines[i]!.toLowerCase().includes(t))) {
      startLine = Math.max(0, i - 2)
      break
    }
  }

  const snippet  = lines.slice(startLine, startLine + 18)
  const codeText = snippet.join('\n')

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-500 font-mono">
          {startLine > 0 ? `lines ${startLine + 1}–${startLine + snippet.length}` : `first ${snippet.length} lines`}
        </span>
        <CopyButton text={codeText} />
      </div>
      <div className="bg-gray-950 overflow-x-auto max-h-52">
        <table className="text-xs w-full">
          <tbody>
            {snippet.map((line, i) => {
              const lineNum    = startLine + i + 1
              const hasMatch   = terms.some(t => line.toLowerCase().includes(t))
              return (
                <tr key={i} className={hasMatch ? 'bg-primary/10' : 'hover:bg-white/[0.02]'}>
                  <td className="select-none text-right text-gray-600 pl-3 pr-2.5 w-9 font-mono text-[11px] leading-5 shrink-0">
                    {lineNum}
                  </td>
                  <td className="font-mono text-gray-300 pr-3 leading-5 whitespace-pre">
                    {hasMatch
                      ? <HighlightedLine line={line} terms={terms} />
                      : line || ' '}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HighlightedLine({ line, terms }: { line: string; terms: string[] }) {
  if (!line) return <span> </span>
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts   = line.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        terms.some(t => part.toLowerCase() === t)
          ? <mark key={i} className="bg-primary/40 text-white rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ result, query, rank }: { result: SearchResult; query: string; rank: number }) {
  const [open, setOpen] = useState(false)

  // Separate file path from chunk anchor (e.g. "src/lib/auth.ts#validateToken")
  const [filePath, chunkAnchor] = result.fileName.split('#') as [string, string | undefined]
  const baseFile  = filePath ?? result.fileName

  return (
    <div className={`rounded-xl border bg-white overflow-hidden shadow-sm transition-all ${open ? 'border-primary/30 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Rank badge */}
        <span className="shrink-0 mt-0.5 size-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          {/* File name row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FileIcon fileName={result.fileName} />
            <span className="text-sm font-mono font-semibold text-gray-800 truncate">{baseFile}</span>
            {chunkAnchor && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 font-mono">
                #{chunkAnchor}
              </Badge>
            )}
          </div>
          {/* Summary preview */}
          <div className="ml-0.5">
            <StructuredSummary summary={result.summary} />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <SimilarityBar score={result.similarity} />
          {open
            ? <ChevronDown  className="size-4 text-gray-400" />
            : <ChevronRight className="size-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded code snippet */}
      {open && (
        <div className="border-t border-gray-100 p-4">
          <CodeSnippet code={result.sourceCode} query={query} />
        </div>
      )}
    </div>
  )
}

// ─── Threshold slider ─────────────────────────────────────────────────────────

function ThresholdSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label =
    value >= 0.75 ? 'Very strict — exact matches only'  :
    value >= 0.55 ? 'Strict — closely related results'  :
    value >= 0.40 ? 'Balanced — recommended'             :
                    'Loose — broad results'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600 flex items-center gap-1.5">
          <Sliders className="size-3.5" /> Similarity threshold
        </span>
        <span className="text-primary font-bold tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min={15} max={90} step={5}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-gray-200"
      />
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SemanticSearchPage() {
  const { project } = Useproject()

  const [query,       setQuery]       = useState('')
  const [debouncedQ,  setDebouncedQ]  = useState('')
  const [threshold,   setThreshold]   = useState(0.40)
  const [fileTypeFilter, setFileType] = useState('all')
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce — fire search 600ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(query)
      if (query.length >= 2) setHasSearched(true)
    }, 600)
    return () => clearTimeout(t)
  }, [query])

  const { data: fileTypes } = api.project.getIndexedFileTypes.useQuery(
    { projectId: project?.id! },
    { enabled: !!project?.id }
  )

  const { mutate: search, data: rawResults, isPending } = api.project.semanticSearch.useMutation()

  // Re-run search whenever debounced query or threshold changes
  useEffect(() => {
    if (!project?.id || debouncedQ.length < 2) return
    search({ projectId: project.id, query: debouncedQ, threshold, limit: 15 })
  }, [debouncedQ, threshold, project?.id])

  // Client-side file type filter
  const results: SearchResult[] = (rawResults ?? []).filter(r => {
    if (fileTypeFilter === 'all') return true
    const base = r.fileName.split('#')[0] ?? r.fileName
    return base.endsWith(`.${fileTypeFilter}`)
  })

  const totalIndexed = fileTypes?.length ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SearchCode className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Semantic Code Search</h1>
        </div>
        <p className="text-sm text-gray-500">
          Search your codebase by meaning, not just keywords — powered by pgvector embeddings.
        </p>
      </div>

      {/* Search box */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
        {/* Input */}
        <div className="relative">
          <SearchCode className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          {isPending && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='e.g. "user authentication JWT", "database query", "error handling middleware"'
            className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            autoFocus
          />
        </div>

        {/* Threshold slider */}
        <ThresholdSlider value={threshold} onChange={v => setThreshold(v)} />

        {/* File type filter */}
        {fileTypes && fileTypes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
              <Layers className="size-3.5" /> Filter by file type
            </p>
            <div className="flex flex-wrap gap-2">
              {['all', ...fileTypes].map(ext => (
                <button
                  key={ext}
                  onClick={() => setFileType(ext)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    fileTypeFilter === ext
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                  }`}
                >
                  {ext === 'all' ? `All types` : `.${ext}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          <SearchCode className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Start typing to search</p>
          <p className="text-xs mt-1">Results update automatically as you type</p>
          {totalIndexed > 0 && (
            <p className="text-xs mt-3 text-primary/60">{totalIndexed} file type{totalIndexed !== 1 ? 's' : ''} indexed</p>
          )}
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-3 justify-center py-10 text-gray-400">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-sm">Searching…</span>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
          <Sparkles className="size-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No matches found</p>
          <p className="text-xs mt-1">Try lowering the similarity threshold or rephrasing your query</p>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {results.length} result{results.length !== 1 ? 's' : ''}
              {fileTypeFilter !== 'all' && ` · .${fileTypeFilter} only`}
            </h2>
            <span className="text-xs text-gray-400">
              Threshold: {Math.round(threshold * 100)}% similarity
            </span>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <ResultCard key={r.id} result={r} query={debouncedQ} rank={i + 1} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
