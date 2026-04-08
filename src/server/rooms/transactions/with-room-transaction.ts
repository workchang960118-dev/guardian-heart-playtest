import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 第一版最小骨架。
 * 後續若改成 Postgres transaction / RPC，再替換這裡。
 */
export async function withRoomTransaction<T>(params: {
  client: SupabaseClient;
  run: (tx: SupabaseClient) => Promise<T>;
}): Promise<T> {
  return params.run(params.client);
}
