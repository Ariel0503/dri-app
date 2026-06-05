import { useState, useRef } from "react";
import { Gauge, AlertTriangle, Layers, FileBarChart, Settings as Cog, ChevronDown, ChevronRight, Plus, Trash2, Download, Calendar, GitBranch, List, Upload, FileDown, CheckSquare, Square, Save, LogOut, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";

/* ----------------------------------------------------------------------------
   SUPABASE NOTES (wire in your own repo — the sandbox has no env/credentials):
   - Create the client in src/supabaseClient.js using createClient() from the
     supabase-js package with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
   - Auth:  supabase.auth.signInWithPassword({ email, password }) / signOut()
   - Save:  supabase.from('regions').upsert(rows)  (see saveSettings below)
   - RLS in the SQL schema already limits writes to admin/editor roles.
---------------------------------------------------------------------------- */

/* ---------- palette ---------- */
const C = {
    blue: "#D2E0FB", yellow: "#F9F3CC", green: "#D7E5CA", mid: "#8EACCD",
    sidebar: "#7D97B4",                 // slightly darker than mid (same hue, not navy)
    ink: "#1f2a44", soft: "#51607d", line: "#c3d0e6", white: "#ffffff",
    high: "#b23b2e", med: "#9a6b12", low: "#3a7d44",
};

/* ---------- date helpers (dd/mm/yyyy) ---------- */
const todayStr = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const validDate = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
const gid = () => Math.random().toString(36).slice(2, 8);

/* ---------- seed ---------- */
const seedRegions = [{ id: "r1", name: "EMEA" }, { id: "r2", name: "APAC" }];
const seedCountries = [
    { id: "c1", name: "France", regionId: "r1" }, { id: "c2", name: "Germany", regionId: "r1" },
    { id: "c3", name: "UAE", regionId: "r1" }, { id: "c4", name: "Japan", regionId: "r2" }, { id: "c5", name: "Australia", regionId: "r2" },
];
const seedWaves = [{ id: "w1", name: "Wave 1", deadline: "30/09/2026" }, { id: "w2", name: "Wave 2", deadline: "31/03/2027" }];
const seedOffers = [{ id: "o1", name: "Core Platform" }, { id: "o2", name: "Analytics Add-on" }];
const seedBUs = [{ id: "u1", name: "Retail" }, { id: "u2", name: "Corporate" }];

// blocks carry weight + a scope LEVEL (wave or offer); bricks are tasks inside a block
const seedBlocks = [
    { id: "bl1", name: "Data migration", weight: 30, level: "wave", scope: "all" },
    { id: "bl2", name: "People & training", weight: 25, level: "offer", scope: "o1" },
    { id: "bl3", name: "Legal & compliance", weight: 20, level: "wave", scope: "all" },
    { id: "bl4", name: "Infrastructure", weight: 15, level: "wave", scope: "w1" },
    { id: "bl5", name: "Stakeholder alignment", weight: 10, level: "wave", scope: "all" },
];
const seedBricks = [
    { id: "bk1", name: "Extract legacy data", blockId: "bl1" },
    { id: "bk2", name: "Validate data quality", blockId: "bl1" },
    { id: "bk3", name: "Train local champions", blockId: "bl2" },
    { id: "bk4", name: "Roll out e-learning", blockId: "bl2" },
    { id: "bk5", name: "GDPR sign-off", blockId: "bl3" },
    { id: "bk6", name: "Provision cloud environment", blockId: "bl4" },
    { id: "bk7", name: "Confirm executive sponsor", blockId: "bl5" },
];
const seedDone = {};
seedCountries.forEach((c, ci) => seedWaves.forEach((w, wi) => seedBricks.forEach((b, bi) => {
    seedDone[`${c.id}|${w.id}|${b.id}`] = (ci + bi + wi * 2) % 3 !== 0;
})));

const seedObstacles = [
    { id: "ob1", title: "GDPR data residency unresolved", owner: "L. Martin", severity: "High", countryId: "c1", waveId: "w1", resolution: "Legal review + regional data-centre decision", blocks: ["ob3", "ob2"], blockIds: ["bl3"] },
    { id: "ob2", title: "Trainer availability shortfall", owner: "S. Klein", severity: "Medium", countryId: "c2", waveId: "w1", resolution: "Hire 2 contract trainers by Q3", blocks: [], blockIds: ["bl2"] },
    { id: "ob3", title: "Migration tooling not localised", owner: "A. Tan", severity: "High", countryId: "c4", waveId: "w1", resolution: "Vendor patch + UAT", blocks: [], blockIds: ["bl1", "bl4"] },
    { id: "ob4", title: "Sponsor turnover", owner: "R. Okafor", severity: "Low", countryId: "c5", waveId: "w2", resolution: "Re-confirm exec sponsor", blocks: [], blockIds: ["bl5"] },
    { id: "ob5", title: "Procurement delay on infra", owner: "M. Haddad", severity: "Medium", countryId: "c3", waveId: "w1", resolution: "Escalate to SteerCo", blocks: ["ob3"], blockIds: ["bl4"] },
];

const seedOfferBU = { "o1|u1": true, "o1|u2": true, "o2|u1": true };
const seedWaveCountry = { "w1|c1": true, "w1|c2": true, "w1|c3": true, "w1|c4": true, "w2|c5": true, "w2|c1": true };
const seedOfferWave = { "o1|w1": true, "o1|w2": true, "o2|w1": true };

const SEV = { High: C.high, Medium: C.med, Low: C.low };
const sevRank = { High: 3, Medium: 2, Low: 1 };
const MODULES = [
    { id: "m1", name: "Readiness Score", Icon: Gauge },
    { id: "m2", name: "Obstacles & Risks", Icon: AlertTriangle },
    { id: "m3", name: "Blocks & Bricks", Icon: Layers },
    { id: "m4", name: "SteerCo Pack", Icon: FileBarChart },
    { id: "m5", name: "Settings", Icon: Cog },
];

/* ---------- shared UI (all module scope = stable identity = inputs keep focus) ---------- */
const Card = ({ children, bg = C.white, style }) => (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${C.line}`, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, kind = "solid", title }) => (
    <button onClick={onClick} title={title}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
        style={{ background: kind === "solid" ? C.mid : "transparent", color: kind === "solid" ? C.white : C.ink, border: `1px solid ${C.mid}` }}>{children}</button>
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

// Hoisted out of App so typing in Settings no longer remounts the inputs.
const SettingsSection = ({ title, items, onAdd, onChange, onDel, extra, bg }) => (
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
const Matrix = ({ title, rows, cols, map, setMap, bg }) => (
    <Card bg={bg} style={{ marginBottom: 12 }}>
        <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>{title}</h3>
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
                </tbody>
            </table>
        </div>
    </Card>
);

/* ---------- Login (module scope -> focus-safe) ---------- */
function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    const submit = () => {
        if (!email.trim() || !pw) { setErr("Enter your email and password."); return; }
        // In your repo: await supabase.auth.signInWithPassword({ email, password: pw })
        onLogin(email.trim());
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
                <p className="mt-4 text-center text-xs" style={{ color: C.soft }}>Demo preview: any email + password works.</p>
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
    const [obstacles, setObstacles] = useState(seedObstacles);
    const [offerBU, setOfferBU] = useState(seedOfferBU);
    const [waveCountry, setWaveCountry] = useState(seedWaveCountry);
    const [offerWave, setOfferWave] = useState(seedOfferWave);
    const [savedAt, setSavedAt] = useState(null);

    // Module-level state (declared here so the auth guard below sits after all hooks)
    const [m1Wave, setM1Wave] = useState("w1");
    const [openCountry, setOpenCountry] = useState(null);
    const [openBlock, setOpenBlock] = useState({});
    const [fSev, setFSev] = useState("All");
    const [fCountry, setFCountry] = useState("All");
    const [fWave, setFWave] = useState("All");
    const [view, setView] = useState("list");
    const [newOb, setNewOb] = useState(null);
    const [openB3, setOpenB3] = useState({});
    const [m4Region, setM4Region] = useState("r1");
    const [m4Wave, setM4Wave] = useState("w1");
    const chartRef = useRef(null);
    const [importMsg, setImportMsg] = useState("");

    /* ---------- calc ---------- */
    // A block applies to a (country, wave) context based on its level + scope
    const blockApplies = (bl, cid, wid) => {
        const lvl = bl.level || "wave";
        if (lvl === "wave") return !bl.scope || bl.scope === "all" || bl.scope === wid;
        // offer level: applies when the offer is active in this wave (or scope = all)
        return !bl.scope || bl.scope === "all" || !!offerWave[`${bl.scope}|${wid}`];
    };
    const blockScore = (cid, wid, blid) => {
        const bs = bricks.filter((b) => b.blockId === blid);
        if (!bs.length) return 0;
        return Math.round(bs.filter((b) => done[`${cid}|${wid}|${b.id}`]).length / bs.length * 100);
    };
    const readiness = (cid, wid) => {
        const appl = blocks.filter((b) => blockApplies(b, cid, wid));
        const totW = appl.reduce((a, b) => a + b.weight, 0) || 1;
        return Math.round(appl.reduce((a, b) => a + blockScore(cid, wid, b.id) * b.weight, 0) / totW);
    };
    const status = (v) => v >= 80 ? { t: "Ready", c: C.low } : v >= 60 ? { t: "On track", c: C.med } : v >= 40 ? { t: "At risk", c: "#c87a1a" } : { t: "Not ready", c: C.high };
    const nameOf = (id) => countries.find((c) => c.id === id)?.name ?? "—";
    const obTitle = (id) => obstacles.find((o) => o.id === id)?.title ?? id;

    const saveSettings = () => {
        // Persist to Supabase here, e.g.:
        //   await supabase.from('regions').upsert(regions);
        //   await supabase.from('countries').upsert(countries); ...etc
        setSavedAt(`${todayStr()} ${new Date().toLocaleTimeString()}`);
    };

    /* ======================= MODULE 1 ======================= */
    const renderM1 = () => (
        <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Wave">
                    <select value={m1Wave} onChange={(e) => setM1Wave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>
                        {waves.map((w) => <option key={w.id} value={w.id}>{w.name} — due {w.deadline}</option>)}
                    </select>
                </Field>
                <p className="text-sm" style={{ color: C.soft }}>Readiness = weighted average of <b>applicable block</b> scores for this wave. A block's score = % of its <b>bricks</b> done. Blocks scoped to another wave/offer are excluded and weights renormalise.</p>
            </div>

            {regions.map((r) => {
                const cs = countries.filter((c) => c.regionId === r.id);
                if (!cs.length) return null;
                return (
                    <div key={r.id} className="mb-5">
                        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: C.soft }}>{r.name}</h3>
                        <div className="grid gap-2">
                            {cs.map((c) => {
                                const v = readiness(c.id, m1Wave), st = status(v), open = openCountry === c.id;
                                return (
                                    <Card key={c.id} bg={C.blue}>
                                        <button className="flex w-full items-center gap-3 rounded text-left focus:outline-none focus:ring-2" aria-expanded={open} onClick={() => setOpenCountry(open ? null : c.id)}>
                                            {open ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                                            <span className="w-32 font-semibold" style={{ color: C.ink }}>{c.name}</span>
                                            <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: C.white }}><div className="h-full rounded-full" style={{ width: `${v}%`, background: st.c }} /></div>
                                            <span className="w-12 text-right font-bold" style={{ color: C.ink }}>{v}%</span>
                                            <span className="w-24 text-right text-sm font-semibold" style={{ color: st.c }}>{st.t}</span>
                                        </button>
                                        {open && (
                                            <div className="mt-3 grid gap-2 border-t pt-3" style={{ borderColor: C.line }}>
                                                {blocks.filter((bl) => blockApplies(bl, c.id, m1Wave)).map((bl) => {
                                                    const sc = blockScore(c.id, m1Wave, bl.id), bk = bricks.filter((b) => b.blockId === bl.id);
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
                                                                    }) : <span className="text-xs" style={{ color: C.soft }}>No bricks defined for this block.</span>}
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

    /* ======================= MODULE 2 ======================= */
    const filtered = obstacles.filter((o) =>
        (fSev === "All" || o.severity === fSev) && (fCountry === "All" || o.countryId === fCountry) && (fWave === "All" || o.waveId === fWave));

    const renderGraph = () => {
        const ids = new Set(filtered.map((o) => o.id));
        const edges = [];
        filtered.forEach((o) => o.blocks.forEach((t) => { if (ids.has(t)) edges.push({ from: o.id, to: t }); }));
        const depth = {}; filtered.forEach((o) => depth[o.id] = 0);
        for (let i = 0; i < filtered.length; i++) edges.forEach((e) => { depth[e.to] = Math.max(depth[e.to], depth[e.from] + 1); });
        const byDepth = {}; filtered.forEach((o) => { const d = depth[o.id]; (byDepth[d] ||= []).push(o.id); });
        const pos = {}; Object.keys(byDepth).forEach((d) => byDepth[d].forEach((id, i) => { pos[id] = { x: Number(d), y: i }; }));
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
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Severity"><select value={fSev} onChange={(e) => setFSev(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{["All", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Country"><select value={fCountry} onChange={(e) => setFCountry(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}><option value="All">All</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Wave"><select value={fWave} onChange={(e) => setFWave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}><option value="All">All</option>{waves.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
                <div className="ml-auto flex gap-2">
                    <Btn kind={view === "list" ? "solid" : "ghost"} onClick={() => setView("list")}><List size={16} /> List</Btn>
                    <Btn kind={view === "graph" ? "solid" : "ghost"} onClick={() => setView("graph")}><GitBranch size={16} /> Graph</Btn>
                    <Btn onClick={() => setNewOb({ id: gid(), title: "", owner: "", severity: "Medium", countryId: countries[0]?.id, waveId: waves[0]?.id, resolution: "", blocks: [], blockIds: [] })}><Plus size={16} /> Add</Btn>
                </div>
            </div>

            {newOb && (
                <Card bg={C.yellow} style={{ marginBottom: 16 }}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Title"><input value={newOb.title} onChange={(e) => setNewOb({ ...newOb, title: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
                        <Field label="Owner"><input value={newOb.owner} onChange={(e) => setNewOb({ ...newOb, owner: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
                        <Field label="Severity"><select value={newOb.severity} onChange={(e) => setNewOb({ ...newOb, severity: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle}>{["High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                        <Field label="Country"><select value={newOb.countryId} onChange={(e) => setNewOb({ ...newOb, countryId: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                        <Field label="Resolution path"><input value={newOb.resolution} onChange={(e) => setNewOb({ ...newOb, resolution: e.target.value })} className="w-full rounded-lg px-3 py-1.5" style={inputStyle} /></Field>
                    </div>
                    <div className="mt-3 flex gap-2"><Btn onClick={() => { if (newOb.title) { setObstacles([...obstacles, newOb]); setNewOb(null); } }}>Save</Btn><Btn kind="ghost" onClick={() => setNewOb(null)}>Cancel</Btn></div>
                </Card>
            )}

            {view === "graph" ? renderGraph() : (
                <div className="grid gap-2">
                    {filtered.map((o) => (
                        <Card key={o.id}>
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2"><SevBadge s={o.severity} /><span className="font-semibold" style={{ color: C.ink }}>{o.title}</span></div>
                                    <p className="mt-1 text-sm" style={{ color: C.soft }}>Owner: <b style={{ color: C.ink }}>{o.owner}</b> · {nameOf(o.countryId)} · {waves.find((w) => w.id === o.waveId)?.name}</p>
                                    <p className="mt-1 text-sm" style={{ color: C.ink }}>Resolution: {o.resolution}</p>
                                    {o.blockIds.length > 0 && <p className="mt-1 text-xs" style={{ color: C.soft }}>Affects blocks: {o.blockIds.map((id) => blocks.find((b) => b.id === id)?.name).filter(Boolean).join(", ")}</p>}
                                    {o.blocks.length > 0 && <div className="mt-2 rounded-lg p-2 text-sm" style={{ background: C.green }}><b style={{ color: C.ink }}>Blocks:</b> {o.blocks.map(obTitle).join(", ")}</div>}
                                </div>
                                <button aria-label={`Delete ${o.title}`} onClick={() => setObstacles(obstacles.filter((x) => x.id !== o.id))} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={16} /></button>
                            </div>
                        </Card>
                    ))}
                    {!filtered.length && <p className="text-sm" style={{ color: C.soft }}>No obstacles match these filters.</p>}
                </div>
            )}
        </>
    );

    /* ======================= MODULE 3 (Blocks & Bricks) ======================= */
    const totW = blocks.reduce((a, b) => a + b.weight, 0);
    const renderM3 = () => (
        <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm" style={{ color: C.soft }}>Blocks carry the <b>weight</b> and a <b>level</b> (wave or offer). Bricks are the <b>tasks</b> inside each block. Total weight: <b style={{ color: totW === 100 ? C.low : C.med }}>{totW}</b>{totW !== 100 ? " (aim for 100)" : ""}.</p>
                <Btn onClick={() => setBlocks([...blocks, { id: gid(), name: "New block", weight: 0, level: "wave", scope: "all" }])}><Plus size={16} /> Add block</Btn>
            </div>
            <div className="grid gap-2">
                {blocks.map((bl) => {
                    const bk = bricks.filter((b) => b.blockId === bl.id), open = openB3[bl.id];
                    const linked = obstacles.filter((o) => o.blockIds.includes(bl.id));
                    const lvl = bl.level || "wave";
                    return (
                        <Card key={bl.id} bg={C.blue}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button aria-label="Toggle bricks" onClick={() => setOpenB3({ ...openB3, [bl.id]: !open })} className="rounded p-1 focus:outline-none focus:ring-2">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
                                <input value={bl.name} aria-label="Block name" onChange={(e) => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, name: e.target.value } : x))} className="min-w-0 flex-1 rounded-lg px-3 py-1.5 font-medium" style={inputStyle} />
                                <div className="flex items-center gap-2"><span className="text-sm" style={{ color: C.ink }}>Weight</span><input type="number" min={0} max={100} value={bl.weight} aria-label={`${bl.name} weight`} onChange={(e) => setBlocks(blocks.map((x) => x.id === bl.id ? { ...x, weight: Number(e.target.value) } : x))} className="w-16 rounded-lg px-2 py-1.5" style={inputStyle} /></div>
                                {/* level toggle: wave / offer */}
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
                                <div className="mt-2 grid gap-1 pl-9">
                                    {bk.map((b) => (
                                        <div key={b.id} className="flex items-center gap-2">
                                            <span style={{ color: C.soft }}>•</span>
                                            <input value={b.name} aria-label="Brick (task) name" onChange={(e) => setBricks(bricks.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm" style={inputStyle} />
                                            <button aria-label={`Delete brick ${b.name}`} onClick={() => setBricks(bricks.filter((x) => x.id !== b.id))} className="rounded p-1 focus:outline-none focus:ring-2" style={{ color: C.high }}><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                    <div><Btn kind="ghost" onClick={() => setBricks([...bricks, { id: gid(), name: "New task", blockId: bl.id }])}><Plus size={14} /> Add brick</Btn></div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </>
    );

    /* ======================= MODULE 4 ======================= */
    const m4C = countries.filter((c) => c.regionId === m4Region);
    const chartData = m4C.map((c) => ({ name: c.name, readiness: readiness(c.id, m4Wave) }));
    const m4Ob = obstacles.filter((o) => m4C.some((c) => c.id === o.countryId) && o.waveId === m4Wave).sort((a, b) => sevRank[b.severity] - sevRank[a.severity]).slice(0, 3);
    const avg = chartData.length ? Math.round(chartData.reduce((a, d) => a + d.readiness, 0) / chartData.length) : 0;
    const readyCount = chartData.filter((d) => d.readiness >= 80).length;
    const highCount = obstacles.filter((o) => m4C.some((c) => c.id === o.countryId) && o.severity === "High").length;

    const downloadPNG = () => {
        const svg = chartRef.current?.querySelector("svg"); if (!svg) return;
        const xml = new XMLSerializer().serializeToString(svg), b = svg.getBoundingClientRect(), img = new Image();
        img.onload = () => {
            const cv = document.createElement("canvas"); cv.width = b.width * 2; cv.height = b.height * 2;
            const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, b.width, b.height);
            const a = document.createElement("a"); a.download = `steerco_${regions.find((r) => r.id === m4Region)?.name}_${todayStr().replace(/\//g, "-")}.png`; a.href = cv.toDataURL("image/png"); a.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    };

    const renderM4 = () => (
        <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Region"><select value={m4Region} onChange={(e) => setM4Region(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                <Field label="Wave"><select value={m4Wave} onChange={(e) => setM4Wave(e.target.value)} className="rounded-lg px-3 py-1.5" style={inputStyle}>{waves.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
                <div className="ml-auto"><Btn onClick={downloadPNG}><Download size={16} /> Download graph (PNG)</Btn></div>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Avg readiness" value={`${avg}%`} bg={C.blue} /><Stat label="Countries ready" value={`${readyCount}/${chartData.length}`} bg={C.green} />
                <Stat label="High-severity risks" value={highCount} bg={C.yellow} /><Stat label="Total obstacles" value={obstacles.filter((o) => m4C.some((c) => c.id === o.countryId)).length} bg={C.blue} />
            </div>
            <Card style={{ marginBottom: 16 }}>
                <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>Readiness by country</h3>
                <div ref={chartRef} style={{ width: "100%", height: 260, background: C.white }}>
                    <ResponsiveContainer>
                        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.line} /><XAxis dataKey="name" tick={{ fill: C.ink, fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: C.ink, fontSize: 12 }} /><Tooltip />
                            <Bar dataKey="readiness" radius={[6, 6, 0, 0]}>{chartData.map((d, i) => <Cell key={i} fill={status(d.readiness).c} />)}</Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
            <Card bg={C.yellow}>
                <h3 className="mb-2 font-semibold" style={{ color: C.ink }}>Top 3 obstacles — {regions.find((r) => r.id === m4Region)?.name}</h3>
                <ol className="grid gap-2">
                    {m4Ob.map((o, i) => (<li key={o.id} className="flex items-center gap-3 rounded-lg p-2" style={{ background: C.white }}><span className="font-bold" style={{ color: C.soft }}>{i + 1}</span><SevBadge s={o.severity} /><span className="flex-1" style={{ color: C.ink }}>{o.title}</span><span className="text-sm" style={{ color: C.soft }}>{nameOf(o.countryId)}</span></li>))}
                    {!m4Ob.length && <li className="text-sm" style={{ color: C.soft }}>No obstacles for this region/wave.</li>}
                </ol>
            </Card>
        </>
    );

    /* ======================= MODULE 5 ======================= */
    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new(), add = (n, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), n);
        add("Regions", [{ name: "EMEA" }]); add("Countries", [{ name: "France", region: "EMEA" }]);
        add("Waves", [{ name: "Wave 1", deadline: "30/09/2026" }]); add("Offers", [{ name: "Core Platform" }]);
        add("BusinessUnits", [{ name: "Retail" }]); add("Blocks", [{ name: "Data migration", weight: 30, level: "wave", scope: "all" }]);
        add("Bricks", [{ name: "Extract legacy data", block: "Data migration" }]);
        add("Obstacles", [{ title: "Example risk", owner: "Owner name", severity: "High", country: "France", wave: "Wave 1", resolution: "Mitigation action" }]);
        XLSX.writeFile(wb, "transformation_import_template.xlsx");
    };
    const onImport = (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: "array" });
                const sh = (n) => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }) : [];
                const str = (x) => String(x ?? "").trim();
                const R = sh("Regions").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((r) => r.name);
                const rBy = {}; R.forEach((r) => rBy[r.name.toLowerCase()] = r.id);
                const Cn = sh("Countries").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), regionId: rBy[str(r.region).toLowerCase()] || R[0]?.id })).filter((c) => c.name);
                const W = sh("Waves").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), deadline: str(r.deadline) || todayStr() })).filter((w) => w.name);
                const wBy = {}; W.forEach((w) => wBy[w.name.toLowerCase()] = w.id);
                const Of = sh("Offers").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((o) => o.name);
                const ofBy = {}; Of.forEach((o) => ofBy[o.name.toLowerCase()] = o.id);
                const Bu = sh("BusinessUnits").map((r) => ({ id: str(r.id) || gid(), name: str(r.name) })).filter((b) => b.name);
                const Bl = sh("Blocks").map((r) => {
                    const lvl = ["wave", "offer"].includes(str(r.level).toLowerCase()) ? str(r.level).toLowerCase() : "wave";
                    const scRaw = str(r.scope).toLowerCase();
                    const scope = (!scRaw || scRaw === "all") ? "all" : ((lvl === "wave" ? wBy[scRaw] : ofBy[scRaw]) || "all");
                    return { id: str(r.id) || gid(), name: str(r.name), weight: Number(r.weight) || 0, level: lvl, scope };
                }).filter((b) => b.name);
                const blBy = {}; Bl.forEach((b) => blBy[b.name.toLowerCase()] = b.id);
                const Bk = sh("Bricks").map((r) => ({ id: str(r.id) || gid(), name: str(r.name), blockId: blBy[str(r.block).toLowerCase()] || Bl[0]?.id })).filter((b) => b.name && b.blockId);
                const cBy = {}; Cn.forEach((c) => cBy[c.name.toLowerCase()] = c.id);
                const Ob = sh("Obstacles").map((r) => ({ id: str(r.id) || gid(), title: str(r.title), owner: str(r.owner), severity: ["High", "Medium", "Low"].includes(str(r.severity)) ? str(r.severity) : "Medium", countryId: cBy[str(r.country).toLowerCase()] || Cn[0]?.id, waveId: wBy[str(r.wave).toLowerCase()] || W[0]?.id, resolution: str(r.resolution), blocks: [], blockIds: [] })).filter((o) => o.title);
                const parts = [];
                if (R.length) { setRegions(R); parts.push(`${R.length} regions`); }
                if (Cn.length) { setCountries(Cn); parts.push(`${Cn.length} countries`); }
                if (W.length) { setWaves(W); parts.push(`${W.length} waves`); }
                if (Of.length) { setOffers(Of); parts.push(`${Of.length} offers`); }
                if (Bu.length) { setBUs(Bu); parts.push(`${Bu.length} business units`); }
                if (Bl.length) { setBlocks(Bl); parts.push(`${Bl.length} blocks`); }
                if (Bk.length) { setBricks(Bk); setDone({}); parts.push(`${Bk.length} bricks`); }
                if (Ob.length) { setObstacles(Ob); parts.push(`${Ob.length} obstacles`); }
                setImportMsg(parts.length ? `Imported: ${parts.join(", ")}.` : "No recognised sheets found. Use the template’s sheet names.");
            } catch (err) { setImportMsg("Could not read the file: " + err.message); }
            e.target.value = "";
        };
        reader.readAsArrayBuffer(file);
    };

    const renderM5 = () => (
        <>
            {/* Save bar */}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ background: C.green, border: `1px solid ${C.line}` }}>
                <Btn onClick={saveSettings}><Save size={16} /> Save settings</Btn>
                {savedAt
                    ? <span className="text-sm" style={{ color: C.low }}>✓ All settings saved — {savedAt}</span>
                    : <span className="text-sm" style={{ color: C.soft }}>Changes apply live; click Save to persist to the database.</span>}
            </div>

            <Card bg={C.yellow} style={{ marginBottom: 16 }}>
                <h3 className="mb-1 font-semibold" style={{ color: C.ink }}>One-time data import (Excel)</h3>
                <p className="mb-3 text-sm" style={{ color: C.soft }}>Upload an .xlsx with sheets named Regions, Countries, Waves, Offers, BusinessUnits, Blocks, Bricks, Obstacles. Importing replaces matching data. Blocks support optional <b>level</b> (wave/offer) and <b>scope</b> columns.</p>
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
            <Matrix title="Offers → Business Units" rows={offers} cols={bus} map={offerBU} setMap={setOfferBU} bg={C.blue} />
            <Matrix title="Waves → Countries" rows={waves} cols={countries} map={waveCountry} setMap={setWaveCountry} bg={C.green} />
            <Matrix title="Offers → Waves" rows={offers} cols={waves} map={offerWave} setMap={setOfferWave} bg={C.yellow} />

            <div className="mt-4 flex justify-end"><Btn onClick={saveSettings}><Save size={16} /> Save settings</Btn></div>
        </>
    );

    /* ======================= shell ======================= */
    if (!user) return <LoginScreen onLogin={(email) => setUser({ email, role: "admin" })} />;

    const active = MODULES.find((m) => m.id === mod);
    const body = { m1: renderM1, m2: renderM2, m3: renderM3, m4: renderM4, m5: renderM5 }[mod];

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
                        <button onClick={() => setUser(null)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium focus:outline-none focus:ring-2" style={{ color: C.white }}><LogOut size={14} aria-hidden /> Sign out</button>
                    </div>
                </nav>
                <main className="flex-1 p-4 sm:p-6">
                    <header className="mb-4 flex items-center gap-2">
                        {active && <active.Icon size={22} aria-hidden style={{ color: C.mid }} />}
                        <h1 className="text-xl font-bold" style={{ color: C.ink }}>{active?.name}</h1>
                        <button onClick={() => setUser(null)} className="ml-auto inline-flex items-center gap-1 text-sm font-medium focus:outline-none focus:ring-2 sm:hidden" style={{ color: C.soft }}><LogOut size={14} aria-hidden /> Sign out</button>
                    </header>
                    {body()}
                </main>
            </div>
        </div>
    );
}
