'use client'
import MDEditor from '@uiw/react-md-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import Useproject from '@/hooks/use-project'
import React, { useState } from 'react'
import Image from "next/image";
import { askQuestion } from './actions'
import {readStreamableValue} from 'ai/rsc'
import CodeReferences from './code-referances'
import { api } from '@/trpc/react'
import { toast } from 'sonner'
import useRefetch from '@/hooks/use-refetch'

interface AskQuestionCardProps {
    children?: React.ReactNode;
}

const AskQuestionCard = ({ children }: AskQuestionCardProps) => {
    const {project}=Useproject()
    const [open, setopen]=useState(false)
    const [question, setQuestion] = useState('')
    const [loading, setLoading] = useState(false)
    const [answer, setAnswer] = useState('')
    const [fileReferences, setFileReferences]= React.useState<{ fileName: string; sourceCode: string; summary: string}[]>([])
    const saveAnswer = api.project.saveAnswer.useMutation();

    const onSubmit = async(e: React.FormEvent<HTMLFormElement>)=>{
        setAnswer('')
        setFileReferences([])
        e.preventDefault()
        if(!project?.id) return 
        setLoading(true)    
        //grabbing the response from the ai 
        const {output, fileReferences} = await askQuestion(question, project.id)
        setopen(true)
        setFileReferences(fileReferences)

        for await(const delta of readStreamableValue(output)){
            if(delta){
                setAnswer(ans => ans + delta)
            }
        }
        setLoading(false)
    }

    const refetch= useRefetch()
  return (
    <>
    {/* <Dialog open={open} onOpenChange={setopen}>
        <DialogContent className='sm:max-w-[80vw]'>
            <DialogHeader>
            <DialogTitle>
                <Image src="/logo.png" alt="Rune" width={40} height={40} />
            </DialogTitle>
        </DialogHeader>

        <MDEditor.Markdown source={answer} className='max-w-[70vw] !h-full max-h-[40vh] overflow-scroll'/>
        <div className='h-4'></div>
        <CodeReferences filesReferences={fileReferences} />
        <Button type='button' onClick={()=>{setopen(false)}}>
            close
        </Button>
        </DialogContent>
    </Dialog> */}

    <Dialog open={open} onOpenChange={setopen}>
    {/* ✅ Increase dialog width */}
    <DialogContent className='sm:max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
            <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
                <Image src="/logo.png" alt="Rune" width={40} height={40} />
                AI Assistant
            </DialogTitle>
            <Button disabled={saveAnswer.isPending} variant="outline" onClick={() =>
                saveAnswer.mutate({
                    projectId: project!.id,
                    question,
                    answer,
                    filesReferances: fileReferences
                },{
                    onSuccess: () => {
                        toast.success('Answer saved successfully!')
                        refetch()
                    },
                    onError: (error) => {
                        toast.error('Failed to save answer.')
                        console.error(error)
                    }
                })
            }>
                Save answer
            </Button>
            </div>
        </DialogHeader>

        {/* ✅ Make content responsive and scrollable */}
        <div className="flex-1 overflow-auto">
            <MDEditor.Markdown 
                source={answer} 
                className='w-full max-h-[40vh] overflow-auto mb-4'
            />
            
            {/* ✅ Full width for code references */}
            <div className="w-full">
                <CodeReferences filesReferences={fileReferences} />
            </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t">
            <Button type='button' onClick={() => setopen(false)}>
                Close
            </Button>
        </div>
    </DialogContent>
</Dialog>
    <Card className='relative col-span-3'>
        <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
        </CardHeader>
        <CardContent>
            <form onSubmit={onSubmit}>
                <Textarea placeholder='which file should i edit to change the home page?' value={question} onChange={(e) => setQuestion(e.target.value)} />
                <div className='h-4'></div>
                    <Button type='submit' disabled={loading}>
                        Ask Rune!
                    </Button>
            </form>
        </CardContent>
    </Card>
    </>
  )
}

export default AskQuestionCard