import type { Metadata } from "next";
import "./globals.css";
import "./editor.css";
import "./studio-theme.css";
import "./loofyai-theme.css";

export const metadata: Metadata = {
  title: "LoofyAI — Your creative workspace",
  description: "Your AI creative workspace for clips, captions, and new video ideas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
