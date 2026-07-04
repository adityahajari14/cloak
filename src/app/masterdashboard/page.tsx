import AuthStatePage from "@/components/auth/AuthStatePage";
import MasterDashboardPage from "@/components/admin/MasterDashboardPage";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getAdminDashboardData, type CountryFilter } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ message?: string; country?: string }>;

function normalizeCountryFilter(value: string | undefined): CountryFilter {
  if (value === "United Kingdom" || value === "United Arab Emirates") return value;
  return "all";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requirePlatformAdmin("/masterdashboard");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables to use the admin dashboard."
      />
    );
  }

  const params = await searchParams;
  const countryFilter = normalizeCountryFilter(params.country);
  const data = await getAdminDashboardData(countryFilter);

  return <MasterDashboardPage data={data} message={params.message} />;
}
