import { ProsePage } from "@/components/Prose";

export const metadata = { title: "About" };

export default function About() {
  return (
    <ProsePage title="About Finally Free">
      <p>
        Finally Free Fellowship is a Christ-centered, peer-led fellowship of men recovering from sexual addiction. We
        follow the SA 12-step model alongside the Conquerors curriculum, and we put one conviction above all others:
        men get free when they are rescued by other men — and then go rescue someone else.
      </p>
      <h2>What we believe</h2>
      <ul>
        <li>God can and will do for us what we could not do for ourselves.</li>
        <li>Recovery has to come first — above job, schedule and comfort — or it doesn&apos;t last.</li>
        <li>No man walks alone. Every man has an accountability partner and, by day 90, a sponsor.</li>
        <li>Freedom isn&apos;t finished until we&apos;re helping another man find it.</li>
      </ul>
      <h2>Who we are</h2>
      <p>
        We are men from many countries and walks of life who meet online every day. We are not therapists or a
        treatment center; we are a fellowship. If you need medical or crisis help, see{" "}
        <a href="/get-help">Get Help Now</a>.
      </p>
    </ProsePage>
  );
}
