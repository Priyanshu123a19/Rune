//default page for signin
//comes from clerk only
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn 
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        redirectUrl="/dashboard"
      />
    </div>
  )
}