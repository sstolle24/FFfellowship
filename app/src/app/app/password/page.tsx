import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/forms";
import { Card, SectionTitle } from "@/components/ui";
import { setPassword } from "../actions";

export const metadata = { title: "Set password" };

export default async function SetPassword() {
  const me = await requireUser();
  return (
    <div className="max-w-md space-y-4">
      <SectionTitle sub={`Signed in as ${me.email}.`}>Set a new password</SectionTitle>
      <Card>
        <ActionForm action={setPassword} className="space-y-3" resetOnOk>
          <div>
            <label className="lbl" htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
          </div>
          <div>
            <label className="lbl" htmlFor="confirm">Type it again</label>
            <input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" />
          </div>
          <p className="text-xs text-muted">At least 10 characters.</p>
          <Submit>Save password</Submit>
        </ActionForm>
      </Card>
      <Link href="/app" className="text-sm text-muted hover:text-gold">Go to my dashboard →</Link>
    </div>
  );
}
