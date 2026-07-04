import CloakClubSignupPage from "@/components/cloak-club/CloakClubSignupPage";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string | string[] }>;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <CloakClubSignupPage error={getParam(params.error)} />;
}
