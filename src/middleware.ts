import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

//now explaining the middleware


//!this ispublicRoute is made to indicate that these routes can be accessed wihtout the authenticaion of the user with clerk
//ultimately u are defining the public routes over here
//the sign in and the sign up route are just public because we need to go there ulitmately to authenticate the user
//u can add whatsoever route u want ot make public over here only
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)' , '/api/webhook/stripe(.*)', '/api/webhook/github(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}