import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("results", "routes/results.tsx"),
  route("division", "routes/division_list.tsx"),
  route("district", "routes/district_list.tsx"),
  route("upazila", "routes/upazila_list.tsx"),
  route("union", "routes/union_list.tsx"),
  route("centers", "routes/center_list.tsx"),
  route(
    ":division/:district/:upazila/:union/:center",
    "routes/center_details.tsx",
  ),
  route("api/locations", "routes/api/locations.ts"),
  route("api/votes", "routes/api/votes.ts"),

  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/index.tsx"),
    route("locations", "routes/admin/locations.tsx"),
    route("entries", "routes/admin/entries.tsx"),
    route("users", "routes/admin/users.tsx"),
    route("candidates", "routes/admin/candidates.tsx"),
    // Add other admin routes here
  ]),
] satisfies RouteConfig;
