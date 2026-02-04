import { prisma } from "~/lib/prisma.server";

export type VoteResult = {
  candidateName: string;
  partyName: string;
  voteCount: number;
  percentage: number;
  color: string;
  symbol?: string;
};

export type PartySeat = {
  partyName: string;
  seats: number;
  color: string;
};

export type LocationStats = {
  locationName: string;
  locationType: string;
  totalVotes: number;
  results: VoteResult[];
  leadingParty?: { name: string; color: string; count: number };
  partySeats?: PartySeat[];
};

function getPartyColor(party: string) {
  const p = party.trim();
  const colors: Record<string, string> = {
    "BNP": "border-green-500",
    "Awami League": "border-red-500",
    "Jamat-e-Islami": "border-sky-500",
    "Bangladesh Jamaat-e-Islami": "border-sky-500",
    "Jatiya Party": "border-yellow-500",
  };
  return colors[p] || "border-slate-500";
}

export async function getVoteStats(
  filter: any,
  locationName: string,
  locationType: string,
): Promise<LocationStats> {
  // Fetch aggregated votes
  const votes = await prisma.voteEntry.groupBy({
    by: ["candidateId"],
    where: filter,
    _sum: {
      voteCount: true,
    },
  });

  // Calculate total votes
  const totalVotes = votes.reduce(
    (sum: number, v: any) => sum + (v._sum.voteCount || 0),
    0,
  );

  // Fetch candidate details
  const candidates = await prisma.candidate.findMany();

  const results = votes
    .map((v: any) => {
      const candidate = candidates.find((c: any) => c.id === v.candidateId);
      const count = v._sum.voteCount || 0;
      const percentage =
        totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : "0";

      return {
        candidateName: candidate?.name || "Unknown",
        partyName: candidate?.party || "Unknown",
        voteCount: count,
        percentage: parseFloat(percentage),
        color: getPartyColor(candidate?.party || ""),
        symbol: candidate?.symbol || undefined,
      };
    })
    .sort((a: any, b: any) => b.voteCount - a.voteCount);

  const leadingParty =
    results.length > 0
      ? {
          name: results[0].partyName,
          color: results[0].color,
          count: results[0].voteCount,
        }
      : undefined;

  // Calculate Party Seats for higher levels
  let partySeats: PartySeat[] | undefined;
  if (["National", "Division", "District"].includes(locationType)) {
    let constituencyFilter: any = {};

    if (locationType === "Division") {
      const divId = filter?.center?.union?.upazila?.district?.divisionId;
      if (divId) constituencyFilter = { district: { divisionId: divId } };
    } else if (locationType === "District") {
      const distId = filter?.center?.union?.upazila?.districtId;
      if (distId) constituencyFilter = { districtId: distId };
    }

    const constituencies = await prisma.constituency.findMany({
      where: constituencyFilter,
      include: {
        candidates: {
          select: { id: true, party: true },
        },
      },
    });

    const allCandidateIds = constituencies.flatMap((c) =>
      c.candidates.map((cand) => cand.id),
    );

    if (allCandidateIds.length > 0) {
      const voteCounts = await prisma.voteEntry.groupBy({
        by: ["candidateId"],
        where: {
          candidateId: { in: allCandidateIds },
        },
        _sum: { voteCount: true },
      });

      const voteMap = new Map(
        voteCounts.map((v) => [v.candidateId, v._sum.voteCount || 0]),
      );

      const seats: Record<string, number> = {};

      for (const c of constituencies) {
        let maxVotes = -1;
        let winnerParty = null;

        for (const cand of c.candidates) {
          const v = voteMap.get(cand.id) || 0;
          if (v > maxVotes) {
            maxVotes = v;
            winnerParty = cand.party;
          }
        }

        if (winnerParty && maxVotes > 0) {
          seats[winnerParty] = (seats[winnerParty] || 0) + 1;
        }
      }

      partySeats = Object.entries(seats)
        .map(([partyName, count]) => ({
          partyName,
          seats: count,
          color: getPartyColor(partyName),
        }))
        .sort((a, b) => b.seats - a.seats);
    }
  }

  return {
    locationName,
    locationType,
    totalVotes,
    results,
    leadingParty,
    partySeats,
  };
}

export async function getChildLocations(
  type:
    | "division"
    | "district"
    | "constituency"
    | "upazila"
    | "union"
    | "center",
  parentId?: string,
) {
  if (type === "division") {
    // Parent is null (National) -> Fetch Divisions
    return await prisma.division.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { districts: true } } },
    });
  } else if (type === "district" && parentId) {
    return await prisma.district.findMany({
      where: { divisionId: parentId },
      orderBy: { name: "asc" },
      include: { _count: { select: { constituencies: true } } },
    });
  } else if (type === "constituency" && parentId) {
    return await prisma.constituency.findMany({
      where: { districtId: parentId },
      orderBy: { seatNumber: "asc" },
      include: { _count: { select: { upazilas: true } } },
    });
  } else if (type === "upazila" && parentId) {
    return await prisma.upazila.findMany({
      where: { constituencyId: parentId },
      orderBy: { name: "asc" },
      include: { _count: { select: { unions: true } } },
    });
  } else if (type === "union" && parentId) {
    return await prisma.union.findMany({
      where: { upazilaId: parentId },
      orderBy: { name: "asc" },
      include: { _count: { select: { centers: true } } },
    });
  } else if (type === "center" && parentId) {
    return await prisma.voteCenter.findMany({
      where: { unionId: parentId },
      orderBy: { name: "asc" },
    });
  }
  return [];
}
