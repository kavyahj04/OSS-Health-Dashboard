import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { createEmailWorker } from "@/lib/worker";

//root layout for the app, includes global styles and fonts

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// defines the default page title and description used for SEO and browser tab
export const metadata: Metadata = {
  title: "OSS Health Tracker",
  description: "Track and visualize the health of your GitHub repositories",
};

async function startWorker() {
  try {
    await fetch(`${process.env.NEXTAUTH_URL}/api/worker`)
  } catch (error) {
    console.error("Failed to start worker:", error)
  }
}

startWorker()


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* wraps the session context around the whole app so any page can access who is logged in */}
        <Providers>
        {children}
        </Providers>
      </body>
    </html>
  );
}
