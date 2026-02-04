import { prisma } from "~/lib/prisma.server";
import { getSession, commitSession, destroySession } from "~/sessions.server";
import bcrypt from "bcryptjs";
import { redirect } from "react-router";

export async function login({ username, password }: any) {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) return null;

  const isCorrectPassword = await bcrypt.compare(password, user.password);
  if (!isCorrectPassword) return null;

  return user;
}

export async function createUser(data: any) {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      username: data.username,
      password: hashedPassword,
      role: data.role || "SUB_USER",
      email: data.email || null,
      mobile: data.mobile || null,
    },
  });
}

export async function updateUser(userId: string, data: any) {
  const updateData: any = {
    username: data.username,
    role: data.role,
    email: data.email || null,
    mobile: data.mobile || null,
  };

  if (data.password && data.password.trim() !== "") {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function getUserSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return session;
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
    return user;
  } catch {
    throw logout(request);
  }
}

export async function requireUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    throw redirect("/login");
  }
  return userId;
}

export async function requireAdmin(request: Request) {
  const user = await getUser(request);
  if (!user || user.role !== "ADMIN") {
    throw redirect("/login");
  }
  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

// Helper to seed initial admin if needed
export async function seedInitialAdmin() {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" },
  });

  if (adminCount === 0) {
    console.log("Seeding initial admin user...");
    await createUser({
      username: "admin",
      password: "password123",
      role: "ADMIN",
    });
  }
}
