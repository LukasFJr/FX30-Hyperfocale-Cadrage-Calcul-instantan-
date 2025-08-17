import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

// FX30 Hyperfocal Calculator — v2.3
// - Unifie la gestion du thème via classes conditionnelles (plus de `dark:` Tailwind).
// - Perf: mémoïsation des dérivés (FOV, équiv, affichages), constantes module-level,
//         `useCallback` pour presets, moins d'allocations à chaque render.
// - Robustesse: bouton copie amélioré (isSecureContext, visibilityState, disable pendant op,
//              modal clavier: Esc pour fermer).
// - Compat: suppression de `foreignObject` → icône caméra en pur SVG.
// - Tests: + cas extrêmes, + recadrage 1.20×, + propriété near@H ≈ H/2.

/* ===================== Constantes module ===================== */
const PRESET_FOCALS = [17, 20, 24, 28, 35, 50, 70];
const PRESET_APERTURES = [2.8, 4, 5.6, 8, 11, 16, 22];

/* ===================== Utilitaires généraux ===================== */
function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
function toFixedSmart(num, digits = 2) {
  if (!isFinite(num)) return "—";
  if (Math.abs(num) < 1e-9) return "0";
  const p = Math.pow(10, digits);
  return (Math.round(num * p) / p).toString();
}
function formatDistanceMeters(meters, unit) {
  if (!isFinite(meters)) return "—";
  if (unit === "ft") {
    const ft = meters * 3.280839895; // exact
    return `${toFixedSmart(ft, ft < 10 ? 2 : 1)} ft`;
  }
  if (meters < 1) return `${toFixedSmart(meters * 100, 0)} cm`;
  return `${toFixedSmart(meters, meters < 10 ? 2 : 1)} m`;
}
function niceMax(maxValue) {
  if (!isFinite(maxValue) || maxValue <= 0) return 1;
  const steps = [1, 2, 5];
  const e = Math.floor(Math.log10(maxValue));
  const base = Math.pow(10, e);
  for (let s of steps) {
    const v = s * base;
    if (v >= maxValue) return v;
  }
  return 10 * base;
}
function deg(x) { return (x * 180) / Math.PI; }
function rad(x) { return (x * Math.PI) / 180; }

