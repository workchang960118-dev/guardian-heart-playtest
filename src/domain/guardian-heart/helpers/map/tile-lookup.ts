
import type { MapTile } from "@/domain/guardian-heart/types/game";

export function getTileById(mapTiles: MapTile[], tileId: string | null | undefined): MapTile | null {
  if (!tileId) return null;
  return mapTiles.find((tile) => tile.tileId === tileId) ?? null;
}

export function areTilesAdjacent(mapTiles: MapTile[], fromTileId: string, toTileId: string): boolean {
  const fromTile = getTileById(mapTiles, fromTileId);
  if (!fromTile) return false;
  return fromTile.adjacentTileIds.includes(toTileId);
}

export function areTilesSameOrAdjacent(mapTiles: MapTile[], tileAId: string, tileBId: string): boolean {
  if (tileAId === tileBId) return true;
  return areTilesAdjacent(mapTiles, tileAId, tileBId) || areTilesAdjacent(mapTiles, tileBId, tileAId);
}
