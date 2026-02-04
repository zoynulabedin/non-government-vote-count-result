import { Link, Outlet, useRouteLoaderData } from "react-router";
import { LayoutDashboard, MapPin, Users, FileText, LogOut } from "lucide-react";

export default function AdminLayout() {
  const rootData = useRouteLoaderData("root") as { user: any };
  const isAdmin = rootData?.user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold flex items-center">
            <LayoutDashboard className="mr-2 text-red-500" />
            {isAdmin ? "Admin Panel" : "User Dashboard"}
          </h2>
        </div>
        <nav className="p-4 space-y-2">
          {/* Dashboard - Visible to everyone */}
          <Link
            to="/admin"
            className="flex items-center px-4 py-3 bg-slate-800 rounded-lg text-slate-100 hover:bg-slate-700 transition-colors"
          >
            <LayoutDashboard className="mr-3 h-5 w-5" />
            Dashboard
          </Link>

          {/* Manage Locations - Admin Only */}
          {isAdmin && (
            <Link
              to="/admin/locations"
              className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
            >
              <MapPin className="mr-3 h-5 w-5" />
              Manage Locations
            </Link>
          )}

          {/* Manage Users - Admin Only */}
          {isAdmin && (
            <Link
              to="/admin/users"
              className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
            >
              <Users className="mr-3 h-5 w-5" />
              Manage Users
            </Link>
          )}

          {/* Manage Candidates - Admin Only */}
          {isAdmin && (
            <Link
              to="/admin/candidates"
              className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
            >
              <FileText className="mr-3 h-5 w-5" />
              Manage Candidates
            </Link>
          )}

          {/* Vote Entries - Visible to everyone */}
          {/* Removed as it is now part of Dashboard */}
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t border-slate-800">
          <form action="/logout" method="post">
            <button
              type="submit"
              className="flex items-center w-full px-4 py-3 text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
