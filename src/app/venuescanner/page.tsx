import AuthStatePage from "@/components/auth/AuthStatePage";
import VenueScannerPage from "@/components/venue/scanner/VenueScannerPage";
import { requireVenueAccess } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ venueId?: string }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requireVenueAccess("/venuescanner");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables before using the venue scanner."
      />
    );
  }

  const params = await searchParams;
  const venueIds = [...new Set(guard.venueRoles.map((r) => r.venueId))];

  let venues: Array<{ id: string; name: string }> = [];
  if (venueIds.length > 0 && isSupabaseAdminConfigured()) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("venues")
      .select("id, name")
      .in("id", venueIds)
      .order("name");
    venues = (data ?? []).map((v) => ({ id: v.id, name: v.name }));
  }

  const selectedVenueId =
    params.venueId && venues.some((v) => v.id === params.venueId)
      ? params.venueId
      // A single-venue account has no picker step and no venueId query param,
      // but the venue is still unambiguous — default to it. Without this,
      // venueId stays undefined and membership-pass scans (which require a
      // venueId to resolve) always fail with "Ticket was not found."
      : venues.length === 1
        ? venues[0].id
        : undefined;

  const venueRole = guard.venueRoles.some((r) => r.role === "manager") ? "manager" : "staff";

  return <VenueScannerPage venues={venues} selectedVenueId={selectedVenueId} venueRole={venueRole} />;
}
