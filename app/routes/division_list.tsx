import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/division_list";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { useRouteLoaderData } from "react-router";
import { Map, ChevronRight, BarChart3 } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const divisions = await prisma.division.findMany({
    include: {
      _count: {
        select: { districts: true },
      },
      districts: {
        include: {
          _count: {
            select: { upazilas: true },
          }
        }
      }
    },
    orderBy: { name: "asc" },
  });
  return { divisions };
}

export default function DivisionList() {
  const { divisions } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { user: any };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Map className="mr-3 h-8 w-8 text-red-600" />
              Divisions of Bangladesh
            </h1>
            <p className="mt-2 text-slate-600">
              Select a division to view detailed election results.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {divisions.map((division: any) => (
            <div
              key={division.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-slate-800">
                    {division.name}
                  </h2>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                    {division._count.districts} Districts
                  </span>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Reporting Status: Live
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                     <span className="w-2 h-2 rounded-full bg-slate-300 mr-2"></span>
                     Total Centers: Calculating...
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Link
                    to={`/results?divisionId=${division.id}`}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    View Results
                  </Link>
                  <Link
                    to={`/district?divisionId=${division.id}`}
                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                  >
                    Districts
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
