import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <ProsePage title="Privacy" sub="Your recovery is your business. Here is exactly who can see what.">
      <h2>What&apos;s public</h2>
      <p>Only the meeting schedule (name, day, time, short description). No names, phone numbers, emails or meeting links appear on any public page.</p>
      <h2>Your program work</h2>
      <p>Your worksheets, turn-ins, initials, 90-in-90 log and fishing list are visible only to you, your <em>currently active</em> AP or sponsor, and fellowship leaders. The moment a relationship ends, that brother loses access.</p>
      <h2>Your journal</h2>
      <p>Entries you mark &ldquo;share with my AP/sponsor&rdquo; are visible to them. All other entries are visible only to you and fellowship leaders.</p>
      <h2>Your contact details</h2>
      <p>Your phone, Signal and city are shown to other members only if you turn sharing on, and only to approved members. Location is city-level at most.</p>
      <h2>Leaders</h2>
      <p>Leaders can see program progress and the reason you gave when signing up, so they can help you. Leader notes are private to leaders. Every approval, role change, relationship change and data export is logged.</p>
      <h2>Your rights</h2>
      <p>From Profile &amp; Privacy you can download everything we hold about you, or delete your account. Deleted accounts are deactivated immediately and turned-in work is purged after 30 days.</p>
      <h2>Analytics</h2>
      <p>We don&apos;t use third-party analytics or trackers on member pages.</p>
    </ProsePage>
  );
}
