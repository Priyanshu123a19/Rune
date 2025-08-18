// import Link from "next/link";

// import { LatestPost } from "@/app/_components/post";
// import { api, HydrateClient } from "@/trpc/server";
// import styles from "./index.module.css";
// import { Button } from "@/components/ui/button";

// export default async function Home() {
//   const hello = await api.post.hello({ text: "from tRPC" });

//   void api.post.getLatest.prefetch();

//   return (
//     <Button >hello</Button>
//   );
// }


import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  // ✅ If user is authenticated, redirect to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  // ✅ If not authenticated, show landing page
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-md mx-auto p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Rune
        </h1>
        <p className="text-gray-600 mb-8">
          AI-powered repository analysis and meeting transcription
        </p>
        <div className="space-y-4">
          <Link href="/sign-in">
            <Button className="w-full" size="lg">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="outline" className="w-full" size="lg">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}