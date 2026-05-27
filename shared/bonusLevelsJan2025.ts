/**
 * Bonus Levels for Jan 2025 by Area — sourced from HGV compensation standards (3/9/2025).
 * Levels 0–8 with # salespeople, avg tier volume, CMI cost %.
 */

export interface BonusLevelTier {
  level: number;
  salespeopleCount: number;
  avgTierVolume: number;
  totalTierVolume: number;
  totalCmi: number;
  costPct: number;
}

export interface BonusLevelArea {
  areaId: string;
  siteLine: string;
  smtVolume: number;
  budgetVolume: number;
  volumeVarPct: number;
  tiers: BonusLevelTier[];
}

function tiersFromPdf(counts: number[], avgVols: number[], totalVols: number[], cmis: number[], costPcts: number[]): BonusLevelTier[] {
  return counts.map((salespeopleCount, i) => ({
    level: i,
    salespeopleCount,
    avgTierVolume: avgVols[i] ?? 0,
    totalTierVolume: totalVols[i] ?? 0,
    totalCmi: cmis[i] ?? 0,
    costPct: costPcts[i] ?? 0,
  }));
}

/** Representative areas from Jan 2025 PDF — full set for manager/director breakout. */
export const BONUS_LEVELS_JAN_2025: BonusLevelArea[] = [
  {
    areaId: 'LV-HGV-AL',
    siteLine: 'LV HGV Action Line',
    smtVolume: 10_863_285,
    budgetVolume: 11_187_189,
    volumeVarPct: -3,
    tiers: tiersFromPdf(
      [28, 22, 35, 26, 24, 17, 8, 8, 6],
      [11_814, 24_641, 33_614, 52_634, 65_421, 94_873, 129_725, 121_477, 192_993],
      [330_799, 542_102, 1_176_484, 1_368_480, 1_570_102, 1_612_847, 1_037_802, 971_812, 1_157_956],
      [0, 5421, 23_530, 41_054, 62_804, 80_642, 62_268, 77_745, 115_796],
      [0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0],
    ),
  },
  {
    areaId: 'LV-HGV-IH',
    siteLine: 'LV HGV In House',
    smtVolume: 18_826_135,
    budgetVolume: 19_630_345,
    volumeVarPct: -4,
    tiers: tiersFromPdf(
      [26, 8, 15, 9, 15, 0, 0, 2, 5],
      [47_047, 126_482, 198_694, 271_270, 371_392, 0, 0, 694_387, 893_514],
      [1_223_233, 1_011_852, 2_980_404, 2_441_429, 5_570_877, 0, 0, 1_388_774, 4_467_571],
      [0, 10_119, 59_608, 73_243, 211_376, 0, 0, 76_383, 268_054],
      [0, 1.0, 2.0, 3.0, 3.8, 0, 0, 5.5, 6.0],
    ),
  },
  {
    areaId: 'ORL-HGV-AL',
    siteLine: 'Orlando HGV Action Line',
    smtVolume: 8_023_607,
    budgetVolume: 8_847_485,
    volumeVarPct: -9,
    tiers: tiersFromPdf(
      [23, 17, 11, 52, 17, 9, 3, 4, 2],
      [11_998, 23_174, 33_784, 51_774, 90_858, 101_980, 134_005, 187_697, 224_139],
      [275_955, 393_951, 371_629, 2_692_253, 1_544_586, 917_823, 402_016, 750_787, 448_278],
      [0, 3940, 7433, 80_768, 61_783, 45_891, 24_121, 60_063, 44_828],
      [0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0],
    ),
  },
  {
    areaId: 'ATL-AL',
    siteLine: 'Atlantic Action Line',
    smtVolume: 460_511,
    budgetVolume: 474_080,
    volumeVarPct: -3,
    tiers: tiersFromPdf(
      [6, 2, 0, 1, 2, 2, 1, 0, 2],
      [9368, 22_206, 0, 29_938, 45_959, 56_969, 78_766, 0, 92_324],
      [56_205, 44_411, 0, 29_938, 91_917, 113_938, 78_766, 0, 184_647],
      [0, 444, 0, 898, 3677, 5697, 4726, 0, 18_465],
      [0, 1.0, 0, 3.0, 4.0, 5.0, 6.0, 0, 10.0],
    ),
  },
  {
    areaId: 'HGV-WEST-AL',
    siteLine: 'HGV West Action Line',
    smtVolume: 2_516_869,
    budgetVolume: 2_623_478,
    volumeVarPct: -4,
    tiers: tiersFromPdf(
      [2, 3, 4, 3, 1, 1, 15, 12, 3],
      [19_645, 24_137, 46_137, 78_473, 74_026, 139_025, 25_094, 50_129, 98_691],
      [39_289, 72_410, 184_549, 235_420, 74_026, 139_025, 376_413, 601_548, 296_073],
      [0, 724, 3691, 7063, 2961, 6951, 25_379, 52_291, 32_173],
      [0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.7, 8.7, 10.9],
    ),
  },
];

export function getBonusArea(areaId: string): BonusLevelArea | undefined {
  return BONUS_LEVELS_JAN_2025.find((a) => a.areaId === areaId);
}

export function bonusLevelDistribution(areaId: string): { level: number; count: number }[] {
  const area = getBonusArea(areaId);
  if (!area) return [];
  return area.tiers.map((t) => ({ level: t.level, count: t.salespeopleCount }));
}

/** Map rep attainment % to approximate bonus tier (0–8) for team workspace overlay. */
export function attainmentToBonusLevel(attainmentPct: number): number {
  if (attainmentPct < 50) return 0;
  if (attainmentPct < 60) return 1;
  if (attainmentPct < 70) return 2;
  if (attainmentPct < 80) return 3;
  if (attainmentPct < 90) return 4;
  if (attainmentPct < 100) return 5;
  if (attainmentPct < 110) return 6;
  if (attainmentPct < 125) return 7;
  return 8;
}

export function teamBonusTierCounts(
  attainments: number[],
): { level: number; count: number }[] {
  const counts = Array.from({ length: 9 }, (_, level) => ({ level, count: 0 }));
  for (const att of attainments) {
    const level = attainmentToBonusLevel(att);
    counts[level].count += 1;
  }
  return counts;
}
