// Request to add a university to the network.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { RequestCampusForm } from "@/components/auth/RequestCampusForm";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Add your university" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RequestCampusPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="wrap auth">
      <p className="eyebrow">Campus network</p>
      <h1>Add your university</h1>
      <p className="lead-sm">
        ModernSI opens sign-up university by university. Tell us where you study; once the admins add your e-mail domain,
        we will write to you and you can join.
      </p>
      <RequestCampusForm initialEmail={firstParam(params.email) ?? ""} />
    </div>
  );
}
