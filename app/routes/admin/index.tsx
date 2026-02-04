import { useState, useEffect } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useFetcher,
} from "react-router";
import { prisma } from "~/lib/prisma.server";
import { Save, Check, AlertCircle, X } from "lucide-react";
import type { Route } from "./+types/index";
import { requireUser, getUser } from "~/services/auth.server";

// Loader: Fetch hierarchy and candidates
export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUser(request);
  const user = await getUser(request);

  const isAdmin = user?.role === "ADMIN";

  // Filter candidates based on selected center (client-side or server-side?)
  // Since we fetch all candidates, we can just pass them to the UI.
  // However, it's better to fetch candidates with their location data so we can filter in the UI.
  const candidates = await prisma.candidate.findMany({
    include: {
      division: true,
      district: true,
      upazila: true,
      union: true,
    },
  });

  // ... rest of the code
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

  // Fetch assigned centers for quick access (especially for sub-users)
  const assignedCenters = await prisma.voteCenter.findMany({
    where: { assignedToUserId: userId },
    include: {
      union: {
        include: {
          upazila: {
            include: {
              district: {
                include: {
                  division: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: { voteEntries: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // For Admins: Fetch recently updated centers to facilitate "Edit Mode"
  let recentCenters: typeof assignedCenters = [];
  if (isAdmin) {
    const recentEntries = await prisma.voteEntry.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: { centerId: true },
    });

    // Deduplicate center IDs
    const centerIds = Array.from(
      new Set(recentEntries.map((e) => e.centerId)),
    ).slice(0, 12);

    if (centerIds.length > 0) {
      recentCenters = await prisma.voteCenter.findMany({
        where: { id: { in: centerIds } },
        include: {
          union: {
            include: {
              upazila: {
                include: {
                  district: {
                    include: {
                      division: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: { voteEntries: true },
          },
        },
      });
    }
  }

  return { divisions, candidates, user, assignedCenters, recentCenters };
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
      select: { assignedToUserId: true },
    });

    if (!center || center.assignedToUserId !== userId) {
      return {
        error:
          "Unauthorized: You can only update votes for your assigned centers.",
      };
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

  // If not admin, check if votes already exist for this center to prevent re-submission
  if (!isAdmin) {
    const existingCount = await prisma.voteEntry.count({
      where: { centerId },
    });
    if (existingCount > 0) {
      return {
        error:
          "Votes have already been submitted for this center. You cannot edit them.",
      };
    }
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
        }),
      ),
    );

    return { success: true, submittedVotes: entries };
  } catch (error) {
    console.error("Error saving votes:", error);
    return { error: "Failed to save vote entries." };
  }
}

export default function VoteEntries() {
  const { divisions, candidates, user, assignedCenters, recentCenters } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";
  const isAdmin = user?.role === "ADMIN";

  const voteFetcher = useFetcher();
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // State for cascading dropdowns
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>("");
  const [selectedUnion, setSelectedUnion] = useState<string>("");
  const [selectedCenter, setSelectedCenter] = useState<string>("");

  // Fetch votes when center is selected
  useEffect(() => {
    if (selectedCenter) {
      voteFetcher.load(`/api/votes?centerId=${selectedCenter}`);
    }
  }, [selectedCenter]);

  // Show success modal when action succeeds
  useEffect(() => {
    if (actionData?.success) {
      setShowSuccessModal(true);
      // Re-fetch votes to show updated values and disable form if needed
      if (selectedCenter) {
        voteFetcher.load(`/api/votes?centerId=${selectedCenter}`);
      }
    }
  }, [actionData, selectedCenter]);

  const existingVotes = (voteFetcher.data as any)?.votes || [];
  const isFetchingVotes = voteFetcher.state !== "idle";
  const hasSubmitted = existingVotes.length > 0;
  // Block input for sub-users if already submitted
  const isReadOnly = !isAdmin && hasSubmitted;

  // Calculate stats
  const totalAssigned = assignedCenters.length;
  const completedCenters = assignedCenters.filter(
    (c: any) => c._count.voteEntries > 0,
  ).length;
  const completionPercentage =
    totalAssigned > 0
      ? Math.round((completedCenters / totalAssigned) * 100)
      : 0;

  // Derived lists
  const districts =
    divisions.find((d: any) => d.id === selectedDivision)?.districts || [];
  const upazilas =
    districts.find((d: any) => d.id === selectedDistrict)?.upazilas || [];
  const unions =
    upazilas.find((u: any) => u.id === selectedUpazila)?.unions || [];
  const centers =
    unions.find((u: any) => u.id === selectedUnion)?.centers || [];

  const relevantCandidates = candidates.filter((c: any) => {
    if (c.divisionId && c.divisionId !== selectedDivision) return false;
    if (c.districtId && c.districtId !== selectedDistrict) return false;
    if (c.upazilaId && c.upazilaId !== selectedUpazila) return false;
    if (c.unionId && c.unionId !== selectedUnion) return false;
    return true;
  });

  const handleQuickSelect = (center: any) => {
    setSelectedDivision(center.union.upazila.district.division.id);
    setSelectedDistrict(center.union.upazila.district.id);
    setSelectedUpazila(center.union.upazila.id);
    setSelectedUnion(center.union.id);
    setSelectedCenter(center.id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, {user?.username}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin
              ? "Admin Dashboard - Manage Votes"
              : "User Dashboard - Enter Vote Results"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-600">
            Progress Overview
          </div>
          <div className="flex items-center gap-2 justify-end">
            <div className="text-2xl font-bold text-slate-800">
              {completedCenters}{" "}
              <span className="text-slate-400 text-lg">/ {totalAssigned}</span>
            </div>
            <div
              className={`text-sm font-bold px-2 py-1 rounded ${completionPercentage === 100 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
            >
              {completionPercentage}%
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-1">Centers Reported</div>
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

      {/* Recently Updated Centers for Admins (Edit Mode) */}
      {isAdmin && recentCenters && recentCenters.length > 0 && (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h3 className="font-bold text-purple-800 mb-3 flex items-center">
            <span className="mr-2">✏️</span>
            Recently Updated Centers (Edit Mode)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recentCenters.map((center: any) => {
              const isSelected = selectedCenter === center.id;

              return (
                <button
                  type="button"
                  key={center.id}
                  onClick={() => handleQuickSelect(center)}
                  className={`text-left p-3 rounded border transition-all relative overflow-hidden ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300"
                      : "bg-white text-slate-700 border-purple-200 hover:border-purple-400 hover:shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm truncate flex-1">
                      {center.name}
                    </div>
                    <div className="bg-purple-100 text-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      Edit
                    </div>
                  </div>
                  <div
                    className={`text-xs mt-1 truncate ${isSelected ? "text-purple-100" : "text-slate-500"}`}
                  >
                    {center.union.name}, {center.union.upazila.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Select for Assigned Centers */}
      {assignedCenters.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-3 flex items-center">
            <Check className="h-4 w-4 mr-2" />
            Your Assigned Centers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {assignedCenters.map((center: any) => {
              const isCompleted = center._count.voteEntries > 0;
              const isSelected = selectedCenter === center.id;

              return (
                <button
                  type="button"
                  key={center.id}
                  onClick={() => handleQuickSelect(center)}
                  className={`text-left p-3 rounded border transition-all relative overflow-hidden ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300"
                      : isCompleted
                        ? "bg-green-50 text-slate-700 border-green-200 hover:border-green-400"
                        : "bg-white text-slate-700 border-blue-200 hover:border-blue-400 hover:shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm truncate flex-1">
                      {center.name}
                    </div>
                    {isCompleted && (
                      <div
                        className={`p-0.5 rounded-full ${isSelected ? "bg-white text-blue-600" : "bg-green-100 text-green-600"}`}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-xs mt-1 truncate ${isSelected ? "text-blue-100" : "text-slate-500"}`}
                  >
                    {center.union.name}, {center.union.upazila.name}
                  </div>
                  {isCompleted && !isSelected && (
                    <div className="text-[10px] text-green-600 font-medium mt-1 flex items-center">
                      Reported
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Location Selection Panel */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
            {selectedCenter ? "Selected Location" : "Select Location Manually"}
          </h3>

          {selectedCenter ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded border border-slate-200">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">
                  Vote Center
                </div>
                <div className="font-bold text-slate-900 text-lg mb-2">
                  {(
                    centers.find((c: any) => c.id === selectedCenter) ||
                    assignedCenters.find((c: any) => c.id === selectedCenter) ||
                    recentCenters?.find((c: any) => c.id === selectedCenter)
                  )?.name || "Unknown Center"}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex items-center">
                    <span className="w-20 text-slate-400">Union:</span>
                    <span className="font-medium">
                      {
                        (
                          unions.find((u: any) => u.id === selectedUnion) ||
                          assignedCenters.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union ||
                          recentCenters?.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union
                        )?.name
                      }
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-20 text-slate-400">Upazila:</span>
                    <span className="font-medium">
                      {
                        (
                          upazilas.find((u: any) => u.id === selectedUpazila) ||
                          assignedCenters.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union.upazila ||
                          recentCenters?.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union.upazila
                        )?.name
                      }
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-20 text-slate-400">District:</span>
                    <span className="font-medium">
                      {
                        (
                          districts.find(
                            (d: any) => d.id === selectedDistrict,
                          ) ||
                          assignedCenters.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union.upazila.district ||
                          recentCenters?.find(
                            (c: any) => c.id === selectedCenter,
                          )?.union.upazila.district
                        )?.name
                      }
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCenter("")}
                className="w-full py-2 px-4 border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center"
              >
                Change Location
              </button>
            </div>
          ) : (
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
                  Union/Pourashava
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
                  <option value="">-- Select Union/Pourashava --</option>
                  {unions.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.type === "POURASHAVA" ? "(Pourashava)" : ""}
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
          )}
        </div>

        {/* Data Entry Form */}
        <div className="lg:col-span-2">
          {selectedCenter ? (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden relative">
              {isFetchingVotes && (
                <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 backdrop-blur-sm transition-all">
                  <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                    <p className="text-slate-600 font-medium">
                      Loading votes...
                    </p>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-700">Enter Votes</h3>
                  <p className="text-sm text-slate-500">
                    {/* Find center name either from derived list or assigned list */}
                    {
                      (
                        centers.find((c: any) => c.id === selectedCenter) ||
                        assignedCenters.find(
                          (c: any) => c.id === selectedCenter,
                        )
                      )?.name
                    }
                  </p>
                </div>
                {isReadOnly && (
                  <div className="flex flex-col items-end">
                    <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center border border-amber-200">
                      <span className="mr-1">🔒</span> LOCKED
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Submitted
                    </span>
                  </div>
                )}
                {isAdmin && hasSubmitted && (
                  <div className="flex flex-col items-end">
                    <div className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center border border-blue-200">
                      <span className="mr-1">✏️</span> EDIT MODE
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Updating Results
                    </span>
                  </div>
                )}
              </div>

              <Form method="post" className="p-6 space-y-6">
                <input type="hidden" name="centerId" value={selectedCenter} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {relevantCandidates.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-slate-500">
                      No candidates found for this location.
                    </div>
                  ) : (
                    relevantCandidates.map((candidate: any) => {
                      const existingVote = existingVotes.find(
                        (v: any) => v.candidateId === candidate.id,
                      );
                      const voteCount = existingVote
                        ? existingVote.voteCount
                        : "";

                      return (
                        <div
                          key={candidate.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isReadOnly
                              ? "bg-slate-50 opacity-75"
                              : "hover:border-red-200"
                          }`}
                        >
                          <label className="block font-medium text-slate-800 mb-2">
                            {candidate.name}
                            <span className="text-xs text-slate-500 block font-normal">
                              {candidate.party}{" "}
                              {candidate.symbol ? `(${candidate.symbol})` : ""}
                            </span>
                          </label>
                          <input
                            key={`${candidate.id}-${selectedCenter}-${voteCount}`}
                            type="number"
                            name={`candidate_${candidate.id}`}
                            min="0"
                            placeholder="0"
                            defaultValue={voteCount}
                            disabled={isReadOnly || isSubmitting}
                            className={`w-full text-lg font-bold text-slate-900 border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500 ${
                              isReadOnly
                                ? "bg-slate-100 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isReadOnly || isSubmitting}
                    className={`px-8 py-3 rounded-lg transition-all font-bold flex items-center shadow-lg ${
                      isReadOnly || isSubmitting
                        ? "bg-slate-400 text-white cursor-not-allowed shadow-none"
                        : "bg-red-600 text-white hover:bg-red-700 shadow-red-200"
                    }`}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : isReadOnly
                        ? "Votes Submitted"
                        : isAdmin && hasSubmitted
                          ? "Update Results"
                          : "Save Results"}
                    <Save className="ml-2 h-5 w-5" />
                  </button>
                </div>
              </Form>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-12 text-center h-full flex flex-col items-center justify-center text-slate-400">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No Center Selected</p>
              <p className="text-sm">
                Please select a vote center to enter data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Votes Submitted Successfully!
              </h3>
              <p className="text-slate-600 mb-6">
                Thank you for your submission. The results have been recorded
                and locked.
              </p>

              <div className="bg-slate-50 rounded p-4 text-left mb-6 text-sm">
                <p className="font-semibold text-slate-700 mb-2">Summary:</p>
                <ul className="space-y-1">
                  {relevantCandidates.map((c: any) => {
                    const submittedVote = actionData?.submittedVotes?.find(
                      (v: any) => v.candidateId === c.id,
                    );
                    const fetchedVote = existingVotes.find(
                      (v: any) => v.candidateId === c.id,
                    );
                    const vote = submittedVote || fetchedVote;

                    if (!vote) return null;
                    return (
                      <li key={c.id} className="flex justify-between">
                        <span>{c.name}:</span>
                        <span className="font-bold">{vote.voteCount}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
