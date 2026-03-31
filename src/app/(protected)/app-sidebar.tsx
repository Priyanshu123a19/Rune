'use client'

import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar } from "@/components/ui/sidebar"
import Useproject from "@/hooks/use-project"
import { cn } from "@/lib/utils"
import { Activity, Bot, Bug, CreditCard, FlaskConical, GitPullRequest, GraduationCap, Kanban, LayoutDashboard, Plus, Presentation, SearchCode, ShieldAlert, ShieldCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
    { title: "Dashboard",   url: "/dashboard",  icon: LayoutDashboard },
    { title: "Q&A",         url: "/qa",         icon: Bot             },
    { title: "Meetings",    url: "/meetings",    icon: Presentation    },
    { title: "Billing",     url: "/billing",     icon: CreditCard      },
]

const aiItems = [
    { title: "PR Review",         url: "/pr-review",        icon: GitPullRequest },
    { title: "Code Health",       url: "/code-health",      icon: Activity      },
    { title: "Code Review",       url: "/code-review",      icon: ShieldCheck  },
    { title: "Bug Investigation", url: "/bug-investigation", icon: Bug          },
    { title: "Onboarding Path",   url: "/onboarding",       icon: GraduationCap },
    { title: "Test Coverage",     url: "/test-coverage",    icon: FlaskConical  },
    { title: "Sprint Planning",   url: "/sprint-planning",  icon: Kanban        },
    { title: "Code Search",       url: "/semantic-search",       icon: SearchCode   },
    { title: "Vuln Scanner",      url: "/vulnerability-scan",    icon: ShieldAlert  },
]

export function AppSidebar() {
    const pathname    = usePathname()
    const { open }    = useSidebar()
    const { projects, projectId, setProjectId } = Useproject()

    return (
        <Sidebar collapsible="icon" variant="floating" className="border-0">
            {/* Logo */}
            <SidebarHeader className="pb-2">
                <div className="flex items-center gap-2.5 px-1">
                    <div className="shrink-0">
                        <Image src="/logo.png" alt="logo" width={36} height={36} className="rounded-lg" />
                    </div>
                    {open && (
                        <div>
                            <h1 className="text-xl font-bold text-primary leading-none">Rune</h1>
                            <p className="text-[10px] text-gray-400 leading-none mt-0.5">AI Dev Platform</p>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarSeparator />

            <SidebarContent className="py-2">
                {/* Application */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-3">
                        Application
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map(item => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link href={item.url} className={cn(
                                            'list-none rounded-lg transition-all',
                                            pathname === item.url
                                                ? '!bg-primary !text-white shadow-sm'
                                                : 'hover:bg-gray-100 text-gray-600'
                                        )}>
                                            <item.icon className="size-4" />
                                            <span className="font-medium">{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* AI Tools */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-3">
                        AI Tools
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {aiItems.map(item => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link href={item.url} className={cn(
                                            'list-none rounded-lg transition-all',
                                            pathname === item.url
                                                ? '!bg-primary !text-white shadow-sm'
                                                : 'hover:bg-gray-100 text-gray-600'
                                        )}>
                                            <item.icon className="size-4" />
                                            <span className="font-medium">{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* Projects */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-3">
                        Your Projects
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {projects?.map(project => (
                                <SidebarMenuButton asChild key={project.id}>
                                    <div
                                        onClick={() => setProjectId(project.id)}
                                        className="cursor-pointer rounded-lg hover:bg-gray-100 transition-all"
                                    >
                                        <div className={cn(
                                            'rounded-md border size-6 flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                                            project.id === projectId
                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                : 'bg-white text-primary border-gray-200'
                                        )}>
                                            {project.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-700 truncate">{project.name}</span>
                                    </div>
                                </SidebarMenuButton>
                            ))}

                            {open && (
                                <SidebarMenuItem className="mt-1">
                                    <Link href="/create">
                                        <Button size="sm" className="w-full gap-1.5 text-xs">
                                            <Plus className="size-3.5" />
                                            New Project
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
