import { useState, useRef, useEffect } from "react";
import { Gauge, AlertTriangle, Layers, FileBarChart, Settings as Cog, ChevronDown, ChevronRight, Plus, Trash2, Download, Calendar, GitBranch, List, Upload, FileDown, CheckSquare, Square, Save, LogOut, Lock, Pencil, CheckCheck, Eraser } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";
// STATIC import: Vite compiles the client into the main chunk, so there is no
// runtime chunk to fetch this is what kills the "/assets/supabaseClient 404".
// (The previous `await import(/* @vite-ignore */ path)` told Vite NOT to bundle
// it, leaving a bare path the browser then 404'd on.) `supabase` is the client
// when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were set at build time, else
// null — see src/supabaseClient.ts.
import { supabase as _sb } from "./supabaseClient";

/* ============================================================================
   SUPABASE PERSISTENCE (optional — preview/dev with no env vars runs in-memory)
   - Keep src/supabaseClient.ts exporting `supabase`
     (createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) or null).
   - Run the companion SQL (transformation_schema_additions.sql) once: it adds
     wave_id to brick_checks and creates the brick_exclusions table.
   - Set LOAD_FROM_DB = false if you want to disable load-on-login while testing.
============================================================================ */
const LOAD_FROM_DB = true;

// async-shaped so existing `await getSupabase()` call sites are unchanged.
async function getSupabase() { return _sb; }

/* ---------- palette ---------- */
const C = {
    blue: "#D2E0FB", yellow: "#F9F3CC", green: "#D7E5CA", mid: "#8EACCD",
    sidebar: "#7D97B4",                 // slightly darker than mid (same hue, not navy)
    ink: "#1f2a44", soft: "#51607d", line: "#c3d0e6", white: "#ffffff",
    high: "#b23b2e", med: "#9a6b12", low: "#3a7d44",
};

/* ---------- date helpers (dd/mm/yyyy <-> ISO; Excel-safe) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const validDate = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s || "");
const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
const toISODate = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fromISO = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
// Normalises anything Excel hands us (Date object, serial number, ISO, d/m/yyyy) to dd/mm/yyyy.
const excelDate = (v) => {
    if (v == null || v === "") return "";
    if (v instanceof Date) return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`;
    if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; }
    const s = String(v).trim();
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (m) return s;
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) return `${pad(+m[1])}/${pad(+m[2])}/${m[3]}`;
    const d = new Date(s); if (!isNaN(d.getTime())) return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return s;
};

/* ---------- ids: real UUIDs so Supabase upserts succeed ---------- */
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });
const gid = uid;

/* ---------- seed (UUIDs, stable cross-references) ---------- */
const ID = {
    rEMEA: uid(), rAPAC: uid(),
    cFR: uid(), cDE: uid(), cAE: uid(), cJP: uid(), cAU: uid(),
    w1: uid(), w2: uid(), o1: uid(), o2: uid(), u1: uid(), u2: uid(),
    bl1: uid(), bl2: uid(), bl3: uid(), bl4: uid(), bl5: uid(),
    bk1: uid(), bk2: uid(), bk3: uid(), bk4: uid(), bk5: uid(), bk6: uid(), bk7: uid(),
    ob1: uid(), ob2: uid(), ob3: uid(), ob4: uid(), ob5: uid(),
};

const seedRegions = [{ id: ID.rEMEA, name: "EMEA" }, { id: ID.rAPAC, name: "APAC" }];
const seedCountries = [
    { id: ID.cFR, name: "France", regionId: ID.rEMEA }, { id: ID.cDE, name: "Germany", regionId: ID.rEMEA },
    { id: ID.cAE, name: "UAE", regionId: ID.rEMEA }, { id: ID.cJP, name: "Japan", regionId: ID.rAPAC }, { id: ID.cAU, name: "Australia", regionId: ID.rAPAC },
];
const seedWaves = [{ id: ID.w1, name: "Wave 1", deadline: "30/09/2026" }, { id: ID.w2, name: "Wave 2", deadline: "31/03/2027" }];
const seedOffers = [{ id: ID.o1, name: "Core Platform" }, { id: ID.o2, name: "Analytics Add-on" }];
const seedBUs = [{ id: ID.u1, name: "Retail" }, { id: ID.u2, name: "Corporate" }];

// blocks carry weight + a scope LEVEL (wave or offer); bricks are tasks inside a block
const seedBlocks = [
    { id: ID.bl1, name: "Data migration", weight: 30, level: "wave", scope: "all" },
    { id: ID.bl2, name: "People & training", weight: 25, level: "offer", scope: ID.o1 },
    { id: ID.bl3, name: "Legal & compliance", weight: 20, level: "wave", scope: "all" },
    { id: ID.bl4, name: "Infrastructure", weight: 15, level: "wave", scope: ID.w1 },
    { id: ID.bl5, name: "Stakeholder alignment", weight: 10, level: "wave", scope: "all" },
];
const seedBricks = [
    { id: ID.bk1, name: "Extract legacy data", blockId: ID.bl1 },
    { id: ID.bk2, name: "Validate data quality", blockId: ID.bl1 },
    { id: ID.bk3, name: "Train local champions", blockId: ID.bl2 },
    { id: ID.bk4, name: "Roll out e-learning", blockId: ID.bl2 },
    { id: ID.bk5, name: "GDPR sign-off", blockId: ID.bl3 },
    { id: ID.bk6, name: "Provision cloud environment", blockId: ID.bl4 },
    { id: ID.bk7, name: "Confirm executive sponsor", blockId: ID.bl5 },
];
const seedDone = {};
seedCountries.forEach((c, ci) => seedWaves.forEach((w, wi) => seedBricks.forEach((b, bi) => {
    seedDone[`${c.id}|${w.id}|${b.id}`] = (ci + bi + wi * 2) % 3 !== 0;
})));
// brick exclusions: brickId|scopeId(wave or offer) = true means "this brick does NOT apply there"
const seedBrickExclusions = {};

const seedObstacles = [
    { id: ID.ob1, title: "GDPR data residency unresolved", owner: "L. Martin", severity: "High", countryId: ID.cFR, waveId: ID.w1, resolution: "Legal review + regional data-centre decision", blocks: [ID.ob3, ID.ob2], blockIds: [ID.bl3] },
    { id: ID.ob2, title: "Trainer availability shortfall", owner: "S. Klein", severity: "Medium", countryId: ID.cDE, waveId: ID.w1, resolution: "Hire 2 contract trainers by Q3", blocks: [], blockIds: [ID.bl2] },
    { id: ID.ob3, title: "Migration tooling not localised", owner: "A. Tan", severity: "High", countryId: ID.cJP, waveId: ID.w1, resolution: "Vendor patch + UAT", blocks: [], blockIds: [ID.bl1, ID.bl4] },
    { id: ID.ob4, title: "Sponsor turnover", owner: "R. Okafor", severity: "Low", countryId: ID.cAU, waveId: ID.w2, resolution: "Re-confirm exec sponsor", blocks: [], blockIds: [ID.bl5] },
    { id: ID.ob5, title: "Procurement delay on infra", owner: "M. Haddad", severity: "Medium", countryId: ID.cAE, waveId: ID.w1, resolution: "Escalate to SteerCo", blocks: [ID.ob3], blockIds: [ID.bl4] },
];

const seedOfferBUs = { [`${ID.o1}|${ID.u1}`]: true, [`${ID.o1}|${ID.u2}`]: true, [`${ID.o2}|${ID.u1}`]: true };
const seedWaveCountry = { [`${ID.w1}|${ID.cFR}`]: true, [`${ID.w1}|${ID.cDE}`]: true, [`${ID.w1}|${ID.cAE}`]: true, [`${ID.w1}|${ID.cJP}`]: true, [`${ID.w2}|${ID.cAU}`]: true, [`${ID.w2}|${ID.cFR}`]: true };
const seedOfferWave = { [`${ID.o1}|${ID.w1}`]: true, [`${ID.o1}|${ID.w2}`]: true, [`${ID.o2}|${ID.w1}`]: true };

const SEV = { High: C.high, Medium: C.med, Low: C.low };
const sevRank = { High: 3, Medium: 2, Low: 1 };
const sevToDb = (s) => ({ High: "high", Medium: "medium", Low: "low" }[s] || "medium");
const sevFromDb = (s) => ({ high: "High", critical: "High", medium: "Medium", low: "Low" }[s] || "Medium");
const MODULES = [
    { id: "m1", name: "Readiness Score", Icon: Gauge },
    { id: "m2", name: "Obstacles & Risks", Icon: AlertTriangle },
    { id: "m3", name: "Blocks & Bricks", Icon: Layers },
    { id: "m4", name: "SteerCo Pack", Icon: FileBarChart },
    { id: "m5", name: "Settings", Icon: Cog },
];
const keysTrue = (map) => Object.keys(map || {}).filter((k) => map[k]).map((k) => k.split("|"));

