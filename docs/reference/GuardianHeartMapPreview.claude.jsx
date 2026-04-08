import React from "react";

// ──── Types ────
const TILE_COLORS = {
  central: "#FFD54F",
  normal:  "#E8E8E8",
  risk:    "#EF5350",
  station: "#66BB6A",
  shelter: "#42A5F5",
};
const TILE_STROKE = {
  central: "#F9A825",
  normal:  "#BDBDBD",
  risk:    "#C62828",
  station: "#2E7D32",
  shelter: "#1565C0",
};
const TILE_ICONS = {
  central: "🏛️",
  normal:  "",
  risk:    "⚠️",
  station: "📦",
  shelter: "🛖",
};

// ──── Map Data (CANONICAL_MAP_V1) ────
const tiles = [
  { id:"C0",  q:0,  r:0,  type:"central", label:"中央大道",  ring:0, neighbors:["I1","I2","I3","I4","I5","I6"] },
  { id:"I1",  q:1,  r:0,  type:"risk",    label:"東街窄巷",  ring:1, neighbors:["C0","I2","I6","O1","O2","O12"] },
  { id:"I2",  q:0,  r:1,  type:"normal",  label:"南方廣場",  ring:1, neighbors:["C0","I1","I3","O2","O3","O4"] },
  { id:"I3",  q:-1, r:1,  type:"risk",    label:"西南暗道",  ring:1, neighbors:["C0","I2","I4","O4","O5","O6"] },
  { id:"I4",  q:-1, r:0,  type:"normal",  label:"西側林道",  ring:1, neighbors:["C0","I3","I5","O6","O7","O8"] },
  { id:"I5",  q:0,  r:-1, type:"risk",    label:"北風走廊",  ring:1, neighbors:["C0","I4","I6","O8","O9","O10"] },
  { id:"I6",  q:1,  r:-1, type:"normal",  label:"東北市集",  ring:1, neighbors:["C0","I1","I5","O10","O11","O12"] },
  { id:"O1",  q:2,  r:0,  type:"risk",    label:"東側斷橋",  ring:2, neighbors:["I1","O2","O12"] },
  { id:"O2",  q:1,  r:1,  type:"normal",  label:"東南石階",  ring:2, neighbors:["I1","I2","O1","O3"] },
  { id:"O3",  q:0,  r:2,  type:"normal",  label:"南邊水井",  ring:2, neighbors:["I2","O2","O4"] },
  { id:"O4",  q:-1, r:2,  type:"shelter", label:"南庇護所",  ring:2, neighbors:["I2","I3","O3","O5"] },
  { id:"O5",  q:-2, r:2,  type:"risk",    label:"西南崩壁",  ring:2, neighbors:["I3","O4","O6"] },
  { id:"O6",  q:-2, r:1,  type:"normal",  label:"西邊舊牆",  ring:2, neighbors:["I3","I4","O5","O7"] },
  { id:"O7",  q:-2, r:0,  type:"station", label:"西物資站",  ring:2, neighbors:["I4","O6","O8"] },
  { id:"O8",  q:-1, r:-1, type:"normal",  label:"西北高台",  ring:2, neighbors:["I4","I5","O7","O9"] },
  { id:"O9",  q:0,  r:-2, type:"shelter", label:"北庇護所",  ring:2, neighbors:["I5","O8","O10"] },
  { id:"O10", q:1,  r:-2, type:"normal",  label:"東北老巷",  ring:2, neighbors:["I5","I6","O9","O11"] },
  { id:"O11", q:2,  r:-2, type:"risk",    label:"東北險徑",  ring:2, neighbors:["I6","O10","O12"] },
  { id:"O12", q:2,  r:-1, type:"station", label:"東物資站",  ring:2, neighbors:["I1","I6","O1","O11"] },
];

const tileById = Object.fromEntries(tiles.map(t => [t.id, t]));

function axialToPixel(q, r, size) {
  return {
    x: size * (3 / 2) * q,
    y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  };
}

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

const HEX = 50;
const W = 620;
const H = 560;
const CX = W / 2;
const CY = H / 2 + 10;

