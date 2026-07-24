import { PrimaryLink, SecondaryLink } from "@/components/shared/ButtonLink";
import PageShell from "@/components/shared/PageShell";
import ScannerFrame from "./ScannerFrame";

export default function VenueScannerPage({
  venues,
  selectedVenueId,
  venueRole = "staff",
}: {
  venues: Array<{ id: string; name: string }>;
  selectedVenueId?: string;
  venueRole?: "staff" | "manager";
}) {
  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  // If there are multiple venues and no valid venue is selected, show a picker.
  if (venues.length > 1 && !selectedVenueId) {
    return (
      <PageShell
        activePath="/venuescanner"
        eyebrow="Scanner"
        title="Select venue"
        venueRole={venueRole}
      >
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-4 text-sm text-muted">Choose which venue you are scanning for.</p>
          <div className="grid gap-3">
            {venues.map((v) => (
              <a
                className="block rounded-xl border border-line bg-white px-5 py-4 text-sm font-medium text-foreground transition hover:border-foreground/20 hover:bg-zinc-50"
                href={`/venuescanner?venueId=${v.id}`}
                key={v.id}
              >
                {v.name}
              </a>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  const eyebrow = selectedVenue ? selectedVenue.name : "Scanner";

  return (
    <PageShell
      activePath="/venuescanner"
      eyebrow={eyebrow}
      title="Verify ticket"
      venueRole={venueRole}
      actions={
        <>
          <SecondaryLink href="/smsbackup">SMS backup</SecondaryLink>
          {venues.length > 1 && (
            <SecondaryLink href="/venuescanner">Switch venue</SecondaryLink>
          )}
        </>
      }
    >
      <ScannerFrame venueId={selectedVenueId} />
    </PageShell>
  );
}
