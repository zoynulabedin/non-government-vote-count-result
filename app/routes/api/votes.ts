import { prisma } from "~/lib/prisma.server";
import { requireUser, getUser } from "~/services/auth.server";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUser(request);
  const user = await getUser(request);
  const url = new URL(request.url);
  const centerId = url.searchParams.get("centerId");

  if (!centerId) {
    return { error: "Center ID is required" };
  }

  // Security check: If not admin, ensure assigned
  if (user?.role !== "ADMIN") {
    const center = await prisma.voteCenter.findUnique({
      where: { id: centerId },
      select: { assignedToUserId: true },
    });

    if (!center || center.assignedToUserId !== userId) {
      return { error: "Unauthorized" };
    }
  }

  const votes = await prisma.voteEntry.findMany({
    where: { centerId },
    select: {
      candidateId: true,
      voteCount: true,
      submittedByUserId: true,
    },
  });

  return { votes };
}
