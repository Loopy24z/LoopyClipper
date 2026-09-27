import type { Metadata } from "next";
import "./globals.css";
import "./editor.css";
import "./studio-theme.css";

export const metadata: Metadata = {
  title: "Loofy Clip — Your creative workspace",
  description: "Turn long videos into your next great clips.",
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
