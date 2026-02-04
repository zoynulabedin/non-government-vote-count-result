import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/candidates";
import { prisma } from "~/lib/prisma.server";
import { requireAdmin } from "~/services/auth.server";
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Check,
  AlertCircle,
  Search,
} from "lucide-react";
import { useState, useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { party: { contains: q, mode: "insensitive" } },
          { symbol: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const candidates = await prisma.candidate.findMany({
    where: where as any,
    orderBy: { name: "asc" },
    include: {
      division: true,
      district: true,
      constituency: true,
      upazila: true,
      union: true,
    },
  });

  const divisions = await prisma.division.findMany({
    include: {
      districts: {
        include: {
          constituencies: true,
          upazilas: {
            include: {
              unions: true,
            },
          },
        },
      },
    },
  });

  return { candidates, divisions };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    try {
      await prisma.candidate.delete({ where: { id } });
      return { success: true, message: "Candidate deleted successfully" };
    } catch (e) {
      return {
        error:
          "Failed to delete candidate. They might have vote entries associated with them.",
      };
    }
  }

  const name = formData.get("name") as string;
  const party = formData.get("party") as string;
  const symbol = formData.get("symbol") as string;
  const seatNumber = formData.get("seatNumber") as string;

  const divisionId = (formData.get("divisionId") as string) || null;
  const districtId = (formData.get("districtId") as string) || null;
  const constituencyId = (formData.get("constituencyId") as string) || null;
  const upazilaId = (formData.get("upazilaId") as string) || null;
  const unionId = (formData.get("unionId") as string) || null;

  if (!name || !party) {
    return { error: "Name and Party are required" };
  }

  const data = {
    name,
    party,
    symbol,
    seatNumber: seatNumber || null,
    divisionId: divisionId || null,
    districtId: districtId || null,
    constituencyId: constituencyId || null,
    upazilaId: upazilaId || null,
    unionId: unionId || null,
  };

  try {
    if (intent === "create") {
      await prisma.candidate.create({ data });
      return { success: true, message: "Candidate created successfully" };
    }

    if (intent === "update") {
      const id = formData.get("id") as string;
      await prisma.candidate.update({
        where: { id },
        data,
      });
      return { success: true, message: "Candidate updated successfully" };
    }
  } catch (error) {
    console.error(error);
    return { error: "Operation failed. Please try again." };
  }

  return null;
}

