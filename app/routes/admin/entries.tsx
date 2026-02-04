import { useState, useEffect } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { prisma } from "~/lib/prisma.server";
import { Save, Check, AlertCircle } from "lucide-react";
import type { Route } from "./+types/entries";
import { requireUser, getUser } from "~/services/auth.server";

// Loader: Fetch hierarchy and candidates
export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUser(request);
  const user = await getUser(request);
  
  const isAdmin = user?.role === "ADMIN";

  // Fetch Candidates
  const candidates = await prisma.candidate.findMany();

  // Fetch Location Hierarchy
  // If admin, fetch all. If sub-user, we might want to filter, 
  // but for cascading dropdowns to work properly, we usually fetch the structure.
  // Ideally, we'd filter centers based on assignment for sub-users.
  
  const divisions = await prisma.division.findMany({
    include: {
      districts: {
        include: {
          upazilas: {
            include: {
              unions: {
                include: {
                  centers: {
                    // If not admin, maybe filter? For now, let's fetch all and filter in UI or backend
                    // strict filtering would be better for security
                    where: isAdmin ? {} : { assignedToUserId: userId },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return { divisions, candidates, user };
}

// Action: Handle vote entry submission
export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUser(request);
  const user = await getUser(request);
  const isAdmin = user?.role === "ADMIN";

  const formData = await request.formData();
  const centerId = formData.get("centerId") as string;
  
  if (!centerId) {
    return { error: "Please select a vote center." };
  }

  // Security Check: Ensure sub-users can only update their assigned centers
  if (!isAdmin) {
    const center = await prisma.voteCenter.findUnique({
      where: { id: centerId },
      select: { assignedToUserId: true }
    });

    if (!center || center.assignedToUserId !== userId) {
      return { error: "Unauthorized: You can only update votes for your assigned centers." };
    }
  }

  // Extract vote counts from formData
  // format: candidate_{candidateId} = count
  const entries = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("candidate_")) {
      const candidateId = key.replace("candidate_", "");
      const voteCount = parseInt(value as string, 10) || 0;
      entries.push({ candidateId, voteCount });
    }
  }

  if (entries.length === 0) {
    return { error: "No vote data provided." };
  }

  try {
    // Transaction to update all entries
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.voteEntry.upsert({
          where: {
            centerId_candidateId: {
              centerId,
              candidateId: entry.candidateId,
            },
          },
          update: {
            voteCount: entry.voteCount,
            submittedByUserId: userId,
          },
          create: {
            centerId,
            candidateId: entry.candidateId,
            voteCount: entry.voteCount,
            submittedByUserId: userId,
          },
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error("Error saving votes:", error);
    return { error: "Failed to save vote entries." };
  }
}

export default function VoteEntries() {
  const { divisions, candidates, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  // State for cascading dropdowns
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>("");
  const [selectedUnion, setSelectedUnion] = useState<string>("");
  const [selectedCenter, setSelectedCenter] = useState<string>("");

  // Derived lists
  const districts =
    divisions.find((d: any) => d.id === selectedDivision)?.districts || [];
  const upazilas =
    districts.find((d: any) => d.id === selectedDistrict)?.upazilas || [];
  const unions =
    upazilas.find((u: any) => u.id === selectedUpazila)?.unions || [];
  const centers =
    unions.find((u: any) => u.id === selectedUnion)?.centers || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vote Entry</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter results for specific centers
          </p>
        </div>
      </div>

      {actionData?.success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <Check className="h-4 w-4 mr-2" />
          Votes saved successfully!
        </div>
      )}

      {actionData?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {actionData.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Location Selection Panel */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
            Select Location
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Division
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedDivision}
                onChange={(e) => {
                  setSelectedDivision(e.target.value);
                  setSelectedDistrict("");
                  setSelectedUpazila("");
                  setSelectedUnion("");
                  setSelectedCenter("");
                }}
              >
                <option value="">-- Select Division --</option>
                {divisions.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                District
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                disabled={!selectedDivision}
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedUpazila("");
                  setSelectedUnion("");
                  setSelectedCenter("");
                }}
              >
                <option value="">-- Select District --</option>
                {districts.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Upazila
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                disabled={!selectedDistrict}
                value={selectedUpazila}
                onChange={(e) => {
                  setSelectedUpazila(e.target.value);
                  setSelectedUnion("");
                  setSelectedCenter("");
                }}
              >
                <option value="">-- Select Upazila --</option>
                {upazilas.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Union
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                disabled={!selectedUpazila}
                value={selectedUnion}
                onChange={(e) => {
                  setSelectedUnion(e.target.value);
                  setSelectedCenter("");
                }}
              >
                <option value="">-- Select Union --</option>
                {unions.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vote Center
              </label>
              <select
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={!selectedUnion}
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
              >
                <option value="">-- Select Center --</option>
                {centers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data Entry Form */}
        <div className="lg:col-span-2">
          {selectedCenter ? (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Enter Votes</h3>
                <p className="text-sm text-slate-500">
                  {centers.find((c: any) => c.id === selectedCenter)?.name}
                </p>
              </div>

              <Form method="post" className="p-6 space-y-6">
                <input type="hidden" name="centerId" value={selectedCenter} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidates.map((candidate: any) => (
                    <div
                      key={candidate.id}
                      className="border rounded-lg p-4 hover:border-red-200 transition-colors"
                    >
                      <label className="block font-medium text-slate-800 mb-2">
                        {candidate.name}
                        <span className="text-xs text-slate-500 block font-normal">
                          {candidate.party} {candidate.symbol ? `(${candidate.symbol})` : ""}
                        </span>
                      </label>
                      <input
                        type="number"
                        name={`candidate_${candidate.id}`}
                        min="0"
                        placeholder="0"
                        className="w-full text-lg font-bold text-slate-900 border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-all font-bold flex items-center shadow-lg shadow-red-200"
                  >
                    {isSubmitting ? "Saving..." : "Save Results"}
                    <Save className="ml-2 h-5 w-5" />
                  </button>
                </div>
              </Form>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-12 text-center h-full flex flex-col items-center justify-center text-slate-400">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No Center Selected</p>
              <p className="text-sm">Please select a vote center from the left panel to enter data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