/* ===================== Composant principal ===================== */
export default function FX30Hyperfocale() {
  // Thème
  const [dark, setDark] = useState(false);

  // Contrôles principaux
  const [mode, setMode] = useState("standard"); // "standard" | "active"
  const [focal, setFocal] = useState(35); // mm
  const [aperture, setAperture] = useState(4); // f/
  const [unit, setUnit] = useState("m"); // "m" | "ft"

  // Avancés
  const [cocBase, setCocBase] = useState(0.019); // mm APS-C
  const [sensorW, setSensorW] = useState(23.5);
  const [sensorH, setSensorH] = useState(15.6);
  const [activeCrop, setActiveCrop] = useState(1.10);
  const [limitLens, setLimitLens] = useState(true); // 17–70

  const cropMode = mode === "active" ? activeCrop : 1.0;
  const cocEquiv = useMemo(() => cocBase / cropMode, [cocBase, cropMode]); // recadrage → CoC plus petit

  // Hyperfocale (mm → m)
  const H_mm = useMemo(() => {
    const f = clamp(Number(focal) || 0, 1, 1000);
    const N = clamp(Number(aperture) || 1.0, 0.7, 64);
    const c = Math.max(Number(cocEquiv) || 0.0001, 0.000001);
    return (f * f) / (N * c) + f; // mm
  }, [focal, aperture, cocEquiv]);
  const H_m = useMemo(() => H_mm / 1000, [H_mm]);
  const nearAtH_m = useMemo(() => H_m / 2, [H_m]);

  // Champ de vision (FOV) et dérivés
  const effW = useMemo(() => sensorW / cropMode, [sensorW, cropMode]);
  const effH = useMemo(() => sensorH / cropMode, [sensorH, cropMode]);
  const f = useMemo(() => Number(focal) || 1, [focal]);
  const hFOV = useMemo(() => 2 * deg(Math.atan(effW / (2 * f))), [effW, f]);
  const vFOV = useMemo(() => 2 * deg(Math.atan(effH / (2 * f))), [effH, f]);
  const ffEq = useMemo(() => f * 1.5 * cropMode, [f, cropMode]);

  const maxScaleM = useMemo(() => niceMax(H_m * 1.15), [H_m]);
  const displayH = useMemo(() => formatDistanceMeters(H_m, unit), [H_m, unit]);
  const displayNear = useMemo(() => formatDistanceMeters(nearAtH_m, unit), [nearAtH_m, unit]);

  const copyText = useMemo(() => `FX30 Hyperfocale — f=${toFixedSmart(f,1)}mm (eq. ${toFixedSmart(ffEq,1)}mm), N=f/${toFixedSmart(aperture,1)}, mode=${mode}, H≈${displayH} (near≈${displayNear}).`, [f, ffEq, aperture, mode, displayH, displayNear]);

  // Presets rapides (useCallback pour éviter recréations)
  const applyPreset = useCallback((p) => {
    if (p === "street") { setMode("standard"); setFocal(17); setAperture(8); }
    if (p === "land") { setMode("standard"); setFocal(24); setAperture(11); }
    if (p === "tele") { setMode("standard"); setFocal(50); setAperture(8); }
    if (p === "night") { setMode("active"); setFocal(17); setAperture(2.8); }
  }, []);

  return (
    <div>
      <div className={`min-h-screen w-full bg-gradient-to-br transition-colors ${dark ? "from-slate-900 via-slate-950 to-black text-slate-100" : "from-slate-50 via-slate-100 to-slate-200 text-slate-900"}`}>
        {/* Style sliders (webkit) */}
        <style>{`
          input[type=range] { -webkit-appearance:none; appearance:none; height:6px; border-radius:9999px; background:linear-gradient(90deg,#0ea5e9,#6366f1); outline:none; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:9999px; background:white; box-shadow:0 1px 4px rgba(0,0,0,.2); border:2px solid #6366f1; }
          input[type=range]::-moz-range-thumb { width:18px; height:18px; border-radius:9999px; background:white; box-shadow:0 1px 4px rgba(0,0,0,.2); border:2px solid #6366f1; }
        `}</style>

        <div className="mx-auto max-w-6xl p-6">
          {/* Header */}
          <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${dark ? "border-white/10 bg-slate-900/50" : "border-white/10 bg-white/70 supports-[backdrop-filter]:bg-white/50"}`}>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">FX30 · Hyperfocale & Cadrage</h1>
              <p className={`text-sm ${dark ? "text-slate-300" : "text-slate-600"}`}>Calcul instantané (Tamron 17–70 ou autre). Mode Standard / Actif, schéma, presets.</p>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                options={[{ id: "m", label: "m" }, { id: "ft", label: "ft" }]}
                value={unit}
                onChange={setUnit}
                ariaLabel="Unités"
                isDark={dark}
              />
              <button onClick={() => setDark((d) => !d)}
                className={`rounded-xl border px-3 py-2 text-sm shadow ${dark ? "border-white/20 bg-gradient-to-br from-slate-800 to-slate-700" : "border-white/20 bg-gradient-to-br from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300"}`}>
                {dark ? "☀️" : "🌙"}
              </button>
              <CopyButton text={copyText} isDark={dark} />
            </div>
          </motion.header>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Panneau de contrôles */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
              className={`rounded-2xl border p-5 shadow-lg backdrop-blur ${dark ? "border-white/10 bg-slate-900/50" : "border-white/10 bg-white/70 supports-[backdrop-filter]:bg-white/50"}`}>
              <h2 className="mb-4 text-lg font-semibold">Paramètres</h2>

              {/* Mode */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium">Mode de stabilisation</label>
                <Segmented
                  options={[{ id: "standard", label: "Standard (IBIS)" }, { id: "active", label: "Actif (recadrage)" }]}
                  value={mode}
                  onChange={setMode}
                  ariaLabel="Mode de stabilisation"
                  isDark={dark}
                />
                <p className={`mt-2 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>Actif resserre le cadre (~{(activeCrop * 100 - 100).toFixed(0)}%) et réduit le CoC → H augmente légèrement.</p>
              </div>

              {/* Focale */}
              <div className="mb-5">
                <div className="flex items-end justify-between">
                  <label className="block text-sm font-medium">Focale (mm)</label>
                  <div className={`text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>Équiv. 24×36 ≈ {toFixedSmart(ffEq, 1)} mm</div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input type="range" min={limitLens ? 17 : 5} max={limitLens ? 70 : 200} step={0.1} value={focal} onChange={(e) => setFocal(Number(e.target.value))} className="h-2 w-full cursor-pointer rounded-full" />
                  <NumberBox value={focal} setValue={setFocal} min={limitLens ? 17 : 5} max={limitLens ? 70 : 200} step={0.1} suffix="mm" isDark={dark} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESET_FOCALS.map((v) => (
                    <Chip key={v} onClick={() => setFocal(v)} isDark={dark}>{v} mm</Chip>
                  ))}
                </div>
                <label className={`mt-3 flex items-center gap-2 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
                  <input type="checkbox" checked={limitLens} onChange={(e) => setLimitLens(e.target.checked)} />
                  Limiter à 17–70 mm (Tamron)
                </label>
              </div>

              {/* Ouverture */}
              <div className="mb-2">
                <label className="mb-2 block text-sm font-medium">Ouverture (N = f/x)</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="range" min={1.0} max={22} step={0.1} value={aperture} onChange={(e) => setAperture(Number(e.target.value))} className="h-2 w-full cursor-pointer rounded-full" />
                  <NumberBox value={aperture} setValue={setAperture} min={1.0} max={22} step={0.1} prefix="f/" isDark={dark} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESET_APERTURES.map((v) => (
                    <Chip key={v} onClick={() => setAperture(v)} isDark={dark}>f/{v}</Chip>
                  ))}
                </div>
              </div>

              {/* Presets pratiques */}
              <div className="mt-4">
                <div className={`mb-2 text-xs font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>Presets rapides</div>
                <div className="flex flex-wrap gap-2">
                  <Chip onClick={() => applyPreset("street")} isDark={dark}>Street / Docu</Chip>
                  <Chip onClick={() => applyPreset("land")} isDark={dark}>Paysage</Chip>
                  <Chip onClick={() => applyPreset("tele")} isDark={dark}>Télé safe</Chip>
                  <Chip onClick={() => applyPreset("night")} isDark={dark}>Night walk</Chip>
                </div>
              </div>
            </motion.section>

            {/* Résultats + Schéma */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
              className={`rounded-2xl border p-5 shadow-lg backdrop-blur ${dark ? "border-white/10 bg-slate-900/50" : "border-white/10 bg-white/70 supports-[backdrop-filter]:bg-white/50"}`}>
              <h2 className="mb-4 text-lg font-semibold">Résultats</h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <Stat label="Hyperfocale (H)" value={displayH} isDark={dark} />
                <Stat label="Limite proche à H" value={displayNear} isDark={dark} />
                <Stat label="hFOV / vFOV" value={`${toFixedSmart(hFOV,1)}° / ${toFixedSmart(vFOV,1)}°`} isDark={dark} />
                <Stat label="Équiv. 24×36" value={`${toFixedSmart(ffEq,1)} mm`} isDark={dark} />
                <Stat label="CoC équiv." value={`${toFixedSmart(cocEquiv,3)} mm`} isDark={dark} />
                <Stat label="Capteur effectif" value={`${toFixedSmart(effW,1)}×${toFixedSmart(effH,1)} mm`} isDark={dark} />
              </div>

              {/* Schéma SVG */}
              <div className="mt-6">
                <h3 className={`mb-2 text-sm font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>Schéma (échelle {maxScaleM} m)</h3>
                <div className={`relative rounded-2xl border p-3 shadow-inner ${dark ? "border-white/10 bg-gradient-to-b from-slate-800/60 to-slate-900/60" : "border-white/10 bg-gradient-to-b from-white/80 to-white/50"}`}>
                  <SVGDiagram H_m={H_m} nearAtH_m={nearAtH_m} maxScaleM={maxScaleM} unit={unit} hFOV={hFOV} />
                  <p className={`mt-2 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>MAP sur H ⇒ zone nette de <b>H/2</b> jusqu’à <b>∞</b> (selon le CoC choisi).</p>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Réglages avancés */}
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}
            className={`mt-5 rounded-2xl border p-5 shadow-lg backdrop-blur ${dark ? "border-white/10 bg-slate-900/50" : "border-white/10 bg-white/70 supports-[backdrop-filter]:bg-white/50"}`}>
            <details>
              <summary className="cursor-pointer select-none text-sm font-semibold">Réglages avancés</summary>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <AdvField label="Cercle de confusion de base (mm)">
                  <NumberBox value={cocBase} setValue={setCocBase} min={0.005} max={0.05} step={0.001} isDark={dark} />
                  <p className={`mt-1 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>Référence APS-C : 0,019 mm. Actif divise ce CoC par le facteur de recadrage.</p>
                </AdvField>
                <AdvField label="Recadrage Stabilisation Active (×)">
                  <NumberBox value={activeCrop} setValue={setActiveCrop} min={1} max={1.5} step={0.01} isDark={dark} />
                  <p className={`mt-1 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>FX30 ≈ 1,10× par défaut.</p>
                </AdvField>
                <AdvField label="Largeur capteur (mm)"><NumberBox value={sensorW} setValue={setSensorW} min={10} max={40} step={0.1} isDark={dark} /></AdvField>
                <AdvField label="Hauteur capteur (mm)"><NumberBox value={sensorH} setValue={setSensorH} min={7} max={30} step={0.1} isDark={dark} /></AdvField>
              </div>
            </details>
          </motion.section>

          {/* Tests (vérification de calcul) */}
          <TestPanel isDark={dark} />

          <footer className={`mt-6 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
            <p>Rappel : la profondeur de champ dépend du critère de netteté (CoC). Un recadrage (mode Actif) resserre l'angle de champ et exige un CoC plus petit → H augmente légèrement.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ===================== Bouton copie robuste ===================== */
function CopyButton({ text, isDark }) {
  const [state, setState] = useState("idle"); // idle | copying | copied | manual
  const [showModal, setShowModal] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const manualRef = useRef(null);

  useEffect(() => {
    if (state === "copied") {
      const t = setTimeout(() => setState("idle"), 1500);
      return () => clearTimeout(t);
    }
  }, [state]);

  useEffect(() => {
    if (showModal && manualRef.current) {
      manualRef.current.focus();
      manualRef.current.select();
    }
  }, [showModal]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowModal(false); };
    if (showModal) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  const handleCopy = async () => {
    if (disabled) return;
    setDisabled(true);
    setState("copying");

    const tryNative = async () => {
      if (!("clipboard" in navigator) || typeof navigator.clipboard.writeText !== "function") return false;
      if (!window.isSecureContext) return false; // requis pour writeText
      if (document.visibilityState !== "visible") return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // NotAllowedError/DOMException ou policy → false
        return false;
      }
    };

    const tryExecCommand = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.tabIndex = -1;
        ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.pointerEvents = "none";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      } catch (_) { return false; }
    };

    const okNative = await tryNative();
    if (okNative) { setState("copied"); setDisabled(false); return; }

    const okLegacy = tryExecCommand();
    if (okLegacy) { setState("copied"); setDisabled(false); return; }

    setShowModal(true);
    setState("manual");
    setDisabled(false);
  };

  return (
    <>
      <button onClick={handleCopy} disabled={disabled}
        className={`rounded-xl border border-white/20 bg-gradient-to-br from-cyan-500 to-indigo-500 px-3 py-2 text-sm font-medium text-white shadow hover:opacity-90 ${disabled ? "opacity-60" : ""}`}>
        {state === "copied" ? "Copié ✔" : state === "copying" ? "Copie…" : "Copier le résumé"}
      </button>
      <InlineToast show={state === "copied"} label="Copié dans le presse‑papiers" />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-4 shadow-xl ${isDark ? "border-white/10 bg-slate-900 text-slate-100" : "border-white/20 bg-white text-slate-900"}`}>
            <div className="mb-2 text-sm font-semibold">Copie manuelle</div>
            <p className="mb-3 text-xs opacity-80">Votre environnement bloque l’accès au presse‑papiers. Sélectionnez puis faites <b>Ctrl/⌘ + C</b>. Appuyez sur <b>Échap</b> pour fermer.</p>
            <textarea ref={manualRef} readOnly value={text} rows={3}
              className={`mb-3 w-full rounded-lg border p-2 text-sm ${isDark ? "border-white/10 bg-slate-800" : "border-slate-200 bg-slate-50"}`}/>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setState("idle"); }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? "border-white/20" : "border-slate-200"}`}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InlineToast({ show, label }) {
  return (
    <div className="relative inline-block">
      <div className={`pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 transform rounded-xl bg-black px-3 py-1 text-xs text-white shadow transition-all ${show ? "opacity-90" : "opacity-0"}`}>{label}</div>
    </div>
  );
}

/* ===================== Petits composants UI ===================== */
function Segmented({ options, value, onChange, ariaLabel, isDark }) {
  return (
    <div role="group" aria-label={ariaLabel}
      className={`inline-flex overflow-hidden rounded-xl border p-1 shadow-inner ${isDark ? "border-white/20 bg-slate-800/60" : "border-white/20 bg-slate-100/70"}`}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-sm transition ${value === o.id
            ? `${isDark ? "rounded-lg bg-slate-100 text-slate-900" : "rounded-lg bg-white text-slate-900"} shadow`
            : `${isDark ? "text-slate-300 hover:bg-slate-700/40" : "text-slate-700 hover:bg-white/50"}`}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
function Chip({ children, onClick, isDark }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs shadow-sm ${isDark ? "border-white/20 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60" : "border-white/20 bg-white/70 text-slate-800 hover:bg-white/90"}`}>
      {children}
    </button>
  );
}
function Stat({ label, value, isDark }) {
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${isDark ? "border-white/10 bg-slate-800/60" : "border-white/10 bg-white/60"}`}>
      <div className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
function AdvField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
function NumberBox({ value, setValue, min, max, step = 1, prefix = "", suffix = "", isDark }) {
  return (
    <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm shadow-sm ${isDark ? "border-white/20 bg-slate-800/60" : "border-white/20 bg-white/70"}`}>
      {prefix && <span className={`${isDark ? "text-slate-300" : "text-slate-500"}`}>{prefix}</span>}
      <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))}
        min={min} max={max} step={step}
        className="w-24 bg-transparent text-right outline-none" />
      {suffix && <span className={`${isDark ? "text-slate-300" : "text-slate-500"}`}>{suffix}</span>}
    </div>
  );
}

/* ===================== Schéma SVG ===================== */
function SVGDiagram({ H_m, nearAtH_m, maxScaleM, unit, hFOV }) {
  const width = 760; const height = 160; // px
  const marginL = 70; const marginR = 20; const baselineY = 95;
  const usableW = width - marginL - marginR;
  const xFromM = (m) => marginL + clamp((m / maxScaleM) * usableW, 0, usableW);

  // Points clés
  const x0 = marginL; // caméra
  const xNear = xFromM(nearAtH_m);
  const xH = xFromM(H_m);

  // Cône FOV orienté vers l'avant (±halfAngle)
  const halfAngle = Math.min(60, Math.max(5, hFOV / 2));
  const wedgeLen = 140; // px
  const ax = x0 + 18, ay = baselineY; // sommet
  const leftAngle = rad(-halfAngle);   // up-left (y up négatif)
  const rightAngle = rad(halfAngle);   // down-right
  const lx = ax + wedgeLen * Math.cos(leftAngle);
  const ly = ay + wedgeLen * Math.sin(leftAngle);
  const rx = ax + wedgeLen * Math.cos(rightAngle);
  const ry = ay + wedgeLen * Math.sin(rightAngle);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#64748b" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Bandeau */}
      <rect x="0" y="0" width={width} height={height} fill="url(#g2)" opacity="0.08" />

      {/* Baseline */}
      <line x1={marginL} y1={baselineY} x2={width - marginR} y2={baselineY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />

      {/* Caméra (pur SVG) */}
      <g transform={`translate(${marginL - 55}, ${baselineY - 16})`}>
        <CameraGlyph />
      </g>

      {/* Wedge FOV */}
      <path d={`M ${ax} ${ay} L ${lx} ${ly} L ${rx} ${ry} Z`} fill="url(#g1)" stroke="#94a3b8" strokeWidth="0.5" />

      {/* Marqueurs H/2 et H */}
      <MarkerLine x={xNear} label={`H/2 (${formatDistanceMeters(nearAtH_m, unit)})`} color="#10b981" align="top" />
      <MarkerLine x={xH} label={`H (${formatDistanceMeters(H_m, unit)})`} color="#4f46e5" align="bottom" />

      {/* Graduations */}
      {Array.from({ length: 5 }).map((_, i) => {
        const m = (i * maxScaleM) / 4;
        const x = xFromM(m);
        return (
          <g key={i}>
            <line x1={x} y1={baselineY - 4} x2={x} y2={baselineY + 4} stroke="#94a3b8" strokeWidth="1" />
            <text x={x} y={baselineY + 16} fontSize="11" textAnchor="middle" fill="#64748b">{formatDistanceMeters(m, unit)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MarkerLine({ x, label, color, align = "top" }) {
  const lineTop = 20, lineBottom = 145;
  return (
    <g>
      <line x1={x} y1={lineTop} x2={x} y2={lineBottom} stroke={color} strokeWidth="2" />
      <rect x={x - 80} y={align === "top" ? 5 : 148} rx="6" width="160" height="18" fill="#0f172a" opacity="0.9" />
      <text x={x} y={align === "top" ? 18 : 161} fontSize="11" textAnchor="middle" fill="#ffffff">{label}</text>
    </g>
  );
}

function CameraGlyph() {
  return (
    <g>
      <rect x="1" y="5" width="32" height="18" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <rect x="8" y="1" width="10" height="6" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="17" cy="14" r="5.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="17" cy="14" r="3" fill="#cbd5e1" />
    </g>
  );
}

/* ===================== Tests ===================== */
function computeHyperfocalMeters({ focal_mm, N, coc_base_mm, crop = 1 }) {
  // coc équiv = coc_base / crop
  const f = focal_mm;
  const c = coc_base_mm / crop;
  const H_mm = (f * f) / (N * c) + f;
  return H_mm / 1000;
}

function computeNearFarMeters({ focal_mm, N, coc_base_mm, crop = 1, s_m }) {
  const H_m = computeHyperfocalMeters({ focal_mm, N, coc_base_mm, crop });
  const f_m = focal_mm / 1000;
  const s = s_m;
  const near = (H_m * s) / (H_m + (s - f_m));
  let far;
  if (s <= H_m) {
    const denom = H_m - (s - f_m);
    far = denom <= 0 ? Infinity : (H_m * s) / denom;
  } else {
    far = Infinity;
  }
  return { H_m, near, far };
}

function TestPanel({ isDark }) {
  // Tests hyperfocale (numériques)
  const hyperTests = [
    { name: "35mm f/8 · Standard", args: { focal_mm: 35, N: 8, coc_base_mm: 0.019, crop: 1.0 }, expected_m: 8.09 },
    { name: "17mm f/8 · Standard", args: { focal_mm: 17, N: 8, coc_base_mm: 0.019, crop: 1.0 }, expected_m: 1.92 },
    { name: "70mm f/2.8 · Standard", args: { focal_mm: 70, N: 2.8, coc_base_mm: 0.019, crop: 1.0 }, expected_m: 92.2 },
    { name: "35mm f/8 · Actif (1.10×)", args: { focal_mm: 35, N: 8, coc_base_mm: 0.019, crop: 1.10 }, expected_m: 8.90 },
    // Ajouts
    { name: "17mm f/22 · Standard (bord)", args: { focal_mm: 17, N: 22, coc_base_mm: 0.019, crop: 1.0 }, expected_m: 0.709 },
    { name: "70mm f/16 · Standard (bord)", args: { focal_mm: 70, N: 16, coc_base_mm: 0.019, crop: 1.0 }, expected_m: 16.19 },
    { name: "35mm f/8 · Actif (1.20×)", args: { focal_mm: 35, N: 8, coc_base_mm: 0.019, crop: 1.20 }, expected_m: 9.71 },
  ];

  const hyperRows = hyperTests.map((t) => {
    const actual = computeHyperfocalMeters(t.args);
    const diff = Math.abs(actual - t.expected_m);
    const tol = Math.max(0.02 * t.expected_m, 0.02); // 2% ou 2 cm
    const pass = diff <= tol;
    return { ...t, actual, diff, tol, pass };
  });

  const passHyper = hyperRows.every((it) => it.pass);

  // Propriété: si s = H ⇒ near ≈ H/2
  const propArgs = { focal_mm: 35, N: 8, coc_base_mm: 0.019, crop: 1.0 };
  const Hm = computeHyperfocalMeters(propArgs);
  const { near: nearAtH } = computeNearFarMeters({ ...propArgs, s_m: Hm });
  const ratio = nearAtH / Hm; // attendu ≈ 0.5
  const propTol = 0.01; // ±1%
  const passProp = Math.abs(ratio - 0.5) <= propTol;

  return (
    <details className="mt-5">
      <summary className="cursor-pointer select-none text-sm font-semibold">Tests (hyperfocale FX30)</summary>
      {/* Tableau hyperfocale */}
      <div className={`mt-3 overflow-x-auto rounded-xl border p-3 text-sm shadow-sm ${isDark ? "border-white/10 bg-slate-800/60" : "border-white/10 bg-white/60"}`}>
        <table className="w-full text-left">
          <thead>
            <tr className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              <th className="px-2 py-1">Cas</th>
              <th className="px-2 py-1">Attendu</th>
              <th className="px-2 py-1">Obtenu</th>
              <th className="px-2 py-1">Tolérance</th>
              <th className="px-2 py-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {hyperRows.map((it) => (
              <tr key={it.name} className={`border-t ${isDark ? "border-white/20" : "border-slate-200"}`}>
                <td className="px-2 py-1">{it.name}</td>
                <td className="px-2 py-1">{toFixedSmart(it.expected_m, 3)} m</td>
                <td className="px-2 py-1">{toFixedSmart(it.actual, 3)} m</td>
                <td className="px-2 py-1">±{toFixedSmart(it.tol, 3)} m</td>
                <td className="px-2 py-1">{it.pass ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-xs">Hyperfocale : {passHyper ? "✅ Tous les tests passent" : "❌ Échecs — vérifier formules/constantes"}</div>
      </div>

      {/* Propriété near@H */}
      <div className={`mt-3 rounded-xl border p-3 text-sm shadow-sm ${isDark ? "border-white/10 bg-slate-800/60" : "border-white/10 bg-white/60"}`}>
        <div className="text-sm font-medium">Propriété : s = H ⇒ near ≈ H/2</div>
        <div className="mt-1 text-xs">Ratio obtenu: {toFixedSmart(ratio, 3)} (attendu 0.5 ± {toFixedSmart(propTol, 3)}) — {passProp ? "✅" : "❌"}</div>
      </div>
    </details>
  );
}

