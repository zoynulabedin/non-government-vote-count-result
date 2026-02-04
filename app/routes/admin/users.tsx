import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/users";
import { prisma } from "~/lib/prisma.server";
import { createUser, requireAdmin, updateUser } from "~/services/auth.server";
import { UserPlus, Shield, User, Trash2, Edit2, X } from "lucide-react";
import { useState, useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedCenters: true,
    },
  });

  const voteCenters = await prisma.voteCenter.findMany({
    orderBy: { name: "asc" },
    include: {
      union: {
        include: {
          upazila: {
            include: {
              district: true,
              constituency: true,
            },
          },
        },
      },
      assignedToUser: {
        select: {
          username: true,
        },
      },
    },
  });

  return { users, voteCenters };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "ADMIN" | "SUB_USER";
    const email = formData.get("email") as string;
    const mobile = formData.get("mobile") as string;
    const userId = formData.get("userId") as string;

    // Get all selected center IDs
    const assignedCenterIds = formData.getAll("centerIds") as string[];

    if (!username || (intent === "create" && !password)) {
      return { error: "Username and password are required" };
    }

    try {
      let targetUserId = userId;

      if (intent === "update") {
        await updateUser(userId, { username, password, role, email, mobile });
      } else {
        const newUser = await createUser({
          username,
          password,
          role,
          email,
          mobile,
        });
        targetUserId = newUser.id;
      }

      // Handle Center Assignments
      // 1. Unassign all centers currently assigned to this user
      await prisma.voteCenter.updateMany({
        where: { assignedToUserId: targetUserId },
        data: { assignedToUserId: null },
      });

      // 2. Assign selected centers to this user
      if (assignedCenterIds.length > 0) {
        await prisma.voteCenter.updateMany({
          where: { id: { in: assignedCenterIds } },
          data: { assignedToUserId: targetUserId },
        });
      }

      return {
        success: true,
        message: `User ${intent === "create" ? "created" : "updated"} successfully!`,
      };
    } catch (error: any) {
      console.error(
        `${intent === "update" ? "Update" : "Create"} user error:`,
        error,
      );
      if (error.code === "P2002" && error.meta?.target) {
        const target = error.meta.target;
        if (Array.isArray(target)) {
          if (target.includes("username"))
            return { error: "Username already exists" };
          if (target.includes("email"))
            return { error: "Email already exists" };
        }
      }
      return { error: error.message || `Failed to ${intent} user` };
    }
  }

  if (intent === "delete") {
    const userId = formData.get("userId") as string;
    try {
      // First unassign any centers
      await prisma.voteCenter.updateMany({
        where: { assignedToUserId: userId },
        data: { assignedToUserId: null },
      });

      await prisma.user.delete({ where: { id: userId } });
      return { success: true, message: "User deleted successfully!" };
    } catch (error) {
      return { error: "Failed to delete user" };
    }
  }
}

