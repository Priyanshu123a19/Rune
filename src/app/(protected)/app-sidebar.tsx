'use client'

import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import Useproject from "@/hooks/use-project"
import { cn } from "@/lib/utils"
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items =[
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard
    },
    {
        title:"Q&A",
        url: "/qa",
        icon: Bot
    },
    {
        title: "Meetings",
        url: "/meetings",
        icon: Presentation
    },
    {
        title: "Billing",
        url: "/billing",
        icon: CreditCard
    }
]

export function AppSidebar() {
    const pathname = usePathname();
    const {open} = useSidebar();
    //using the custom hook that we made for gettin gthe project
    const {projects, projectId, setProjectId} = Useproject()
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="logo" width={90} height={90} />
            {open && (
                <h1 className="text-4xl font-bold text-primary/80">
                    Rune
                </h1>
            )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
            <SidebarGroupLabel>
                application
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                {items.map(item =>{
                    return(
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                                <Link href={item.url} className={cn({
                                    '!bg-primary !text-white' : pathname===item.url
                                }, 'list-none')}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )
                })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>

        {/* Second side bar group  */}
        <SidebarGroup>
            <SidebarGroupLabel>
                your projects
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {projects?.map((project) => {
                        return(
                            <SidebarMenuButton asChild key={project.name}>
                                <div onClick={() => setProjectId(project.id)}>
                                    <div className={cn(
                                        'rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary',
                                        {
                                            'bg-primary text-white': project.id === projectId
                                        }
                                    )}>
                                        {project.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{project.name}</span>
                                </div>
                            </SidebarMenuButton>
                        )
                    })}
                    <div className="h-2"></div>
                    {open && (
                        <SidebarMenuItem>
                            <Link href='/create'>
                                <Button>
                                    <Plus/>
                                    Create Project
                                </Button>
                            </Link>
                        </SidebarMenuItem>
                    )}
                    </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
                       

export default AppSidebar
