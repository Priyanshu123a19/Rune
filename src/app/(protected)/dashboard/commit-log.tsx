// //this will be the server side component to render the dashboard commits for the currently selected project
// 'use client'

// import Useproject from '@/hooks/use-project'
// import { cn } from '@/lib/utils'
// import { api } from '@/trpc/react'
// import { ExternalLink } from 'lucide-react'
// import Link from 'next/link'
// import React from 'react'

// const CommitLog = () => {
//     const { projectId,project } = Useproject()
//     const {data: commits} = api.project.getCommits.useQuery({ projectId })
//   return (
//     <>
//         <ul className='space-y-6'>
//             {commits?.map((commit,commitIdx)=>{
//                 return <li key={commit.id} className='relative flex gap-x-4'>
//                     <div className={cn(
//                         commitIdx === commits.length -1 ? 'h-6' : '-bottom-8',
//                         'absolute left-0 top-0 flex w-6 justify-center'
//                     )}>
//                             <div className='w-px translate-x-1 bg-gray-200'></div>
//                     </div>
//                     <>
//                         <img src={commit.commitAuthorAvatar} alt='commit avatar' className='relative mt-4 size-8 flex-none rounded-full bg-gray-50'/>
//                         <div className='flex-auto rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200'>
//                             <div  className='flex justify-between gap-x-4'>

//                             <Link target='_blank' href={`${project?.githubUrl}/commits/${commit.commitHash}`} className='py-0.5 text-xs leading-5 text-gray-500'>
//                                 <span className='font-medium text-gray-900'>
//                                     {commit.commitAuthorName}
//                                 </span>{" "}
//                                 <span className='inline-flex items-center'>
//                                     commited
//                                     <ExternalLink className='ml-1 size-4' />
//                                 </span>
//                             </Link>
//                             </div>
//                              <span className='font-semibold'>
//                             {commit.commitMessage}
//                         </span>
//                         <pre className='mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-500'>
//                             {commit.summary}
//                         </pre>
//                         </div>
//                     </>
//                 </li>
//             })}
//         </ul>
//     </>
//   )
// }

// export default CommitLog


'use client'

