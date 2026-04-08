import { CANONICAL_MAP_V1 } from "@/domain/guardian-heart/seeds/map/canonical-map-layout-v1";

/**
 * 19 格固定版型地圖。
 * 目前改以 canonical-map-layout-v1 為單一資料來源，
 * 讓 lobby preview、正式局面與後續視覺地圖都共用同一套座標與命名口徑。
 */
export const MINIMAL_MAP = CANONICAL_MAP_V1;
