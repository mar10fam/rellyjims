import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "rellyjims",
  description: "Workout tracker with progressive overload",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "rellyjims", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
