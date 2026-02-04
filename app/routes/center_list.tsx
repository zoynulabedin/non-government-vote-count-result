import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/center_list";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { useRouteLoaderData } from "react-router";
import { Map, ChevronRight, BarChart3, ArrowLeft } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const unionId = url.searchParams.get("unionId");

  const where = unionId ? { unionId } : {};

  const centers = await prisma.voteCenter.findMany({
    where,
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
      },
    },
    orderBy: { name: "asc" },
  });

  const unionName = unionId && centers.length > 0 ? centers[0].union.name : null;

  return { centers, unionName, unionId };
}

export default function CenterList() {
  const { centers, unionName, unionId } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { user: any };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
            <Link
            to={unionId ? `/union?upazilaId=${centers[0]?.union.upazilaId || ''}` : "/union"}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mr-4"
            >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to {unionId ? "Unions" : "All Unions"}
            </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Map className="mr-3 h-8 w-8 text-red-600" />
              {unionName ? `Centers of ${unionName}` : "All Vote Centers"}
            </h1>
            <p className="mt-2 text-slate-600">
              Select a center to view detailed election results.
            </p>
          </div>
        </div>

        {centers.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-slate-500">No centers found.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {centers.map((center: any) => {
                // Construct the hierarchical URL
                // Encode components to handle spaces/special chars
                const division = encodeURIComponent(center.union.upazila.district.division.name);
                const district = encodeURIComponent(center.union.upazila.district.name);
                const upazila = encodeURIComponent(center.union.upazila.name);
                const union = encodeURIComponent(center.union.name);
                const centerName = encodeURIComponent(center.name);
                const hierarchicalUrl = `/${division}/${district}/${upazila}/${union}/${centerName}`;

                return (
                    <div
                    key={center.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-slate-200"
                    >
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {center.name}
                            </h2>
                            {!unionId && (
                                <span className="text-sm text-slate-500 block">
                                    {center.union.name} Union
                                </span>
                            )}
                        </div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                        <div className="flex items-center text-sm text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                            Reporting Status: Live
                        </div>
                        </div>

                        <div className="flex space-x-3">
                        <Link
                            to={hierarchicalUrl}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                        >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            View Results
                        </Link>
                        </div>
                    </div>
                    </div>
                );
            })}
            </div>
        )}
      </main>
    </div>
  );
}
