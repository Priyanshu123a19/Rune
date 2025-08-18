import { db } from '@/server/db';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import React from 'react'

const syncUser = async () => {
  const { userId } = await auth();

  //validation check
  if (!userId) {
    console.error('User not authenticated');
    throw new Error('User not authenticated');
  }
  //now extracting the information using this userId
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  if(!user.emailAddresses[0]?.emailAddress){
    return notFound();
  }
  //now if the user is found then we will first extract the information then we will save that user to the database using neon database
  await db.user.upsert({
    where: {
      emailAddress: user.emailAddresses[0]?.emailAddress ?? ""
    },
    update: {
      imageUrl: user.imageUrl,
      firstName: user.firstName,
      lastName: user.lastName
    },
    create: {
      id: userId,
      emailAddress: user.emailAddresses[0]?.emailAddress ?? "",
      imageUrl: user.imageUrl,
      firstName: user.firstName,
      lastName: user.lastName
    }
  })

  //run the command the bun prisma studio to see all the database related things
  //bun prisma studio

  return redirect('/dashboard')
}

export default syncUser