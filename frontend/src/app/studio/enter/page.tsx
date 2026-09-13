import { redirect } from "next/navigation";
import { authApi, destinationsApi, provincesApi } from "@/lib/api/services";
import { EntryForm } from "@/components/studio/entry-form";

/**
 * Student destination entry: auth-guarded workspace with optional
 * edit mode (?id=) for the student's own drafts.
 */
export default async function EnterPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/enter");

  const { id } = (await searchParams) ?? {};
  const [provinces, initial] = await Promise.all([
    provincesApi.list().catch(() => []),
    id ? destinationsApi.get(id).catch(() => null) : Promise.resolve(null),
  ]);
  if (id && !initial) redirect("/studio/mine");

  // Key remount is load-bearing: EntryForm seeds all fields with useState
  // from `initial`, so without it navigating from /studio/enter to
  // /studio/enter?id=X (or between two ids) reuses the old state and the
  // draft appears empty / stale — "continue editing" shows last session.
  return <EntryForm key={id ?? "new"} user={me} provinces={provinces} initial={initial} />;
}
