import { useState } from "react";
import { Gauge, AlertTriangle, Layers, FileBarChart, Cog, LogOut, Plus, Check, ChevronRight, Save } from "lucide-react";

/* ============================================================================
   DATA LAYER — Supabase wiring (do this in YOUR repo, not the artifact sandbox)
   ----------------------------------------------------------------------------
   In src/supabaseClient.js, create the client with createClient() from the
   supabase-js package, passing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   from your env, and export it as `supabase`.

   Auth gate:      supabase.auth.getSession() / signInWithPassword({ email, password }) / signOut()
   Save settings:  supabase.from('regions').upsert(rows)  (one upsert per section)
   Brick checks:   supabase.from('brick_checks').upsert({ country_id, brick_id, checked })
   RLS in the SQL schema already restricts writes to admin/editor roles.

   The preview below uses in-memory state so you can see everything working.
============================================================================ */

/* ---------- palette (your required backgrounds + accessible chrome) -------- */
const C_BLUE = "#D2E0FB", C_CREAM = "#F9F3CC", C_GREEN = "#D7E5CA", C_STEEL = "#8EACCD";
const NAVY = "#1e3a5f";          // headers
const NAVY_SIDEBAR = "#16304d";  // sidebar — slightly DARKER than headers
const LT = "#eef3fb", LINE = "#d7e0ee", INK = "#1e293b", SOFT = "#64748b";
const FH = "'Jost','Century Gothic','Calibri',sans-serif";

/* ---------- helpers --------------------------------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, "0");
const fmtD = iso => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${pad(d)}/${pad(m)}/${y}`; };
const parseD = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim()); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : null; };
const validD = s => !s || parseD(s) !== null;
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = iso => iso ? Math.round((new Date(iso) - new Date(todayISO())) / 864e5) : null;
const dl = d => d === null ? "No date" : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today" : `${d}d left`;
const dc = d => d === null ? SOFT : d < 0 ? "#dc2626" : d < 14 ? "#ea580c" : d < 30 ? "#b45309" : "#15803d";
const sc = v => v >= 80 ? "#15803d" : v >= 60 ? "#16a34a" : v >= 40 ? "#b45309" : v >= 20 ? "#ea580c" : "#dc2626";
const sb = v => v >= 80 ? C_GREEN : v >= 60 ? "#e7f0da" : v >= 40 ? C_CREAM : v >= 20 ? "#fbe6d2" : "#fbdcdc";
const sl = v => v >= 80 ? "On track" : v >= 60 ? "Good" : v >= 40 ? "Needs attention" : v >= 20 ? "At risk" : "Critical";
const SEVC = { critical: "#dc2626", high: "#ea580c", medium: "#b45309", low: "#475569" };
const SEVB = { critical: "#fbdcdc", high: "#fbe6d2", medium: C_CREAM, low: "#e2e8f0" };
const SEVR = { critical: 4, high: 3, medium: 2, low: 1 };
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;

/* ---------- scoring (wave- AND offer-scoped blocks feed the score) --------- */
function nextWave(c, waves) {
  const wa = (c.waveAssignments || []).filter(w => w.goLiveDate);
  if (!wa.length) return null;
  const up = wa.filter(w => daysUntil(w.goLiveDate) >= 0).sort((a, b) => a.goLiveDate.localeCompare(b.goLiveDate));
  const chosen = up[0] || [...wa].sort((a, b) => a.goLiveDate.localeCompare(b.goLiveDate))[0];
  return { ...chosen, name: waves.find(w => w.id === chosen.waveId)?.name || "—" };
}
function blockApplies(b, c, waveId) {
  if (b.scope === "wave") return b.waveId === waveId;          // wave-level
  return (c.offers || []).includes(b.offerId);                // offer-level
}
function countryScore(c, waveId, deps, blocks, bricks) {
  let wsum = 0, acc = 0;
  deps.forEach(dep => {
    const depBlocks = blocks.filter(b => b.depId === dep.id && blockApplies(b, c, waveId));
    const ids = bricks.filter(br => depBlocks.some(b => b.id === br.blockId));
    if (!ids.length) return;
    const done = ids.filter(br => c.checks?.[br.id]).length;
    wsum += dep.weight; acc += dep.weight * (done / ids.length);
  });
  return wsum ? Math.round(acc / wsum * 100) : 0;
}

