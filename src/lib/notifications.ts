import { db } from '@/server/db'

export type NotificationType =
  | 'PR_REVIEW'
  | 'CODE_REVIEW'
  | 'BUG_INVESTIGATION'
  | 'TEST_SUITE'
  | 'SPRINT_PLAN'
  | 'ONBOARDING'
  | 'VULN_SCAN'
  | 'MEETING'

// Notifies all users associated with the project — no need to pass userId.
export async function notifyProject(params: {
  projectId: string
  type:      NotificationType
  title:     string
  body:      string
  url:       string
}): Promise<void> {
  try {
    const members = await db.userToProject.findMany({
      where:  { projectId: params.projectId },
      select: { userId: true },
    })
    if (members.length === 0) return

    await db.notification.createMany({
      data: members.map(m => ({
        userId:    m.userId,
        projectId: params.projectId,
        type:      params.type,
        title:     params.title,
        body:      params.body,
        url:       params.url,
      })),
    })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}
