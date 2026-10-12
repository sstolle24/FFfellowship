import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui";

export function ProsePage({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div className="space-y-5 leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-gold [&_a]:text-gold [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </div>
  );
}
