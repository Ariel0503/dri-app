import { supabase } from "./supabase";

const TABLE = "app_state";

export const storage = {
  // Returns { key, value } where value is a JSON string, or null if not found.
  async get(key) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("key, value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // value is stored as jsonb; stringify so callers can JSON.parse() as before.
    return { key: data.key, value: JSON.stringify(data.value) };
  },

  // value arrives as a JSON string (callers do JSON.stringify before calling).
  async set(key, value) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },

  async delete(key) {
    const { error } = await supabase.from(TABLE).delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true };
  },

  async list(prefix = "") {
    let q = supabase.from(TABLE).select("key");
    if (prefix) q = q.like("key", `${prefix}%`);
    const { data, error } = await q;
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix };
  },
};