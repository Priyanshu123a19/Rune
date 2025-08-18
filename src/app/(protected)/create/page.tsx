'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useRefetch from '@/hooks/use-refetch'
import { api } from '@/trpc/react'
import { Info } from 'lucide-react'
import Image from 'next/image'
import { required } from 'node_modules/zod/v4/core/util.cjs'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormInput={
    repoUrl: string,
    projectName: string,
    githubToken?: string
}

const Createpage = () => {
    const { register, handleSubmit, reset } = useForm<FormInput>()
    //getting the api endpoint over here
    const checkCredits = api.project.checkCredits.useMutation();
    const createProject = api.project.createProject.useMutation();
    const refetch = useRefetch();


    function onSubmit(data: FormInput) {
        if(!!checkCredits.data){
            createProject.mutate(
                {
                    githubUrl: data.repoUrl,
                    name: data.projectName,
                    githubToken: data.githubToken
                }, {
                    onSuccess: () => {
                        toast.success('Project created successfully!');
                        //after successful creation, we want to refetch the user data
                        //so we use this refetch hook that is doing the same thing as invalidateQueries of tanstack query
                        refetch();
                        reset();
                    },
                    onError: (error) => {
                        toast.error(`Error creating project: ${error.message}`);
                    }
                }
            );
        }else{
            checkCredits.mutate({
                githubUrl: data.repoUrl,
                githubToken: data.githubToken
            });
        }
    }
const hasEnoughCredits = checkCredits?.data?.userCredits  ?  checkCredits.data.fileCount <= checkCredits.data.userCredits : true;

  return (
    <div className='flex items-center gap-12 h-full justify-center'>
<Image src="/undrow_github.png" alt="GitHub Icon" height={200} width={200}/>
        {/* <img src="/undrow_github.svg" className="h-99 w-auto" /> */}
        <div>
            <div>
                <h1 className='font-semibold text-2xl'>
                    Link your GitHub repository
                </h1>
                <p className='text-sm text-muted-foreground'>
                    enter the url of your repository to link it to Rune
                </p>
            </div>
            <div className='h-4'></div>
            <div>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Input
                        {...register('projectName',{required:true})}
                        placeholder='Enter your project name'
                        required
                    />
                    <div className='h-2'></div>
                    <Input
                        {...register('repoUrl',{required:true})}
                        placeholder='Enter your repository URL'
                        type='url'
                    />
                    <div className='h-2'></div>
                    <Input
                        {...register('githubToken')}
                        placeholder='Github Token (optional)'
                    />
                    {!!checkCredits.data && (
                        <>
                        <div className='mt-4 bg-orange-50 px-4 rounded-md border border-orange-200 text-orange-700'>
                            <div className='flex items-center gap-2'>
                                <Info className='size-4' />
                                <p className='text-sm'>you will be charged <strong>{checkCredits.data?.fileCount}</strong> credits for this repository.</p>
                            </div>
                        <p className='text-sm text-blue-600 ml-6'>you have <strong>{checkCredits.data?.userCredits}</strong> credits available.</p>
                        </div>
                        </>
                    )}
                    <div className='h-4'></div>
                    <Button type="submit" disabled= {createProject.isPending || checkCredits.isPending || !hasEnoughCredits}>
                        {!!checkCredits.data ? 'Create Project' : 'Check Credits'}
                    </Button>
                </form>
            </div>
        </div>
    </div>
  )
}

export default Createpage