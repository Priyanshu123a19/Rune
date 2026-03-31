import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import {
  ClerkProvider
} from '@clerk/nextjs'
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Rune – AI Dev Platform",
  description: "AI-powered developer platform: code review, bug investigation, sprint planning, and more.",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/logo.png" },
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rune",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

const geist = Geist({
  subsets: ["latin"],
});

//now here we are wrapping the whole application with the ClerkProvider
//this ensures that the authentication state is available throughout the app
//and u already defined the public routes in the middleware
//so that will exclude those routes from authentication

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
    <html lang="en">
      <body className={geist.className}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster richColors/>
      </body>
    </html>
    </ClerkProvider>
  );
}
