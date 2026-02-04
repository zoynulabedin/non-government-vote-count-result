import type { Route } from "./+types/results";
import { useLoaderData, useRouteLoaderData, Link } from "react-router";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { SearchFilter } from "~/components/dashboard/SearchFilter";
import { StatCard } from "~/components/dashboard/StatCard";
import { NationalChart } from "~/components/dashboard/NationalChart";
import { ClientOnly } from "~/components/ClientOnly";
import { Map, Activity, ArrowLeft, ArrowRight } from "lucide-react";
import { getVoteStats, getChildLocations } from "~/services/vote.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const divisionId = url.searchParams.get("divisionId");
  const districtId = url.searchParams.get("districtId");
  const constituencyId = url.searchParams.get("constituencyId");
  const upazilaId = url.searchParams.get("upazilaId");
  const unionId = url.searchParams.get("unionId");
  const centerId = url.searchParams.get("centerId");

  // Determine current location and build filter
  let locationName = "National";
  let locationType = "National";
  let voteFilter: any = {};
  let childType:
    | "division"
    | "district"
    | "constituency"
    | "upazila"
    | "union"
    | "center"
    | null = "division";
  let currentId = null;

  if (centerId) {
    const center = await prisma.voteCenter.findUnique({
      where: { id: centerId },
    });
    locationName = center?.name || "Unknown Center";
    locationType = "Vote Center";
    voteFilter = { centerId };
    childType = null; // No children for center
    currentId = centerId;
  } else if (unionId) {
    const union = await prisma.union.findUnique({ where: { id: unionId } });
    locationName = union?.name || "Unknown Union";
    locationType = "Union";
    voteFilter = { center: { unionId } };
    childType = "center";
    currentId = unionId;
  } else if (upazilaId) {
    const upazila = await prisma.upazila.findUnique({
      where: { id: upazilaId },
    });
    locationName = upazila?.name || "Unknown Upazila";
    locationType = "Upazila";
    voteFilter = { center: { union: { upazilaId } } };
    childType = "union";
    currentId = upazilaId;
  } else if (constituencyId) {
    const constituency = await prisma.constituency.findUnique({
      where: { id: constituencyId },
    });
    locationName = constituency?.name || "Unknown Constituency";
    locationType = "Constituency";
    // For Constituency, we want votes from centers in upazilas belonging to this constituency
    // Or we can rely on candidate-based queries?
    // getVoteStats uses voteFilter on VoteEntry.
    // VoteEntry -> Center -> Union -> Upazila -> Constituency
    voteFilter = { center: { union: { upazila: { constituencyId } } } };
    childType = "upazila";
    currentId = constituencyId;
  } else if (districtId) {
    const district = await prisma.district.findUnique({
      where: { id: districtId },
    });
    locationName = district?.name || "Unknown District";
    locationType = "District";
    voteFilter = { center: { union: { upazila: { districtId } } } };
    childType = "constituency";
    currentId = districtId;
  } else if (divisionId) {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
    });
    locationName = division?.name || "Unknown Division";
    locationType = "Division";
    voteFilter = {
      center: { union: { upazila: { district: { divisionId } } } },
    };
    childType = "district";
    currentId = divisionId;
  }

  // Fetch Stats for Current Location
  const stats = await getVoteStats(voteFilter, locationName, locationType);

  // Fetch Child Locations (if any)
  let childLocations: any[] = [];
  if (childType && currentId) {
    childLocations = await getChildLocations(childType, currentId);
  } else if (!currentId) {
    // Fallback to national if no ID (shouldn't happen often if using params)
    childLocations = await getChildLocations("division");
  }

  return {
    locationName,
    locationType,
    stats,
    childLocations,
    childType,
    currentParams: {
      divisionId,
      districtId,
      constituencyId,
      upazilaId,
      unionId,
      centerId,
    },
  };
}

