import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/union_list";
import { prisma } from "~/lib/prisma.server";
import { Header } from "~/components/dashboard/Header";
import { useRouteLoaderData } from "react-router";
import { Map, ChevronRight, BarChart3, ArrowLeft } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const upazilaId = url.searchParams.get("upazilaId");

  const where = upazilaId ? { upazilaId } : {};

  const unions = await prisma.union.findMany({
    where,
    include: {
      upazila: true,
      _count: {
        select: { centers: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const upazilaName = upazilaId && unions.length > 0 ? unions[0].upazila.name : null;

  return { unions, upazilaName, upazilaId };
}

export default function UnionList() {
  const { unions, upazilaName, upazilaId } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { user: any };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={rootData?.user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
            <Link
            to={upazilaId ? `/upazila?districtId=${unions[0]?.upazila.districtId || ''}` : "/upazila"}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mr-4"
            >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to {upazilaId ? "Upazilas" : "All Upazilas"}
            </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Map className="mr-3 h-8 w-8 text-red-600" />
              {upazilaName ? `Unions of ${upazilaName}` : "All Unions"}
            </h1>
            <p className="mt-2 text-slate-600">
              Select a union to view detailed election results.
            </p>
          </div>
        </div>

        {unions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-slate-500">No unions found.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unions.map((union: any) => (
                <div
                key={union.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-slate-200"
                >
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center">
                            {union.name}
                            {union.type === "POURASHAVA" && (
                                <span className="ml-2 text-xs font-normal text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    Pourashava
                                </span>
                            )}
                        </h2>
                        {!upazilaId && (
                            <span className="text-sm text-slate-500 block">
                                {union.upazila.name} Upazila
                            </span>
                        )}
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                        {union._count.centers} Centers
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
                        to={`/results?unionId=${union.id}`}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                    >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        View Results
                    </Link>
                    <Link
                        to={`/results?unionId=${union.id}`}
                        className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-center py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                    >
                        Centers
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
