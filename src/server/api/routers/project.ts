import { pollCommits } from "@/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import z from "zod";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { TRPCError } from "@trpc/server";
import { runCodeReviewAgent } from "@/lib/code-review-agent";
import { runBugInvestigationAgent } from "@/lib/bug-investigation-agent";
import { runOnboardingAgent } from "@/lib/onboarding-agent";
import { runTestCoverageAgent } from "@/lib/test-coverage-agent";
import { runSprintPlanningAgent } from "@/lib/sprint-planning-agent"
import { runVulnerabilityScanner } from "@/lib/vulnerability-scanner";
import { generateEmbedding } from "@/lib/gemini";
import { runPrReviewAgent } from "@/lib/pr-review-agent";
import { octokit } from "@/lib/github";
// createTRPCRouter: Creates a tRPC router to group related API endpoints.
// createProject: This is a mutation endpoint (for creating a project).
// protectedProcedure: Ensures only authenticated users can call this endpoint.
// .input(): (Currently empty) — normally, you’d define a schema for the expected input here.
// .mutation(async ({ ctx, input }) => { ... }): Defines the mutation logic.
// ctx: Context object, usually contains user/session info.
// input: The data sent from the client (none defined yet).
// ctx.user.userId: Accesses the authenticated user's ID (but doesn’t use it yet).
// console.log('hi'): Logs "hi" to the server console.
// return true: Returns true as a response.

//!just like the tenstack query  here also we define the function that will be used in the basic functionality like getting the users , getting the commits we have defined it here so we can use them whenever we want