/* ---------- shared UI (all at module scope) -------------------------------- */
const s = {
  card: { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 },
  h: { fontFamily: FH, fontWeight: 800, color: NAVY },
  lbl: { fontSize: 11, fontWeight: 700, color: SOFT, textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 4 },
  inp: { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: INK, outline: "none", boxSizing: "border-box" },
  btn: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnG: { background: "transparent", color: SOFT, border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  xbtn: { background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600, color: SOFT, cursor: "pointer" },
  chip: (col, bg) => ({ fontSize: 10, fontWeight: 700, color: col, background: bg, padding: "2px 8px", borderRadius: 20 }),
};
function Ring({ v, size = 48 }) {
  const r = size / 2 - 4, C = 2 * Math.PI * r, col = sc(v);
  return <svg width={size} height={size} role="img" aria-label={`${v}%`}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e9f4" strokeWidth="4" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round"
      strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * .28} fontWeight="800" fill={col} fontFamily={FH}>{v}</text>
  </svg>;
}
const Bar = ({ v, color }) => <div style={{ flex: 1, height: 8, background: "#e2e9f4", borderRadius: 6, overflow: "hidden" }}>
  <div style={{ width: `${v}%`, height: "100%", background: color, borderRadius: 6, transition: "width .6s" }} /></div>;

/* ---------- LOGIN (focus-safe: defined at module scope) -------------------- */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const submit = () => { if (email.trim() && pw) onLogin(email.trim()); };
  // In your repo: await supabase.auth.signInWithPassword({ email, password: pw })
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${C_STEEL},${C_BLUE})` }}>
    <div style={{ ...s.card, width: 340, padding: 28 }}>
      <div style={{ ...s.h, fontSize: 20, marginBottom: 4 }}>Transformation Readiness</div>
      <div style={{ fontSize: 12, color: SOFT, marginBottom: 20 }}>Sign in to continue</div>
      <label style={s.lbl}>Email</label>
      <input style={{ ...s.inp, marginBottom: 12 }} value={email} onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()} placeholder="you@example.com" autoFocus />
      <label style={s.lbl}>Password</label>
      <input type="password" style={{ ...s.inp, marginBottom: 18 }} value={pw} onChange={e => setPw(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" />
      <button style={{ ...s.btn, width: "100%" }} onClick={submit}>Sign in</button>
      <div style={{ fontSize: 10, color: SOFT, marginTop: 14, textAlign: "center" }}>Demo: any email + password works in this preview.</div>
    </div>
  </div>;
}

/* ---------- SETTINGS sub-forms (module scope = focus is retained) ---------- */
function ListSettings({ title, bg, items, setItems, fields, onSave, saved }) {
  const blank = Object.fromEntries(fields.map(f => [f.k, ""]));
  const [draft, setDraft] = useState(items);
  const [neu, setNeu] = useState(blank);
  const upd = (id, k, v) => setDraft(d => d.map(x => x.id === id ? { ...x, [k]: v } : x));
  const add = () => { if (fields.some(f => f.req && !neu[f.k])) return; setDraft(d => [...d, { id: uid(), ...neu }]); setNeu(blank); };
  const save = () => { setItems(draft); onSave(); };
  return <div style={{ ...s.card, background: bg, marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ ...s.h, fontSize: 15 }}>{title}</div>
      <button style={s.btn} onClick={save}><Save size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{saved ? "Saved ✓" : "Save"}</button>
    </div>
    {draft.map(it => <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${LINE}` }}>
      {fields.map(f => <div key={f.k} style={{ flex: f.w || 1 }}>
        <input style={{ ...s.inp, borderColor: f.k === "deadline" && !validD(it[f.k]) ? "#dc2626" : LINE }}
          value={it[f.k] || ""} placeholder={f.ph} onChange={e => upd(it.id, f.k, e.target.value)} aria-label={f.ph} />
      </div>)}
      <button style={{ ...s.xbtn, color: "#dc2626" }} onClick={() => setDraft(d => d.filter(x => x.id !== it.id))} aria-label="Remove">✕</button>
    </div>)}
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, background: "#fff", padding: 10, borderRadius: 8, border: `1px solid ${LINE}` }}>
      {fields.map(f => <input key={f.k} style={{ ...s.inp, flex: f.w || 1 }} value={neu[f.k]} placeholder={f.ph}
        onChange={e => setNeu(n => ({ ...n, [f.k]: e.target.value }))} aria-label={`New ${f.ph}`} />)}
      <button style={s.btnG} onClick={add}><Plus size={13} /></button>
    </div>
  </div>;
}