export default function Candidates() {
  const { candidates, divisions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [party, setParty] = useState("");
  const [symbol, setSymbol] = useState("");
  const [seatNumber, setSeatNumber] = useState("");

  // Location Scope State
  const [scope, setScope] = useState<
    "National" | "Division" | "District" | "Constituency" | "Upazila" | "Union"
  >("National");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedConstituency, setSelectedConstituency] = useState("");
  const [selectedUpazila, setSelectedUpazila] = useState("");
  const [selectedUnion, setSelectedUnion] = useState("");

  // Derived lists based on selection
  const districts =
    divisions.find((d) => d.id === selectedDivision)?.districts || [];
  const constituencies =
    districts.find((d) => d.id === selectedDistrict)?.constituencies || [];
  const upazilas =
    districts.find((d) => d.id === selectedDistrict)?.upazilas || [];
  const unions = upazilas.find((u) => u.id === selectedUpazila)?.unions || [];

  useEffect(() => {
    if (actionData?.success) {
      setIsAdding(false);
      setEditingId(null);
      resetForm();
    }
  }, [actionData]);

  const resetForm = () => {
    setName("");
    setParty("");
    setSymbol("");
    setScope("National");
    setSelectedDivision("");
    setSelectedDistrict("");
    setSelectedConstituency("");
    setSelectedUpazila("");
    setSelectedUnion("");
  };

  const handleEdit = (candidate: any) => {
    setEditingId(candidate.id);
    setName(candidate.name);
    setParty(candidate.party);
    setSymbol(candidate.symbol || "");
    setSeatNumber(candidate.seatNumber || "");

    // Determine scope and set values
    if (candidate.unionId) {
      setScope("Union");
      // We need to reverse lookup parent IDs if we want to populate dropdowns correctly
      // But we don't have the full tree easily accessible unless we traverse 'divisions'
      // Ideally, the candidate object should have relations loaded.
      // Since we loaded relations in loader, we can use them.
      // But candidate.union only gives us the union. We need upazilaId, districtId, etc.
      // The candidate object has direct FKs (divisionId, districtId, etc.) if we saved them!
      // My schema change added ALL of them as nullable.
      // If I save correctly, I should have them.
      setSelectedDivision(candidate.divisionId || "");
      setSelectedDistrict(candidate.districtId || "");
      setSelectedConstituency(candidate.constituencyId || "");
      setSelectedUpazila(candidate.upazilaId || "");
      setSelectedUnion(candidate.unionId || "");
    } else if (candidate.upazilaId) {
      setScope("Upazila");
      setSelectedDivision(candidate.divisionId || "");
      setSelectedDistrict(candidate.districtId || "");
      setSelectedConstituency(candidate.constituencyId || "");
      setSelectedUpazila(candidate.upazilaId || "");
    } else if (candidate.constituencyId) {
      setScope("Constituency");
      setSelectedDivision(candidate.divisionId || "");
      setSelectedDistrict(candidate.districtId || "");
      setSelectedConstituency(candidate.constituencyId || "");
    } else if (candidate.districtId) {
      setScope("District");
      setSelectedDivision(candidate.divisionId || "");
      setSelectedDistrict(candidate.districtId || "");
    } else if (candidate.divisionId) {
      setScope("Division");
      setSelectedDivision(candidate.divisionId || "");
    } else {
      setScope("National");
    }

    setIsAdding(false);
  };

  const getLocationLabel = (candidate: any) => {
    if (candidate.unionId) return `Union: ${candidate.union?.name}`;
    if (candidate.upazilaId) return `Upazila: ${candidate.upazila?.name}`;
    if (candidate.constituencyId)
      return `Constituency: ${candidate.constituency?.seatNumber ? candidate.constituency.seatNumber + ": " : ""}${candidate.constituency?.name}`;
    if (candidate.districtId) return `District: ${candidate.district?.name}`;
    if (candidate.divisionId) return `Division: ${candidate.division?.name}`;
    return "National";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Manage Candidates
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Add or update election candidates and parties
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => {
              setIsAdding(true);
              resetForm();
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Candidate
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <Form method="get" className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            name="q"
            placeholder="Search candidates by name, party, or symbol..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                // You might want to submit the form or clear the search param here
                window.location.href = window.location.pathname;
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </Form>
      </div>

      {actionData?.success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <Check className="h-4 w-4 mr-2" />
          {actionData.message}
        </div>
      )}

      {actionData?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {actionData.error}
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
            {editingId ? "Edit Candidate" : "Add New Candidate"}
          </h3>
          <Form method="post" className="space-y-4">
            <input
              type="hidden"
              name="intent"
              value={editingId ? "update" : "create"}
            />
            {editingId && <input type="hidden" name="id" value={editingId} />}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Candidate Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Party Name
                </label>
                <input
                  type="text"
                  name="party"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  placeholder="e.g. Independent"
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Symbol (Optional)
                </label>
                <input
                  type="text"
                  name="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. Lion"
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Location Scope Selection */}
            <div className="bg-slate-50 p-4 rounded border border-slate-200 mt-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-3 uppercase">
                Location Scope
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Scope Level
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => {
                      setScope(e.target.value as any);
                      // Reset child selections when scope changes upwards?
                      // Actually, let's keep selections if they are valid, but maybe reset if switching to National
                      if (e.target.value === "National") {
                        setSelectedDivision("");
                        setSelectedDistrict("");
                        setSelectedConstituency("");
                        setSelectedUpazila("");
                        setSelectedUnion("");
                      }
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="National">National (All Centers)</option>
                    <option value="Division">Division Level</option>
                    <option value="District">District Level</option>
                    <option value="Constituency">Constituency Level</option>
                    <option value="Upazila">Upazila Level</option>
                    <option value="Union">Union Level</option>
                  </select>
                </div>

                {scope !== "National" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Division
                    </label>
                    <select
                      name="divisionId"
                      value={selectedDivision}
                      onChange={(e) => {
                        setSelectedDivision(e.target.value);
                        setSelectedDistrict("");
                        setSelectedConstituency("");
                        setSelectedUpazila("");
                        setSelectedUnion("");
                      }}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">-- Select Division --</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(scope === "District" ||
                  scope === "Constituency" ||
                  scope === "Upazila" ||
                  scope === "Union") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      District
                    </label>
                    <select
                      name="districtId"
                      value={selectedDistrict}
                      onChange={(e) => {
                        setSelectedDistrict(e.target.value);
                        setSelectedConstituency("");
                        setSelectedUpazila("");
                        setSelectedUnion("");
                      }}
                      className="w-full border rounded px-3 py-2"
                      disabled={!selectedDivision}
                      required
                    >
                      <option value="">-- Select District --</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(scope === "Constituency" ||
                  scope === "Upazila" ||
                  scope === "Union") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Constituency (Optional for Upazila/Union)
                    </label>
                    <select
                      name="constituencyId"
                      value={selectedConstituency}
                      onChange={(e) => setSelectedConstituency(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      disabled={!selectedDistrict}
                    >
                      <option value="">-- Select Constituency --</option>
                      {constituencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.seatNumber ? `${c.seatNumber}: ` : ""}
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(scope === "Upazila" || scope === "Union") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Upazila
                    </label>
                    <select
                      name="upazilaId"
                      value={selectedUpazila}
                      onChange={(e) => {
                        setSelectedUpazila(e.target.value);
                        setSelectedUnion("");
                      }}
                      className="w-full border rounded px-3 py-2"
                      disabled={!selectedDistrict}
                      required
                    >
                      <option value="">-- Select Upazila --</option>
                      {upazilas.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {scope === "Union" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Union
                    </label>
                    <select
                      name="unionId"
                      value={selectedUnion}
                      onChange={(e) => setSelectedUnion(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      disabled={!selectedUpazila}
                      required
                    >
                      <option value="">-- Select Union --</option>
                      {unions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Candidate
                  </>
                )}
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Candidates List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Party
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {candidates.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-4 text-center text-slate-500"
                >
                  No candidates found. Add one to get started.
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">
                      {candidate.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                      {candidate.party}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {candidate.symbol || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {candidate.seatNumber || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {getLocationLabel(candidate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(candidate)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              "Are you sure you want to delete this candidate?",
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                        className="inline"
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={candidate.id} />
                        <button
                          type="submit"
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
