import AuthStatePage from "@/components/auth/AuthStatePage";
import AnalyticsPage from "@/components/venue/analytics/AnalyticsPage";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getVenueAnalyticsData } from "@/lib/venue-dashboard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  range?: string;
  from?: string;
  to?: string;
  event?: string;
}>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requirePlatformAdmin("/analytics");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables before using platform analytics."
      />
    );
  }

  const params = await searchParams;
  const data = await getVenueAnalyticsData(guard, {
    eventId: params.event,
    from: params.from,
    range: params.range,
    to: params.to,
  });

  return <AnalyticsPage data={data} />;
}