/* ---------- seed --------------------------------------------------------------- */
const SEED = {
  regions: [{ id: "r1", name: "Europe" }, { id: "r2", name: "Asia-Pacific" }],
  offers: [{ id: "of1", short: "SP", name: "Spare Parts" }, { id: "of2", short: "FS", name: "Field Services" }],
  bus: [{ id: "u1", name: "Aftermarket" }, { id: "u2", name: "Operations" }],
  waves: [{ id: "w1", name: "Wave 1", deadline: "2026-09-30" }, { id: "w2", name: "Wave 2", deadline: "2027-02-28" }],
  deps: [
    { id: "d1", label: "Data migration", color: "#6366F1", weight: 3 },
    { id: "d2", label: "Training", color: "#0ea5e9", weight: 2 },
    { id: "d3", label: "Infrastructure", color: "#10b981", weight: 1 },
  ],
  blocks: [
    { id: "bl1", depId: "d1", name: "Master data cleanse", scope: "wave", waveId: "w1" },
    { id: "bl2", depId: "d2", name: "Key-user training", scope: "offer", offerId: "of1" },
    { id: "bl3", depId: "d3", name: "Network readiness", scope: "wave", waveId: "w1" },
  ],
  bricks: [
    { id: "br1", blockId: "bl1", name: "Extract legacy" }, { id: "br2", blockId: "bl1", name: "Dedup & validate" },
    { id: "br3", blockId: "bl2", name: "Schedule sessions" }, { id: "br4", blockId: "bl3", name: "Bandwidth test" },
  ],
  countries: [
    { id: "c1", name: "France", region: "r1", offers: ["of1", "of2"], waveAssignments: [{ waveId: "w1", goLiveDate: "2026-09-30" }], checks: { br1: true, br2: true, br3: true, br4: true } },
    { id: "c2", name: "Germany", region: "r1", offers: ["of1"], waveAssignments: [{ waveId: "w1", goLiveDate: "2026-09-30" }], checks: { br1: true, br3: true } },
    { id: "c3", name: "Japan", region: "r2", offers: ["of1", "of2"], waveAssignments: [{ waveId: "w2", goLiveDate: "2027-02-28" }], checks: {} },
  ],
  obstacles: [
    { id: "o1", title: "Legacy data quality", owner: "A. Dubois", depId: "d1", severity: "critical", status: "in-progress", resolution: "Vendor cleanse + UAT", countries: ["c1", "c2"], impacts: ["o2"] },
    { id: "o2", title: "Trainer availability", owner: "M. Sato", depId: "d2", severity: "high", status: "open", resolution: "Hire 2 contractors", countries: ["c3"], impacts: [] },
    { id: "o3", title: "VPN throughput", owner: "R. Klein", depId: "d3", severity: "medium", status: "open", resolution: "Upgrade circuit", countries: ["c2"], impacts: [] },
  ],
};

const MODULES = [
  { id: "m1", name: "Readiness Score", Icon: Gauge },
  { id: "m2", name: "Obstacles & Risks", Icon: AlertTriangle },
  { id: "m3", name: "Blocks & Bricks", Icon: Layers },
  { id: "m4", name: "SteerCo Pack", Icon: FileBarChart },
  { id: "m5", name: "Settings", Icon: Cog },
];

