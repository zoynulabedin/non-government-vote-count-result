import type { Route } from "./+types/locations";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const parentId = url.searchParams.get("parentId");

  let data: { id: string; name: string }[] = [];

  if (type === "division") {
    data = await prisma.division.findMany({ select: { id: true, name: true } });
  } else if (type === "district" && parentId) {
    data = await prisma.district.findMany({ where: { divisionId: parentId }, select: { id: true, name: true } });
  } else if (type === "upazila" && parentId) {
    data = await prisma.upazila.findMany({ where: { districtId: parentId }, select: { id: true, name: true } });
  } else if (type === "union" && parentId) {
    data = await prisma.union.findMany({ where: { upazilaId: parentId }, select: { id: true, name: true } });
  } else if (type === "center" && parentId) {
    data = await prisma.voteCenter.findMany({ where: { unionId: parentId }, select: { id: true, name: true } });
  }

  return { type, data };
}
