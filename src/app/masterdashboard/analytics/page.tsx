import AuthStatePage from "@/components/auth/AuthStatePage";
import PlatformAnalyticsPage from "@/components/admin/PlatformAnalyticsPage";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformAnalyticsData, type AnalyticsScope } from "@/lib/platform-analytics";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ country?: string; venueId?: string }>;

function resolveScope(params: { country?: string; venueId?: string }): AnalyticsScope {
  if (params.venueId) return { type: "venue", venueId: params.venueId };
  if (params.country === "United Kingdom" || params.country === "United Arab Emirates") {
    return { type: "country", country: params.country };
  }
  return { type: "total" };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requirePlatformAdmin("/masterdashboard/analytics");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables to use platform analytics."
      />
    );
  }

  const params = await searchParams;
  const scope = resolveScope(params);
  const data = await getPlatformAnalyticsData(scope);

  return <PlatformAnalyticsPage data={data} />;
}
