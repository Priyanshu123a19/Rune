'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import Useproject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import AskQuestionCard from '../dashboard/ask-question-card'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from '../dashboard/code-referances'
import { MessageSquare, Calendar, BookOpen } from 'lucide-react'

const QApage = () => {
  const { projectId } = Useproject()
  const { data: questions } = api.project.getQuestions.useQuery({ projectId })

  const [questionIndex, setQuestionIndex] = React.useState(0)
  const question = questions?.[questionIndex]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Q&A</h1>
        </div>
        <p className="text-sm text-gray-500">Ask questions about your codebase and save answers for your team.</p>
      </div>

      {/* Ask question card */}
      <Sheet>
        <AskQuestionCard />

        {/* Saved questions */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Saved Questions
              {questions && questions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                  ({questions.length})
                </span>
              )}
            </h2>
          </div>

          {!questions?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
              <MessageSquare className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No saved questions yet</p>
              <p className="text-xs mt-1">Ask a question above and save the answer to share with your team.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, index) => (
                <React.Fragment key={q.id}>
                  <SheetTrigger
                    className="w-full text-left"
                    onClick={() => setQuestionIndex(index)}
                  >
                    <div className="flex items-start gap-3 bg-white rounded-xl p-4 border border-gray-200 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                      <img
                        src={q.user.imageUrl ?? ''}
                        alt={q.user.firstName ?? ''}
                        className="size-8 rounded-full shrink-0 ring-2 ring-gray-100 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors">
                            {q.question}
                          </p>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(q.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                  </SheetTrigger>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>

        {/* Sheet panel */}
        {question && (
          <SheetContent className="sm:max-w-[90vw] flex flex-col max-h-screen">
            <SheetHeader className="shrink-0 border-b pb-4">
              <div className="flex items-start gap-3">
                <img
                  src={question.user.imageUrl ?? ''}
                  alt=""
                  className="size-8 rounded-full shrink-0 ring-2 ring-gray-100 mt-0.5"
                />
                <SheetTitle className="text-left leading-snug">{question.question}</SheetTitle>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-auto py-5 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Answer</h3>
                <div className="max-h-[42vh] overflow-auto rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <MDEditor.Markdown source={question.answer} />
                </div>
              </div>

              {(() => {
                let fileRefs: { fileName: string; sourceCode: string; summary: string }[] = []
                try {
                  if (question.filesReferences) {
                    if (typeof question.filesReferences === 'string') {
                      fileRefs = JSON.parse(question.filesReferences)
                    } else if (Array.isArray(question.filesReferences)) {
                      fileRefs = question.filesReferences as any
                    }
                  }
                } catch { fileRefs = [] }

                return fileRefs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Code References</h3>
                    <div className="rounded-xl border border-gray-200 p-4 bg-white">
                      <CodeReferences filesReferences={fileRefs} />
                    </div>
                  </div>
                )
              })()}
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

export default QApage
