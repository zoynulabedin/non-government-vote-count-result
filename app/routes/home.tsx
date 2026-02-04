import { useLoaderData, useRouteLoaderData, Link } from "react-router";
import type { Route } from "./+types/home";
import { SearchFilter } from "~/components/dashboard/SearchFilter";
import { Header } from "~/components/dashboard/Header";
import { StatCard } from "~/components/dashboard/StatCard";
import { NationalChart } from "~/components/dashboard/NationalChart";
import { ClientOnly } from "~/components/ClientOnly";
import { Map, Activity, ArrowRight, BarChart3 } from "lucide-react";
import { getVoteStats, getChildLocations } from "~/services/vote.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Election Tracker BD - Live Results" },
    {
      name: "description",
      content: "Non-government private vote counting dashboard.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Fetch National Stats
  const stats = await getVoteStats({}, "National", "National");
  
  // Fetch Divisions
  const divisions = await getChildLocations("division");

  return { stats, divisions };
}

export default function Home() {
  const rootData = useRouteLoaderData("root") as { user: any };
  const { stats, divisions } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        {/* Search Filter */}
        <SearchFilter />

        {/* Top Stats Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Activity className="mr-2 h-6 w-6 text-red-600" />
              Live National Results
            </h2>
            <div className="text-sm text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border">
              Last updated:{" "}
              <span className="font-mono font-bold text-slate-700">
                Just now
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.results.length > 0 ? (
              stats.results.slice(0, 4).map((result, idx) => (
                <StatCard
                  key={idx}
                  partyName={result.partyName}
                  voteCount={result.voteCount}
                  percentage={result.percentage}
                  color={result.color}
                  trend={idx === 0 ? "up" : "neutral"} // Simple trend logic for now
                  trendValue={idx === 0 ? "Leading" : ""}
                />
              ))
            ) : (
              <div className="col-span-4 bg-white p-6 rounded-lg shadow-sm text-center text-slate-500">
                No votes recorded yet.
              </div>
            )}
          </div>
        </section>

        {/* Division Drill Down */}
        <section className="mb-12">
           <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
             <Map className="mr-2 h-5 w-5 text-slate-600" />
             Divisions Overview
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {divisions.map((division: any) => (
               <Link 
                 key={division.id} 
                 to={`/results?divisionId=${division.id}`}
                 className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-all border border-slate-200 group relative overflow-hidden"
               >
                 <div className="flex justify-between items-start mb-4">
                   <h4 className="text-lg font-bold text-slate-800 group-hover:text-red-600 transition-colors">
                     {division.name}
                   </h4>
                   <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                     {division._count.districts} Districts
                   </span>
                 </div>
                 
                 <div className="flex items-center text-sm text-slate-500 mt-4 group-hover:translate-x-1 transition-transform">
                   View Detailed Results 
                   <ArrowRight className="ml-1 h-4 w-4" />
                 </div>
                 
                 <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
               </Link>
             ))}
           </div>
        </section>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ClientOnly
              fallback={
                <div className="h-96 bg-white rounded-lg shadow-md animate-pulse" />
              }
            >
              {() => <NationalChart data={stats.results.map(r => ({ name: r.partyName, votes: r.voteCount, color: r.color }))} />}
            </ClientOnly>
          </div>
        </div>
      </main>
    </div>
  );
}
