import type { MapTile, TileKind } from "@/domain/guardian-heart/types/game";

export type CanonicalMapTileLayout = {
  tileId: string;
  q: number;
  r: number;
  kind: TileKind;
  labelZh: string;
  ring: 0 | 1 | 2;
  adjacentTileIds: string[];
};

export const CANONICAL_MAP_LAYOUT_V1: CanonicalMapTileLayout[] = [
  { tileId: "C", q: 0, r: 0, kind: "center", labelZh: "中央大道", ring: 0, adjacentTileIds: ["I1", "I2", "I3", "I4", "I5", "I6"] },

  { tileId: "I1", q: 1, r: 0, kind: "risk", labelZh: "東街窄巷", ring: 1, adjacentTileIds: ["C", "I2", "I6", "O1", "O2", "O12"] },
  { tileId: "I2", q: 0, r: 1, kind: "safe", labelZh: "南方廣場", ring: 1, adjacentTileIds: ["C", "I1", "I3", "O2", "O3", "O4"] },
  { tileId: "I3", q: -1, r: 1, kind: "risk", labelZh: "西南暗道", ring: 1, adjacentTileIds: ["C", "I2", "I4", "O4", "O5", "O6"] },
  { tileId: "I4", q: -1, r: 0, kind: "safe", labelZh: "西側林道", ring: 1, adjacentTileIds: ["C", "I3", "I5", "O6", "O7", "O8"] },
  { tileId: "I5", q: 0, r: -1, kind: "risk", labelZh: "北風走廊", ring: 1, adjacentTileIds: ["C", "I4", "I6", "O8", "O9", "O10"] },
  { tileId: "I6", q: 1, r: -1, kind: "safe", labelZh: "東北市集", ring: 1, adjacentTileIds: ["C", "I1", "I5", "O10", "O11", "O12"] },

  { tileId: "O1", q: 2, r: 0, kind: "risk", labelZh: "東側斷橋", ring: 2, adjacentTileIds: ["I1", "O2", "O12"] },
  { tileId: "O2", q: 1, r: 1, kind: "safe", labelZh: "東南石階", ring: 2, adjacentTileIds: ["I1", "I2", "O1", "O3"] },
  { tileId: "O3", q: 0, r: 2, kind: "safe", labelZh: "南邊水井", ring: 2, adjacentTileIds: ["I2", "O2", "O4"] },
  { tileId: "O4", q: -1, r: 2, kind: "shelter", labelZh: "南庇護所", ring: 2, adjacentTileIds: ["I2", "I3", "O3", "O5"] },
  { tileId: "O5", q: -2, r: 2, kind: "risk", labelZh: "西南崩壁", ring: 2, adjacentTileIds: ["I3", "O4", "O6"] },
  { tileId: "O6", q: -2, r: 1, kind: "safe", labelZh: "西邊舊牆", ring: 2, adjacentTileIds: ["I3", "I4", "O5", "O7"] },
  { tileId: "O7", q: -2, r: 0, kind: "station", labelZh: "西物資站", ring: 2, adjacentTileIds: ["I4", "O6", "O8"] },
  { tileId: "O8", q: -1, r: -1, kind: "safe", labelZh: "西北高台", ring: 2, adjacentTileIds: ["I4", "I5", "O7", "O9"] },
  { tileId: "O9", q: 0, r: -2, kind: "shelter", labelZh: "北庇護所", ring: 2, adjacentTileIds: ["I5", "O8", "O10"] },
  { tileId: "O10", q: 1, r: -2, kind: "safe", labelZh: "東北老巷", ring: 2, adjacentTileIds: ["I5", "I6", "O9", "O11"] },
  { tileId: "O11", q: 2, r: -2, kind: "risk", labelZh: "東北險徑", ring: 2, adjacentTileIds: ["I6", "O10", "O12"] },
  { tileId: "O12", q: 2, r: -1, kind: "station", labelZh: "東物資站", ring: 2, adjacentTileIds: ["I1", "I6", "O1", "O11"] },
];

export const CANONICAL_MAP_V1: MapTile[] = CANONICAL_MAP_LAYOUT_V1.map((tile) => ({
  tileId: tile.tileId,
  nameZh: tile.labelZh,
  kind: tile.kind,
  adjacentTileIds: tile.adjacentTileIds,
}));

export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * (3 / 2) * q,
    y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  };
}

export function mapLayoutToPercentages(size = 1) {
  const points = CANONICAL_MAP_LAYOUT_V1.map((tile) => {
    const { x, y } = axialToPixel(tile.q, tile.r, size);
    return { tileId: tile.tileId, x, y };
  });
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  return Object.fromEntries(points.map((point) => [
    point.tileId,
    {
      x: 12 + ((point.x - minX) / width) * 76,
      y: 10 + ((point.y - minY) / height) * 76,
    },
  ])) as Record<string, { x: number; y: number }>;
}
