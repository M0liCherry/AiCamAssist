import { LegalPage, policies, type PolicyKey } from "@/components/verity/LegalPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return Object.keys(policies).map((policy) => ({ policy }));
}

export async function generateMetadata({ params }: { params: Promise<{ policy: string }> }): Promise<Metadata> {
  const { policy } = await params;
  if (!(policy in policies)) return {};
  const item = policies[policy as PolicyKey];
  return { title: `${item.title} | VerityAI`, description: item.summary };
}

export default async function PolicyPage({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  if (!(policy in policies)) notFound();
  return <LegalPage policyKey={policy as PolicyKey} />;
}
