import Link from "next/link";
import { Search } from "lucide-react";
import { destinationsApi } from "@/lib/api/services";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DestinationCard } from "@/components/destination/destination-card";

const CATEGORIES = [
  { key: "", label: "Tất cả" },
  { key: "NATURE", label: "Thiên nhiên" },
  { key: "CULTURE", label: "Văn hóa" },
  { key: "HISTORY", label: "Lịch sử" },
  { key: "CUISINE", label: "Ẩm thực" },
  { key: "ENTERTAINMENT", label: "Giải trí" },
  { key: "RELIGION", label: "Tâm linh" },
];

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; category?: string }>;
}) {
  const params0 = (await searchParams) ?? {};
  const q = params0.q ?? "";
  const category = params0.category ?? "";

  const params: Record<string, string> = { limit: "24" };
  if (q) params.q = q;
  if (category) params.category = category;

  const result = await destinationsApi
    .list(params)
    .catch(() => ({ data: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } }));

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Điểm đến
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Khám phá điểm đến đã qua kiểm duyệt
          </h1>
        </div>
      </div>

      <form className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Tìm theo tên hoặc địa điểm..."
            className="pl-10"
          />
        </div>
        <select
          name="category"
          defaultValue={category}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#1d4ed8] px-5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Lọc
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        {result.meta.total} điểm đến
        {category ? ` trong nhóm ${category}` : ""}
        {q ? ` khớp "${q}"` : ""}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {result.data.map((d) => (
          <DestinationCard key={d.id} destination={d} />
        ))}
      </div>

      {result.data.length === 0 ? (
        <Card className="mt-10">
          <CardBody className="grid place-items-center gap-2 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Chưa có điểm đến nào
            </p>
            <p className="text-xs text-slate-500">
              Hãy thử thay đổi bộ lọc hoặc quay lại sau.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <nav className="mt-8 flex justify-center gap-2 text-sm">
        {Array.from({ length: Math.max(1, result.meta.totalPages) }).map(
          (_, i) => {
            const page = i + 1;
            const search = new URLSearchParams();
            if (q) search.set("q", q);
            if (category) search.set("category", category);
            search.set("page", String(page));
            const active = page === result.meta.page;
            return (
              <Link
                key={page}
                href={`/destinations?${search.toString()}`}
                className={
                  active
                    ? "rounded-md bg-[#1d4ed8] px-3 py-1.5 font-semibold text-white"
                    : "rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                }
              >
                {page}
              </Link>
            );
          },
        )}
      </nav>
    </div>
  );
}
