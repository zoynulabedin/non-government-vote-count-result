import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/center_details";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { useRouteLoaderData } from "react-router";
import { Map, ArrowLeft, Activity } from "lucide-react";
import { getVoteStats } from "~/services/vote.server";
import { StatCard } from "~/components/dashboard/StatCard";
import { NationalChart } from "~/components/dashboard/NationalChart";
import { ClientOnly } from "~/components/ClientOnly";

export async function loader({ params }: Route.LoaderArgs) {
  const { division, district, upazila, union, center } = params;

  // Decode params
  const divisionName = decodeURIComponent(division || "");
  const districtName = decodeURIComponent(district || "");
  const upazilaName = decodeURIComponent(upazila || "");
  const unionName = decodeURIComponent(union || "");
  const centerName = decodeURIComponent(center || "");

  // Find the center by traversing the hierarchy
  // We use findFirst because names might not be globally unique, but the path should be unique
  const centerData = await prisma.voteCenter.findFirst({
    where: {
      name: centerName,
      union: {
        name: unionName,
        upazila: {
          name: upazilaName,
          district: {
            name: districtName,
            division: {
              name: divisionName
            }
          }
        }
      }
    },
    include: {
      union: {
        include: {
            upazila: {
                include: {
                    district: {
                        include: {
                            division: true
                        }
                    }
                }
            }
        }
      }
    }
  });

  if (!centerData) {
    throw new Response("Center Not Found", { status: 404 });
  }

  // Fetch Stats for this center
  const stats = await getVoteStats({ centerId: centerData.id }, centerData.name, "Vote Center");

  return { centerData, stats };
}

export default function CenterDetails() {
  const { centerData, stats } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { user: any };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
            <Link
            to={`/centers?unionId=${centerData.unionId}`}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mr-4"
            >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Centers
            </Link>
        </div>

        {/* Top Stats Section */}
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-2xl font-bold flex items-center">
                    <Activity className="mr-2 h-6 w-6 text-red-600" />
                    Live Results: {centerData.name}
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                    {centerData.union.name}, {centerData.union.upazila.name}, {centerData.union.upazila.district.name}, {centerData.union.upazila.district.division.name}
                </p>
            </div>
            </div>

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

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Vote Distribution</h3>
                    <ClientOnly
                    fallback={
                        <div className="h-64 bg-slate-50 rounded animate-pulse" />
                    }
                    >
                    {() => <NationalChart data={stats.results.map(r => ({ name: r.partyName, votes: r.voteCount, color: r.color }))} />}
                    </ClientOnly>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