/* ============================== APP ========================================= */
export default function App() {
  const [user, setUser] = useState(null);
  const [mod, setMod] = useState("m1");
  const [saved, setSaved] = useState(false);
  const flagSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const [regions, setRegions] = useState(SEED.regions);
  const [offers, setOffers] = useState(SEED.offers);
  const [bus, setBus] = useState(SEED.bus);
  const [waves, setWaves] = useState(SEED.waves);
  const [deps, setDeps] = useState(SEED.deps);
  const [blocks, setBlocks] = useState(SEED.blocks);
  const [bricks, setBricks] = useState(SEED.bricks);
  const [countries, setCountries] = useState(SEED.countries);
  const [obstacles, setObstacles] = useState(SEED.obstacles);

  if (!user) return <LoginScreen onLogin={email => setUser({ email, role: "admin" })} />;

  const cScore = c => { const nw = nextWave(c, waves); return countryScore(c, nw?.waveId, deps, blocks, bricks); };
  const overall = avg(countries.map(cScore));
  const openObs = obstacles.filter(o => o.status !== "resolved");

  /* ---- Module 1 ---- */
  const Readiness = () => <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY_SIDEBAR})`, borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", gap: 22 }}>
      <Ring v={overall} size={96} />
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".1em" }}>Programme readiness · weighted</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: FH }}>{sl(overall)} · {overall}%</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 4 }}>Each country scored against its next wave, weighted by enabler importance.</div>
      </div>
    </div>
    {regions.map(r => {
      const rcs = countries.filter(c => c.region === r.id); if (!rcs.length) return null;
      return <div key={r.id} style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${C_STEEL}` }}>
          <div style={{ ...s.h, fontSize: 15, flex: 1 }}>{r.name}</div>
          <Ring v={avg(rcs.map(cScore))} size={44} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
          {rcs.map(c => {
            const nw = nextWave(c, waves), v = cScore(c), crit = openObs.filter(o => o.countries.includes(c.id) && o.severity === "critical").length;
            return <div key={c.id} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 15, borderTop: `4px solid ${sc(v)}`, background: sb(v) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><div style={{ fontSize: 14, fontWeight: 800, color: INK, fontFamily: FH }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: NAVY, fontWeight: 600 }}>{nw?.name || "No wave"}</div></div>
                <Ring v={v} size={42} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: "#475569" }}>{nw?.goLiveDate ? fmtD(nw.goLiveDate) : "No date"}</span>
                <span style={{ color: dc(daysUntil(nw?.goLiveDate)), fontWeight: 700 }}>{dl(daysUntil(nw?.goLiveDate))}</span>
              </div>
              <Bar v={v} color={sc(v)} />
              {crit > 0 && <div style={{ marginTop: 6 }}><span style={s.chip("#dc2626", "#fbdcdc")}>⚠ {crit} critical</span></div>}
            </div>;
          })}
        </div>
      </div>;
    })}
  </div>;

  /* ---- Module 2 ---- */
  const Obstacles = () => {
    const cycle = id => setObstacles(os => os.map(o => o.id !== id ? o : { ...o, status: o.status === "open" ? "in-progress" : o.status === "in-progress" ? "resolved" : "open" }));
    const STL = { open: "Open", "in-progress": "In progress", resolved: "Resolved" };
    const STC = { open: "#dc2626", "in-progress": "#b45309", resolved: "#15803d" };
    const sorted = [...obstacles].sort((a, b) => SEVR[b.severity] - SEVR[a.severity]);
    return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sorted.map(o => {
        const blocked = (o.impacts || []).map(id => obstacles.find(x => x.id === id)?.title).filter(Boolean);
        return <div key={o.id} style={{ ...s.card, borderLeft: `5px solid ${SEVC[o.severity]}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={s.chip(SEVC[o.severity], SEVB[o.severity])}>{o.severity.toUpperCase()}</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, flex: 1 }}>{o.title}</div>
            <button style={s.chip(STC[o.status], "#fff")} onClick={() => cycle(o.id)} aria-label="Change status">{STL[o.status]} ⟳</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 10, fontSize: 12, color: "#475569" }}>
            <div><span style={s.lbl}>Owner</span>{o.owner || "Unassigned"}</div>
            <div><span style={s.lbl}>Enabler</span>{deps.find(d => d.id === o.depId)?.label || "—"}</div>
            <div><span style={s.lbl}>Resolution path</span>{o.resolution || "—"}</div>
            <div><span style={s.lbl}>Countries</span>{o.countries.map(id => countries.find(c => c.id === id)?.name).join(", ") || "—"}</div>
          </div>
          {blocked.length > 0 && <div style={{ marginTop: 10, padding: "8px 12px", background: LT, borderRadius: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: NAVY }}>Dependency map · blocks: </span>
            {blocked.map((t, i) => <span key={i} style={{ color: "#475569" }}>{i ? ", " : ""}{t}</span>)}
          </div>}
        </div>;
      })}
    </div>;
  };

  /* ---- Module 3: blocks & bricks at WAVE or OFFER level ---- */
  const BlocksBricks = () => {
    const totW = deps.reduce((a, d) => a + d.weight, 0) || 1;
    const setScope = (id, scope) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, scope, waveId: scope === "wave" ? (waves[0]?.id) : undefined, offerId: scope === "offer" ? (offers[0]?.id) : undefined } : b));
    const setTarget = (id, val) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...(b.scope === "wave" ? { waveId: val } : { offerId: val }) } : b));
    return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {deps.map(dep => <div key={dep.id} style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 5, height: 26, background: dep.color, borderRadius: 2 }} />
          <div style={{ ...s.h, fontSize: 15, flex: 1 }}>{dep.label}</div>
          <span style={{ fontSize: 11, color: SOFT }}>weight {dep.weight} · {Math.round(dep.weight / totW * 100)}% of score</span>
        </div>
        {blocks.filter(b => b.depId === dep.id).map(b => {
          const bbricks = bricks.filter(br => br.blockId === b.id);
          return <div key={b.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, flex: 1 }}>{b.name}</span>
              <div style={{ display: "flex", border: `1px solid ${LINE}`, borderRadius: 7, overflow: "hidden" }}>
                {["wave", "offer"].map(sk => <button key={sk} onClick={() => setScope(b.id, sk)}
                  style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", background: b.scope === sk ? NAVY : "transparent", color: b.scope === sk ? "#fff" : SOFT }}>{sk === "wave" ? "Wave level" : "Offer level"}</button>)}
              </div>
              <select value={b.scope === "wave" ? b.waveId : b.offerId} onChange={e => setTarget(b.id, e.target.value)}
                style={{ ...s.inp, width: "auto", padding: "5px 8px" }} aria-label="Scope target">
                {(b.scope === "wave" ? waves : offers).map(x => <option key={x.id} value={x.id}>{x.name || x.short}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {bbricks.map(br => <span key={br.id} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 5, background: LT, border: `1px solid ${LINE}`, color: "#475569" }}>{br.name}</span>)}
            </div>
          </div>;
        })}
      </div>)}
    </div>;
  };

  /* ---- Module 4: SteerCo pack by region + download ---- */
  const SteerCo = () => {
    const top3 = [...openObs].sort((a, b) => SEVR[b.severity] - SEVR[a.severity]).slice(0, 3);
    const crit = openObs.filter(o => o.severity === "critical").length;
    const high = openObs.filter(o => o.severity === "high").length;
    const rag = overall >= 60 ? "GREEN" : overall >= 40 ? "AMBER" : "RED";
    const dl_ = () => {
      const rows = regions.map(r => { const rcs = countries.filter(c => c.region === r.id); return `<tr><td style='padding:6px 10px;border:1px solid #ccc'><b>${r.name}</b></td><td style='padding:6px 10px;border:1px solid #ccc'>${rcs.length}</td><td style='padding:6px 10px;border:1px solid #ccc'>${avg(rcs.map(cScore))}%</td></tr>`; }).join("");
      const tops = top3.map((o, i) => `<p><b>${i + 1}. ${o.title}</b> [${o.severity.toUpperCase()}]<br/>Owner: ${o.owner} · Resolution: ${o.resolution}</p>`).join("");
      const html = `<html><head><meta charset='utf-8'></head><body style='font-family:Calibri'><h1>SteerCo Pack — ${fmtD(todayISO())}</h1><h2>RAG: ${rag} (${overall}%)</h2><h3>Readiness by region</h3><table style='border-collapse:collapse'>${rows}</table><h3>Top 3 obstacles</h3>${tops}</body></html>`;
      const blob = new Blob([html], { type: "application/msword" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `SteerCo_${todayISO()}.doc`; a.click();
    };
    return <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ ...s.h, fontSize: 18 }}>SteerCo Pack</div>
        <button style={s.btn} onClick={dl_}>⬇ Download (.doc)</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Readiness", `${overall}%`, sb(overall)], ["RAG", rag, C_BLUE], ["Critical", crit, "#fbdcdc"], ["High", high, C_CREAM]].map(([l, v, bg]) =>
          <div key={l} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, textAlign: "center", background: bg }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, fontFamily: FH }}>{v}</div><div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{l}</div></div>)}
      </div>
      {regions.map(r => { const rcs = countries.filter(c => c.region === r.id); if (!rcs.length) return null;
        return <div key={r.id} style={{ marginBottom: 14 }}>
          <div style={{ ...s.h, fontSize: 14, marginBottom: 6 }}>{r.name} — {avg(rcs.map(cScore))}%</div>
          {rcs.map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <span style={{ width: 110, fontSize: 12, fontWeight: 600 }}>{c.name}</span><Bar v={cScore(c)} color={sc(cScore(c))} />
            <span style={{ width: 40, textAlign: "right", fontWeight: 800, color: sc(cScore(c)), fontSize: 13 }}>{cScore(c)}%</span></div>)}
        </div>;
      })}
      <div style={{ ...s.h, fontSize: 14, margin: "14px 0 8px" }}>Top 3 obstacles</div>
      {top3.map((o, i) => <div key={o.id} style={{ padding: "8px 12px", background: SEVB[o.severity], borderLeft: `4px solid ${SEVC[o.severity]}`, borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
        <b>{i + 1}. {o.title}</b> — {o.owner} · {o.resolution}</div>)}
    </div>;
  };

  /* ---- Module 5: Settings (save buttons + focus-safe inputs) ---- */
  const Settings = () => <div>
    <div style={{ fontSize: 12, color: SOFT, marginBottom: 14 }}>Configure regions, countries, waves, offers and business units. Each section saves independently. Wave deadlines use dd/mm/yyyy.</div>
    <ListSettings title="Regions" bg={C_BLUE} items={regions} setItems={setRegions} onSave={flagSaved} saved={saved}
      fields={[{ k: "name", ph: "Region name", req: true }]} />
    <ListSettings title="Waves" bg={C_CREAM} items={waves} setItems={setWaves} onSave={flagSaved} saved={saved}
      fields={[{ k: "name", ph: "Wave name", req: true, w: 2 }, { k: "deadline", ph: "dd/mm/yyyy", w: 1 }]} />
    <ListSettings title="Offers" bg={C_GREEN} items={offers} setItems={setOffers} onSave={flagSaved} saved={saved}
      fields={[{ k: "short", ph: "Code", w: 1 }, { k: "name", ph: "Offer name", req: true, w: 3 }]} />
    <ListSettings title="Business Units" bg={C_BLUE} items={bus} setItems={setBus} onSave={flagSaved} saved={saved}
      fields={[{ k: "name", ph: "Unit name", req: true }]} />
  </div>;

  const BODY = { m1: Readiness, m2: Obstacles, m3: BlocksBricks, m4: SteerCo, m5: Settings }[mod];
  const active = MODULES.find(m => m.id === mod);

  return <div style={{ minHeight: "100vh", display: "flex", background: "#f4f7fc", fontFamily: "system-ui,sans-serif", color: INK }}>
    {/* darker sidebar */}
    <nav aria-label="Modules" style={{ width: 230, background: NAVY_SIDEBAR, padding: 14, flexShrink: 0 }}>
      <div style={{ color: "#fff", fontWeight: 800, fontFamily: FH, fontSize: 17, marginBottom: 2 }}>Transformation</div>
      <div style={{ color: "#cfe0f5", fontSize: 11, marginBottom: 18 }}>Today: {fmtD(todayISO())}</div>
      {MODULES.map(({ id, name, Icon }) => { const on = id === mod;
        return <button key={id} onClick={() => setMod(id)} aria-current={on ? "page" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 3, textAlign: "left", fontSize: 13, fontWeight: on ? 700 : 500, background: on ? "#fff" : "transparent", color: on ? NAVY : "#dbe6f5" }}>
          <Icon size={17} aria-hidden /> {name}</button>;
      })}
    </nav>
    <main style={{ flex: 1, padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        {active && <active.Icon size={22} style={{ color: NAVY, marginRight: 8 }} aria-hidden />}
        <h1 style={{ ...s.h, fontSize: 20, flex: 1 }}>{active.name}</h1>
        {saved && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 700, marginRight: 14 }}><Check size={13} style={{ verticalAlign: "-2px" }} /> Saved</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 12px", background: "#fff", borderRadius: 10, border: `1px solid ${LINE}` }}>
          <Ring v={overall} size={30} />
          <div><div style={{ fontSize: 9, color: SOFT, fontWeight: 700, textTransform: "uppercase" }}>{user.email}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: sc(overall) }}>{sl(overall)} · {overall}%</div></div>
          <button style={s.xbtn} onClick={() => setUser(null)} aria-label="Sign out"><LogOut size={13} /></button>
        </div>
      </header>
      <BODY />
    </main>
  </div>;
}
