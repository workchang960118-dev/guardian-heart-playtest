// ============================================================
// 《守護之心 Guardian Heart》 核心首版固定地圖 v1
// 19 格六角地圖 ─ axial coordinates (flat-top)
// 座標系統: axial (q, r)，flat-top orientation
// pixel 轉換: x = size * 3/2 * q
//              y = size * (√3/2 * q + √3 * r)
// ============================================================

export type TileType = "central" | "normal" | "risk" | "station" | "shelter";

export interface Tile {
  /** 唯一識別碼 */
  id: string;
  /** axial 座標 q */
  q: number;
  /** axial 座標 r */
  r: number;
  /** 地格類型 */
  type: TileType;
  /** 顯示用中文名稱 */
  label: string;
  /** 所屬圈層：0=中央, 1=內圈, 2=外圈 */
  ring: 0 | 1 | 2;
  /** 相鄰地格 id 列表 */
  neighbors: string[];
}

export interface MapLayout {
  version: string;
  totalTiles: number;
  tiles: Tile[];
}

export const CANONICAL_MAP_V1: MapLayout = {
  version: "1.0.0",
  totalTiles: 19,
  tiles: [
    // ──────────── Ring 0：中央 ────────────
    {
      id: "C0",
      q: 0,
      r: 0,
      type: "central",
      label: "中央大道",
      ring: 0,
      neighbors: ["I1", "I2", "I3", "I4", "I5", "I6"],
    },

    // ──────────── Ring 1：內圈（6 格）────────────
    // 內圈不放功能點，僅 normal / risk
    {
      id: "I1",
      q: 1,
      r: 0,
      type: "risk",
      label: "東街窄巷",
      ring: 1,
      neighbors: ["C0", "I2", "I6", "O1", "O2", "O12"],
    },
    {
      id: "I2",
      q: 0,
      r: 1,
      type: "normal",
      label: "南方廣場",
      ring: 1,
      neighbors: ["C0", "I1", "I3", "O2", "O3", "O4"],
    },
    {
      id: "I3",
      q: -1,
      r: 1,
      type: "risk",
      label: "西南暗道",
      ring: 1,
      neighbors: ["C0", "I2", "I4", "O4", "O5", "O6"],
    },
    {
      id: "I4",
      q: -1,
      r: 0,
      type: "normal",
      label: "西側林道",
      ring: 1,
      neighbors: ["C0", "I3", "I5", "O6", "O7", "O8"],
    },
    {
      id: "I5",
      q: 0,
      r: -1,
      type: "risk",
      label: "北風走廊",
      ring: 1,
      neighbors: ["C0", "I4", "I6", "O8", "O9", "O10"],
    },
    {
      id: "I6",
      q: 1,
      r: -1,
      type: "normal",
      label: "東北市集",
      ring: 1,
      neighbors: ["C0", "I1", "I5", "O10", "O11", "O12"],
    },

    // ──────────── Ring 2：外圈（12 格）────────────
    // 物資站、庇護所皆在此圈；交錯分布於四個方向
    {
      id: "O1",
      q: 2,
      r: 0,
      type: "risk",
      label: "東側斷橋",
      ring: 2,
      neighbors: ["I1", "O2", "O12"],
    },
    {
      id: "O2",
      q: 1,
      r: 1,
      type: "normal",
      label: "東南石階",
      ring: 2,
      neighbors: ["I1", "I2", "O1", "O3"],
    },
    {
      id: "O3",
      q: 0,
      r: 2,
      type: "normal",
      label: "南邊水井",
      ring: 2,
      neighbors: ["I2", "O2", "O4"],
    },
    {
      id: "O4",
      q: -1,
      r: 2,
      type: "shelter",
      label: "南庇護所",
      ring: 2,
      neighbors: ["I2", "I3", "O3", "O5"],
    },
    {
      id: "O5",
      q: -2,
      r: 2,
      type: "risk",
      label: "西南崩壁",
      ring: 2,
      neighbors: ["I3", "O4", "O6"],
    },
    {
      id: "O6",
      q: -2,
      r: 1,
      type: "normal",
      label: "西邊舊牆",
      ring: 2,
      neighbors: ["I3", "I4", "O5", "O7"],
    },
    {
      id: "O7",
      q: -2,
      r: 0,
      type: "station",
      label: "西物資站",
      ring: 2,
      neighbors: ["I4", "O6", "O8"],
    },
    {
      id: "O8",
      q: -1,
      r: -1,
      type: "normal",
      label: "西北高台",
      ring: 2,
      neighbors: ["I4", "I5", "O7", "O9"],
    },
    {
      id: "O9",
      q: 0,
      r: -2,
      type: "shelter",
      label: "北庇護所",
      ring: 2,
      neighbors: ["I5", "O8", "O10"],
    },
    {
      id: "O10",
      q: 1,
      r: -2,
      type: "normal",
      label: "東北老巷",
      ring: 2,
      neighbors: ["I5", "I6", "O9", "O11"],
    },
    {
      id: "O11",
      q: 2,
      r: -2,
      type: "risk",
      label: "東北險徑",
      ring: 2,
      neighbors: ["I6", "O10", "O12"],
    },
    {
      id: "O12",
      q: 2,
      r: -1,
      type: "station",
      label: "東物資站",
      ring: 2,
      neighbors: ["I1", "I6", "O1", "O11"],
    },
  ],
};

// ──────────── 輔助工具 ────────────

/** 以 id 快速查找 tile */
export const TILE_MAP = new Map<string, Tile>(
  CANONICAL_MAP_V1.tiles.map((t) => [t.id, t])
);

/** flat-top hex：axial → pixel 座標 */
export function axialToPixel(
  q: number,
  r: number,
  size: number
): { x: number; y: number } {
  const x = size * (3 / 2) * q;
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

/** flat-top hex 頂點路徑（供 SVG / Canvas） */
export function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(
      `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`
    );
  }
  return pts.join(" ");
}
