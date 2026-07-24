import type { ReactNode } from "react";
import AppHeader from "./AppHeader";

export default function PageShell({
  actions,
  activePath,
  children,
  description,
  eyebrow,
  locked,
  title,
  venueRole,
}: {
  actions?: ReactNode;
  activePath?: string;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  locked?: boolean;
  title: string;
  venueRole?: "staff" | "manager";
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader activePath={activePath} locked={locked} venueRole={venueRole} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-5">{children}</div>
      </main>
    </div>
  );
}