export const projectRouter = createTRPCRouter({
    createProject: protectedProcedure.input(
        //over here we are accepting the project details from the user
        //direclty use zod over here for the type saefty
        z.object({
            name: z.string(),
            githubUrl: z.string(),
            githubToken: z.string().optional()
        })
        //on to this side we start doing the mutation over here and make sure that the data is processed correctly
    ).mutation(async({ ctx, input }) => {
        const user = await ctx.db.user.findUnique({
            where: {
                id: ctx.user.userId!
            },
            select: {
                credits: true
            }
        })
        if(!user){
            throw new Error('User not found');
        }

        const currentCredits = user.credits|| 0;
        const fileCount=await checkCredits(input.githubUrl, input.githubToken);

        if(currentCredits<fileCount){
            throw new Error('Insufficient credits');
        }

       //making the project pushed into the database
       const project = await ctx.db.project.create({
        data: {
            githubUrl: input.githubUrl,
            name: input.name,
            userToProjects: {
                create: {
                    userId: ctx.user.userId!,
                }
            }
        }
       })
       //this function now called sot that we can also embedd the files of the repo as embeddings in the database
       await indexGithubRepo(project.id, input.githubUrl, input.githubToken)
       await pollCommits(project.id)
       //decrementing the user credits after the creation of the project
       await ctx.db.user.update({
           where: {
               id: ctx.user.userId!
           },
           data: {
               credits: { decrement: fileCount }
           }
       })
       return project;
    }),

    //over here we are making the hook that helps us fetch the project details that belong to one user
    getProjects: protectedProcedure.query(async ({ ctx }) => {
       const projects = await ctx.db.project.findMany({
           where: {
               userToProjects: {
                   some: {
                       userId: ctx.user.userId!
                   }
               },
               //this makes sure that the project has not been deleted
               deletedAt: null
           }
       })
       return projects;
    }),
    //this one will help us with fetching all the commits for a specific project
    // getCommits: protectedProcedure.input(z.object({
    //     projectId: z.string()
    // })).query(async ({ ctx, input }) => {
    //     pollCommits(input.projectId).then().catch(console.error)
    //     return await ctx.db.commit.findMany({
    //         where: {
    //             projectId: input.projectId
    //         }
    //     })
    // }),

    getCommits: protectedProcedure
  .input(z.object({
    projectId: z.string()
  }))
  .query(async ({ ctx, input }) => {
    return await ctx.db.commit.findMany({
      where: {
        projectId: input.projectId
      },
      orderBy: {
        commitDate: 'desc'
      },
      take: 50 // Limit to last 50 commits
    });
  }),

  syncCommits: protectedProcedure
  .input(z.object({
    projectId: z.string()
  }))
  .mutation(async ({ ctx, input }) => {
    try {
      // Use your existing pollCommits function
      await pollCommits(input.projectId);
      return { success: true, message: 'Commits synced successfully' };
    } catch (error) {
      console.error('Manual sync error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to sync commits'
      });
    }
  }),

    //route will help to save the users currently asked ai questino to our database and make sure thay can access and see prev asked question

    saveAnswer: protectedProcedure.input(z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(),
        filesReferances: z.any()
    })).mutation(async ({ ctx, input }) => {
        await ctx.db.question.create({
            data: {
                projectId: input.projectId,
                question: input.question,
                userId: ctx.user.userId!,
                answer: input.answer,
                filesReferences: input.filesReferances
            }
        })
    }),

    //this route will fetcht the specific qustion that we want to access in the qa part
    getQuestions: protectedProcedure.input(z.object({
        projectId: z.string()})).query(async ({ ctx, input }) => {
            return await ctx.db.question.findMany({
                where: {
                    projectId: input.projectId
                },
                include: {
                    user: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        }),

        uploadMeeting: protectedProcedure.input(z.object({
            projectId: z.string(),
            name: z.string(),
            meetingUrl: z.string()
        })).mutation(async ({ ctx, input }) => {
            const meeting= await ctx.db.meeting.create({
                data: {
                    projectId: input.projectId,
                    name: input.name,
                    meetingUrl: input.meetingUrl,
                    status: "PROCESSING"
                }
            })
            return meeting;
        }),

        getMeetings: protectedProcedure.input(z.object({
            projectId: z.string()
        })).query(async ({ ctx, input }) => {
            return await ctx.db.meeting.findMany({
                where: {
                    projectId: input.projectId,
                },
                include: { issues: true }
            })
        }),

        deleteMeeting: protectedProcedure.input(z.object({
            meetingId: z.string()
        })).mutation(async ({ ctx, input }) => {
            await ctx.db.meeting.delete({
                where: {
                    id: input.meetingId
                }
            })
        }),

        getMeetingById: protectedProcedure.input(z.object({
            meetingId: z.string()
        })).query(async ({ ctx, input }) => {
            return await ctx.db.meeting.findUnique({
                where: {
                    id: input.meetingId
                },
                include: { issues: true }
            })
        }),

        archiveProject: protectedProcedure.input(z.object({
            projectId: z.string()
        })).mutation(async ({ ctx, input }) => {
            await ctx.db.project.update({
                where: {
                    id: input.projectId
                },
                data: {
                    deletedAt: new Date()
                }
            })
        }),

        getTeamMembers: protectedProcedure.input(z.object({
            projectId: z.string()
        })).query(async ({ ctx, input }) => {
            return await ctx.db.userToProject.findMany({
                where: {
                    projectId: input.projectId
                },
                include: {
                    user: true
                }
            })
        }),

        getMyCredits: protectedProcedure.query(async ({ ctx }) => {
            return await ctx.db.user.findUnique({where: {id: ctx.user.userId!}, select: {credits: true}})
        }),
        checkCredits: protectedProcedure.input(z.object({
            githubUrl: z.string(),
            githubToken: z.string().optional()
        })).mutation(async ({ ctx, input }) => {
            const fileCount = await checkCredits(input.githubUrl, input.githubToken);
            const userCredits = await ctx.db.user.findUnique({where: {id: ctx.user.userId!}, select: {credits: true}});
            return {fileCount, userCredits: userCredits?.credits || 0};
        }),

        getCodeReviews: protectedProcedure.input(z.object({
            projectId: z.string()
        })).query(async ({ ctx, input }) => {
            return await ctx.db.codeReview.findMany({
                where: { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
        }),

        // ─── Bug Investigation ──────────────────────────────────────
        startBugInvestigation: protectedProcedure.input(z.object({
            projectId:      z.string(),
            bugDescription: z.string().min(10),
            fileName:       z.string().optional(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            });
            if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

            // Create the investigation record upfront (INVESTIGATING status)
            const investigation = await ctx.db.bugInvestigation.create({
                data: {
                    projectId:      input.projectId,
                    bugDescription: input.bugDescription,
                    status:         'INVESTIGATING',
                },
            });

            // Fire and forget — agent runs in background
            void runBugInvestigationAgent({
                investigationId: investigation.id,
                projectId:       input.projectId,
                githubUrl:       project.githubUrl,
                bugDescription:  input.bugDescription,
                fileName:        input.fileName,
            });

            return { investigationId: investigation.id };
        }),

        getBugInvestigations: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.bugInvestigation.findMany({
                where:   { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    15,
            });
        }),

        getBugInvestigationById: protectedProcedure.input(z.object({
            investigationId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.bugInvestigation.findUnique({
                where: { id: input.investigationId },
            });
        }),

        // ─── Onboarding Plan ────────────────────────────────────────
        generateOnboardingPlan: protectedProcedure.input(z.object({
            projectId:  z.string(),
            role:       z.enum(['frontend', 'backend', 'fullstack', 'devops']),
            experience: z.enum(['junior', 'mid', 'senior']),
            background: z.string().min(5),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })

            // Upsert: one plan per user per project (regenerate overwrites)
            const existing = await ctx.db.onboardingPlan.findFirst({
                where: { projectId: input.projectId, userId: ctx.user.userId! },
            })

            const plan = existing
                ? await ctx.db.onboardingPlan.update({
                    where: { id: existing.id },
                    data: {
                        role: input.role, experience: input.experience,
                        background: input.background, status: 'GENERATING',
                        codebaseAnalysis: '', learningPath: [], milestones: {}, summary: '',
                    },
                  })
                : await ctx.db.onboardingPlan.create({
                    data: {
                        projectId:  input.projectId,
                        userId:     ctx.user.userId!,
                        role:       input.role,
                        experience: input.experience,
                        background: input.background,
                        status:     'GENERATING',
                    },
                  })

            void runOnboardingAgent({
                planId:     plan.id,
                projectId:  input.projectId,
                userId:     ctx.user.userId!,
                role:       input.role,
                experience: input.experience,
                background: input.background,
            })

            return { planId: plan.id }
        }),

        getOnboardingPlan: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.onboardingPlan.findFirst({
                where:   { projectId: input.projectId, userId: ctx.user.userId! },
                orderBy: { createdAt: 'desc' },
            })
        }),

        // ─── Sprint Planning ─────────────────────────────────────────
        generateSprintPlan: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })

            const plan = await ctx.db.sprintPlan.create({
                data: {
                    projectId: input.projectId,
                    userId:    ctx.user.userId!,
                    status:    'GENERATING',
                },
            })

            void runSprintPlanningAgent({
                planId:    plan.id,
                projectId: input.projectId,
                githubUrl: project.githubUrl,
            })

            return { planId: plan.id }
        }),

        getSprintPlans: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.sprintPlan.findMany({
                where:   { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    5,
            })
        }),

        getSprintPlanById: protectedProcedure.input(z.object({
            planId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.sprintPlan.findUnique({
                where: { id: input.planId },
            })
        }),

        // ─── Code Review ────────────────────────────────────────────
        runCodeReview: protectedProcedure.input(z.object({
            projectId:     z.string(),
            commitHash:    z.string(),
            commitMessage: z.string(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where: { id: input.projectId },
                select: { githubUrl: true }
            });
            if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

            // Check if a review already exists for this commit
            const existing = await ctx.db.codeReview.findFirst({
                where: { projectId: input.projectId, commitHash: input.commitHash }
            });
            if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Review already exists for this commit' });

            // Fire-and-forget — agent runs in background, card auto-polls every 30s
            void runCodeReviewAgent({
                projectId:     input.projectId,
                commitHash:    input.commitHash,
                commitMessage: input.commitMessage,
                githubUrl:     project.githubUrl,
            });

            return { success: true };
        }),

        // ─── Test Coverage ───────────────────────────────────────────
        generateTestSuite: protectedProcedure.input(z.object({
            projectId: z.string(),
            fileName:  z.string().min(2),
        })).mutation(async ({ ctx, input }) => {
            const suite = await ctx.db.testSuite.create({
                data: {
                    projectId: input.projectId,
                    fileName:  input.fileName,
                    status:    'GENERATING',
                },
            })

            void runTestCoverageAgent({
                suiteId:   suite.id,
                projectId: input.projectId,
                fileName:  input.fileName,
            })

            return { suiteId: suite.id }
        }),

        getTestSuites: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.testSuite.findMany({
                where:   { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    20,
            })
        }),

        getTestSuiteById: protectedProcedure.input(z.object({
            suiteId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.testSuite.findUnique({
                where: { id: input.suiteId },
            })
        }),

        searchIndexedFiles: protectedProcedure.input(z.object({
            projectId: z.string(),
            query:     z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.sourceCodeEmbedding.findMany({
                where: {
                    projectId: input.projectId,
                    fileName:  { contains: input.query, mode: 'insensitive' },
                },
                select: { fileName: true },
                take: 8,
            })
        }),

        // ─── Semantic Search ─────────────────────────────────────────
        semanticSearch: protectedProcedure.input(z.object({
            projectId: z.string(),
            query:     z.string().min(2),
            threshold: z.number().min(0.1).max(0.99).default(0.4),
            limit:     z.number().min(1).max(25).default(12),
        })).mutation(async ({ ctx, input }) => {
            const embedding = await generateEmbedding(input.query)

            type Row = {
                id:         string
                fileName:   string
                summary:    string
                sourceCode: string
                similarity: number
            }

            const results = await ctx.db.$queryRaw<Row[]>`
                SELECT
                    id,
                    "fileName",
                    "summary",
                    "sourceCode",
                    1 - ("summaryEmbedding" <=> ${embedding}::vector) AS similarity
                FROM "sourceCodeEmbedding"
                WHERE
                    "projectId" = ${input.projectId}
                    AND "summaryEmbedding" IS NOT NULL
                    AND 1 - ("summaryEmbedding" <=> ${embedding}::vector) >= ${input.threshold}
                ORDER BY similarity DESC
                LIMIT ${input.limit}
            `

            return results.map(r => ({
                ...r,
                similarity: Number(r.similarity),
            }))
        }),

        getIndexedFileTypes: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            const files = await ctx.db.sourceCodeEmbedding.findMany({
                where:  { projectId: input.projectId },
                select: { fileName: true },
            })
            // Extract unique extensions (handle chunk IDs like "src/auth.ts#fn")
            const exts = new Set<string>()
            for (const { fileName } of files) {
                const base = fileName.split('#')[0] ?? fileName
                const ext  = base.split('.').pop()
                if (ext && ext.length <= 5) exts.add(ext)
            }
            return [...exts].sort()
        }),

        // ─── PR Review ──────────────────────────────────────────────
        getOpenPRs: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

            const parts = project.githubUrl.replace('https://github.com/', '').split('/')
            const owner = parts[0]!
            const repo  = parts[1]!

            try {
                const { data } = await octokit.rest.pulls.list({
                    owner, repo, state: 'open', per_page: 15,
                })
                return data.map(pr => ({
                    number:    pr.number,
                    title:     pr.title,
                    user:      pr.user?.login ?? '',
                    userAvatar: pr.user?.avatar_url ?? '',
                    url:       pr.html_url,
                    headSha:   pr.head.sha,
                    headRef:   pr.head.ref,
                    baseRef:   pr.base.ref,
                    createdAt: pr.created_at,
                    draft:     pr.draft ?? false,
                    labels:    pr.labels.map(l => ({ name: l.name ?? '', color: l.color ?? '' })),
                }))
            } catch {
                return []
            }
        }),

        startPrReview: protectedProcedure.input(z.object({
            projectId: z.string(),
            prNumber:  z.number(),
            prTitle:   z.string(),
            prUrl:     z.string(),
            prHeadSha: z.string(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

            // Prevent duplicate in-flight reviews
            const existing = await ctx.db.prReview.findFirst({
                where: { projectId: input.projectId, prNumber: input.prNumber, status: 'REVIEWING' },
            })
            if (existing) return { reviewId: existing.id }

            const review = await ctx.db.prReview.create({
                data: {
                    projectId: input.projectId,
                    prNumber:  input.prNumber,
                    prTitle:   input.prTitle,
                    prUrl:     input.prUrl,
                    status:    'REVIEWING',
                },
            })

            void runPrReviewAgent({
                reviewId:  review.id,
                projectId: input.projectId,
                githubUrl: project.githubUrl,
                prNumber:  input.prNumber,
                prHeadSha: input.prHeadSha,
            })

            return { reviewId: review.id }
        }),

        getPrReviews: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.prReview.findMany({
                where:   { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    20,
            })
        }),

        getPrReviewById: protectedProcedure.input(z.object({
            reviewId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.prReview.findUnique({ where: { id: input.reviewId } })
        }),

        // ─── Meeting Issue → GitHub Issue ────────────────────────────
        createGithubIssue: protectedProcedure.input(z.object({
            projectId: z.string(),
            issueId:   z.string(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

            const issue = await ctx.db.issue.findUnique({ where: { id: input.issueId } })
            if (!issue) throw new TRPCError({ code: 'NOT_FOUND' })

            // Already created — return existing URL
            if (issue.githubIssueUrl) return { url: issue.githubIssueUrl }

            const parts = project.githubUrl.replace('https://github.com/', '').split('/')
            const owner = parts[0]!
            const repo  = parts[1]!

            const { data } = await octokit.rest.issues.create({
                owner, repo,
                title: `[Meeting] ${issue.gist}`,
                body:  `## Action Item\n\n${issue.headline}\n\n## Summary\n\n${issue.summary}\n\n**Timestamp:** ${issue.start} – ${issue.end}\n\n---\n*Created from Rune meeting notes*`,
            })

            await ctx.db.issue.update({
                where: { id: input.issueId },
                data:  { githubIssueUrl: data.html_url },
            })

            return { url: data.html_url }
        }),

        // ─── Vulnerability Scanner ───────────────────────────────────
        startVulnerabilityScan: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).mutation(async ({ ctx, input }) => {
            const project = await ctx.db.project.findUnique({
                where:  { id: input.projectId },
                select: { githubUrl: true },
            })
            if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

            const scan = await ctx.db.vulnerabilityScan.create({
                data: { projectId: input.projectId, status: 'SCANNING' },
            })

            void runVulnerabilityScanner({
                scanId:    scan.id,
                projectId: input.projectId,
                githubUrl: project.githubUrl,
            })

            return { scanId: scan.id }
        }),

        getVulnerabilityScans: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.vulnerabilityScan.findMany({
                where:   { projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    10,
            })
        }),

        getVulnerabilityScanById: protectedProcedure.input(z.object({
            scanId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.vulnerabilityScan.findUnique({ where: { id: input.scanId } })
        }),

        // ─── Notifications ───────────────────────────────────────────
        getNotifications: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            return await ctx.db.notification.findMany({
                where:   { userId: ctx.user.userId!, projectId: input.projectId },
                orderBy: { createdAt: 'desc' },
                take:    30,
            })
        }),

        markNotificationRead: protectedProcedure.input(z.object({
            id: z.string(),
        })).mutation(async ({ ctx, input }) => {
            await ctx.db.notification.update({
                where: { id: input.id },
                data:  { read: true },
            })
        }),

        markAllNotificationsRead: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).mutation(async ({ ctx, input }) => {
            await ctx.db.notification.updateMany({
                where: { userId: ctx.user.userId!, projectId: input.projectId, read: false },
                data:  { read: true },
            })
        }),

        // ─── Code Health Dashboard ───────────────────────────────────
        getCodeHealth: protectedProcedure.input(z.object({
            projectId: z.string(),
        })).query(async ({ ctx, input }) => {
            const [allFiles, testSuites, bugInvestigations, codeReviews, totalCommits, questionCount] = await Promise.all([
                ctx.db.sourceCodeEmbedding.findMany({
                    where:  { projectId: input.projectId },
                    select: { fileName: true },
                }),
                ctx.db.testSuite.findMany({
                    where:   { projectId: input.projectId },
                    select:  { fileName: true, framework: true, status: true },
                    orderBy: { createdAt: 'desc' },
                }),
                ctx.db.bugInvestigation.findMany({
                    where:   { projectId: input.projectId },
                    select:  { fixLocation: true, bugDescription: true, status: true },
                    orderBy: { createdAt: 'desc' },
                }),
                ctx.db.codeReview.findMany({
                    where:   { projectId: input.projectId },
                    select:  { overallSeverity: true, commitMessage: true },
                    orderBy: { createdAt: 'desc' },
                }),
                ctx.db.commit.count({ where: { projectId: input.projectId } }),
                ctx.db.question.count({ where: { projectId: input.projectId } }),
            ])

            const uniqueFileSet = new Set(allFiles.map(f => f.fileName.split('#')[0] ?? f.fileName))
            const totalFiles = uniqueFileSet.size

            const completedSuites = testSuites.filter(t => t.status === 'COMPLETED')
            const testedFileSet = new Set(completedSuites.map(t => t.fileName.split('#')[0] ?? t.fileName))
            const testedCount = testedFileSet.size
            const testScore = totalFiles > 0
                ? Math.min(Math.round((testedCount / totalFiles) * 500), 100)
                : 50

            const resolvedBugs = bugInvestigations.filter(b => b.status === 'COMPLETED' && b.fixLocation?.trim())
            const bugScore = Math.max(0, 100 - resolvedBugs.length * 15)

            const reviewScore = totalCommits > 0
                ? Math.min(Math.round((codeReviews.length / totalCommits) * 400), 100)
                : 50

            const overallScore = Math.round(testScore * 0.35 + bugScore * 0.35 + reviewScore * 0.30)

            const severityBreakdown = {
                LOW:      codeReviews.filter(r => r.overallSeverity === 'LOW').length,
                MEDIUM:   codeReviews.filter(r => r.overallSeverity === 'MEDIUM').length,
                HIGH:     codeReviews.filter(r => r.overallSeverity === 'HIGH').length,
                CRITICAL: codeReviews.filter(r => r.overallSeverity === 'CRITICAL').length,
            }

            return {
                overallScore,
                testScore,
                bugScore,
                reviewScore,
                totalFiles,
                testedCount,
                resolvedBugCount: resolvedBugs.length,
                reviewCount:      codeReviews.length,
                totalCommits,
                questionCount,
                severityBreakdown,
                flaggedFiles: resolvedBugs
                    .filter(b => b.fixLocation?.trim())
                    .map(b => ({ file: b.fixLocation!, desc: b.bugDescription }))
                    .slice(0, 8),
                recentTestSuites: completedSuites.slice(0, 8).map(t => ({
                    fileName:  t.fileName,
                    framework: t.framework,
                })),
                recentReviews: codeReviews.slice(0, 6).map(r => ({
                    severity:      r.overallSeverity,
                    commitMessage: r.commitMessage,
                })),
            }
        }),

    })

