"use client";
import { Button } from "@/components/ui";

export function PrintButton() {
  return <Button variant="ghost" onClick={() => window.print()}>Print / Save as PDF</Button>;
}
