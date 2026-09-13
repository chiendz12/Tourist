import { itinerariesApi } from "@/lib/api/services";
import { ItineraryBuilder } from "@/components/itinerary/builder";

export default async function NewItineraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const params = (await searchParams) ?? {};
  let trip;
  if (params.id) {
    try {
      trip = await itinerariesApi.get(params.id);
    } catch {
      // fall through to create flow — requestedId still lets the builder
      // recover the local draft for this id
    }
  }
  return <ItineraryBuilder initialTrip={trip ?? null} requestedId={params.id ?? null} />;
}