export default function GuardianHeartMapPreview() {
  const [hover, setHover] = React.useState(null);
  const hovered = hover ? tileById[hover] : null;

  // Edges (deduplicated)
  const edges = [];
  const seen = new Set();
  tiles.forEach(t => {
    t.neighbors.forEach(nId => {
      const key = [t.id, nId].sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        const nb = tileById[nId];
        if (nb) edges.push({ from: t, to: nb });
      }
    });
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, background: "var(--bg, #fafafa)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text, #222)" }}>
        《守護之心》核心首版地圖 v1
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>
        19 格 · 1 central / 8 normal / 6 risk / 2 station / 2 shelter
      </p>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto" }}>
        {/* Edges */}
        {edges.map(({ from, to }) => {
          const a = axialToPixel(from.q, from.r, HEX);
          const b = axialToPixel(to.q, to.r, HEX);
          const isHighlight = hover && (from.id === hover || to.id === hover);
          return (
            <line
              key={`${from.id}-${to.id}`}
              x1={CX + a.x} y1={CY + a.y}
              x2={CX + b.x} y2={CY + b.y}
              stroke={isHighlight ? "#FF9800" : "#D0D0D0"}
              strokeWidth={isHighlight ? 2.5 : 1}
              strokeDasharray={isHighlight ? "" : "4 3"}
            />
          );
        })}

        {/* Hex tiles */}
        {tiles.map(t => {
          const { x, y } = axialToPixel(t.q, t.r, HEX);
          const px = CX + x;
          const py = CY + y;
          const pts = hexPoints(px, py, HEX);
          const isHover = hover === t.id;
          const isNeighbor = hovered && hovered.neighbors.includes(t.id);
          const icon = TILE_ICONS[t.type] || "";

          return (
            <g
              key={t.id}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <polygon
                points={pts}
                fill={TILE_COLORS[t.type]}
                stroke={isHover ? "#FF6F00" : isNeighbor ? "#FFA726" : TILE_STROKE[t.type]}
                strokeWidth={isHover ? 3.5 : isNeighbor ? 2.5 : 2}
                opacity={isHover ? 1 : isNeighbor ? 0.95 : 0.88}
              />
              {icon && (
                <text x={px} y={py - 11} textAnchor="middle" dominantBaseline="central" fontSize={16}>
                  {icon}
                </text>
              )}
              <text
                x={px} y={py + (icon ? 7 : -2)}
                textAnchor="middle" dominantBaseline="central"
                fontSize={t.type === "central" ? 12 : 10.5}
                fontWeight={t.type === "central" ? 700 : 500}
                fill="#333"
              >
                {t.label}
              </text>
              <text
                x={px} y={py + (icon ? 20 : 12)}
                textAnchor="middle" fontSize={8.5} fill="#777"
              >
                ({t.q},{t.r})
              </text>
              <text
                x={px + HEX * 0.42} y={py - HEX * 0.45}
                textAnchor="middle" fontSize={8} fill="#999" fontWeight={600}
              >
                {t.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
        {[
          { type: "central", label: "中央大道 (1)" },
          { type: "normal",  label: "一般地格 (8)" },
          { type: "risk",    label: "風險地格 (6)" },
          { type: "station", label: "物資站 (2)" },
          { type: "shelter", label: "庇護所 (2)" },
        ].map(item => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: TILE_COLORS[item.type],
              border: `2px solid ${TILE_STROKE[item.type]}`,
            }} />
            <span style={{ fontSize: 12, color: "#555" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Hover info */}
      {hovered && (
        <div style={{
          marginTop: 12, padding: "8px 14px", background: "#f5f5f5",
          borderRadius: 8, fontSize: 13, color: "#444", textAlign: "center",
        }}>
          <strong>{hovered.id}</strong> {hovered.label}
          {" · "}類型: {hovered.type}
          {" · "}圈層: {hovered.ring === 0 ? "中央" : hovered.ring === 1 ? "內圈" : "外圈"}
          {" · "}鄰接: {hovered.neighbors.join(", ")}
        </div>
      )}
    </div>
  );
}
