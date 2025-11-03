import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - AI Email Sorter",
  description: "Sign in with your Google account to start managing your emails",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
