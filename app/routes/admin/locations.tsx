import { useState, useEffect } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { prisma } from "~/lib/prisma.server";
import {
  Plus,
  ChevronRight,
  Check,
  Search,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Route } from "./+types/locations";
import { requireAdmin } from "~/services/auth.server";

// Loader: Fetch existing hierarchy
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const divisions = await prisma.division.findMany({
    include: {
      districts: {
        include: {
          constituencies: true,
          upazilas: {
            include: {
              unions: {
                include: {
                  centers: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return { divisions };
}

// Action: Handle creation of all levels
export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") || "create";
  const type = formData.get("type");
  const id = formData.get("id") as string;

  try {
    if (intent === "delete") {
      if (!id) return { error: "ID is required for deletion" };
      try {
        if (type === "division")
          await prisma.division.delete({ where: { id } });
        else if (type === "district")
          await prisma.district.delete({ where: { id } });
        else if (type === "constituency")
          await prisma.constituency.delete({ where: { id } });
        else if (type === "upazila")
          await prisma.upazila.delete({ where: { id } });
        else if (type === "union") await prisma.union.delete({ where: { id } });
        else if (type === "center")
          await prisma.voteCenter.delete({ where: { id } });

        return { success: true, message: "Deleted successfully" };
      } catch (error) {
        return {
          error:
            "Cannot delete: This item likely has related data (children or candidates).",
        };
      }
    } else if (intent === "update") {
      if (!id) return { error: "ID is required for update" };

      if (type === "division") {
        const name = formData.get("name") as string;
        await prisma.division.update({ where: { id }, data: { name } });
      } else if (type === "district") {
        const name = formData.get("name") as string;
        const divisionId = formData.get("divisionId") as string;
        await prisma.district.update({
          where: { id },
          data: { name, divisionId },
        });
      } else if (type === "constituency") {
        let name = formData.get("name") as string;
        let seatNumber = formData.get("seatNumber") as string;

        // Generate name from seatNumber if not provided or if we want to enforce format
        if (seatNumber) {
          seatNumber = seatNumber.trim();
          const parts = seatNumber.split("-");
          if (parts.length >= 2) {
            // "Pabna-1" -> "Pabna Parliamentary Constituency 1"
            name = `${parts[0]} Parliamentary Constituency ${parts[1]}`;
          } else {
            name = seatNumber;
          }
        }

        const districtId = formData.get("districtId") as string;
        await prisma.constituency.update({
          where: { id },
          data: {
            name: name || undefined, // Only update name if we generated one
            seatNumber,
            districtId,
          },
        });
      } else if (type === "upazila") {
        const name = formData.get("name") as string;
        const districtId = formData.get("districtId") as string;
        const constituencyId = formData.get("constituencyId") as string;
        await prisma.upazila.update({
          where: { id },
          data: { name, districtId, constituencyId: constituencyId || null },
        });
      } else if (type === "union") {
        const name = formData.get("name") as string;
        const upazilaId = formData.get("upazilaId") as string;
        const unionType = formData.get("unionType") as "UNION" | "POURASHAVA";
        await prisma.union.update({
          where: { id },
          data: { name, upazilaId, type: unionType || "UNION" },
        });
      } else if (type === "center") {
        const name = formData.get("name") as string;
        const unionId = formData.get("unionId") as string;
        await prisma.voteCenter.update({
          where: { id },
          data: { name, unionId },
        });
      }
      return { success: true, message: "Updated successfully" };
    } else {
      // Create logic
      if (type === "division") {
        const name = formData.get("name") as string;
        await prisma.division.create({ data: { name } });
      } else if (type === "district") {
        const name = formData.get("name") as string;
        const divisionId = formData.get("divisionId") as string;
        await prisma.district.create({ data: { name, divisionId } });
      } else if (type === "constituency") {
        let name = formData.get("name") as string;
        let seatNumber = formData.get("seatNumber") as string;

        if (!seatNumber) return { error: "Seat Number is required" };
        seatNumber = seatNumber.trim();

        // Generate name from seatNumber
        const parts = seatNumber.split("-");
        if (parts.length >= 2) {
          name = `${parts[0]} Parliamentary Constituency ${parts[1]}`;
        } else {
          name = seatNumber;
        }

        const districtId = formData.get("districtId") as string;
        await prisma.constituency.create({
          data: { name, seatNumber, districtId },
        });
      } else if (type === "upazila") {
        const name = formData.get("name") as string;
        const districtId = formData.get("districtId") as string;
        const constituencyId = formData.get("constituencyId") as string;
        await prisma.upazila.create({
          data: { name, districtId, constituencyId: constituencyId || null },
        });
      } else if (type === "union") {
        const name = formData.get("name") as string;
        const upazilaId = formData.get("upazilaId") as string;
        const unionType = formData.get("unionType") as "UNION" | "POURASHAVA";
        await prisma.union.create({
          data: { name, upazilaId, type: unionType || "UNION" },
        });
      } else if (type === "center") {
        const name = formData.get("name") as string;
        const unionId = formData.get("unionId") as string;
        await prisma.voteCenter.create({ data: { name, unionId } });
      }
      return { success: true, message: "Created successfully" };
    }
  } catch (error: any) {
    console.error("Location action error:", error);
    return { error: `Operation failed: ${error.message}` };
  }
}

export default function ManageLocations() {
  const { divisions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState<any>(null);

  // Reset editing state on successful action
  useEffect(() => {
    if (actionData?.success) {
      setEditingItem(null);
      // Optional: Clear selections or keep them for rapid entry
    }
  }, [actionData]);

  const [activeTab, setActiveTab] = useState<
    "division" | "district" | "constituency" | "upazila" | "union" | "center"
  >("division");

  // Filtered lists for dropdowns
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>("");
  const [selectedUnion, setSelectedUnion] = useState<string>("");

  const handleEdit = (item: any, type: string, parents: any = {}) => {
    setEditingItem(item);
    setActiveTab(type as any);
    if (parents.divisionId) setSelectedDivision(parents.divisionId);
    if (parents.districtId) setSelectedDistrict(parents.districtId);
    if (parents.constituencyId) setSelectedConstituency(parents.constituencyId);
    else setSelectedConstituency(""); // Reset if not present (e.g. editing district)
    if (parents.upazilaId) setSelectedUpazila(parents.upazilaId);
    if (parents.unionId) setSelectedUnion(parents.unionId);
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const handleDelete = (id: string, type: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("type", type);
      formData.append("id", id);
      submit(formData, { method: "post" });
    }
  };

  const districts =
    divisions.find((d: any) => d.id === selectedDivision)?.districts || [];
  const constituencies =
    districts.find((d: any) => d.id === selectedDistrict)?.constituencies || [];
  // Filter upazilas by constituency if selected, otherwise show all in district
  const allDistrictUpazilas =
    districts.find((d: any) => d.id === selectedDistrict)?.upazilas || [];
  const upazilas = selectedConstituency
    ? allDistrictUpazilas.filter(
        (u: any) => u.constituencyId === selectedConstituency,
      )
    : allDistrictUpazilas;
  const unions =
    upazilas.find((u: any) => u.id === selectedUpazila)?.unions || [];

  const filterDivisions = (divisions: any[], query: string) => {
    if (!query) return divisions;
    const lowerQuery = query.toLowerCase();

    return divisions
      .map((div) => {
        const divMatches = div.name.toLowerCase().includes(lowerQuery);
        if (divMatches) return div;

        const filteredDistricts = div.districts
          .map((dis: any) => {
            const disMatches = dis.name.toLowerCase().includes(lowerQuery);
            if (disMatches) return dis;

            const filteredConstituencies =
              dis.constituencies?.filter((c: any) =>
                c.name.toLowerCase().includes(lowerQuery),
              ) || [];

            const filteredUpazilas = dis.upazilas
              .map((upa: any) => {
                const upaMatches = upa.name.toLowerCase().includes(lowerQuery);
                if (upaMatches) return upa;

                const filteredUnions = upa.unions
                  .map((uni: any) => {
                    const uniMatches = uni.name
                      .toLowerCase()
                      .includes(lowerQuery);
                    if (uniMatches) return uni;

                    const filteredCenters =
                      uni.centers?.filter((cen: any) =>
                        cen.name.toLowerCase().includes(lowerQuery),
                      ) || [];

                    if (filteredCenters.length > 0)
                      return { ...uni, centers: filteredCenters };
                    return null;
                  })
                  .filter(Boolean);

                if (filteredUnions.length > 0)
                  return { ...upa, unions: filteredUnions };
                return null;
              })
              .filter(Boolean);

            if (
              filteredConstituencies.length > 0 ||
              filteredUpazilas.length > 0
            ) {
              return {
                ...dis,
                constituencies: filteredConstituencies,
                upazilas: filteredUpazilas,
              };
            }
            return null;
          })
          .filter(Boolean);

        if (filteredDistricts.length > 0)
          return { ...div, districts: filteredDistricts };
        return null;
      })
      .filter(Boolean);
  };

  const filteredDivisions = filterDivisions(divisions, searchQuery);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Manage Locations</h1>
      </div>

      {actionData?.success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center">
          <Check className="h-4 w-4 mr-2" />
          Successfully added!
        </div>
      )}

      {actionData?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {actionData.error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Tabs */}
        <div className="flex space-x-2 border-b mb-6 pb-2 overflow-x-auto">
          {[
            "division",
            "district",
            "constituency",
            "upazila",
            "union",
            "center",
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab as any);
                setEditingItem(null);
                // Reset selections if desired, or keep context
              }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize ${
                activeTab === tab
                  ? "bg-slate-100 text-slate-900 border-b-2 border-red-500"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Add {tab === "union" ? "Union/Pourashava" : tab}
            </button>
          ))}
        </div>

        {/* Forms */}
        <Form method="post" className="space-y-4 max-w-lg">
          <input type="hidden" name="type" value={activeTab} />
          <input
            type="hidden"
            name="intent"
            value={editingItem ? "update" : "create"}
          />
          {editingItem && (
            <input type="hidden" name="id" value={editingItem.id} />
          )}

          {/* Cascading Dropdowns based on activeTab hierarchy */}
          {activeTab !== "division" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Division
              </label>
              <select
                name="divisionId"
                required
                className="w-full border rounded px-3 py-2"
                onChange={(e) => {
                  setSelectedDivision(e.target.value);
                  setSelectedDistrict("");
                  setSelectedConstituency("");
                  setSelectedUpazila("");
                  setSelectedUnion("");
                }}
                value={selectedDivision}
              >
                <option value="">-- Select Division --</option>
                {divisions.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === "upazila" ||
            activeTab === "union" ||
            activeTab === "center" ||
            activeTab === "constituency") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select District
              </label>
              <select
                name="districtId"
                required
                className="w-full border rounded px-3 py-2"
                disabled={!selectedDivision}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedConstituency("");
                  setSelectedUpazila("");
                  setSelectedUnion("");
                }}
                value={selectedDistrict}
              >
                <option value="">-- Select District --</option>
                {districts.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === "upazila" ||
            activeTab === "union" ||
            activeTab === "center") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Constituency (Optional)
              </label>
              <select
                name="constituencyId"
                className="w-full border rounded px-3 py-2"
                disabled={!selectedDistrict}
                onChange={(e) => {
                  setSelectedConstituency(e.target.value);
                  setSelectedUpazila("");
                  setSelectedUnion("");
                }}
                value={selectedConstituency}
              >
                <option value="">-- Select Constituency (Optional) --</option>
                {constituencies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.seatNumber ? `${c.seatNumber}: ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === "union" || activeTab === "center") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Upazila
              </label>
              <select
                name="upazilaId"
                required
                className="w-full border rounded px-3 py-2"
                disabled={!selectedDistrict}
                onChange={(e) => {
                  setSelectedUpazila(e.target.value);
                  setSelectedUnion("");
                }}
                value={selectedUpazila}
              >
                <option value="">-- Select Upazila --</option>
                {upazilas.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "center" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Union
              </label>
              <select
                name="unionId"
                required
                className="w-full border rounded px-3 py-2"
                disabled={!selectedUpazila}
                onChange={(e) => setSelectedUnion(e.target.value)}
                value={selectedUnion}
              >
                <option value="">-- Select Union --</option>
                {unions.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab !== "constituency" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {activeTab === "center"
                  ? "Vote Center Name"
                  : activeTab === "union"
                    ? "Union/Pourashava Name"
                    : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Name`}
              </label>
              <input
                key={editingItem ? `name-${editingItem.id}` : "name-new"}
                type="text"
                name="name"
                required
                defaultValue={editingItem?.name || ""}
                placeholder={`Enter ${activeTab} name`}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          )}

          {activeTab === "constituency" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Seat Number (e.g. Pabna-1)
              </label>
              <input
                key={editingItem ? `seat-${editingItem.id}` : "seat-new"}
                type="text"
                name="seatNumber"
                required
                defaultValue={editingItem?.seatNumber || ""}
                placeholder="Enter seat number"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          )}

          {activeTab === "union" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    key={
                      editingItem
                        ? `type-union-${editingItem.id}`
                        : "type-union-new"
                    }
                    type="radio"
                    name="unionType"
                    value="UNION"
                    defaultChecked={
                      !editingItem || editingItem.type === "UNION"
                    }
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>Union</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    key={
                      editingItem
                        ? `type-pourashava-${editingItem.id}`
                        : "type-pourashava-new"
                    }
                    type="radio"
                    name="unionType"
                    value="POURASHAVA"
                    defaultChecked={editingItem?.type === "POURASHAVA"}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>Pourashava</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`text-white px-6 py-2 rounded hover:opacity-90 transition-colors flex items-center ${
                editingItem
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isSubmitting ? (
                "Saving..."
              ) : editingItem ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Update {activeTab}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Add {activeTab}
                </>
              )}
            </button>
            {editingItem && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-slate-200 text-slate-700 px-6 py-2 rounded hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </Form>
      </div>

      {/* Preview Hierarchy */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700">Current Hierarchy</h3>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm border rounded focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {filteredDivisions.length === 0 && (
            <p className="text-slate-400 text-sm">
              {searchQuery
                ? "No matching locations found."
                : "No data found. Start by adding a Division."}
            </p>
          )}
          {filteredDivisions.map((div: any) => (
            <details key={div.id} className="group" open={!!searchQuery}>
              <summary className="cursor-pointer font-medium text-slate-800 hover:text-red-600 flex items-center">
                <ChevronRight className="h-4 w-4 mr-1 group-open:rotate-90 transition-transform" />
                {div.name}
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleEdit(div, "division");
                    }}
                    className="text-blue-500 hover:text-blue-700 p-1"
                    title="Edit Division"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(div.id, "division");
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete Division"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </summary>
              <div className="pl-6 mt-2 space-y-2 border-l-2 border-slate-200 ml-2">
                {div.districts.map((dis: any) => (
                  <details key={dis.id} className="group" open={!!searchQuery}>
                    <summary className="cursor-pointer text-slate-700 hover:text-red-600 flex items-center text-sm">
                      <ChevronRight className="h-3 w-3 mr-1 group-open:rotate-90 transition-transform" />
                      {dis.name}
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleEdit(dis, "district", { divisionId: div.id });
                          }}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Edit District"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(dis.id, "district");
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete District"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </summary>
                    <div className="pl-6 mt-1 space-y-1 border-l-2 border-slate-100 ml-2">
                      {/* Constituencies List */}
                      {dis.constituencies && dis.constituencies.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Constituencies
                          </h4>
                          {dis.constituencies.map((constituency: any) => (
                            <div
                              key={constituency.id}
                              className="text-sm text-blue-700 pl-2 border-l-2 border-blue-200 mb-1"
                            >
                              <div className="flex items-center group/item">
                                <div className="flex items-center">
                                  {constituency.seatNumber && (
                                    <span className="font-bold mr-1">
                                      {constituency.seatNumber}:
                                    </span>
                                  )}
                                  {constituency.name}
                                </div>
                                <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleEdit(constituency, "constituency", {
                                        divisionId: div.id,
                                        districtId: dis.id,
                                      });
                                    }}
                                    className="text-blue-500 hover:text-blue-700 p-1"
                                    title="Edit Constituency"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDelete(
                                        constituency.id,
                                        "constituency",
                                      );
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Delete Constituency"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              {/* Show Upazilas under this Constituency */}
                              <div className="ml-2 mt-1 border-l border-slate-200 pl-2">
                                {dis.upazilas
                                  .filter(
                                    (u: any) =>
                                      u.constituencyId === constituency.id,
                                  )
                                  .map((upa: any) => (
                                    <details
                                      key={upa.id}
                                      className="group"
                                      open={!!searchQuery}
                                    >
                                      <summary className="cursor-pointer text-slate-600 hover:text-red-600 flex items-center text-sm">
                                        <ChevronRight className="h-3 w-3 mr-1 group-open:rotate-90 transition-transform" />
                                        {upa.name}
                                        <div className="flex items-center space-x-1 ml-2">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleEdit(upa, "upazila", {
                                                divisionId: div.id,
                                                districtId: dis.id,
                                                constituencyId: constituency.id,
                                              });
                                            }}
                                            className="text-blue-500 hover:text-blue-700 p-1"
                                            title="Edit Upazila"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleDelete(upa.id, "upazila");
                                            }}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="Delete Upazila"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </summary>
                                      <div className="pl-6 mt-1 ml-2">
                                        {upa.unions.map((uni: any) => (
                                          <details
                                            key={uni.id}
                                            className="group"
                                            open={!!searchQuery}
                                          >
                                            <summary className="cursor-pointer text-slate-500 hover:text-red-600 flex items-center text-sm">
                                              <ChevronRight className="h-3 w-3 mr-1 group-open:rotate-90 transition-transform" />
                                              {uni.name}{" "}
                                              {uni.type === "POURASHAVA"
                                                ? "(Pourashava)"
                                                : ""}
                                              <div className="flex items-center space-x-1 ml-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    handleEdit(uni, "union", {
                                                      divisionId: div.id,
                                                      districtId: dis.id,
                                                      upazilaId: upa.id,
                                                    });
                                                  }}
                                                  className="text-blue-500 hover:text-blue-700 p-1"
                                                  title="Edit Union"
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    handleDelete(
                                                      uni.id,
                                                      "union",
                                                    );
                                                  }}
                                                  className="text-red-500 hover:text-red-700 p-1"
                                                  title="Delete Union"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </div>
                                            </summary>
                                            <div className="pl-6 mt-1 ml-2 text-xs text-slate-400">
                                              {uni.centers.map(
                                                (center: any) => (
                                                  <div
                                                    key={center.id}
                                                    className="py-0.5 flex items-center group/item"
                                                  >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></div>
                                                    {center.name}
                                                    <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                      <button
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          handleEdit(
                                                            center,
                                                            "center",
                                                            {
                                                              divisionId:
                                                                div.id,
                                                              districtId:
                                                                dis.id,
                                                              upazilaId: upa.id,
                                                              unionId: uni.id,
                                                            },
                                                          );
                                                        }}
                                                        className="text-blue-500 hover:text-blue-700 p-1"
                                                        title="Edit Center"
                                                      >
                                                        <Pencil className="h-3 w-3" />
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          handleDelete(
                                                            center.id,
                                                            "center",
                                                          );
                                                        }}
                                                        className="text-red-500 hover:text-red-700 p-1"
                                                        title="Delete Center"
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ),
                                              )}
                                              {uni.centers.length === 0 && (
                                                <div className="italic opacity-50">
                                                  No centers
                                                </div>
                                              )}
                                            </div>
                                          </details>
                                        ))}
                                      </div>
                                    </details>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upazilas List (Not assigned to any constituency) */}
                      {dis.upazilas.filter((u: any) => !u.constituencyId)
                        .length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">
                            Other Upazilas
                          </h4>
                          {dis.upazilas
                            .filter((u: any) => !u.constituencyId)
                            .map((upa: any) => (
                              <details
                                key={upa.id}
                                className="group"
                                open={!!searchQuery}
                              >
                                <summary className="cursor-pointer text-slate-600 hover:text-red-600 flex items-center text-sm">
                                  <ChevronRight className="h-3 w-3 mr-1 group-open:rotate-90 transition-transform" />
                                  {upa.name}
                                  <div className="flex items-center space-x-1 ml-2">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleEdit(upa, "upazila", {
                                          divisionId: div.id,
                                          districtId: dis.id,
                                        });
                                      }}
                                      className="text-blue-500 hover:text-blue-700 p-1"
                                      title="Edit Upazila"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleDelete(upa.id, "upazila");
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1"
                                      title="Delete Upazila"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </summary>
                                <div className="pl-6 mt-1 ml-2">
                                  {upa.unions.map((uni: any) => (
                                    <details
                                      key={uni.id}
                                      className="group"
                                      open={!!searchQuery}
                                    >
                                      <summary className="cursor-pointer text-slate-500 hover:text-red-600 flex items-center text-sm">
                                        <ChevronRight className="h-3 w-3 mr-1 group-open:rotate-90 transition-transform" />
                                        {uni.name}{" "}
                                        {uni.type === "POURASHAVA"
                                          ? "(Pourashava)"
                                          : ""}
                                        <div className="flex items-center space-x-1 ml-2">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleEdit(uni, "union", {
                                                divisionId: div.id,
                                                districtId: dis.id,
                                                upazilaId: upa.id,
                                              });
                                            }}
                                            className="text-blue-500 hover:text-blue-700 p-1"
                                            title="Edit Union"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleDelete(uni.id, "union");
                                            }}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="Delete Union"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </summary>
                                      <div className="pl-6 mt-1 ml-2 text-xs text-slate-400">
                                        {uni.centers.map((center: any) => (
                                          <div
                                            key={center.id}
                                            className="py-0.5 flex items-center group/item"
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></div>
                                            {center.name}
                                            <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                              <button
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  handleEdit(center, "center", {
                                                    divisionId: div.id,
                                                    districtId: dis.id,
                                                    upazilaId: upa.id,
                                                    unionId: uni.id,
                                                  });
                                                }}
                                                className="text-blue-500 hover:text-blue-700 p-1"
                                                title="Edit Center"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  handleDelete(
                                                    center.id,
                                                    "center",
                                                  );
                                                }}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Delete Center"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        {uni.centers.length === 0 && (
                                          <div className="italic opacity-50">
                                            No centers
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              </details>
                            ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