import { api } from '@/trpc/react';
import Useproject from '@/hooks/use-project';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, GitCommit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CommitLog = () => {
  const { project } = Useproject();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  
  const { data: commits, isLoading, refetch } = api.project.getCommits.useQuery(
    { projectId: project?.id! },
    { 
      enabled: !!project?.id,
      refetchInterval: 60000, // Refetch every minute
    }
  );

  const { mutate: syncCommits } = api.project.syncCommits.useMutation({
    onSuccess: () => {
      refetch();
      setIsManualSyncing(false);
    },
    onError: (error) => {
      console.error('Sync error:', error);
      setIsManualSyncing(false);
    }
  });

  const handleManualSync = () => {
    if (project?.id) {
      setIsManualSyncing(true);
      syncCommits({ projectId: project.id });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Recent Commits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading commits...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          Recent Commits
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleManualSync}
          disabled={isManualSyncing}
        >
          <RefreshCw className={`h-4 w-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
          {isManualSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </CardHeader>
      <CardContent>
        {!commits || commits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No commits found</p>
            <p className="text-sm">Push some code or click "Sync Now" to fetch commits</p>
          </div>
        ) : (
          <div className="space-y-4">
            {commits.map((commit) => (
              <div key={commit.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <img 
                      src={commit.commitAuthorAvatar || '/default-avatar.png'} 
                      alt={commit.commitAuthorName}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <span className="font-medium">{commit.commitAuthorName}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {new Date(commit.commitDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {commit.commitHash.slice(0, 7)}
                  </Badge>
                </div>
                
                <p className="font-mono text-sm mb-3 text-gray-800 bg-gray-50 p-2 rounded">
                  {commit.commitMessage}
                </p>
                
                {commit.summary && (
                  <div className="bg-blue-50 border-l-4 border-blue-200 p-3 rounded">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">AI Summary: </span>
                      {commit.summary}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CommitLog;

// 'use client'

// import { api } from '@/trpc/react';
// import Useproject from '@/hooks/use-project';
// import { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { RefreshCw, GitCommit, ExternalLink } from 'lucide-react';
// import Link from 'next/link';
// import { Badge } from '@/components/ui/badge';

// const CommitLog = () => {
//   const { project } = Useproject();
//   const [isManualSyncing, setIsManualSyncing] = useState(false);

//   const { data: commits, isLoading, refetch } = api.project.getCommits.useQuery(
//     { projectId: project?.id! },
//     {
//       enabled: !!project?.id,
//       refetchInterval: 60000, // Refetch every minute
//     }
//   );

//   const { mutate: syncCommits } = api.project.syncCommits.useMutation({
//     onSuccess: () => {
//       refetch();
//       setIsManualSyncing(false);
//     },
//     onError: (error) => {
//       console.error('Sync error:', error);
//       setIsManualSyncing(false);
//     }
//   });

//   const handleManualSync = () => {
//     if (project?.id) {
//       setIsManualSyncing(true);
//       syncCommits({ projectId: project.id });
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center p-8">
//         <RefreshCw className="h-6 w-6 animate-spin" />
//         <span className="ml-2">Loading commits...</span>
//       </div>
//     );
//   }

//   return (
//     <div>
//       <div className="flex flex-row items-center justify-between mb-4">
//         <div className="flex items-center gap-2">
//           <GitCommit className="h-5 w-5" />
//           <span className="font-semibold text-lg">Recent Commits</span>
//         </div>
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={handleManualSync}
//           disabled={isManualSyncing}
//         >
//           <RefreshCw className={`h-4 w-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
//           {isManualSyncing ? 'Syncing...' : 'Sync Now'}
//         </Button>
//       </div>
//       <ul className="space-y-6">
//         {(!commits || commits.length === 0) ? (
//           <li className="text-center py-8 text-gray-500">
//             <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
//             <p>No commits found</p>
//             <p className="text-sm">Push some code or click "Sync Now" to fetch commits</p>
//           </li>
//         ) : (
//           commits.map((commit, commitIdx) => (
//             <li key={commit.id} className="relative flex gap-x-4">
//               <div className={
//                 commitIdx === commits.length - 1
//                   ? 'h-6'
//                   : '-bottom-8'
//                 + ' absolute left-0 top-0 flex w-6 justify-center'
//               }>
//                 <div className="w-px translate-x-1 bg-gray-200"></div>
//               </div>
//               <>
//                 <img
//                   src={commit.commitAuthorAvatar || '/default-avatar.png'}
//                   alt="commit avatar"
//                   className="relative mt-4 size-8 flex-none rounded-full bg-gray-50"
//                 />
//                 <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200">
//                   <div className="flex justify-between gap-x-4">
//                     <Link
//                       target="_blank"
//                       href={`${project?.githubUrl}/commits/${commit.commitHash}`}
//                       className="py-0.5 text-xs leading-5 text-gray-500"
//                     >
//                       <span className="font-medium text-gray-900">
//                         {commit.commitAuthorName}
//                       </span>{" "}
//                       <span className="inline-flex items-center">
//                         committed
//                         <ExternalLink className="ml-1 size-4" />
//                       </span>
//                     </Link>
//                     <Badge variant="secondary" className="font-mono text-xs">
//                       {commit.commitHash.slice(0, 7)}
//                     </Badge>
//                   </div>
//                   <span className="font-semibold">
//                     {commit.commitMessage}
//                   </span>
//                   <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-500">
//                     {commit.summary}
//                   </pre>
//                 </div>
//               </>
//             </li>
//           ))
//         )}
//       </ul>
//     </div>
//   );
// };

// export default CommitLog;