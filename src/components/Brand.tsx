import { BRAND } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <a href="/" className="text-lg font-semibold tracking-tight text-neutral-900">
            Splitpot
          </a>
          <span className="text-sm text-neutral-500">settles to {BRAND.handle} on Moove</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <a
            href={BRAND.mooveProfileUrl}
            className="text-neutral-700 underline hover:text-neutral-900"
          >
            {BRAND.handle} on Moove
          </a>
          <a
            href={BRAND.xUrl}
            className="text-neutral-700 underline hover:text-neutral-900"
          >
            X
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 text-sm text-neutral-600">
        <p>{BRAND.tagline}</p>
        <p className="flex flex-wrap items-center gap-2">
          <span>Moove Handle</span>
          <a
            href={BRAND.mooveProfileUrl}
            className="font-medium text-neutral-900 underline"
          >
            {BRAND.handle}
          </a>
          <span aria-hidden="true">·</span>
          <a href={BRAND.xUrl} className="font-medium text-neutral-900 underline">
            {BRAND.xUrl}
          </a>
        </p>
        <p className="text-neutral-500">{BRAND.builtByLine}</p>
        <p className="text-xs text-neutral-400">
          Splitpot creates payment links and reads their completion. Moove Agentic
          Payments moves the funds.
        </p>
      </div>
    </footer>
  );
}
