import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { pollCommits } from '@/lib/github';
import { db } from '@/server/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = (await headers()).get('x-hub-signature-256');

    // Verify webhook signature
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
        .update(body)
        .digest('hex')}`;
      
      if (signature !== expectedSignature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    
    // Only process push events
    if (payload.ref && payload.commits && payload.commits.length > 0) {
      const { repository } = payload;
      
      // Find project by GitHub URL
      const project = await db.project.findFirst({
        where: {
          OR: [
            { githubUrl: repository.html_url },
            { githubUrl: repository.clone_url },
            { githubUrl: { contains: repository.name } }
          ]
        }
      });

      if (project) {
        console.log(`🔄 Processing commits for project: ${project.name}`);
        
        // Use your existing pollCommits function
        await pollCommits(project.id);
        
        console.log(`✅ Successfully processed commits for project: ${project.name}`);
        
        return NextResponse.json({ 
          message: 'Commits processed successfully',
          projectId: project.id,
          commitCount: payload.commits.length
        });
      } else {
        console.log(`❌ No project found for repository: ${repository.html_url}`);
        return NextResponse.json({ 
          message: 'Project not found',
          repository: repository.html_url 
        });
      }
    }

    return NextResponse.json({ message: 'Event ignored - not a push event' });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ message: 'GitHub webhook endpoint active' });
}