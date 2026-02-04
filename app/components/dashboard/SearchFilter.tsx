import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useFetcher, useSearchParams, useNavigate } from "react-router";

interface LocationOption {
  id: string;
  name: string;
}

export function SearchFilter() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [divisions, setDivisions] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [upazilas, setUpazilas] = useState<LocationOption[]>([]);
  const [unions, setUnions] = useState<LocationOption[]>([]);
  const [centers, setCenters] = useState<LocationOption[]>([]);

  const [selectedDivision, setSelectedDivision] = useState(
    searchParams.get("divisionId") || "",
  );
  const [selectedDistrict, setSelectedDistrict] = useState(
    searchParams.get("districtId") || "",
  );
  const [selectedUpazila, setSelectedUpazila] = useState(
    searchParams.get("upazilaId") || "",
  );
  const [selectedUnion, setSelectedUnion] = useState(
    searchParams.get("unionId") || "",
  );
  const [selectedCenter, setSelectedCenter] = useState(
    searchParams.get("centerId") || "",
  );

  // Load divisions on mount
  useEffect(() => {
    fetcher.load("/api/locations?type=division");
  }, []);

  // Pre-load child options if URL params exist
  useEffect(() => {
    if (selectedDivision)
      fetcher.load(`/api/locations?type=district&parentId=${selectedDivision}`);
    if (selectedDistrict)
      fetcher.load(`/api/locations?type=upazila&parentId=${selectedDistrict}`);
    if (selectedUpazila)
      fetcher.load(`/api/locations?type=union&parentId=${selectedUpazila}`);
    if (selectedUnion)
      fetcher.load(`/api/locations?type=center&parentId=${selectedUnion}`);
  }, []); // Run once on mount

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const { type, data } = fetcher.data as {
        type: string;
        data: LocationOption[];
      };
      // Prevent overwriting with empty arrays if we are loading multiple things
      // Only set if data is valid
      if (type === "division") setDivisions(data);
      if (type === "district") setDistricts(data);
      if (type === "upazila") setUpazilas(data);
      if (type === "union") setUnions(data);
      if (type === "center") setCenters(data);
    }
  }, [fetcher.data, fetcher.state]);

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (selectedDivision) params.set("divisionId", selectedDivision);
    if (selectedDistrict) params.set("districtId", selectedDistrict);
    if (selectedUpazila) params.set("upazilaId", selectedUpazila);
    if (selectedUnion) params.set("unionId", selectedUnion);
    if (selectedCenter) params.set("centerId", selectedCenter);
    
    // Navigate to /results with the params
    // Use navigate from react-router for client-side transition
    navigate(`/results?${params.toString()}`);
  };

  const handleDivisionChange = (id: string) => {
    setSelectedDivision(id);
    setSelectedDistrict("");
    setSelectedUpazila("");
    setSelectedUnion("");
    setSelectedCenter("");
    if (id) fetcher.load(`/api/locations?type=district&parentId=${id}`);
  };

  const handleDistrictChange = (id: string) => {
    setSelectedDistrict(id);
    setSelectedUpazila("");
    setSelectedUnion("");
    setSelectedCenter("");
    if (id) fetcher.load(`/api/locations?type=upazila&parentId=${id}`);
  };

  const handleUpazilaChange = (id: string) => {
    setSelectedUpazila(id);
    setSelectedUnion("");
    setSelectedCenter("");
    if (id) fetcher.load(`/api/locations?type=union&parentId=${id}`);
  };

  const handleUnionChange = (id: string) => {
    setSelectedUnion(id);
    setSelectedCenter("");
    if (id) fetcher.load(`/api/locations?type=center&parentId=${id}`);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
        <Search className="mr-2 h-5 w-5 text-red-600" />
        Search Results by Location
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Division */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Division
          </label>
          <select
            className="w-full border rounded text-sm px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none"
            value={selectedDivision}
            onChange={(e) => handleDivisionChange(e.target.value)}
          >
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* District */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            District
          </label>
          <select
            className="w-full border rounded text-sm px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={!selectedDivision}
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Upazila */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Upazila
          </label>
          <select
            className="w-full border rounded text-sm px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
            value={selectedUpazila}
            onChange={(e) => handleUpazilaChange(e.target.value)}
            disabled={!selectedDistrict}
          >
            <option value="">All Upazilas</option>
            {upazilas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Union */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Union
          </label>
          <select
            className="w-full border rounded text-sm px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
            value={selectedUnion}
            onChange={(e) => handleUnionChange(e.target.value)}
            disabled={!selectedUpazila}
          >
            <option value="">All Unions</option>
            {unions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Center */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Vote Center
          </label>
          <select
            className="w-full border rounded text-sm px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            disabled={!selectedUnion}
          >
            <option value="">All Centers</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold text-sm transition-colors flex items-center disabled:opacity-50"
          disabled={!selectedDivision}
          onClick={handleFilter}
        >
          <Search className="h-4 w-4 mr-2" />
          Filter Results
        </button>
      </div>
    </div>
  );
}
