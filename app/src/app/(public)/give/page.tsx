import { ProsePage } from "@/components/Prose";
import { env } from "@/lib/env";

export const metadata = { title: "Give" };

// TODO(Steven): add the fellowship's giving link (no personal payment handles on public pages).
export default function Give() {
  return (
    <ProsePage title="Give" sub="Help keep the meetings free for the next man.">
      <p>
        Finally Free is run by volunteers. Gifts cover meeting software, accountability-software group rates, and
        books for men who can&apos;t afford them.
      </p>
      <p>
        {env.contactEmail ? (
          <>To give, email <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a> and we&apos;ll send you the details.</>
        ) : (
          <>Giving details coming soon.</>
        )}
      </p>
    </ProsePage>
  );
}
