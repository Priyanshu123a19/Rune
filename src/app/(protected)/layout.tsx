import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { UserButton } from '@clerk/nextjs'
import React from 'react'
import AppSidebar from './app-sidebar'
import { NotificationBell } from '@/components/notification-bell'

type Props = {
    children: React.ReactNode
}

const SidebarLayout = ({ children }: Props) => {
  return (
    <SidebarProvider>
        <AppSidebar/>
      <main className='w-full m-2 flex flex-col gap-2'>
        {/* Top bar */}
        <div className='flex items-center gap-3 border-sidebar-border bg-sidebar border shadow-sm rounded-xl p-2.5 px-4'>
            <SidebarTrigger className='text-gray-400 hover:text-gray-600 transition-colors' />
            <div className='w-px h-5 bg-gray-200' />
            <div className='ml-auto flex items-center gap-3'>
                <NotificationBell />
                <UserButton
                    appearance={{
                        elements: {
                            avatarBox: 'size-8 ring-2 ring-primary/20'
                        }
                    }}
                />
            </div>
        </div>

        {/* Main content */}
        <div className='border-sidebar-border bg-sidebar border shadow-sm rounded-xl overflow-y-auto h-[calc(100vh-5.5rem)] p-1'>
            {children}
        </div>
      </main>
    </SidebarProvider>
  )
}

export default SidebarLayout