export default function Results() {
  const rootData = useRouteLoaderData("root") as { user: any };
  const {
    locationName,
    locationType,
    stats,
    childLocations,
    childType,
    currentParams,
  } = useLoaderData<typeof loader>();

  const getLinkForChild = (childId: string) => {
    const params = new URLSearchParams();
    if (currentParams.divisionId)
      params.set("divisionId", currentParams.divisionId);
    if (currentParams.districtId)
      params.set("districtId", currentParams.districtId);
    if (currentParams.constituencyId)
      params.set("constituencyId", currentParams.constituencyId);
    if (currentParams.upazilaId)
      params.set("upazilaId", currentParams.upazilaId);
    if (currentParams.unionId) params.set("unionId", currentParams.unionId);

    // Add the new child param based on type
    if (childType === "district") params.set("districtId", childId);
    if (childType === "constituency") params.set("constituencyId", childId);
    if (childType === "upazila") params.set("upazilaId", childId);
    if (childType === "union") params.set("unionId", childId);
    if (childType === "center") params.set("centerId", childId);

    return `/results?${params.toString()}`;
  };

  const getBackLink = () => {
    const params = new URLSearchParams();
    // Reconstruct parent URL
    if (currentParams.centerId) {
      if (currentParams.unionId) params.set("unionId", currentParams.unionId);
      if (currentParams.upazilaId)
        params.set("upazilaId", currentParams.upazilaId);
      if (currentParams.constituencyId)
        params.set("constituencyId", currentParams.constituencyId);
      if (currentParams.districtId)
        params.set("districtId", currentParams.districtId);
      if (currentParams.divisionId)
        params.set("divisionId", currentParams.divisionId);
      return `/results?${params.toString()}`;
    }
    if (currentParams.unionId) {
      if (currentParams.upazilaId)
        params.set("upazilaId", currentParams.upazilaId);
      if (currentParams.constituencyId)
        params.set("constituencyId", currentParams.constituencyId);
      if (currentParams.districtId)
        params.set("districtId", currentParams.districtId);
      if (currentParams.divisionId)
        params.set("divisionId", currentParams.divisionId);
      return `/results?${params.toString()}`;
    }
    if (currentParams.upazilaId) {
      if (currentParams.constituencyId) {
        params.set("constituencyId", currentParams.constituencyId);
        if (currentParams.districtId)
          params.set("districtId", currentParams.districtId);
        if (currentParams.divisionId)
          params.set("divisionId", currentParams.divisionId);
      } else if (currentParams.districtId) {
        params.set("districtId", currentParams.districtId);
        if (currentParams.divisionId)
          params.set("divisionId", currentParams.divisionId);
      }
      return `/results?${params.toString()}`;
    }
    if (currentParams.constituencyId) {
      if (currentParams.districtId)
        params.set("districtId", currentParams.districtId);
      if (currentParams.divisionId)
        params.set("divisionId", currentParams.divisionId);
      return `/results?${params.toString()}`;
    }
    if (currentParams.districtId) {
      if (currentParams.divisionId)
        params.set("divisionId", currentParams.divisionId);
      return `/results?${params.toString()}`;
    }
    if (currentParams.divisionId) {
      return "/";
    }
    return "/";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
          <Link
            to={getBackLink()}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mr-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back
          </Link>
        </div>

        {/* Search Filter */}
        <SearchFilter />

        {/* Top Stats Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Activity className="mr-2 h-6 w-6 text-red-600" />
              Live Results: {locationName}{" "}
              <span className="text-slate-500 text-lg font-normal ml-2">
                ({locationType})
              </span>
            </h2>
          </div>

          {/* Seat Count Section (for National/Division/District) */}
          {stats.partySeats && stats.partySeats.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-700 mb-3">
                Parliamentary Seats Won
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {stats.partySeats.map((seat, idx) => (
                  <div
                    key={idx}
                    className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${seat.color}`}
                  >
                    <div className="text-slate-500 text-sm font-medium">
                      {seat.partyName}
                    </div>
                    <div className="text-3xl font-bold mt-1">{seat.seats}</div>
                    <div className="text-xs text-slate-400 mt-1">Seats</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.results.length > 0 ? (
              stats.results.map((result, idx) => (
                <StatCard
                  key={idx}
                  partyName={result.partyName}
                  voteCount={result.voteCount}
                  percentage={result.percentage}
                  color={result.color}
                  trend={idx === 0 ? "up" : "neutral"}
                  trendValue={idx === 0 ? "Leading" : ""}
                />
              ))
            ) : (
              <div className="col-span-4 bg-white p-6 rounded-lg shadow-sm text-center text-slate-500">
                No votes recorded yet for this location.
              </div>
            )}
          </div>
        </section>

        {/* Child Locations Grid (Drill Down) */}
        {childLocations.length > 0 && (
          <section className="mb-12">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center capitalize">
              <Map className="mr-2 h-5 w-5 text-slate-600" />
              {childType}s in {locationName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {childLocations.map((child: any) => (
                <Link
                  key={child.id}
                  to={getLinkForChild(child.id)}
                  className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-all border border-slate-200 group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-bold text-slate-800 group-hover:text-red-600 transition-colors">
                      {child.name}
                    </h4>
                    {/* Count badge based on type */}
                    {child._count && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded capitalize">
                        {child._count.districts ||
                          child._count.constituencies ||
                          child._count.upazilas ||
                          child._count.unions ||
                          child._count.centers ||
                          0}{" "}
                        Sub-units
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-slate-500 mt-4 group-hover:translate-x-1 transition-transform">
                    View Results
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>

                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                Vote Distribution
              </h3>
              <ClientOnly
                fallback={
                  <div className="h-64 bg-slate-50 rounded animate-pulse" />
                }
              >
                {() => (
                  <NationalChart
                    data={stats.results.map((r) => ({
                      name: r.partyName,
                      votes: r.voteCount,
                      color: r.color,
                    }))}
                  />
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
