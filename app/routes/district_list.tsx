import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/district_list";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { useRouteLoaderData } from "react-router";
import { Map, ChevronRight, BarChart3, ArrowLeft } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const divisionId = url.searchParams.get("divisionId");

  const where = divisionId ? { divisionId } : {};

  const districts = await prisma.district.findMany({
    where,
    include: {
      division: true,
      _count: {
        select: { upazilas: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const divisionName = divisionId && districts.length > 0 ? districts[0].division.name : null;

  return { districts, divisionName, divisionId };
}

export default function DistrictList() {
  const { districts, divisionName, divisionId } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { user: any };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
            <Link
            to={divisionId ? "/division" : "/"}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mr-4"
            >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to {divisionId ? "Divisions" : "Home"}
            </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Map className="mr-3 h-8 w-8 text-red-600" />
              {divisionName ? `Districts of ${divisionName}` : "All Districts"}
            </h1>
            <p className="mt-2 text-slate-600">
              Select a district to view detailed election results.
            </p>
          </div>
        </div>

        {districts.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-slate-500">No districts found.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {districts.map((district: any) => (
                <div
                key={district.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-slate-200"
                >
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {district.name}
                        </h2>
                        {!divisionId && (
                            <span className="text-sm text-slate-500 block">
                                {district.division.name} Division
                            </span>
                        )}
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                        {district._count.upazilas} Upazilas
                    </span>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                        Reporting Status: Live
                    </div>
                    </div>

                    <div className="flex space-x-3">
                    <Link
                        to={`/results?districtId=${district.id}`}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                    >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        View Results
                    </Link>
                    {/* Note: We point Upazilas to results page for now to avoid 404s until upazila list is created, 
                        or we can create the upazila list page too. 
                        Given results page handles drill down, this is a safe fallback.
                        But the user might expect a list. 
                        For now, let's point to results which shows upazilas.
                    */}
                    <Link
                        to={`/results?districtId=${district.id}`}
                        className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                    >
                        Upazilas
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
      </main>
    </div>
  );
}