/* ---------- shared UI (all module scope = stable identity = inputs keep focus) ---------- */
const Card = ({ children, bg = C.white, style = {} }: { children: any; bg?: string; style?: any }) => (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${C.line}`, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, kind = "solid", title = "", disabled = false }: { children: any; onClick: any; kind?: string; title?: string; disabled?: boolean }) => (
    <button onClick={onClick} title={title} disabled={disabled}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
        style={{ background: kind === "solid" ? C.mid : "transparent", color: kind === "solid" ? C.white : C.ink, border: `1px solid ${C.mid}`, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>
);
const Field = ({ label, children }) => (
    <label className="block text-sm" style={{ color: C.soft }}><span className="mb-1 block font-medium" style={{ color: C.ink }}>{label}</span>{children}</label>
);
const inputStyle = { border: `1px solid ${C.line}`, background: C.white, color: C.ink };
const SevBadge = ({ s }) => (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: SEV[s] + "22", color: SEV[s], border: `1px solid ${SEV[s]}` }}>
        <AlertTriangle size={12} aria-hidden /> {s}
    </span>
);
const Stat = ({ label, value, bg }) => (
    <Card bg={bg}><div className="text-3xl font-bold" style={{ color: C.ink }}>{value}</div><div className="text-sm" style={{ color: C.soft }}>{label}</div></Card>
);
const Chip = ({ on, onClick, children, title = "" }: { on?: any; onClick?: any; children?: any; title?: string }) => (
    <button onClick={onClick} title={title} aria-pressed={on}
        className="rounded-full px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2"
        style={{ background: on ? C.mid : C.white, color: on ? C.white : C.soft, border: `1px solid ${on ? C.mid : C.line}` }}>{children}</button>
);

// Save bar shown on every module page.
const SaveBar = ({ onSave, state }) => (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ background: C.green, border: `1px solid ${C.line}` }}>
        <Btn onClick={onSave} disabled={state.status === "saving"}><Save size={16} /> {state.status === "saving" ? "Saving…" : "Save to database"}</Btn>
        {state.status === "saved" && <span className="text-sm" style={{ color: C.low }}>✓ Saved to database — {state.at}</span>}
        {state.status === "local" && <span className="text-sm" style={{ color: C.med }}>Saved in this session. Set VITE_SUPABASE_URL in your repo to persist to Supabase.</span>}
        {state.status === "error" && <span className="text-sm" style={{ color: C.high }}>Save failed: {state.msg}</span>}
        {(state.status === "idle" || state.status === "saving") && <span className="text-sm" style={{ color: C.soft }}>Changes apply live; click Save to persist to the database.</span>}
    </div>
);

// Hoisted out of App so typing in Settings no longer remounts the inputs.
const SettingsSection = ({ title, items, onAdd, onChange, onDel, extra, bg }: { title: any; items: any; onAdd: any; onChange: any; onDel: any; extra?: any; bg?: any }) => (
    <Card bg={bg} style={{ marginBottom: 12 }}>
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold" style={{ color: C.ink }}>{title}</h3><Btn onClick={onAdd}><Plus size={16} /> Add</Btn></div>
        <div className="grid gap-2">
            {items.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-2">
                    <input value={it.name} aria-label={`${title} name`} onChange={(e) => onChange(it.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg px-3 py-1.5" style={inputStyle} />
                    {extra && extra(it)}
                    <button aria-label={`Delete ${it.name}`} onClick={() => onDel(it.id)} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={16} /></button>
                </div>
            ))}
            {!items.length && <p className="text-sm" style={{ color: C.soft }}>None yet.</p>}
        </div>
    </Card>
);
const Matrix = ({ title, rows, cols, map, setMap, bg }) => {
    const allOn = rows.length && cols.length && rows.every((r) => cols.every((c) => map[`${r.id}|${c.id}`]));
    const setAll = (val) => { const n = { ...map }; rows.forEach((r) => cols.forEach((c) => { n[`${r.id}|${c.id}`] = val; })); setMap(n); };
    return (
        <Card bg={bg} style={{ marginBottom: 12 }}>
            <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold" style={{ color: C.ink }}>{title}</h3>
                <div className="flex gap-2">
                    <Btn kind="ghost" onClick={() => setAll(true)}><CheckCheck size={14} /> Select all</Btn>
                    <Btn kind="ghost" onClick={() => setAll(false)}><Eraser size={14} /> Clear all</Btn>
                </div>
            </div>
            <div className="overflow-auto">
                <table className="text-sm" style={{ color: C.ink }}>
                    <thead><tr><th></th>{cols.map((c) => <th key={c.id} className="px-2 py-1 text-left font-medium" style={{ color: C.soft }}>{c.name}</th>)}</tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td className="py-1 pr-3 font-medium">{r.name}</td>
                                {cols.map((c) => {
                                    const k = `${r.id}|${c.id}`; return (
                                        <td key={c.id} className="px-2 py-1 text-center">
                                            <input type="checkbox" checked={!!map[k]} aria-label={`${r.name} – ${c.name}`} onChange={() => setMap({ ...map, [k]: !map[k] })} style={{ width: 16, height: 16, accentColor: C.mid }} />
                                        </td>);
                                })}
                            </tr>
                        ))}
                        {!rows.length && <tr><td className="py-1 text-sm" style={{ color: C.soft }}>Nothing to map yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

// Add / edit form for an obstacle (module scope -> focus-safe).
const ObstacleForm = ({ value, onChange, onSave, onCancel, countries, waves, blocks, obstacles, bg = C.yellow }) => {
    const set = (p) => onChange({ ...value, ...p });
    const toggle = (key, id) => { const arr = value[key] || []; set({ [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] }); };
    return (
        <Card bg={bg} style={{ marginBottom: 16 }}>
            <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>{value._new ? "New obstacle" : "Edit obstacle"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title"><input value={value.title} onChange={(e) => set({ title: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
                <Field label="Owner"><input value={value.owner} onChange={(e) => set({ owner: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
                <Field label="Severity"><select value={value.severity} onChange={(e) => set({ severity: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle}>{["High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Country"><select value={value.countryId} onChange={(e) => set({ countryId: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Wave"><select value={value.waveId} onChange={(e) => set({ waveId: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle}>{waves.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
                <Field label="Resolution path"><input value={value.resolution} onChange={(e) => set({ resolution: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                    <span className="mb-1 block text-sm font-medium" style={{ color: C.ink }}>Affects blocks</span>
                    <div className="flex flex-wrap gap-1">
                        {blocks.map((b) => <Chip key={b.id} on={(value.blockIds || []).includes(b.id)} onClick={() => toggle("blockIds", b.id)}>{b.name}</Chip>)}
                        {!blocks.length && <span className="text-xs" style={{ color: C.soft }}>No blocks defined.</span>}
                    </div>
                </div>
                <div>
                    <span className="mb-1 block text-sm font-medium" style={{ color: C.ink }}>Dependency map — this blocks</span>
                    <div className="flex flex-wrap gap-1">
                        {obstacles.filter((o) => o.id !== value.id).map((o) => <Chip key={o.id} on={(value.blocks || []).includes(o.id)} onClick={() => toggle("blocks", o.id)}>{o.title || "(untitled)"}</Chip>)}
                        {obstacles.filter((o) => o.id !== value.id).length === 0 && <span className="text-xs" style={{ color: C.soft }}>No other obstacles.</span>}
                    </div>
                </div>
            </div>
            <div className="mt-3 flex gap-2"><Btn onClick={onSave}>Save</Btn><Btn kind="ghost" onClick={onCancel}>Cancel</Btn></div>
        </Card>
    );
};

/* ---------- Login (module scope -> focus-safe) ---------- */
function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    const submit = async () => {
        if (!email.trim() || !pw) { setErr("Enter your email and password."); return; }
        const sb = await getSupabase();
        if (sb) {
            const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
            if (error) { setErr(error.message); return; }
            let id = null;
            try { const { data } = await sb.auth.getUser(); id = data?.user?.id || null; } catch { /* ignore */ }
            onLogin({ email: email.trim(), id });
            return;
        }
        onLogin({ email: email.trim(), id: null });
    };
    return (
        <div className="flex min-h-screen w-full items-center justify-center p-4" style={{ background: "#f4f7fc", fontFamily: "system-ui, sans-serif" }}>
            <Card bg={C.blue} style={{ width: 360, padding: 28 }}>
                <div className="mb-1 flex items-center gap-2"><Lock size={18} style={{ color: C.ink }} aria-hidden /><h1 className="text-lg font-bold" style={{ color: C.ink }}>Transformation</h1></div>
                <p className="mb-5 text-sm" style={{ color: C.soft }}>Sign in to continue.</p>
                <Field label="Email">
                    <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder="you@example.com" autoFocus className="mb-3 w-full rounded-lg px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Password">
                    <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder="••••••••" className="mb-4 w-full rounded-lg px-3 py-2" style={inputStyle} />
                </Field>
                {err && <p className="mb-3 text-sm" style={{ color: C.high }}>{err}</p>}
                <button onClick={submit} className="w-full rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2" style={{ background: C.mid, color: C.white }}>Sign in</button>
                {!_sb && <p className="mt-4 text-center text-xs" style={{ color: C.soft }}>Without Supabase configured, any email + password signs in (preview mode).</p>}
            </Card>
        </div>
    );
}

export default function App() {
    const [user, setUser] = useState(null);
    const [mod, setMod] = useState("m1");
    const [regions, setRegions] = useState(seedRegions);
    const [countries, setCountries] = useState(seedCountries);
    const [waves, setWaves] = useState(seedWaves);
    const [offers, setOffers] = useState(seedOffers);
    const [bus, setBUs] = useState(seedBUs);
    const [blocks, setBlocks] = useState(seedBlocks);
    const [bricks, setBricks] = useState(seedBricks);
    const [done, setDone] = useState(seedDone);
    const [brickExcl, setBrickExcl] = useState(seedBrickExclusions);
    const [obstacles, setObstacles] = useState(seedObstacles);
    const [offerBUs, setOfferBUs] = useState(seedOfferBUs);
    const [waveCountry, setWaveCountry] = useState(seedWaveCountry);
    const [offerWave, setOfferWave] = useState(seedOfferWave);
    const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "saved" | "local" | "error"; at?: string; msg?: string }>({ status: "idle" });

    // Module-level state (declared here so the auth guard below sits after all hooks)
    const [m1Wave, setM1Wave] = useState(seedWaves[0]?.id);
    const [openCountry, setOpenCountry] = useState(null);
    const [openBlock, setOpenBlock] = useState({});
    const [fSev, setFSev] = useState("All");
    const [fCountry, setFCountry] = useState("All");
    const [fWave, setFWave] = useState("All");
    const [view, setView] = useState("list");
    const [obDraft, setObDraft] = useState(null);
    const [openB3, setOpenB3] = useState({});
    const [openBrickScope, setOpenBrickScope] = useState({});
    const [m4Region, setM4Region] = useState(seedRegions[0]?.id);
    const [m4Wave, setM4Wave] = useState(seedWaves[0]?.id);
    const chartRef = useRef(null);
    const [importMsg, setImportMsg] = useState("");

    /* ---------- scope helpers ---------- */
    // A block applies to a (country, wave) context based on its level + scope
    const blockApplies = (bl, cid, wid) => {
        const lvl = bl.level || "wave";
        if (lvl === "wave") return !bl.scope || bl.scope === "all" || bl.scope === wid;
        // offer level: applies when the offer is active in this wave (or scope = all)
        return !bl.scope || bl.scope === "all" || !!offerWave[`${bl.scope}|${wid}`];
    };
    // The dimension a brick exclusion is keyed on for this block in this wave.
    const exclScope = (bl, wid) => (bl.level === "offer") ? (bl.scope && bl.scope !== "all" ? bl.scope : null) : wid;
    const brickApplies = (bl, brickId, wid) => { const sid = exclScope(bl, wid); return !(sid && brickExcl[`${brickId}|${sid}`]); };
    const applicableBricks = (bl, wid) => bricks.filter((b) => b.blockId === bl.id && brickApplies(bl, b.id, wid));

    const blockScore = (cid, wid, bl) => {
        const bs = applicableBricks(bl, wid);
        if (!bs.length) return 0;
        return Math.round(bs.filter((b) => done[`${cid}|${wid}|${b.id}`]).length / bs.length * 100);
    };
    const readiness = (cid, wid) => {
        const appl = blocks.filter((b) => blockApplies(b, cid, wid));
        const totW = appl.reduce((a, b) => a + b.weight, 0) || 1;
        return Math.round(appl.reduce((a, b) => a + blockScore(cid, wid, b) * b.weight, 0) / totW);
    };
    const status = (v) => v >= 80 ? { t: "Ready", c: C.low } : v >= 60 ? { t: "On track", c: C.med } : v >= 40 ? { t: "At risk", c: "#c87a1a" } : { t: "Not ready", c: C.high };
    const nameOf = (id) => countries.find((c) => c.id === id)?.name ?? "—";
    const obTitle = (id) => obstacles.find((o) => o.id === id)?.title ?? id;

    // Countries assigned to a wave (Waves → Countries mapping)
    const countriesOfWave = (wid) => countries.filter((c) => waveCountry[`${wid}|${c.id}`]);

    // All applicable brick keys for a country in a wave (used by select/clear all)
    const countryBrickKeys = (cid, wid) => {
        const keys = [];
        blocks.filter((bl) => blockApplies(bl, cid, wid)).forEach((bl) => applicableBricks(bl, wid).forEach((b) => keys.push(`${cid}|${wid}|${b.id}`)));
        return keys;
    };
    const setCountryAll = (cid, wid, val) => { const n = { ...done }; countryBrickKeys(cid, wid).forEach((k) => { n[k] = val; }); setDone(n); };
    const setWaveAll = (wid, val) => { const n = { ...done }; countriesOfWave(wid).forEach((c) => countryBrickKeys(c.id, wid).forEach((k) => { n[k] = val; })); setDone(n); };

    /* ======================= PERSISTENCE =======================
       persist(d, userId) writes an explicit data snapshot to Supabase. Taking the
       data as an argument (rather than reading component state) lets the Excel
       import write straight to the DB with the freshly-parsed rows, without
       waiting a render for setState to apply.
       userId, when a valid UUID, is stamped onto brick_checks.updated_by so each
       imported/saved check is attributed to a user (the auth user id, or the
       Meta sheet's user_id — see the import + template below). */
    const snapshot = () => ({ regions, countries, waves, offers, bus, blocks, bricks, done, brickExcl, obstacles, offerBUs, waveCountry, offerWave });

    const persist = async (d, userId) => {
        setSaveState({ status: "saving" });
        const sb = await getSupabase();
        if (!sb) { setSaveState({ status: "local" }); return false; }
        try {
            // ---------- 0. canonical ids: reuse existing rows by NAME -----------
            // The Settings dimension tables (regions, countries, waves, offers,
            // business_units) carry a unique index on lower(name). The seed and the
            // Excel import can mint a NEW uuid for a name that already exists, which
            // makes the id-based upsert attempt an INSERT and trip that index (409).
            // Resolve each name to the id already in the DB and rewrite EVERY foreign
            // key onto it, so the write is always an UPDATE — no 409, and no
            // duplicate rows — whether or not the index is present. (Blocks/bricks
            // are intentionally NOT name-resolved: their names can legitimately
            // repeat, so they stay keyed by id; their references to the dimensions
            // above are still remapped below.)
            const idMap = {};
            const resolveByName = async (table, items) => {
                if (!items.length) return;
                const rows = [];
                for (let from = 0; ; from += 1000) {
                    const { data, error } = await sb.from(table).select("id,name").range(from, from + 999);
                    if (error) throw new Error(`${table} (resolve): ${error.message}`);
                    rows.push(...(data || []));
                    if (!data || data.length < 1000) break;
                }
                const byName = {};
                rows.forEach((r) => { byName[String(r.name).trim().toLowerCase()] = r.id; });
                items.forEach((it) => { const hit = byName[String(it.name).trim().toLowerCase()]; if (hit && hit !== it.id) idMap[it.id] = hit; });
            };
            await resolveByName("regions", d.regions);
            await resolveByName("countries", d.countries);
            await resolveByName("waves", d.waves);
            await resolveByName("offers", d.offers);
            await resolveByName("business_units", d.bus);

            const mid = (id) => idMap[id] || id;                          // remap one id
            const msc = (s) => (!s || s === "all") ? s : mid(s);          // block scope (keep "all")
            const mkey = (k) => String(k).split("|").map(mid).join("|");  // remap a composite map key
            const mmap = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [mkey(k), v]));
            // D: the snapshot with all dimension ids (and every FK that points at
            // them) rewritten to canonical DB ids. mid() is a no-op for any id not
            // in idMap, so block/brick ids and other segments pass through untouched.
            const D = {
                regions: d.regions.map((r) => ({ ...r, id: mid(r.id) })),
                countries: d.countries.map((c) => ({ ...c, id: mid(c.id), regionId: mid(c.regionId) })),
                waves: d.waves.map((w) => ({ ...w, id: mid(w.id) })),
                offers: d.offers.map((o) => ({ ...o, id: mid(o.id) })),
                bus: d.bus.map((b) => ({ ...b, id: mid(b.id) })),
                blocks: d.blocks.map((b) => ({ ...b, scope: msc(b.scope) })),  // scope -> a wave/offer id
                bricks: d.bricks,                                              // keyed by id; blockId unchanged
                done: mmap(d.done),                 // country|wave|brick -> country & wave remapped
                brickExcl: mmap(d.brickExcl),       // brick|scope        -> scope(wave/offer) remapped
                obstacles: d.obstacles.map((o) => ({ ...o, countryId: mid(o.countryId), waveId: mid(o.waveId) })),
                offerBUs: mmap(d.offerBUs),           // offer|bu           -> both remapped
                waveCountry: mmap(d.waveCountry),   // wave|country       -> both remapped
                offerWave: mmap(d.offerWave),       // offer|wave         -> both remapped
            };

            // sync(): upsert the desired rows FIRST, then delete only the rows that
            // are no longer present. Upserting first means a mid-way failure can
            // leave EXTRA rows at worst — it can never empty a table, which the old
            // delete-then-insert could. keyCols is the natural key (the conflict
            // target). merge=false -> insert-or-ignore (link tables hold only their
            // key); merge=true -> also update non-key columns (entities, scopes,
            // brick_checks). Prune reads the existing keys (paged) and removes the
            // ones not in the desired set; cascades clean up dependent rows.
            const sync = async (t, rows, keyCols, merge = true) => {
                if (rows.length) {
                    const { error } = await sb.from(t).upsert(rows, { onConflict: keyCols.join(","), ignoreDuplicates: !merge });
                    if (error) throw new Error(`${t}: ${error.message}`);
                }
                const sel = keyCols.join(","), existing = [];
                for (let from = 0; ; from += 1000) {
                    const { data, error } = await sb.from(t).select(sel).range(from, from + 999);
                    if (error) throw new Error(`${t} (read): ${error.message}`);
                    existing.push(...(data || []));
                    if (!data || data.length < 1000) break;
                }
                const keyOf = (r) => keyCols.map((c) => String(r[c])).join("\u0001");
                const want = new Set(rows.map(keyOf));
                for (const r of existing) {
                    if (want.has(keyOf(r))) continue;
                    let q = sb.from(t).delete();
                    keyCols.forEach((c) => { q = q.eq(c, r[c]); });
                    const { error: de } = await q; if (de) throw new Error(`${t} (prune): ${de.message}`);
                }
            };

            // --- entities (keyed by id; parents before children for FKs) --------
            await sync("regions", D.regions.map((r, i) => ({ id: r.id, name: r.name, sort_order: i })), ["id"]);
            await sync("countries", D.countries.map((c) => ({ id: c.id, name: c.name, region_id: c.regionId })), ["id"]);
            await sync("waves", D.waves.map((w, i) => ({ id: w.id, name: w.name, deadline: toISODate(w.deadline), sort_order: i })), ["id"]);
            await sync("offers", D.offers.map((o) => ({ id: o.id, name: o.name })), ["id"]);
            await sync("business_units", D.bus.map((b, i) => ({ id: b.id, name: b.name, sort_order: i })), ["id"]);
            await sync("blocks", D.blocks.map((b) => ({ id: b.id, name: b.name, weight: b.weight, scope_level: b.level || "wave" })), ["id"]);
            await sync("bricks", D.bricks.map((b, i) => ({ id: b.id, name: b.name, block_id: b.blockId, sort_order: i })), ["id"]);
            // block scope: one row per scoped block. block_assignments is the only
            // target with a synthetic `id` PK and no natural unique key, so it can't
            // use on_conflict. Reconcile by block_id via the id PK: update the
            // block's existing row in place, insert when it has none, and delete
            // rows for blocks no longer scoped (plus any duplicate rows). No DB
            // migration (UNIQUE(block_id) not required) and no delete-then-insert.
            {
                const baWant = D.blocks.filter((b) => b.scope && b.scope !== "all").map((b) => b.level === "offer"
                    ? { block_id: b.id, wave_id: null, offer_id: b.scope }
                    : { block_id: b.id, wave_id: b.scope, offer_id: null });
                const existing = [];
                for (let from = 0; ; from += 1000) {
                    const { data, error } = await sb.from("block_assignments").select("id,block_id,wave_id,offer_id,country_id").range(from, from + 999);
                    if (error) throw new Error(`block_assignments (read): ${error.message}`);
                    existing.push(...(data || []));
                    if (!data || data.length < 1000) break;
                }
                const byBlock = {}, dupIds = [];
                existing.forEach((r) => { if (byBlock[r.block_id]) dupIds.push(r.id); else byBlock[r.block_id] = r; });
                const wantBlocks = new Set(baWant.map((r) => r.block_id));
                for (const row of baWant) {
                    const cur = byBlock[row.block_id];
                    if (cur) {
                        if (cur.wave_id !== row.wave_id || cur.offer_id !== row.offer_id) {
                            const { error } = await sb.from("block_assignments").update({ wave_id: row.wave_id, offer_id: row.offer_id }).eq("id", cur.id);
                            if (error) throw new Error(`block_assignments (update): ${error.message}`);
                        }
                    } else {
                        const { error } = await sb.from("block_assignments").insert(row);
                        if (error) throw new Error(`block_assignments (insert): ${error.message}`);
                    }
                }
                const delIds = [...dupIds, ...existing.filter((r) => byBlock[r.block_id] === r && !wantBlocks.has(r.block_id)).map((r) => r.id)];
                for (const id of delIds) {
                    const { error } = await sb.from("block_assignments").delete().eq("id", id);
                    if (error) throw new Error(`block_assignments (prune): ${error.message}`);
                }
            }

            // --- link tables (presence only -> insert-or-ignore, prune removals) -
            // Each table now has a surrogate `id uuid primary key default
            // gen_random_uuid()` PLUS a UNIQUE constraint on its natural key. We do
            // NOT send `id` — the DB fills it. We upsert/prune on the NATURAL KEY,
            // so re-saving the same pair conflicts on that unique constraint and is
            // ignored/updated in place (never a new id). keysTrue() yields the split
            // key as a 2-element array; destructure exactly two.
            await sync("offer_business_units", keysTrue(D.offerBUs).map(([offer_id, bu_id]) => ({ offer_id, bu_id })), ["offer_id", "bu_id"], false);
            await sync("wave_countries", keysTrue(D.waveCountry).map(([wave_id, country_id]) => ({ wave_id, country_id })), ["wave_id", "country_id"], false);
            await sync("offer_waves", keysTrue(D.offerWave).map(([offer_id, wave_id]) => ({ offer_id, wave_id })), ["offer_id", "wave_id"], false);
            await sync("brick_exclusions", keysTrue(D.brickExcl).map(([brick_id, scope_id]) => ({ brick_id, scope_id })), ["brick_id", "scope_id"], false);
            // brick_checks: per (country, wave, brick). updated_by is stamped when
            // userId is a valid UUID (a real profiles.id). merge so checked +
            // updated_by update in place rather than churning rows.
            const stamp = isUUID(userId) ? { updated_by: userId } : {};
            const bcRows = Object.entries(D.done).map(([k, v]) => { const [country_id, wave_id, brick_id] = k.split("|"); return { country_id, wave_id, brick_id, checked: !!v, ...stamp }; });
            await sync("brick_checks", bcRows, ["country_id", "wave_id", "brick_id"], true);

            // --- obstacles + their link tables ----------------------------------
            // Link tables carry a surrogate id (DB default) + a UNIQUE natural key.
            // Send only the natural-key columns; upsert/prune on that key.
            await sync("obstacles", D.obstacles.map((o) => ({ id: o.id, title: o.title, owner: o.owner, severity: sevToDb(o.severity), resolution: o.resolution, status: "open" })), ["id"]);
            await sync("obstacle_countries", D.obstacles.filter((o) => o.countryId).map((o) => ({ obstacle_id: o.id, country_id: o.countryId })), ["obstacle_id", "country_id"], false);
            await sync("obstacle_waves", D.obstacles.filter((o) => o.waveId).map((o) => ({ obstacle_id: o.id, wave_id: o.waveId })), ["obstacle_id", "wave_id"], false);
            await sync("obstacle_impacts", D.obstacles.flatMap((o) => (o.blocks || []).filter((b) => b !== o.id).map((b) => ({ obstacle_id: o.id, blocked_obstacle_id: b }))), ["obstacle_id", "blocked_obstacle_id"], false);
            await sync("obstacle_blocks", D.obstacles.flatMap((o) => (o.blockIds || []).map((b) => ({ obstacle_id: o.id, block_id: b }))), ["obstacle_id", "block_id"], false);

            setSaveState({ status: "saved", at: `${todayStr()} ${new Date().toLocaleTimeString()}` });
            return true;
        } catch (e) { setSaveState({ status: "error", msg: e.message || String(e) }); return false; }
    };

    // Save button on every module page -> writes current in-memory state, attributed to the signed-in user.
    const saveAll = () => persist(snapshot(), user?.id);

    const loadAll = async () => {
        const sb = await getSupabase(); if (!sb) return;
        try {
            const g = async (t) => { const { data, error } = await sb.from(t).select("*"); if (error) throw error; return data || []; };
            const R = await g("regions"); if (!R.length) return; // empty DB -> keep seeds
            const by = (rows) => rows.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            setRegions(by(R).map((r) => ({ id: r.id, name: r.name })));
            const Cn = await g("countries"); if (Cn.length) setCountries(Cn.map((c) => ({ id: c.id, name: c.name, regionId: c.region_id })));
            const W = await g("waves"); if (W.length) setWaves(by(W).map((w) => ({ id: w.id, name: w.name, deadline: fromISO(w.deadline) || todayStr() })));
            const Of = await g("offers"); if (Of.length) setOffers(Of.map((o) => ({ id: o.id, name: o.name })));
            const Bu = await g("business_units"); if (Bu.length) setBUs(by(Bu).map((b) => ({ id: b.id, name: b.name })));
            const asg = await g("block_assignments");
            const Bl = await g("blocks");
            if (Bl.length) setBlocks(Bl.map((b) => { const a = asg.find((x) => x.block_id === b.id); return { id: b.id, name: b.name, weight: Number(b.weight) || 0, level: b.scope_level || "wave", scope: a ? (a.wave_id || a.offer_id) : "all" }; }));
            const Bk = await g("bricks"); if (Bk.length) setBricks(by(Bk).map((b) => ({ id: b.id, name: b.name, blockId: b.block_id })));
            const obu = await g("offer_business_units"); setOfferBUs(Object.fromEntries(obu.map((r) => [`${r.offer_id}|${r.bu_id}`, true])));
            const wc = await g("wave_countries"); setWaveCountry(Object.fromEntries(wc.map((r) => [`${r.wave_id}|${r.country_id}`, true])));
            const ow = await g("offer_waves"); setOfferWave(Object.fromEntries(ow.map((r) => [`${r.offer_id}|${r.wave_id}`, true])));
            const bx = await g("brick_exclusions"); setBrickExcl(Object.fromEntries(bx.map((r) => [`${r.brick_id}|${r.scope_id}`, true])));
            const bc = await g("brick_checks"); setDone(Object.fromEntries(bc.map((r) => [`${r.country_id}|${r.wave_id}|${r.brick_id}`, !!r.checked])));
            const Ob = await g("obstacles");
            if (Ob.length) {
                const oc = await g("obstacle_countries"), ow2 = await g("obstacle_waves"), oi = await g("obstacle_impacts"), ob2 = await g("obstacle_blocks");
                setObstacles(Ob.map((o) => ({
                    id: o.id, title: o.title, owner: o.owner || "", severity: sevFromDb(o.severity), resolution: o.resolution || "",
                    countryId: oc.find((x) => x.obstacle_id === o.id)?.country_id,
                    waveId: ow2.find((x) => x.obstacle_id === o.id)?.wave_id,
                    blocks: oi.filter((x) => x.obstacle_id === o.id).map((x) => x.blocked_obstacle_id),
                    blockIds: ob2.filter((x) => x.obstacle_id === o.id).map((x) => x.block_id),
                })));
            }
        } catch { /* any failure -> keep seeds, app still works */ }
    };

    useEffect(() => { if (user && LOAD_FROM_DB) loadAll(); /* eslint-disable-next-line */ }, [user]);

    /* ======================= MODULE 1 — Readiness ======================= */
    const m1Countries = countriesOfWave(m1Wave);
    const renderM1 = () => (
        <>
            <SaveBar onSave={saveAll} state={saveState} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Wave">
                    <select value={m1Wave} onChange={(e) => setM1Wave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>
                        {waves.map((w) => <option key={w.id} value={w.id}>{w.name} — due {w.deadline}</option>)}
                    </select>
                </Field>
                <div className="ml-auto flex gap-2">
                    <Btn kind="ghost" onClick={() => setWaveAll(m1Wave, true)}><CheckCheck size={16} /> Select all</Btn>
                    <Btn kind="ghost" onClick={() => setWaveAll(m1Wave, false)}><Eraser size={16} /> Clear all</Btn>
                </div>
            </div>
            <p className="mb-4 text-sm" style={{ color: C.soft }}>Only countries assigned to this wave (Settings → Waves → Countries) are shown. Readiness = weighted average of <b>applicable block</b> scores. A block's score = % of its <b>bricks</b> done. Blocks/bricks scoped out of this wave are excluded and weights renormalise.</p>

            {m1Countries.length === 0 && (
                <Card bg={C.yellow}><p className="text-sm" style={{ color: C.ink }}>No countries are assigned to this wave yet. Add them in <b>Settings → Mappings → Waves → Countries</b>.</p></Card>
            )}

            {regions.map((r) => {
                const cs = m1Countries.filter((c) => c.regionId === r.id);
                if (!cs.length) return null;
                return (
                    <div key={r.id} className="mb-5">
                        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: C.soft }}>{r.name}</h3>
                        <div className="grid gap-2">
                            {cs.map((c) => {
                                const v = readiness(c.id, m1Wave), st = status(v), open = openCountry === c.id;
                                return (
                                    <Card key={c.id} bg={C.blue}>
                                        <div className="flex items-center gap-2">
                                            <button className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus:ring-2" aria-expanded={open} onClick={() => setOpenCountry(open ? null : c.id)}>
                                                {open ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                                                <span className="w-32 font-semibold" style={{ color: C.ink }}>{c.name}</span>
                                                <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: C.white }}><div className="h-full rounded-full" style={{ width: `${v}%`, background: st.c }} /></div>
                                                <span className="w-12 text-right font-bold" style={{ color: C.ink }}>{v}%</span>
                                                <span className="w-24 text-right text-sm font-semibold" style={{ color: st.c }}>{st.t}</span>
                                            </button>
                                            <button title="Mark all bricks done" aria-label={`Mark all bricks done for ${c.name}`} onClick={() => setCountryAll(c.id, m1Wave, true)} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.low }}><CheckCheck size={16} /></button>
                                            <button title="Clear all bricks" aria-label={`Clear all bricks for ${c.name}`} onClick={() => setCountryAll(c.id, m1Wave, false)} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.soft }}><Eraser size={16} /></button>
                                        </div>
                                        {open && (
                                            <div className="mt-3 grid gap-2 border-t pt-3" style={{ borderColor: C.line }}>
                                                {blocks.filter((bl) => blockApplies(bl, c.id, m1Wave)).map((bl) => {
                                                    const sc = blockScore(c.id, m1Wave, bl), bk = applicableBricks(bl, m1Wave);
                                                    const okey = `${c.id}|${bl.id}`, bopen = openBlock[okey];
                                                    return (
                                                        <div key={bl.id} className="rounded-lg p-2" style={{ background: C.white }}>
                                                            <button className="flex w-full items-center gap-2 rounded text-left focus:outline-none focus:ring-2" aria-expanded={!!bopen} onClick={() => setOpenBlock({ ...openBlock, [okey]: !bopen })}>
                                                                {bopen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                                                                <span className="w-44 text-sm font-medium" style={{ color: C.ink }}>{bl.name}</span>
                                                                <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: C.green, color: C.soft }}>{(bl.level || "wave") === "offer" ? "offer" : "wave"}</span>
                                                                <span className="text-xs" style={{ color: C.soft }}>weight {bl.weight}</span>
                                                                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: C.line }}><div className="h-full" style={{ width: `${sc}%`, background: status(sc).c }} /></div>
                                                                <span className="w-10 text-right text-sm font-semibold" style={{ color: C.ink }}>{sc}%</span>
                                                            </button>
                                                            {bopen && (
                                                                <div className="mt-2 grid gap-1 pl-6">
                                                                    {bk.length ? bk.map((brick) => {
                                                                        const dkey = `${c.id}|${m1Wave}|${brick.id}`, d = !!done[dkey];
                                                                        return (
                                                                            <button key={brick.id} className="flex items-center gap-2 rounded text-left text-sm focus:outline-none focus:ring-2" onClick={() => setDone({ ...done, [dkey]: !d })}>
                                                                                {d ? <CheckSquare size={16} aria-hidden style={{ color: C.low }} /> : <Square size={16} aria-hidden style={{ color: C.soft }} />}
                                                                                <span style={{ color: C.ink, textDecoration: d ? "line-through" : "none" }}>{brick.name}</span>
                                                                            </button>
                                                                        );
                                                                    }) : <span className="text-xs" style={{ color: C.soft }}>No bricks apply to this block in this wave.</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </>
    );

    /* ======================= MODULE 2 — Obstacles & Risks ======================= */
    const filtered = obstacles.filter((o) =>
        (fSev === "All" || o.severity === fSev) && (fCountry === "All" || o.countryId === fCountry) && (fWave === "All" || o.waveId === fWave));

    const saveDraft = () => {
        if (!obDraft.title) return;
        const { _new, ...o } = obDraft;
        setObstacles(_new ? [...obstacles, o] : obstacles.map((x) => x.id === o.id ? o : x));
        setObDraft(null);
    };

    const renderGraph = () => {
        const ids = new Set(filtered.map((o) => o.id));
        const edges = [];
        filtered.forEach((o) => (o.blocks || []).forEach((t) => { if (ids.has(t)) edges.push({ from: o.id, to: t }); }));
        const depth = {} as Record<string, number>;
        filtered.forEach((o) => { depth[o.id] = 0; });
        for (let i = 0; i < filtered.length; i++) edges.forEach((e) => { depth[e.to] = Math.max(depth[e.to], depth[e.from] + 1); });
        const byDepth = {} as Record<number, string[]>;
        filtered.forEach((o) => { const d = depth[o.id]; (byDepth[d] ||= []).push(o.id); });
        const pos = {} as Record<string, { x: number; y: number }>;
        Object.keys(byDepth).forEach((d) => byDepth[Number(d)].forEach((id, i) => { pos[id] = { x: Number(d), y: i }; }));
        const colW = 230, rowH = 90, nodeW = 190, nodeH = 56;
        const maxD = Math.max(0, ...filtered.map((o) => depth[o.id]));
        const maxR = Math.max(1, ...Object.values(byDepth).map((a) => a.length));
        const W = (maxD + 1) * colW + 20, H = maxR * rowH + 20;
        const cx = (id) => pos[id].x * colW + 20, cy = (id) => pos[id].y * rowH + 20;
        return (
            <Card bg={C.white}>
                <p className="mb-2 text-sm" style={{ color: C.soft }}>Arrows point from an obstacle to what it blocks. Left = upstream (resolve first).</p>
                <div className="overflow-auto" style={{ maxWidth: "100%" }}>
                    <svg width={W} height={H} role="img" aria-label="Obstacle dependency graph; see list view for a text equivalent" style={{ minWidth: W }}>
                        <defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={C.soft} /></marker></defs>
                        {edges.map((e, i) => {
                            const x1 = cx(e.from) + nodeW, y1 = cy(e.from) + nodeH / 2, x2 = cx(e.to), y2 = cy(e.to) + nodeH / 2, mx = (x1 + x2) / 2;
                            return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`} fill="none" stroke={C.soft} strokeWidth={2} markerEnd="url(#ar)" />;
                        })}
                        {filtered.map((o) => (
                            <g key={o.id}>
                                <rect x={cx(o.id)} y={cy(o.id)} width={nodeW} height={nodeH} rx={10} fill={SEV[o.severity] + "22"} stroke={SEV[o.severity]} strokeWidth={2} />
                                <text x={cx(o.id) + 10} y={cy(o.id) + 20} fontSize="11" fontWeight="700" fill={SEV[o.severity]}>{o.severity}</text>
                                <text x={cx(o.id) + 10} y={cy(o.id) + 38} fontSize="11" fill={C.ink}>{o.title.length > 26 ? o.title.slice(0, 24) + "…" : o.title}</text>
                            </g>
                        ))}
                    </svg>
                </div>
                {!filtered.length && <p className="text-sm" style={{ color: C.soft }}>No obstacles match these filters.</p>}
            </Card>
        );
    };

    const renderM2 = () => (
        <>
            <SaveBar onSave={saveAll} state={saveState} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Severity"><select value={fSev} onChange={(e) => setFSev(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{["All", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Country"><select value={fCountry} onChange={(e) => setFCountry(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}><option value="All">All</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Wave"><select value={fWave} onChange={(e) => setFWave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}><option value="All">All</option>{waves.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
                <div className="ml-auto flex gap-2">
                    <Btn kind={view === "list" ? "solid" : "ghost"} onClick={() => setView("list")}><List size={16} /> List</Btn>
                    <Btn kind={view === "graph" ? "solid" : "ghost"} onClick={() => setView("graph")}><GitBranch size={16} /> Graph</Btn>
                    <Btn onClick={() => setObDraft({ _new: true, id: gid(), title: "", owner: "", severity: "Medium", countryId: countries[0]?.id, waveId: waves[0]?.id, resolution: "", blocks: [], blockIds: [] })}><Plus size={16} /> Add</Btn>
                </div>
            </div>

            {obDraft && (
                <ObstacleForm value={obDraft} onChange={setObDraft} onSave={saveDraft} onCancel={() => setObDraft(null)} countries={countries} waves={waves} blocks={blocks} obstacles={obstacles} />
            )}

            {view === "graph" ? renderGraph() : (
                <div className="grid gap-2">
                    {filtered.map((o) => (
                        <Card key={o.id}>
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2"><SevBadge s={o.severity} /><span className="font-semibold" style={{ color: C.ink }}>{o.title}</span></div>
                                    <p className="mt-1 text-sm" style={{ color: C.soft }}>Owner: <b style={{ color: C.ink }}>{o.owner || "—"}</b> · {nameOf(o.countryId)} · {waves.find((w) => w.id === o.waveId)?.name || "—"}</p>
                                    <p className="mt-1 text-sm" style={{ color: C.ink }}>Resolution: {o.resolution || "—"}</p>
                                    {(o.blockIds || []).length > 0 && <p className="mt-1 text-xs" style={{ color: C.soft }}>Affects blocks: {o.blockIds.map((id) => blocks.find((b) => b.id === id)?.name).filter(Boolean).join(", ")}</p>}
                                    {(o.blocks || []).length > 0 && <div className="mt-2 rounded-lg p-2 text-sm" style={{ background: C.green }}><b style={{ color: C.ink }}>Blocks:</b> {o.blocks.map(obTitle).join(", ")}</div>}
                                </div>
                                <div className="flex gap-1">
                                    <button aria-label={`Edit ${o.title}`} title="Edit" onClick={() => setObDraft({ ...o, blocks: [...(o.blocks || [])], blockIds: [...(o.blockIds || [])] })} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.mid }}><Pencil size={16} /></button>
                                    <button aria-label={`Delete ${o.title}`} title="Delete" onClick={() => setObstacles(obstacles.filter((x) => x.id !== o.id))} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </Card>
                    ))}
                    {!filtered.length && <p className="text-sm" style={{ color: C.soft }}>No obstacles match these filters.</p>}
                </div>
            )}
        </>
    );

    /* ======================= MODULE 3 — Blocks & Bricks ======================= */
    const totW = blocks.reduce((a, b) => a + b.weight, 0);
    const renderM3 = () => (
        <>
            <SaveBar onSave={saveAll} state={saveState} />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm" style={{ color: C.soft }}>Blocks carry the <b>weight</b> and a <b>level</b> (wave or offer). Bricks are the <b>tasks</b> inside each block. Use <b>Applies&nbsp;to</b> on a brick to drop it from one wave/offer without touching the others. Total weight: <b style={{ color: totW === 100 ? C.low : C.med }}>{totW}</b>{totW !== 100 ? " (aim for 100)" : ""}.</p>
                <Btn onClick={() => setBlocks([...blocks, { id: gid(), name: "New block", weight: 0, level: "wave", scope: "all" }])}><Plus size={16} /> Add block</Btn>
            </div>
            <div className="grid gap-2">
                {blocks.map((bl) => {
                    const bk = bricks.filter((b) => b.blockId === bl.id), open = openB3[bl.id];
                    const linked = obstacles.filter((o) => (o.blockIds || []).includes(bl.id));
                    const lvl = bl.level || "wave";
                    const scopeOptions = lvl === "wave" ? waves : offers; // where a brick can be excluded
                    return (
                        <Card key={bl.id} bg={C.blue}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button aria-label="Toggle bricks" onClick={() => setOpenB3({ ...openB3, [bl.id]: !open })} className="rounded p-1 focus:outline-none focus:ring-2">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
                                <input value={bl.name} aria-label="Block name" onChange={(e) => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, name: e.target.value } : x))} className="min-w-0 flex-1 rounded-lg px-3 py-1.5 font-medium" style={inputStyle} />
                                <div className="flex items-center gap-2"><span className="text-sm" style={{ color: C.ink }}>Weight</span><input type="number" min={0} max={100} value={bl.weight} aria-label={`${bl.name} weight`} onChange={(e) => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, weight: Number(e.target.value) } : x))} className="w-16 rounded-lg px-2 py-1.5" style={inputStyle} /></div>
                                <div className="inline-flex overflow-hidden rounded-lg" style={{ border: `1px solid ${C.line}` }} role="group" aria-label="Block level">
                                    {["wave", "offer"].map((opt) => (
                                        <button key={opt} onClick={() => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, level: opt, scope: "all" } : x))}
                                            className="px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2" aria-pressed={lvl === opt}
                                            style={{ background: lvl === opt ? C.mid : C.white, color: lvl === opt ? C.white : C.soft }}>{opt === "wave" ? "Wave" : "Offer"}</button>
                                    ))}
                                </div>
                                <select value={bl.scope || "all"} aria-label="Block scope" onChange={(e) => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, scope: e.target.value } : x))} className="rounded-lg px-2 py-1.5 text-sm" style={inputStyle}>
                                    <option value="all">All {lvl === "wave" ? "waves" : "offers"}</option>
                                    {(lvl === "wave" ? waves : offers).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                                <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: C.white, color: C.soft }}>{bk.length} brick{bk.length !== 1 ? "s" : ""}</span>
                                <button aria-label={`Delete ${bl.name}`} onClick={() => { setBlocks(blocks.filter((x) => x.id !== bl.id)); setBricks(bricks.filter((b) => b.blockId !== bl.id)); }} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={16} /></button>
                            </div>
                            {linked.length > 0 && <p className="mt-1 pl-9 text-xs" style={{ color: C.soft }}>Obstacles affecting this block: {linked.map((o) => o.title).join(", ")}</p>}
                            {open && (
                                <div className="mt-2 grid gap-2 pl-9">
                                    {bk.map((b) => {
                                        const so = openBrickScope[b.id];
                                        return (
                                            <div key={b.id} className="rounded-lg p-2" style={{ background: C.white }}>
                                                <div className="flex items-center gap-2">
                                                    <span style={{ color: C.soft }}>•</span>
                                                    <input value={b.name} aria-label="Brick (task) name" onChange={(e) => setBricks(bricks.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm" style={inputStyle} />
                                                    <Btn kind="ghost" onClick={() => setOpenBrickScope({ ...openBrickScope, [b.id]: !so })} title="Choose which waves/offers this brick applies to">Applies to {so ? "▴" : "▾"}</Btn>
                                                    <button aria-label={`Delete brick ${b.name}`} onClick={() => setBricks(bricks.filter((x) => x.id !== b.id))} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={14} /></button>
                                                </div>
                                                {so && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-1 pl-6">
                                                        <span className="mr-1 text-xs" style={{ color: C.soft }}>Applies to {lvl === "wave" ? "waves" : "offers"}:</span>
                                                        {scopeOptions.map((s) => {
                                                            const on = !brickExcl[`${b.id}|${s.id}`]; // on = applies (not excluded)
                                                            return <Chip key={s.id} on={on} title={on ? "Click to remove from this " + lvl : "Click to add to this " + lvl}
                                                                onClick={() => setBrickExcl({ ...brickExcl, [`${b.id}|${s.id}`]: on ? true : false })}>{s.name}</Chip>;
                                                        })}
                                                        {!scopeOptions.length && <span className="text-xs" style={{ color: C.soft }}>Add {lvl === "wave" ? "waves" : "offers"} in Settings first.</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div><Btn kind="ghost" onClick={() => setBricks([...bricks, { id: gid(), name: "New task", blockId: bl.id }])}><Plus size={14} /> Add brick</Btn></div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </>
    );

    /* ======================= MODULE 4 — SteerCo Pack ======================= */
    const m4C = countries.filter((c) => c.regionId === m4Region);
    const chartData = m4C.map((c) => ({ name: c.name, readiness: readiness(c.id, m4Wave) }));
    const m4Ob = obstacles.filter((o) => m4C.some((c) => c.id === o.countryId) && o.waveId === m4Wave).sort((a, b) => sevRank[b.severity] - sevRank[a.severity]).slice(0, 3);
    const avg = chartData.length ? Math.round(chartData.reduce((a, d) => a + d.readiness, 0) / chartData.length) : 0;
    const readyCount = chartData.filter((d) => d.readiness >= 80).length;
    const highCount = obstacles.filter((o) => m4C.some((c) => c.id === o.countryId) && o.severity === "High").length;
    const regionName = regions.find((r) => r.id === m4Region)?.name || "";

    const downloadPNG = () => {
        try {
            const svg = chartRef.current?.querySelector("svg"); if (!svg) { setImportMsg("Chart not ready yet — try again in a moment."); return; }
            const xml = new XMLSerializer().serializeToString(svg), b = svg.getBoundingClientRect(), img = new Image();
            img.onload = () => {
                const cv = document.createElement("canvas"); cv.width = b.width * 2; cv.height = b.height * 2;
                const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, b.width, b.height);
                const a = document.createElement("a"); a.download = `steerco_${regionName}_${todayStr().replace(/\//g, "-")}.png`; a.href = cv.toDataURL("image/png"); a.click();
            };
            img.onerror = () => setImportMsg("Could not render the chart image.");
            img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
        } catch (e) { setImportMsg("PNG export failed: " + e.message); }
    };
    const downloadPack = () => {
        const wb = XLSX.utils.book_new();
        const summary = [
            { Metric: "Region", Value: regionName },
            { Metric: "Wave", Value: waves.find((w) => w.id === m4Wave)?.name || "" },
            { Metric: "Generated", Value: todayStr() },
            { Metric: "Avg readiness (%)", Value: avg },
            { Metric: "Countries ready", Value: `${readyCount}/${chartData.length}` },
            { Metric: "High-severity risks", Value: highCount },
            { Metric: "Total obstacles (region)", Value: obstacles.filter((o) => m4C.some((c) => c.id === o.countryId)).length },
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chartData.map((d) => ({ Country: d.name, "Readiness %": d.readiness }))), "Readiness");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(m4Ob.map((o, i) => ({ "#": i + 1, Severity: o.severity, Obstacle: o.title, Country: nameOf(o.countryId), Owner: o.owner, Resolution: o.resolution }))), "Top obstacles");
        XLSX.writeFile(wb, `steerco_pack_${regionName}_${todayStr().replace(/\//g, "-")}.xlsx`);
    };

    const renderM4 = () => (
        <>
            <SaveBar onSave={saveAll} state={saveState} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Region"><select value={m4Region} onChange={(e) => setM4Region(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                <Field label="Wave"><select value={m4Wave} onChange={(e) => setM4Wave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{waves.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
                <div className="ml-auto flex gap-2">
                    <Btn kind="ghost" onClick={downloadPNG}><Download size={16} /> Graph (PNG)</Btn>
                    <Btn onClick={downloadPack}><FileDown size={16} /> Download pack (Excel)</Btn>
                </div>
            </div>
            {importMsg && <p className="mb-3 text-sm" style={{ color: C.high }}>{importMsg}</p>}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Avg readiness" value={`${avg}%`} bg={C.blue} /><Stat label="Countries ready" value={`${readyCount}/${chartData.length}`} bg={C.green} />
                <Stat label="High-severity risks" value={highCount} bg={C.yellow} /><Stat label="Total obstacles" value={obstacles.filter((o) => m4C.some((c) => c.id === o.countryId)).length} bg={C.blue} />
            </div>
            <Card style={{ marginBottom: 16 }}>
                <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>Readiness by country — {regionName}</h3>
                {chartData.length ? (
                    <div ref={chartRef} style={{ width: "100%", height: 260, background: C.white }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.line} /><XAxis dataKey="name" tick={{ fill: C.ink, fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: C.ink, fontSize: 12 }} /><Tooltip />
                                <Bar dataKey="readiness" radius={[6, 6, 0, 0]} isAnimationActive={false}>{chartData.map((d, i) => <Cell key={i} fill={status(d.readiness).c} />)}</Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : <p className="text-sm" style={{ color: C.soft }}>No countries in this region yet. Add countries in Settings.</p>}
            </Card>
            <Card bg={C.yellow}>
                <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>Top 3 obstacles — {regionName}</h3>
                <ol className="grid gap-2">
                    {m4Ob.map((o, i) => (<li key={o.id} className="flex items-center gap-3 rounded-lg p-2" style={{ background: C.white }}><span className="font-bold" style={{ color: C.soft }}>{i + 1}</span><SevBadge s={o.severity} /><span className="flex-1" style={{ color: C.ink }}>{o.title}</span><span className="text-sm" style={{ color: C.soft }}>{nameOf(o.countryId)}</span></li>))}
                    {!m4Ob.length && <li className="text-sm" style={{ color: C.soft }}>No obstacles for this region/wave.</li>}
                </ol>
            </Card>
        </>
    );

    /* ======================= MODULE 5 — Settings ======================= */
    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new(), add = (n, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), n);
        // Meta carries the user id used to attribute imported brick checks (updated_by).
        // Prefilled with the signed-in user's id when known; leave it to use the importer's id.
        add("Meta", [{ user_id: user?.id || "PASTE-YOUR-SUPABASE-AUTH-USER-ID" }]);
        add("Regions", [{ name: "EMEA" }]); add("Countries", [{ name: "France", region: "EMEA" }]);
        add("Waves", [{ name: "Wave 1", deadline: "30/09/2026" }]); add("Offers", [{ name: "Core Platform" }]);
        add("BusinessUnits", [{ name: "Retail" }]); add("Blocks", [{ name: "Data migration", weight: 30, level: "wave", scope: "all" }]);
        add("Bricks", [{ name: "Extract legacy data", block: "Data migration" }]);
        add("Obstacles", [{ title: "Example risk", owner: "Owner name", severity: "High", country: "France", wave: "Wave 1", resolution: "Mitigation action" }]);
        // checkbox-importable sheets:
        add("WaveCountries", [{ wave: "Wave 1", country: "France", selected: "yes" }]);
        add("OfferBUs", [{ offer: "Core Platform", bu: "Retail", selected: "yes" }]);
        add("OfferWaves", [{ offer: "Core Platform", wave: "Wave 1", selected: "yes" }]);
        add("BrickChecks", [{ country: "France", wave: "Wave 1", brick: "Extract legacy data", checked: "yes" }]);
        XLSX.writeFile(wb, "transformation_import_template.xlsx");
    };
    const onImport = (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
                const sh = (n) => wb.Sheets[n] ? (XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }) as any[]) : [];
                const str = (x) => String(x ?? "").trim();
                const yes = (x) => ["yes", "y", "true", "1", "x", "✓"].includes(str(x).toLowerCase());
                const R = sh("Regions").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((r) => r.name);
                const rBy = {}; R.forEach((r) => rBy[r.name.toLowerCase()] = r.id);
                const Cn = sh("Countries").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), regionId: rBy[str(r.region).toLowerCase()] || R[0]?.id })).filter((c) => c.name);
                const W = sh("Waves").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), deadline: excelDate(r.deadline) || todayStr() })).filter((w) => w.name);
                const wBy = {}; W.forEach((w) => wBy[w.name.toLowerCase()] = w.id);
                const Of = sh("Offers").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((o) => o.name);
                const ofBy = {}; Of.forEach((o) => ofBy[o.name.toLowerCase()] = o.id);
                const Bu = sh("BusinessUnits").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((b) => b.name);
                const buBy = {}; Bu.forEach((b) => buBy[b.name.toLowerCase()] = b.id);
                const Bl = sh("Blocks").map((r) => {
                    const lvl = ["wave", "offer"].includes(str(r.level).toLowerCase()) ? str(r.level).toLowerCase() : "wave";
                    const scRaw = str(r.scope).toLowerCase();
                    const scope = (!scRaw || scRaw === "all") ? "all" : ((lvl === "wave" ? wBy[scRaw] : ofBy[scRaw]) || "all");
                    return { id: str(r.id) || gid(), name: str(r.name), weight: Number(r.weight) || 0, level: lvl, scope };
                }).filter((b) => b.name);
                const blBy = {}; Bl.forEach((b) => blBy[b.name.toLowerCase()] = b.id);
                const Bk = sh("Bricks").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), blockId: blBy[str(r.block).toLowerCase()] || Bl[0]?.id })).filter((b) => b.name && b.blockId);
                const bkBy = {}; Bk.forEach((b) => bkBy[b.name.toLowerCase()] = b.id);
                const cBy = {}; Cn.forEach((c) => cBy[c.name.toLowerCase()] = c.id);
                const Ob = sh("Obstacles").map((r) => ({ id: str(r.id) || gid(), title: str(r.title), owner: str(r.owner), severity: ["High", "Medium", "Low"].includes(str(r.severity)) ? str(r.severity) : "Medium", countryId: cBy[str(r.country).toLowerCase()] || Cn[0]?.id, waveId: wBy[str(r.wave).toLowerCase()] || W[0]?.id, resolution: str(r.resolution), blocks: [], blockIds: [] })).filter((o) => o.title);
                // checkbox sheets
                const wcMap = {}; sh("WaveCountries").forEach((r) => { const w = wBy[str(r.wave).toLowerCase()], c = cBy[str(r.country).toLowerCase()]; if (w && c && yes(r.selected)) wcMap[`${w}|${c}`] = true; });
                const obuMap = {}; sh("OfferBUs").forEach((r) => { const o = ofBy[str(r.offer).toLowerCase()], b = buBy[str(r.bu).toLowerCase()]; if (o && b && yes(r.selected)) obuMap[`${o}|${b}`] = true; });
                const owMap = {}; sh("OfferWaves").forEach((r) => { const o = ofBy[str(r.offer).toLowerCase()], w = wBy[str(r.wave).toLowerCase()]; if (o && w && yes(r.selected)) owMap[`${o}|${w}`] = true; });
                const doneMap = {}; sh("BrickChecks").forEach((r) => { const c = cBy[str(r.country).toLowerCase()], w = wBy[str(r.wave).toLowerCase()], b = bkBy[str(r.brick).toLowerCase()]; if (c && w && b) doneMap[`${c}|${w}|${b}`] = yes(r.checked); });
                // Meta: user id used to attribute the imported brick checks. A valid UUID
                // from the sheet wins; otherwise we fall back to the signed-in user's id.
                const meta = sh("Meta")[0] || {};
                const resolvedUserId = isUUID(str(meta.user_id)) ? str(meta.user_id) : (user?.id || null);

                const parts = [];
                if (R.length) { setRegions(R); parts.push(`${R.length} regions`); }
                if (Cn.length) { setCountries(Cn); parts.push(`${Cn.length} countries`); }
                if (W.length) { setWaves(W); parts.push(`${W.length} waves`); }
                if (Of.length) { setOffers(Of); parts.push(`${Of.length} offers`); }
                if (Bu.length) { setBUs(Bu); parts.push(`${Bu.length} business units`); }
                if (Bl.length) { setBlocks(Bl); parts.push(`${Bl.length} blocks`); }
                if (Bk.length) { setBricks(Bk); parts.push(`${Bk.length} bricks`); }
                if (Ob.length) { setObstacles(Ob); parts.push(`${Ob.length} obstacles`); }
                if (Object.keys(wcMap).length) { setWaveCountry(wcMap); parts.push(`${Object.keys(wcMap).length} wave→country`); }
                if (Object.keys(obuMap).length) { setOfferBUs(obuMap); parts.push(`${Object.keys(obuMap).length} offer→BU`); }
                if (Object.keys(owMap).length) { setOfferWave(owMap); parts.push(`${Object.keys(owMap).length} offer→wave`); }
                if (Object.keys(doneMap).length) { setDone(doneMap); parts.push(`${Object.keys(doneMap).length} brick checks`); }
                else if (Bk.length) { setDone({}); } // bricks changed but no checks provided -> reset

                if (!parts.length) { setImportMsg("No recognised sheets found. Use the template’s sheet names."); e.target.value = ""; return; }

                // Production: write the parsed rows straight to the DB tables (don't wait for
                // setState). Preview (no VITE_SUPABASE_URL): keep it in-memory.
                const snap = {
                    regions: R.length ? R : regions,
                    countries: Cn.length ? Cn : countries,
                    waves: W.length ? W : waves,
                    offers: Of.length ? Of : offers,
                    bus: Bu.length ? Bu : bus,
                    blocks: Bl.length ? Bl : blocks,
                    bricks: Bk.length ? Bk : bricks,
                    done: Object.keys(doneMap).length ? doneMap : (Bk.length ? {} : done),
                    brickExcl,
                    obstacles: Ob.length ? Ob : obstacles,
                    offerBUs: Object.keys(obuMap).length ? obuMap : offerBUs,
                    waveCountry: Object.keys(wcMap).length ? wcMap : waveCountry,
                    offerWave: Object.keys(owMap).length ? owMap : offerWave,
                };
                const sb = await getSupabase();
                if (sb) {
                    setImportMsg(`Imported: ${parts.join(", ")}. Writing to the database…`);
                    const ok = await persist(snap, resolvedUserId);
                    setImportMsg(ok
                        ? `Imported and written to the database: ${parts.join(", ")}.`
                        : `Imported into the app, but the database write failed — see the Save status above.`);
                } else {
                    setImportMsg(`Imported (preview): ${parts.join(", ")}. Set VITE_SUPABASE_URL in your repo to write these straight to the database.`);
                }
            } catch (err) { setImportMsg("Could not read the file: " + err.message); }
            e.target.value = "";
        };
        reader.readAsArrayBuffer(file);
    };

    const renderM5 = () => (
        <>
            <SaveBar onSave={saveAll} state={saveState} />

            <Card bg={C.yellow} style={{ marginBottom: 16 }}>
                <h3 className="mb-1 font-semibold" style={{ color: C.ink }}>Data import (Excel)</h3>
                <p className="mb-3 text-sm" style={{ color: C.soft }}>Upload an .xlsx with sheets: <b>Meta</b> (a single <code>user_id</code> cell), Regions, Countries, Waves, Offers, BusinessUnits, Blocks, Bricks, Obstacles, plus the checkbox sheets <b>WaveCountries</b>, <b>OfferBUs</b>, <b>OfferWaves</b> and <b>BrickChecks</b> (each with a yes/no column). Dates in any common format are normalised to dd/mm/yyyy. With Supabase configured, the import <b>writes straight to the database</b> (no separate Save needed) and stamps the <code>Meta.user_id</code> — or, if that cell is blank, your signed-in id — onto each brick check. In preview it stays in this session. Importing replaces matching data.</p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: C.mid, color: C.white, border: `1px solid ${C.mid}` }}>
                        <Upload size={16} /> Choose Excel file
                        <input type="file" accept=".xlsx,.xls" onChange={onImport} className="hidden" />
                    </label>
                    <Btn kind="ghost" onClick={downloadTemplate}><FileDown size={16} /> Download template</Btn>
                    {importMsg && <span className="text-sm" style={{ color: C.ink }}>{importMsg}</span>}
                </div>
            </Card>

            <SettingsSection title="Regions" items={regions} bg={C.blue}
                onAdd={() => setRegions([...regions, { id: gid(), name: "New region" }])} onChange={(id, p) => setRegions(regions.map((x) => x.id === id ? { ...x, ...p } : x))} onDel={(id) => setRegions(regions.filter((x) => x.id !== id))} />
            <SettingsSection title="Countries" items={countries} bg={C.green}
                onAdd={() => setCountries([...countries, { id: gid(), name: "New country", regionId: regions[0]?.id }])} onChange={(id, p) => setCountries(countries.map((x) => x.id === id ? { ...x, ...p } : x))} onDel={(id) => setCountries(countries.filter((x) => x.id !== id))}
                extra={(it) => <select value={it.regionId} aria-label="Region" onChange={(e) => setCountries(countries.map((x) => x.id === it.id ? { ...x, regionId: e.target.value } : x))} className="rounded-lg px-2 py-1.5 text-sm" style={inputStyle}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>} />
            <SettingsSection title="Waves" items={waves} bg={C.yellow}
                onAdd={() => setWaves([...waves, { id: gid(), name: "New wave", deadline: todayStr() }])} onChange={(id, p) => setWaves(waves.map((x) => x.id === id ? { ...x, ...p } : x))} onDel={(id) => setWaves(waves.filter((x) => x.id !== id))}
                extra={(it) => <span className="flex items-center gap-1"><Calendar size={14} aria-hidden style={{ color: C.soft }} /><input value={it.deadline} aria-label="Deadline dd/mm/yyyy" placeholder="dd/mm/yyyy" onChange={(e) => setWaves(waves.map((x) => x.id === it.id ? { ...x, deadline: e.target.value } : x))} className="w-28 rounded-lg px-2 py-1.5 text-sm" style={{ ...inputStyle, borderColor: validDate(it.deadline) ? C.line : C.high }} /></span>} />
            <SettingsSection title="Offers" items={offers} bg={C.blue}
                onAdd={() => setOffers([...offers, { id: gid(), name: "New offer" }])} onChange={(id, p) => setOffers(offers.map((x) => x.id === id ? { ...x, ...p } : x))} onDel={(id) => setOffers(offers.filter((x) => x.id !== id))} />
            <SettingsSection title="Business Units" items={bus} bg={C.green}
                onAdd={() => setBUs([...bus, { id: gid(), name: "New unit" }])} onChange={(id, p) => setBUs(bus.map((x) => x.id === id ? { ...x, ...p } : x))} onDel={(id) => setBUs(bus.filter((x) => x.id !== id))} />

            <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide" style={{ color: C.soft }}>Mappings</h3>
            <Matrix title="Offers → Business Units" rows={offers} cols={bus} map={offerBUs} setMap={setOfferBUs} bg={C.blue} />
            <Matrix title="Waves → Countries" rows={waves} cols={countries} map={waveCountry} setMap={setWaveCountry} bg={C.green} />
            <Matrix title="Offers → Waves" rows={offers} cols={waves} map={offerWave} setMap={setOfferWave} bg={C.yellow} />

            <div className="mt-4 flex justify-end"><Btn onClick={saveAll}><Save size={16} /> Save to database</Btn></div>
        </>
    );

    /* ======================= shell ======================= */
    if (!user) return <LoginScreen onLogin={(u) => setUser({ email: u.email, id: u.id || null, role: "admin" })} />;

    const active = MODULES.find((m) => m.id === mod);
    const body = { m1: renderM1, m2: renderM2, m3: renderM3, m4: renderM4, m5: renderM5 }[mod];
    const signOut = async () => { const sb = await getSupabase(); if (sb) { try { await sb.auth.signOut(); } catch { /* ignore */ } } setUser(null); };

    return (
        <div className="min-h-screen w-full" style={{ background: "#f4f7fc", color: C.ink, fontFamily: "system-ui, sans-serif" }}>
            <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
                <nav aria-label="Modules" className="flex shrink-0 flex-col p-3 sm:w-60" style={{ background: C.sidebar }}>
                    <div className="mb-4 px-2 pt-1"><div className="text-lg font-bold" style={{ color: C.white }}>Transformation</div><div className="text-xs" style={{ color: "#eef3fb" }}>Today: {todayStr()}</div></div>
                    <ul className="flex gap-1 sm:flex-col">
                        {MODULES.map(({ id, name, Icon }) => {
                            const on = id === mod; return (
                                <li key={id} className="flex-1">
                                    <button onClick={() => setMod(id)} aria-current={on ? "page" : undefined} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2" style={{ background: on ? C.white : "transparent", color: on ? C.ink : C.white }}>
                                        <Icon size={18} aria-hidden /> <span className="hidden sm:inline">{name}</span>
                                    </button>
                                </li>);
                        })}
                    </ul>
                    <div className="mt-auto px-2 pt-4 hidden sm:block">
                        <div className="truncate text-xs" style={{ color: "#eef3fb" }}>{user.email}</div>
                        <button onClick={signOut} className="mt-1 inline-flex items-center gap-1 text-xs font-medium focus:outline-none focus:ring-2" style={{ color: C.white }}><LogOut size={14} aria-hidden /> Sign out</button>
                    </div>
                </nav>
                <main className="flex-1 p-4 sm:p-6">
                    <header className="mb-4 flex items-center gap-2">
                        {active && <active.Icon size={22} aria-hidden style={{ color: C.mid }} />}
                        <h1 className="text-xl font-bold" style={{ color: C.ink }}>{active?.name}</h1>
                        <button onClick={signOut} className="ml-auto inline-flex items-center gap-1 text-sm font-medium focus:outline-none focus:ring-2 sm:hidden" style={{ color: C.soft }}><LogOut size={14} aria-hidden /> Sign out</button>
                    </header>
                    {body()}
                </main>
            </div>
        </div>
    );
}
