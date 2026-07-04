import { redirect } from "next/navigation";
import CloakClubWelcome from "@/components/cloak-club/CloakClubWelcome";
import { getMemberByToken } from "@/lib/membership";
import { getWalletConfig } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ member?: string | string[] }>;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = getParam(params.member);

  if (!token) redirect("/cloak-club");

  const member = await getMemberByToken(token);
  if (!member) redirect("/cloak-club");

  return (
    <CloakClubWelcome
      guestName={member.fullName}
      memberToken={token}
      wallet={getWalletConfig()}
    />
  );
}
