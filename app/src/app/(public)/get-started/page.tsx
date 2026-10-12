import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui";
import { env } from "@/lib/env";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: "Get Started" };

export default function GetStarted() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <SectionTitle sub="Sign up, and a leader will approve your account — usually within a day. You can join meetings while you wait.">
        Get Started
      </SectionTitle>
      <Card><SignUpForm siteKey={env.turnstileSiteKey} /></Card>
      <p className="mt-4 text-center text-sm text-muted">
        Already a member? <Link href="/login" className="text-gold underline">Log in</Link>
      </p>
    </div>
  );
}
