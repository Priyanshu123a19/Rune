// 'use client'

// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { cn } from '@/lib/utils';
// import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
// import {nightOwl} from 'react-syntax-highlighter/dist/esm/styles/prism'
// import React from 'react'

// type Props = {
//     filesReferences: { fileName: string; sourceCode: string; summary: string }[];
// }

// const codeReferences = ({ filesReferences }: Props) => {
//     //over here we will be using the thing to make sure we show the files that are relevant to the ans in a beautiful way
//     const [tab, setTab]=React.useState(filesReferences[0]?.fileName)
//     if(filesReferences.length === 0) return null
//   return (
//     <div className='w-full max-w-[70vh]'>
//       <Tabs value={tab} onValueChange={setTab}>
//           <div className='overflow-scroll flex gap-2 bg-gray-200 p-1 rounded-md'>
//               {filesReferences.map((file) => (
//                 <button key={file.fileName} className={cn(
//                   'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap text-muted-foreground hover:bg-muted',
//                   {
//                     'bg-primary text-primary-foreground': tab === file.fileName
//                   }
//                 )}>
//                 </button>
//                   ))}
//           </div>
         
//           {filesReferences.map((file) => (
//             <TabsContent key={file.fileName} value={file.fileName} className='max-h-[40vh] overflow-scroll max-w-7xl rounded-md'>
//               <SyntaxHighlighter language='typescript' style={nightOwl}>
//                 {file.sourceCode}
//               </SyntaxHighlighter>
//             </TabsContent>
//           ))}
//       </Tabs>
//     </div>
//   )
// }

// export default codeReferences

'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import {atomDark} from 'react-syntax-highlighter/dist/esm/styles/prism'
import React from 'react'

type Props = {
    filesReferences: { fileName: string; sourceCode: string; summary: string }[];
}

const CodeReferences = ({ filesReferences }: Props) => {
    const [tab, setTab] = React.useState(filesReferences[0]?.fileName)
    
    // ✅ Add debugging
    console.log('🔍 Files received:', filesReferences.length, filesReferences.map(f => f.fileName))
    
    if(filesReferences.length === 0) return (
        <div className="p-4 text-center text-gray-500">
            No code references found.
        </div>
    )

    return (
        // ✅ Fix width to match content above
        <div className='w-full max-w-[70vw]'>
            <Tabs value={tab} onValueChange={setTab}>
                {/* ✅ Proper TabsList with TabsTrigger */}
                <TabsList className='w-full justify-start overflow-x-auto flex gap-2 bg-gray-100 p-1 rounded-md h-auto'>
                    {filesReferences.map((file, index) => (
                        <TabsTrigger 
                            key={file.fileName || index} 
                            value={file.fileName}
                            className={cn(
                                'px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                            )}
                        >
                            {/* ✅ Actually show the file name */}
                            {file.fileName}
                        </TabsTrigger>
                    ))}
                </TabsList>
                
                {/* ✅ Fix width and height of content */}
                {filesReferences.map((file, index) => (
                    <TabsContent 
                        key={file.fileName || index} 
                        value={file.fileName} 
                        className='w-full max-h-[50vh] overflow-auto rounded-md mt-4'
                    >
                        {/* ✅ Add file info header */}
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                            <div className="font-semibold text-sm text-gray-800">{file.fileName}</div>
                            <div className="text-xs text-gray-600 mt-1">{file.summary}</div>
                        </div>
                        
                        {/* ✅ Fix SyntaxHighlighter width */}
                        <SyntaxHighlighter 
                            language='typescript' 
                            style={atomDark}
                            customStyle={{
                                margin: 0,
                                borderRadius: '8px',
                                fontSize: '14px',
                                width: '100%',
                                maxWidth: '100%'
                            }}
                            wrapLines={true}
                            wrapLongLines={true}
                        >
                            {file.sourceCode}
                        </SyntaxHighlighter>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}

export default CodeReferences