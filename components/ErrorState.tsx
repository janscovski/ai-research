import { SITE_NAME } from "@/lib/site";

/** Deck unreachable and no snapshot yet: minimal branded state, never a blank page. */
export function ErrorState() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <p className="kicker mb-6">{SITE_NAME}</p>
      <h1 className="max-w-[20ch] text-[clamp(1.8rem,4vw,3rem)] font-light leading-tight tracking-[-0.02em]">
        Content is syncing from the source deck.
      </h1>
      <p className="mt-4 text-muted">Please check back in a minute.</p>
    </main>
  );
}
