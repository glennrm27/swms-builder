import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth";
import { NavBar } from "../components/NavBar";

export const metadata: Metadata = {
  title: "SWMS Builder",
  description: "Guided Safe Work Method Statement authoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <AuthProvider>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
