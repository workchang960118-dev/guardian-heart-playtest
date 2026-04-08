import React from "react";
import { CANONICAL_MAP_V1, axialToPixel, hexPoints, Tile } from "./map-layout-v1.claude";

// ──────────── 顏色對照 ────────────
const TILE_COLORS: Record<string, string> = {
  central: "#FFD54F", // 金黃 — 中央大道
  normal:  "#E0E0E0", // 淺灰 — 一般地格
  risk:    "#EF5350", // 紅色 — 風險地格
  station: "#66BB6A", // 綠色 — 物資站（+SR）
  shelter: "#42A5F5", // 藍色 — 庇護所（+SP）
};

const TILE_STROKE: Record<string, string> = {
  central: "#F9A825",
  normal:  "#9E9E9E",
  risk:    "#C62828",
  station: "#2E7D32",
  shelter: "#1565C0",
};

const TILE_ICONS: Record<string, string> = {
  central: "🏛️",
  normal:  "",
  risk:    "⚠️",
  station: "📦",
  shelter: "🛖",
};

// ──────────── 設定 ────────────
const HEX_SIZE = 52;
const SVG_WIDTH = 640;
const SVG_HEIGHT = 560;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT / 2;

// ──────────── 單個六角格 ────────────
interface HexTileProps {
  tile: Tile;
  cx: number;
  cy: number;
  size: number;
}

const HexTile: React.FC<HexTileProps> = ({ tile, cx, cy, size }) => {
  const points = hexPoints(cx, cy, size);
  const fill = TILE_COLORS[tile.type] ?? "#E0E0E0";
  const stroke = TILE_STROKE[tile.type] ?? "#9E9E9E";
  const icon = TILE_ICONS[tile.type] ?? "";

  return (
    <g>
      {/* 六角形 */}
      <polygon
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth={2.5}
        opacity={0.92}
      />
      {/* 圖示 */}
      {icon && (
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={18}
        >
          {icon}
        </text>
      )}
      {/* 名稱 */}
      <text
        x={cx}
        y={cy + (icon ? 8 : 0)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={tile.type === "central" ? 700 : 500}
        fill="#333"
      >
        {tile.label}
      </text>
      {/* ID（右下小字） */}
      <text
        x={cx + size * 0.38}
        y={cy + size * 0.55}
        textAnchor="middle"
        fontSize={8}
        fill="#888"
      >
        {tile.id}
      </text>
    </g>
  );
};

// ──────────── 地圖主元件 ────────────
const GuardianHeartMap: React.FC = () => {
  return (
    <svg
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: "transparent" }}
    >
      {/* 鄰接線（底層） */}
      {CANONICAL_MAP_V1.tiles.map((tile: Tile) => {
        const from = axialToPixel(tile.q, tile.r, HEX_SIZE);
        return tile.neighbors.map((nId: string) => {
          const nb = CANONICAL_MAP_V1.tiles.find((t: Tile) => t.id === nId);
          if (!nb || nb.id < tile.id) return null; // 避免重複繪製
          const to = axialToPixel(nb.q, nb.r, HEX_SIZE);
          return (
            <line
              key={`${tile.id}-${nId}`}
              x1={CENTER_X + from.x}
              y1={CENTER_Y + from.y}
              x2={CENTER_X + to.x}
              y2={CENTER_Y + to.y}
              stroke="#BDBDBD"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          );
        });
      })}

      {/* 六角格（上層） */}
      {CANONICAL_MAP_V1.tiles.map((tile: Tile) => {
        const { x, y } = axialToPixel(tile.q, tile.r, HEX_SIZE);
        return (
          <HexTile
            key={tile.id}
            tile={tile}
            cx={CENTER_X + x}
            cy={CENTER_Y + y}
            size={HEX_SIZE}
          />
        );
      })}

      {/* 圖例 */}
      {[
        { type: "central", label: "中央大道" },
        { type: "normal", label: "一般地格" },
        { type: "risk", label: "風險地格" },
        { type: "station", label: "物資站 (+SR)" },
        { type: "shelter", label: "庇護所 (+SP)" },
      ].map((item, i) => (
        <g key={item.type} transform={`translate(16, ${16 + i * 22})`}>
          <rect
            width={14}
            height={14}
            rx={3}
            fill={TILE_COLORS[item.type]}
            stroke={TILE_STROKE[item.type]}
            strokeWidth={1.5}
          />
          <text x={20} y={11} fontSize={12} fill="#555">
            {item.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default GuardianHeartMap;
