/**
 * Instant navigation feedback: rendered while the incoming route's
 * server components are still working (especially noticeable in dev,
 * where each route compiles on first visit).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse px-5 py-10" aria-label="Đang tải">
      <div className="h-4 w-40 rounded-full bg-slate-200" />
      <div className="mt-3 h-8 w-80 max-w-full rounded-lg bg-slate-200" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <div className="aspect-[4/3] bg-slate-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded-full bg-slate-200" />
              <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
