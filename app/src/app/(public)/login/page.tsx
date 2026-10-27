import Link from "next/link";
import { Card, Notice, SectionTitle } from "@/components/ui";
import { LoginForms } from "./LoginForms";

export const metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; link?: string }> }) {
  const { next, link } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <SectionTitle>Log in</SectionTitle>
      {link === "expired" && (
        <Notice tone="orange" className="mb-4">That reset link has expired or was already used. Ask an admin for a new one, or use &ldquo;Email me a sign-in link&rdquo; below.</Notice>
      )}
      <Card><LoginForms next={next ?? "/app"} /></Card>
      <p className="mt-4 text-center text-sm text-muted">
        New here? <Link href="/get-started" className="text-gold underline">Get started</Link>
      </p>
    </div>
  );
}
