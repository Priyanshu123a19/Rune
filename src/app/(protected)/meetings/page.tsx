'use client'

import Useproject from '@/hooks/use-project';
import { api } from '@/trpc/react';
import React from 'react'
import MeetingCard from '../dashboard/meeting-card';
import { divider } from '@uiw/react-md-editor';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import useRefetch from '@/hooks/use-refetch';

const MeetingsPage = () => {
    const {projectId} = Useproject();
    const {data: meetings,isLoading} = api.project.getMeetings.useQuery({projectId},{
        refetchInterval: 4000
    });
    const deleteMeeting = api.project.deleteMeeting.useMutation();
    const refetch = useRefetch();

  return (
    <>
    <MeetingCard />
    <div className='h-6'>
        <h1 className='text-xl font-semibold'>Meetings</h1>
        {meetings && meetings.length ===0 && <div>No meetings scheduled</div>}
        {isLoading && <div>Loading meetings...</div>}
        <ul className='divide-y divide-gray-200'>
            {meetings?.map(meeting=>(
                <li key={meeting.id} className='flex items-center justify-between py-5 gap-x-6'>
                    <div>
                        <div className='min-w-0'>
                            <div className='flex items-center gap-2'>
                                <Link href={`/meetings/${meeting.id}`} className='text-sm font-semibold'>
                                    {meeting.name}
                                </Link>
                                {meeting.status==="PROCESSING" && 
                                <Badge className='bg-yellow-500 text-white'>
                                    Processing
                                </Badge>
                                }
                            </div>
                        </div>

                        <div className='flex items-center text-xs text-grey-500 gap-x-2'>
                            <p className='whitespace-nowrap'>
                                {meeting.createdAt.toLocaleString()}
                            </p>
                            <p className='truncate'>{meeting.issues.length} issues</p>

                        </div>
                    </div>

                    <div className='flex items-center flex-none gap-x-4'>
                        <Link href={`/meetings/${meeting.id}`} >
                        <Button variant='outline' >
                            view Meeting
                        </Button>
                        </Link>
                        <Button disabled={deleteMeeting.isPending} variant='destructive' onClick={()=> deleteMeeting.mutate({meetingId: meeting.id} , {onSuccess: () => {
                            toast.success('Meeting deleted successfully');
                            refetch();
                        }, onError: () => {
                            toast.error('Failed to delete meeting');
                        }})}>Delete Meeting</Button>
                    </div>
                </li>
            ))}

        </ul>
    </div>
    </>
  )
}

export default MeetingsPage;