import { pollCommits } from "@/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import z from "zod";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { TRPCError } from "@trpc/server";
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
        })
    
    })