export default function ManageUsers() {
  const { users, voteCenters } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Reset editing state on successful submission
  useEffect(() => {
    if (actionData?.success) {
      setEditingUser(null);
      setSearchTerm("");
    }
  }, [actionData]);

  const filteredCenters = voteCenters.filter(
    (center: any) =>
      center.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      center.union.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      center.union.upazila.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      center.union.upazila.constituency?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      center.union.upazila.constituency?.seatNumber
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <UserPlus className="mr-2 h-6 w-6 text-red-600" />
            Manage Users
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create and manage system access
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Edit User Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 sticky top-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? "Edit User" : "Create New User"}
              </h3>
              {editingUser && (
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <Form
              key={editingUser ? editingUser.id : "new"}
              method="post"
              className="space-y-4"
            >
              <input
                type="hidden"
                name="intent"
                value={editingUser ? "update" : "create"}
              />
              {editingUser && (
                <input type="hidden" name="userId" value={editingUser.id} />
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  required
                  defaultValue={editingUser?.username || ""}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. dhaka_sub1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password{" "}
                  {editingUser && (
                    <span className="text-xs text-slate-400 font-normal">
                      (Leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  name="password"
                  required={!editingUser}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder={editingUser ? "********" : "********"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue={editingUser?.role || "SUB_USER"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="SUB_USER">Sub-User (Data Entry)</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingUser?.email || ""}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mobile No (Optional)
                </label>
                <input
                  type="text"
                  name="mobile"
                  defaultValue={editingUser?.mobile || ""}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              {/* Assign Centers Section */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign Vote Centers
                </label>

                <input
                  type="text"
                  placeholder="Search centers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 mb-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                />

                <div className="h-48 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50 space-y-1">
                  {filteredCenters.map((center: any) => {
                    const isAssignedToOther =
                      center.assignedToUserId &&
                      center.assignedToUserId !== editingUser?.id;
                    const isAssignedToCurrent =
                      center.assignedToUserId === editingUser?.id;

                    return (
                      <label
                        key={center.id}
                        className={`flex items-start space-x-2 p-1 rounded hover:bg-slate-100 ${isAssignedToOther ? "opacity-75" : ""}`}
                      >
                        <input
                          type="checkbox"
                          name="centerIds"
                          value={center.id}
                          defaultChecked={isAssignedToCurrent}
                          className="mt-1"
                        />
                        <div className="text-sm">
                          <div className="font-medium text-slate-700">
                            {center.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {center.union.name}, {center.union.upazila.name}
                            {center.union.upazila.constituency && (
                              <span className="ml-1 text-slate-400">
                                (
                                {center.union.upazila.constituency.seatNumber ||
                                  center.union.upazila.constituency.name}
                                )
                              </span>
                            )}
                            {isAssignedToOther && (
                              <span className="text-red-500 ml-1">
                                (Assigned to {center.assignedToUser?.username})
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {filteredCenters.length === 0 && (
                    <div className="text-center text-slate-400 text-xs py-4">
                      No centers found matching "{searchTerm}"
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Select centers to assign to this user.
                </div>
              </div>

              {actionData?.error && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {actionData.error}
                </div>
              )}

              {actionData?.success && !actionData.error && (
                <div className="text-green-600 text-sm bg-green-50 p-2 rounded">
                  {actionData.message}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 ${editingUser ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-900 hover:bg-slate-800"} text-white py-2 rounded-md transition-colors font-medium disabled:opacity-50`}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingUser
                      ? "Update User"
                      : "Create User"}
                </button>
                {editingUser && (
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </Form>
          </div>
        </div>

        {/* User List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700">Existing Users</h3>
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                {users.length} Users
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {users.map((user: any) => (
                <div
                  key={user.id}
                  className={`p-4 flex items-center justify-between transition-colors ${editingUser?.id === user.id ? "bg-blue-50 border-l-4 border-blue-500" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-full ${user.role === "ADMIN" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {user.role === "ADMIN" ? (
                        <Shield className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {user.username}
                      </p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        {user.role}
                        {user.assignedCenters &&
                          user.assignedCenters.length > 0 && (
                            <span className="text-blue-600 normal-case border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded-full">
                              {user.assignedCenters.length} Centers
                            </span>
                          )}
                      </p>
                      {(user.email || user.mobile) && (
                        <div className="text-xs text-slate-400 mt-1">
                          {user.email && <span>{user.email}</span>}
                          {user.email && user.mobile && <span> • </span>}
                          {user.mobile && <span>{user.mobile}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-slate-400 space-x-2">
                    <span className="mr-2 hidden sm:inline">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-slate-400 hover:text-blue-500 p-2 rounded hover:bg-blue-50 transition-colors"
                      title="Edit User"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <Form
                      method="post"
                      onSubmit={(e) =>
                        !confirm(
                          "Are you sure you want to delete this user?",
                        ) && e.preventDefault()
                      }
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Form>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No users found. Create one to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
