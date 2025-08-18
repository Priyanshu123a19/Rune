// 'use client'
// import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
// import Useproject from '@/hooks/use-project';
// import { api } from '@/trpc/react';
// import React from 'react'
// import AskQuestionCard from '../dashboard/ask-question-card';
// import MDEditor from '@uiw/react-md-editor';
// import CodeReferences from '../dashboard/code-referances';

// const QApage = () => {
//   //now here we will be gettin the current project id using the function call
//   const {projectId} = Useproject();
//   const {data: questions} = api.project.getQuestions.useQuery({ projectId });

//   const [questionIndex, setQuestionIndex] = React.useState(0)
//   const question = questions?.[questionIndex];

//   return (
//     <Sheet>
//       <AskQuestionCard />
//         <div className='h-4'></div>
//         <h1 className='text-xl font-semibold'>Saved questions</h1>
//         <div className='h-2'></div>
//         <div className='flex flex-col gap-2'>
//           {questions?.map((question,index) => {
//               return <React.Fragment key={question.id}>
//                 <SheetTrigger onClick={() => setQuestionIndex(index)}>
//                   <div className='flex items-center gap-4 bg-white rounded-lg p-4 shadow border'>
//                     <img className='rounded-full' height={30} width={30} src={question.user.imageUrl ?? ""}/>

//                     <div className='text-left flex flex-col'>
//                       <div className='flex items-center gap-2'>
//                         <p className='text-gray-700 line-clamp-1 text-lg font-medium'>
//                           {question.question}
//                         </p>
//                         <span className='text-xs text-grey-400 whitespace-nowrap'>
//                           {new Date(question.createdAt).toLocaleDateString()}
//                         </span>
//                       </div>
//                       <p className='text-grey-500 line-clamp-1 text-sm'>
//                         {question.answer} 
//                       </p>
//                     </div>
//                   </div>
//                 </SheetTrigger>
//               </React.Fragment>
//           })}
//         </div>

//         {question && (
//           <SheetContent className='sm:max-w-[80vw]'>
//             <SheetHeader>
//               <SheetTitle>
//                 {question.question}
//               </SheetTitle>
//               <MDEditor.Markdown source={question.answer} />
//               <CodeReferences filesReferences={(question.filesReferences ?? []) as any} />
//             </SheetHeader>
//           </SheetContent>
//         )}
//     </Sheet>
//   )
// }

// export default QApage

'use client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Useproject from '@/hooks/use-project';
import { api } from '@/trpc/react';
import React from 'react'
import AskQuestionCard from '../dashboard/ask-question-card';
import MDEditor from '@uiw/react-md-editor';
import CodeReferences from '../dashboard/code-referances';

const QApage = () => {
  const {projectId} = Useproject();
  const {data: questions} = api.project.getQuestions.useQuery({ projectId });

  const [questionIndex, setQuestionIndex] = React.useState(0)
  const question = questions?.[questionIndex];

  return (
    <Sheet>
      <AskQuestionCard />
        <div className='h-4'></div>
        <h1 className='text-xl font-semibold'>Saved questions</h1>
        <div className='h-2'></div>
        <div className='flex flex-col gap-2'>
          {questions?.map((question,index) => {
              return <React.Fragment key={question.id}>
                <SheetTrigger onClick={() => setQuestionIndex(index)}>
                  <div className='flex items-center gap-4 bg-white rounded-lg p-4 shadow border'>
                    <img className='rounded-full' height={30} width={30} src={question.user.imageUrl ?? ""}/>

                    <div className='text-left flex flex-col'>
                      <div className='flex items-center gap-2'>
                        <p className='text-gray-700 line-clamp-1 text-lg font-medium'>
                          {question.question}
                        </p>
                        <span className='text-xs text-grey-400 whitespace-nowrap'>
                          {new Date(question.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className='text-grey-500 line-clamp-1 text-sm'>
                        {question.answer} 
                      </p>
                    </div>
                  </div>
                </SheetTrigger>
              </React.Fragment>
          })}
        </div>

        {question && (
          <SheetContent className='sm:max-w-[90vw] flex flex-col max-h-screen'>
            <SheetHeader className='flex-shrink-0 border-b pb-4'>
              <SheetTitle className='text-left'>
                {question.question}
              </SheetTitle>
            </SheetHeader>
            
            {/* ✅ Scrollable content area */}
            <div className='flex-1 overflow-auto py-4 space-y-6'>
              {/* ✅ Answer section */}
              <div>
                <h3 className='font-semibold mb-2 text-lg'>Answer:</h3>
                <div className='max-h-[40vh] overflow-auto border rounded-lg p-4 bg-gray-50'>
                  <MDEditor.Markdown source={question.answer} />
                </div>
              </div>
              
              {/* ✅ File references section with proper type checking */}
              {(() => {
                // Parse the filesReferences JSON and type check
                let fileRefs: { fileName: string; sourceCode: string; summary: string }[] = [];
                
                try {
                  if (question.filesReferences) {
                    if (typeof question.filesReferences === 'string') {
                      fileRefs = JSON.parse(question.filesReferences);
                    } else if (Array.isArray(question.filesReferences)) {
                      fileRefs = question.filesReferences as any;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing file references:', error);
                  fileRefs = [];
                }

                return fileRefs && fileRefs.length > 0 && (
                  <div>
                    <h3 className='font-semibold mb-2 text-lg'>Code References:</h3>
                    <div className='border rounded-lg p-4 bg-white'>
                      <CodeReferences filesReferences={fileRefs} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </SheetContent>
        )}
    </Sheet>
  )
}

export default QApage