/**
 * 注音 DRILL — v5.3 (Global Release Edition)
 * ─────────────────────────────────────────────────────────────────
 * ✓ Timer: Default 3.0s
 * ✓ Language: English
 * ✓ Commercial-ready (CC BY 4.0 Attribution included)
 * ✓ Monetization: Direct PayPal Integration
 * ✓ Feedback: Tally.so Integration
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";

const LS_KEY = "zhuyin_drill_session";

// REPLACE THESE WITH YOUR ACTUAL LINKS:
const PAYPAL_URL = "https://www.paypal.me/FischerDM"; 
const TALLY_URL = "https://tally.so/r/oboGpX";

function loadSession() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { total: 0, correct: 0, bestStreak: 0 };
    const p = JSON.parse(raw);
    return {
      total:      Number(p.total)      || 0,
      correct:    Number(p.correct)    || 0,
      bestStreak: Number(p.bestStreak) || 0,
    };
  } catch {
    return { total: 0, correct: 0, bestStreak: 0 };
  }
}

function saveSession(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

const SYMBOLS = [
  {sym:"ㄅ", py:"b",   grp:"initial", audio:"bo"},
  {sym:"ㄆ", py:"p",   grp:"initial", audio:"po"},
  {sym:"ㄇ", py:"m",   grp:"initial", audio:"mo"},
  {sym:"ㄈ", py:"f",   grp:"initial", audio:"fo"},
  {sym:"ㄉ", py:"d",   grp:"initial", audio:"de"},
  {sym:"ㄊ", py:"t",   grp:"initial", audio:"te"},
  {sym:"ㄋ", py:"n",   grp:"initial", audio:"ne"},
  {sym:"ㄌ", py:"l",   grp:"initial", audio:"le"},
  {sym:"ㄍ", py:"g",   grp:"initial", audio:"ge"},
  {sym:"ㄎ", py:"k",   grp:"initial", audio:"ke"},
  {sym:"ㄏ", py:"h",   grp:"initial", audio:"he"},
  {sym:"ㄐ", py:"j",   grp:"initial", audio:"ji"},
  {sym:"ㄑ", py:"q",   grp:"initial", audio:"qi"},
  {sym:"ㄒ", py:"x",   grp:"initial", audio:"xi"},
  {sym:"ㄓ", py:"zh",  grp:"initial", audio:"zhi"},
  {sym:"ㄔ", py:"ch",  grp:"initial", audio:"chi"},
  {sym:"ㄕ", py:"sh",  grp:"initial", audio:"shi"},
  {sym:"ㄖ", py:"r",   grp:"initial", audio:"ri"},
  {sym:"ㄗ", py:"z",   grp:"initial", audio:"zi"},
  {sym:"ㄘ", py:"c",   grp:"initial", audio:"ci"},
  {sym:"ㄙ", py:"s",   grp:"initial", audio:"si"},
  {sym:"ㄧ", py:"i",   grp:"medial",  audio:"yi"},
  {sym:"ㄨ", py:"u",   grp:"medial",  audio:"wu"},
  {sym:"ㄩ", py:"ü",   grp:"medial",  audio:"yu"},
  {sym:"ㄚ", py:"a",   grp:"final",   audio:"a"},
  {sym:"ㄛ", py:"o",   grp:"final",   audio:"o"},
  {sym:"ㄜ", py:"e",   grp:"final",   audio:"e"},
  {sym:"ㄝ", py:"ê",   grp:"final",   audio:"ie"},
  {sym:"ㄞ", py:"ai",  grp:"final",   audio:"ai"},
  {sym:"ㄟ", py:"ei",  grp:"final",   audio:"ei"},
  {sym:"ㄠ", py:"ao",  grp:"final",   audio:"ao"},
  {sym:"ㄡ", py:"ou",  grp:"final",   audio:"ou"},
  {sym:"ㄢ", py:"an",  grp:"final",   audio:"an"},
  {sym:"ㄣ", py:"en",  grp:"final",   audio:"en"},
  {sym:"ㄤ", py:"ang", grp:"final",   audio:"ang"},
  {sym:"ㄥ", py:"eng", grp:"final",   audio:"eng"},
  {sym:"ㄦ", py:"er",  grp:"final",   audio:"er"},
];

class AudioEngine {
  constructor() {
    this._ctx    = null;
    this.buffers = new Map();
  }
  _getCtx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }
  async preload(onTick) {
    const ctx = this._getCtx();
    await Promise.allSettled(
      SYMBOLS.map(async ({ sym, audio }) => {
        const url = `/audio/${audio}.mp3`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          this.buffers.set(sym, audioBuf);
          onTick(sym, "ok");
        } catch (err) {
          this.buffers.set(sym, null);
          onTick(sym, "fail");
        }
      })
    );
  }
  play(sym) {
    const buf = this.buffers.get(sym);
    if (!buf) return;
    try {
      const ctx = this._getCtx();
      if (ctx.state === "suspended") ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  }
  has(sym) { return !!this.buffers.get(sym); }
}

const engine = new AudioEngine();

const DEFAULT_CFG = {
  timerMs:    3000,
  symbolSet:  "all",
  difficulty: "normal",
  showAnswer: true,
  autoAudio:  true,
  prioQueue:  true,
};

const PRIO_EVERY = 3;
const PRIO_CLEAR = 2;
const NEXT_DELAY = 650;

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
function getPool(set) {
  if (set === "init")   return SYMBOLS.filter(s => s.grp !== "final");
  if (set === "finals") return SYMBOLS.filter(s => s.grp !== "initial");
  return SYMBOLS;
}
function makeOptions(correct, pool) {
  const others = shuffle(pool.filter(s => s.sym !== correct.sym)).slice(0, 3);
  return shuffle([...others, correct]);
}

const V = {
  bg:     "#060B14",
  surf:   "#0F172A",
  card:   "#1A2539",
  border: "#243247",
  blue:   "#0EA5E9",
  text:   "#E2E8F0",
  muted:  "#64748B",
  ok:     "#4ADE80",
  fail:   "#F87171",
  prio:   "#FB923C",
  mono:   "'IBM Plex Mono', monospace",
  cjk:    "'Noto Sans TC', sans-serif",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; user-select:none; }
  button { border:none; outline:none; font-family:inherit; cursor:pointer; touch-action:manipulation; }
  button:not(:disabled):active { opacity:.8; }
`;

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width:48, height:26, borderRadius:13, cursor:"pointer", position:"relative", background: on ? V.blue : V.border, transition:"background .15s" }}>
      <div style={{ position:"absolute", top:3, left: on ? 25 : 3, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,.3)", transition:"left .15s" }}/>
    </div>
  );
}

function PillRow({ options, value, onChange }) {
  return (
    <div style={{ display:"flex", gap:6 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{ padding:"7px 13px", borderRadius:10, fontSize:11, fontWeight:700, border:"1.5px solid", fontFamily:"inherit", cursor:"pointer", borderColor: value === o.v ? V.blue : V.border, background: value === o.v ? V.blue : "transparent", color: value === o.v ? "#fff" : V.muted }}>{o.l}</button>
      ))}
    </div>
  );
}

function SettingsScreen({ cfg, onSave }) {
  const [local, setLocal] = useState({ ...cfg });
  const set = (k, v) => setLocal(l => ({ ...l, [k]: v }));
  return (
    <div style={S.setInner}>
      <div style={S.setHeader}>
        <span style={S.setTitle}>Settings</span>
        <button style={S.btnBack} onClick={() => onSave(local)}>← Save</button>
      </div>
      <div style={S.secLabel}>Timer</div>
      <div style={S.setCard}>
        <div style={{ ...S.setRow, borderBottom:`1px solid ${V.border}` }}>
          <div><div style={S.rowLbl}>Response Time</div><div style={S.rowSub}>Seconds per question</div></div>
          <div style={S.stepper}>
            <button style={S.stepBtn} onClick={() => set("timerMs", Math.max(1000, local.timerMs - 500))}>−</button>
            <span style={S.stepVal}>{(local.timerMs / 1000).toFixed(1)}s</span>
            <button style={S.stepBtn} onClick={() => set("timerMs", Math.min(10000, local.timerMs + 500))}>+</button>
          </div>
        </div>
      </div>
      <div style={S.secLabel}>Quiz Mode</div>
      <div style={S.setCard}>
        <div style={{ ...S.setRow, borderBottom:`1px solid ${V.border}` }}>
          <div><div style={S.rowLbl}>Symbol Set</div><div style={S.rowSub}>Focus your training</div></div>
          <PillRow options={[{v:"all",l:"All 37"},{v:"init",l:"Initials"},{v:"finals",l:"Finals"}]} value={local.symbolSet} onChange={v => set("symbolSet", v)} />
        </div>
        <div style={S.setRow}>
          <div><div style={S.rowLbl}>Difficulty</div><div style={S.rowSub}>Priority Queue multiplier</div></div>
          <PillRow options={[{v:"easy",l:"Easy"},{v:"normal",l:"Normal"},{v:"hard",l:"Hard"}]} value={local.difficulty} onChange={v => set("difficulty", v)} />
        </div>
      </div>
      <div style={S.secLabel}>Feedback Mode</div>
      <div style={S.setCard}>
        <div style={{ ...S.setRow, borderBottom:`1px solid ${V.border}` }}>
          <div><div style={S.rowLbl}>Show Correct Answer</div><div style={S.rowSub}>Reveal on error</div></div>
          <Toggle on={local.showAnswer} onToggle={() => set("showAnswer", !local.showAnswer)}/>
        </div>
        <div style={{ ...S.setRow, borderBottom:`1px solid ${V.border}` }}>
          <div><div style={S.rowLbl}>Audio Autoplay</div><div style={S.rowSub}>Play sound automatically</div></div>
          <Toggle on={local.autoAudio} onToggle={() => set("autoAudio", !local.autoAudio)}/>
        </div>
        <div style={S.setRow}>
          <div><div style={S.rowLbl}>Priority Queue</div><div style={S.rowSub}>Repeat mistakes every 3 rounds</div></div>
          <Toggle on={local.prioQueue} onToggle={() => set("prioQueue", !local.prioQueue)}/>
        </div>
      </div>
      <button style={S.btnSave} onClick={() => onSave(local)}>Save & Exit</button>
    </div>
  );
}

function HomeScreen({ session, onStart, onSettings, onReset }) {
  const acc = session.total > 0 ? Math.round(session.correct / session.total * 100) + "%" : "—";
  return (
    <div style={S.homeWrap}>
      {[["ㄅ","6%","8%",80],["ㄓ","18%","62%",100],["ㄢ","64%","12%",90],["ㄩ","76%","58%",85],["ㄞ","38%","78%",75],["ㄏ","54%","22%",95],["ㄐ","8%","42%",70],["ㄥ","85%","72%",88]].map(([sym,l,t,sz],i)=>(
        <div key={sym} style={{ position:"absolute", left:l, top:t, fontFamily:V.cjk, fontWeight:900, fontSize:sz, color:V.blue, opacity:.045, lineHeight:1, pointerEvents:"none", transform:`rotate(${i*11-25}deg)` }}>{sym}</div>
      ))}
      <div style={S.homeBadge}>BOPOMOFO TRAINER</div>
      <div style={S.homeTitle}>注音</div>
      <div style={S.homeSub}>ZHUYIN DRILL</div>
      <div style={S.homeStats}>
        {[["Answered", session.total], ["Best Streak", session.bestStreak], ["Accuracy", acc]].map(([l, v]) => (
          <div key={l} style={S.homeStat}>
            <div style={S.homeStatNum}>{v}</div>
            <div style={S.homeStatLbl}>{l}</div>
          </div>
        ))}
      </div>
      <button style={S.btnPrimary} onClick={onStart}>▶  START</button>
      <div style={{ display:"flex", gap:10, width:"100%", marginTop:12 }}>
        <button style={{ ...S.btnSecondary, flex:1, marginTop:0 }} onClick={onSettings}>⚙ SETTINGS</button>
        <button style={{ ...S.btnSecondary, flex:1, marginTop:0, color:V.prio, borderColor:V.prio }} onClick={() => window.open(PAYPAL_URL, '_blank')}>💳 PAYPAL</button>
      </div>
      <button style={{ ...S.btnReset, marginTop:20, color:V.blue }} onClick={() => window.open(TALLY_URL, '_blank')}>Report Bug / Feedback</button>
      {session.total > 0 && <button style={S.btnReset} onClick={onReset}>↺ Reset Stats</button>}
      <div style={S.homeFooter}>
        37 Symbols · Offline Audio · Priority Queue
        <div style={{ marginTop: 12, fontSize: 8, opacity: 0.6, lineHeight: 1.4, fontWeight: "normal", textTransform: "none" }}>
          Audio: <a href="https://tone.lib.msu.edu/" target="_blank" style={{ color: V.blue, textDecoration: "none" }}>Tone Perfect Dataset</a> (Michigan State University)<br/>
          Licensed under CC BY 4.0
        </div>
      </div>
    </div>
  );
}

function PreloadScreen({ onDone }) {
  const [ticks, setTicks] = useState({});
  const [done, setDone] = useState(0);
  const [canSkip, setSkip] = useState(false);
  useEffect(() => {
    const skipTO = setTimeout(() => setSkip(true), 2000);
    engine.preload((sym, status) => {
      setTicks(prev => ({ ...prev, [sym]: status }));
      setDone(n => {
        const next = n + 1;
        if (next >= SYMBOLS.length) setTimeout(onDone, 600);
        return next;
      });
    });
    return () => clearTimeout(skipTO);
  }, [onDone]);
  const pct = done / SYMBOLS.length;
  return (
    <div style={S.loadWrap}>
      <div style={S.loadTitle}>注音</div>
      <div style={S.loadSub}>LOADING AUDIO ASSETS</div>
      <div style={S.loadTrack}><div style={{ ...S.loadFill, width:`${pct * 100}%` }}/></div>
      <div style={S.loadStatus}>{done < SYMBOLS.length ? `Loading ${done} / ${SYMBOLS.length}…` : `✓ Ready to start`}</div>
      <div style={S.loadGrid}>{SYMBOLS.map(({ sym }) => (
          <div key={sym} style={{ ...S.lsSym, ...(ticks[sym] === "ok" ? S.lsOk : {}), ...(ticks[sym] === "fail" ? S.lsFail : {}), }}>{sym}</div>
      ))}</div>
      {canSkip && done < SYMBOLS.length && <button style={S.btnSkip} onClick={onDone}>▶ Start without Audio</button>}
    </div>
  );
}

function GameScreen({ cfg, session, onSaveSession, onPause }) {
  const turnRef = useRef(0);
  const pqRef = useRef([]);
  const lockedRef = useRef(false);
  const timerAF = useRef(null);
  const timerTO = useRef(null);
  const nextTO = useRef(null);
  const fillRef = useRef(null);
  const [q, setQ] = useState(null);
  const [fb, setFb] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ c: 0, t: 0 });
  const addPQ = sym => { if (!pqRef.current.find(e => e.sym === sym)) pqRef.current = [...pqRef.current, { sym, cleared:0 }]; };
  const tickPQ = sym => { pqRef.current = pqRef.current.map(e => e.sym===sym ? {...e, cleared:e.cleared+1} : e).filter(e => e.cleared < PRIO_CLEAR); };
  const startTimer = useCallback((onExpire) => {
    cancelAnimationFrame(timerAF.current);
    clearTimeout(timerTO.current);
    const t0 = performance.now();
    const dur = cfg.timerMs;
    const tick = () => {
      const pct = Math.max(0, 1 - (performance.now() - t0) / dur);
      if (fillRef.current) fillRef.current.style.width = `${pct * 100}%`;
      if (pct > 0) timerAF.current = requestAnimationFrame(tick);
    };
    timerAF.current = requestAnimationFrame(tick);
    timerTO.current = setTimeout(onExpire, dur);
  }, [cfg.timerMs]);
  const stopTimer = useCallback(() => { cancelAnimationFrame(timerAF.current); clearTimeout(timerTO.current); if (fillRef.current) fillRef.current.style.width = "0%"; }, []);
  const advance = useCallback(() => {
    clearTimeout(nextTO.current);
    lockedRef.current = false;
    turnRef.current++;
    const pool = getPool(cfg.symbolSet);
    let isPrio = false, entry;
    if (cfg.prioQueue && turnRef.current % PRIO_EVERY === 0 && pqRef.current.length > 0) {
      isPrio = true;
      entry = SYMBOLS.find(s => s.sym === pqRef.current[Math.floor(Math.random() * pqRef.current.length)].sym);
    } else { entry = pool[Math.floor(Math.random() * pool.length)]; }
    const opts = makeOptions(entry, pool);
    setQ({ sym:entry.sym, py:entry.py, opts, isPrio });
    setFb(null);
    if (cfg.autoAudio) setTimeout(() => engine.play(entry.sym), 80);
    startTimer(() => {
      if (lockedRef.current) return;
      lockedRef.current = true; stopTimer(); addPQ(entry.sym);
      setStreak(0); setScore(s => { const n = { ...s, t: s.t + 1 }; handleSaveSession({ ...session, total: session.total + 1 }); return n; });
      setFb({ type:"timeout", selSym:null }); engine.play(entry.sym);
      nextTO.current = setTimeout(advance, NEXT_DELAY);
    });
  }, [cfg, startTimer, stopTimer, session]);
  const handleSaveSession = useCallback((upd) => { Object.assign(session, upd); onSaveSession(upd); }, [session, onSaveSession]);
  const onAnswer = useCallback((opt) => {
    if (lockedRef.current || !q) return;
    lockedRef.current = true; stopTimer();
    const ok = opt.sym === q.sym;
    if (!ok) addPQ(q.sym); else if (q.isPrio) tickPQ(q.sym);
    if (!ok) engine.play(q.sym);
    setStreak(prev => { const n = ok ? prev + 1 : 0; if (n > session.bestStreak) handleSaveSession({ ...session, bestStreak: n }); return n; });
    setScore(s => { const n = { c: s.c + (ok?1:0), t: s.t + 1 }; handleSaveSession({ ...session, total: session.total + 1, correct: session.correct + (ok?1:0) }); return n; });
    setFb({ type: ok ? "ok" : "fail", selSym: opt.sym });
    nextTO.current = setTimeout(advance, NEXT_DELAY);
  }, [q, stopTimer, advance, session]);
  useEffect(() => { advance(); return () => { cancelAnimationFrame(timerAF.current); clearTimeout(timerTO.current); clearTimeout(nextTO.current); }; }, []);
  if (!q) return null;
  const cardFlash = fb?.type === "ok" ? { background:"#052e16", borderColor:"#166534" } : fb?.type === "fail" ? { background:"#2d0a0a", borderColor:"#7f1d1d" } : fb?.type === "timeout" ? { background:"#1a1500", borderColor:"#4a3800" } : {};
  const fbColor = fb?.type === "ok" ? V.ok : fb?.type === "fail" ? V.fail : fb?.type === "timeout" ? "#a37c00" : "transparent";
  const fbText = fb?.type === "ok" ? "✓ CORRECT" : fb?.type === "fail" ? (cfg.showAnswer ? `✗ ${q.py.toUpperCase()}` : "✗ WRONG") : fb?.type === "timeout" ? `⏱ TIMEOUT — ${q.py.toUpperCase()}` : "—";
  return (
    <>
      <div style={S.gHeader}>
        <div><span style={S.gLogoZH}>注音</span><span style={S.gLogoEN}>DRILL</span></div>
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          {pqRef.current.length > 0 && <div style={S.pillPrio}>⚠ {pqRef.current.length}</div>}
          <div style={S.pillStreak}>{streak >= 10 ? "🔥" : streak >= 5 ? "⚡" : "✦"} {streak}</div>
          <button style={S.pillGear} onClick={onPause}>⚙</button>
        </div>
      </div>
      <div style={S.timerTrack}><div ref={fillRef} style={S.timerFill}/></div>
      <div style={{ ...S.symCard, ...cardFlash }}>
        <button style={{ ...S.audioBtn, opacity: engine.has(q.sym) ? 0.8 : 0.3 }} onClick={() => engine.play(q.sym)}>{engine.has(q.sym) ? "🔊" : "🔇"}</button>
        {q.isPrio && <div style={S.prioBadge}><span style={S.prioPip}/>PRIORITY</div>}
        <div style={S.glyph}>{q.sym}</div>
        <div style={{ ...S.fbLine, color: fbColor }}>{fbText}</div>
      </div>
      <div style={S.optsGrid}>{q.opts.map(opt => (
            <button key={opt.sym} style={{ ...S.opt, ...(fb ? (opt.sym === q.sym ? S.optOk : (opt.sym === fb.selSym ? S.optFail : S.optDim)) : {}) }} onPointerDown={() => onAnswer(opt)} disabled={!!fb}>{opt.py}</button>
      ))}</div>
      <div style={S.gFooter}>
        {[["SCORE", `${score.c}/${score.t}`], ["ROUND", turnRef.current], ["QUEUE", pqRef.current.length], ["TIMER", `${(cfg.timerMs/1000).toFixed(1)}s`]].map(([l, v]) => (
          <div key={l} style={S.gFoot}>{l} <span style={{ color:V.text }}>{v}</span></div>
        ))}
      </div>
    </>
  );
}

function App() {
  const [screen, setScreen] = useState("home");
  const [cfg, setCfg] = useState({ ...DEFAULT_CFG });
  const session = useRef(loadSession());
  const [snap, setSnap] = useState(session.current);
  const handleSave = useCallback((u) => { Object.assign(session.current, u); setSnap({ ...session.current }); saveSession(session.current); }, []);
  const handleReset = useCallback(() => { const e = { total:0, correct:0, bestStreak:0 }; handleSave(e); }, []);
  return (
    <div style={{ background:V.bg, minHeight:"100svh", display:"flex", justifyContent:"center", fontFamily:V.mono }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:"100%", maxWidth:460, display:"flex", flexDirection:"column" }}>
        {screen === "home" && <HomeScreen session={snap} onStart={() => setScreen("preload")} onSettings={() => setScreen("settings")} onReset={handleReset} />}
        {screen === "settings" && <SettingsScreen cfg={cfg} onSave={n => { setCfg(n); setScreen("home"); }} />}
        {screen === "preload" && <PreloadScreen onDone={() => setScreen("game")} />}
        {screen === "game" && <GameScreen key={JSON.stringify(cfg)} cfg={cfg} session={session.current} onSaveSession={handleSave} onPause={() => setScreen("settings")} />}
      </div>
    </div>
  );
}

const S = {
  homeWrap:    { flex:1, width:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"36px 24px", position:"relative", overflow:"hidden" },
  homeBadge:   { background:V.blue, color:"#fff", fontSize:9, fontWeight:700, letterSpacing:".2em", padding:"5px 14px", borderRadius:20, marginBottom:24, zIndex:1 },
  homeTitle:   { fontFamily:V.cjk, fontWeight:900, fontSize:72, color:V.blue, lineHeight:1, zIndex:1 },
  homeSub:     { fontSize:11, fontWeight:700, letterSpacing:".22em", color:V.muted, marginTop:4, marginBottom:36, zIndex:1 },
  homeStats:   { display:"flex", gap:12, width:"100%", marginBottom:36, zIndex:1 },
  homeStat:    { flex:1, background:V.surf, border:`1px solid ${V.border}`, borderRadius:18, padding:"16px 10px", textAlign:"center" },
  homeStatNum: { fontSize:22, fontWeight:700, color:V.blue },
  homeStatLbl: { fontSize:9, fontWeight:600, letterSpacing:".1em", color:V.muted, marginTop:3, textTransform:"uppercase" },
  btnPrimary:  { width:"100%", height:68, background:V.blue, borderRadius:22, color:"#fff", fontSize:16, fontWeight:700, letterSpacing:".08em", boxShadow:"0 8px 28px rgba(14,165,233,.3)", zIndex:1 },
  btnSecondary:{ marginTop:12, height:52, background:"transparent", border:`1.5px solid ${V.border}`, borderRadius:18, color:V.text, fontSize:12, fontWeight:700, letterSpacing:".08em", zIndex:1 },
  btnReset:    { marginTop:10, background:"transparent", border:"none", color:V.muted, fontSize:10, fontWeight:600, letterSpacing:".1em", zIndex:1, cursor:"pointer" },
  homeFooter:  { fontSize:9, fontWeight:600, color:V.muted, letterSpacing:".1em", marginTop:22, textTransform:"uppercase", zIndex:1, textAlign: "center" },
  setInner:    { flex:1, width:"100%", display:"flex", flexDirection:"column", padding:"0 20px 32px" },
  setHeader:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"22px 0 20px" },
  setTitle:    { fontSize:18, fontWeight:700, color:V.text },
  btnBack:     { background:V.surf, border:`1.5px solid ${V.border}`, borderRadius:12, padding:"8px 16px", fontSize:11, fontWeight:700, color:V.blue },
  secLabel:    { fontSize:9, fontWeight:700, letterSpacing:".16em", color:V.muted, textTransform:"uppercase", margin:"18px 0 8px" },
  setCard:     { background:V.surf, borderRadius:20, border:`1px solid ${V.border}`, overflow:"hidden" },
  setRow:      { padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  rowLbl:      { fontSize:13, fontWeight:600, color:V.text },
  rowSub:      { fontSize:10, color:V.muted, marginTop:2 },
  stepper:     { display:"flex", alignItems:"center", background:V.card, borderRadius:12, border:`1px solid ${V.border}`, overflow:"hidden" },
  stepBtn:     { width:40, height:40, background:"transparent", fontSize:18, color:V.blue, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" },
  stepVal:     { minWidth:52, textAlign:"center", fontSize:16, fontWeight:700, color:V.blue },
  btnSave:     { marginTop:24, width:"100%", height:60, background:V.blue, borderRadius:18, color:"#fff", fontSize:14, fontWeight:700, letterSpacing:".08em", boxShadow:"0 6px 20px rgba(14,165,233,.25)" },
  loadWrap:    { flex:1, width:"100%", display:"flex", flexDirection:"column", alignItems:"center", padding:"36px 24px" },
  loadTitle:   { fontFamily:V.cjk, fontWeight:900, fontSize:44, color:V.blue, marginBottom:4 },
  loadSub:     { fontSize:9, fontWeight:700, letterSpacing:".2em", color:V.muted, marginBottom:28 },
  loadTrack:   { width:"100%", height:5, background:V.surf, borderRadius:3, overflow:"hidden", marginBottom:10 },
  loadFill:    { height:"100%", background:V.blue, borderRadius:3 },
  loadStatus:  { fontSize:11, color:V.muted, marginBottom:24 },
  loadGrid:    { display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6, width:"100%" },
  lsSym:       { height:36, borderRadius:8, background:V.surf, border:`1px solid ${V.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:V.cjk, fontSize:14, color:V.muted },
  lsOk:        { background:"#052e16", color:"#4ADE80", border:"1px solid #166534" },
  lsFail:      { opacity:.35 },
  btnSkip:     { marginTop:20, padding:"11px 28px", background:V.surf, border:`1px solid ${V.border}`, borderRadius:12, color:V.text, fontSize:11, fontWeight:700, letterSpacing:".1em" },
  gHeader:     { width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 18px 10px" },
  gLogoZH:     { fontFamily:V.cjk, fontWeight:900, fontSize:20, color:V.blue },
  gLogoEN:     { fontSize:9, fontWeight:700, letterSpacing:".2em", color:V.muted, marginLeft:6 },
  pillStreak:  { display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:20, fontSize:13, fontWeight:700, background:"#0c1f35", color:V.blue, border:"1px solid #1e3a5f" },
  pillPrio:    { display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:20, fontSize:13, fontWeight:700, background:"#2d1200", color:V.prio, border:"1px solid #7c2d12" },
  pillGear:    { display:"flex", alignItems:"center", padding:"5px 10px", borderRadius:20, fontSize:15, background:V.surf, color:V.muted, border:`1px solid ${V.border}` },
  timerTrack:  { width:"100%", height:3, background:V.surf },
  timerFill:   { height:"100%", background:V.blue, width:"100%" },
  symCard:     { width:"calc(100% - 28px)", borderRadius:22, background:V.card, border:`1px solid ${V.border}`, margin:"18px 0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"26px 20px", position:"relative", minHeight:196 },
  audioBtn:    { position:"absolute", top:12, left:12, background:"transparent", fontSize:14, padding:0 },
  prioBadge:   { position:"absolute", top:12, right:12, background:"rgba(251,146,60,.15)", border:`1px solid ${V.prio}`, color:V.prio, fontSize:9, fontWeight:700, letterSpacing:".12em", padding:"3px 8px", borderRadius:6, display:"flex", alignItems:"center", gap:4 },
  prioPip:     { width:5, height:5, borderRadius:"50%", background:V.prio, display:"inline-block" },
  glyph:       { fontFamily:V.cjk, fontWeight:900, fontSize:108, lineHeight:1, color:V.text },
  fbLine:      { height:17, marginTop:9, fontSize:10, fontWeight:700, letterSpacing:".13em" },
  optsGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, width:"calc(100% - 28px)" },
  opt:         { height:82, borderRadius:17, background:V.surf, border:`1.5px solid ${V.border}`, fontSize:20, fontWeight:700, color:V.text, display:"flex", alignItems:"center", justifyContent:"center" },
  optOk:       { background:"#052e16", borderColor:V.ok,   color:V.ok   },
  optFail:     { background:"#2d0a0a", borderColor:V.fail, color:V.fail },
  optDim:      { opacity:.2, pointerEvents:"none" },
  gFooter:     { marginTop:14, display:"flex", gap:18, paddingBottom:24 },
  gFoot:       { fontSize:9, fontWeight:600, letterSpacing:".1em", color:V.muted, textTransform:"uppercase" },
};