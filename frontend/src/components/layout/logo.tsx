import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={className}>
      <span className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">
          VJ
        </span>
        <span className="text-sm font-bold tracking-tight text-slate-700">
          VietJourney
        </span>
      </span>
    </Link>
  );
}
