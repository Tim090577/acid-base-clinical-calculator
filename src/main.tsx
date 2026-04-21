import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  FlaskConical,
  HeartPulse,
  Wind,
  RefreshCcw,
  Route,
  Stethoscope,
} from "lucide-react";
import "./styles.css";

type VolumeStatus = "unknown" | "hypovolemic" | "euvolemic" | "hypervolemic";
type ClinicalContext =
  | "none"
  | "vomiting"
  | "diarrhea"
  | "copd"
  | "sepsis"
  | "dka"
  | "aki_ckd"
  | "salicylate"
  | "cirrhosis"
  | "heart_failure"
  | "diuretics"
  | "panic_pain"
  | "pregnancy"
  | "toxin";

type Accent = "acid" | "alk" | "neutral" | "warning" | "good";

type CompensationCheck = {
  name: string;
  measuredLabel: string;
  measured: number;
  expected: number;
  lo: number;
  hi: number;
  unit: string;
  status: "ok" | "low" | "high";
  lowMeaning: string;
  highMeaning: string;
};

type AnalysisResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      errors: string[];
      acidemia: boolean;
      alkalemia: boolean;
      severity: string;
      ag: number;
      agCorr: number;
      agType: string;
      agReason: string;
      deltaAg: number;
      deltaHco3: number;
      deltaRatio: number | null;
      deltaApplicable: boolean;
      deltaReason: string;
      serumOsm: number | null;
      osmGap: number | null;
      urineAg: number | null;
      urinePh: number | null;
      decisionPath: string[];
      primary: string;
      compensation: string;
      compensationCheck: CompensationCheck | null;
      mixed: string[];
      differential: string[];
      mostLikely: string;
      diagnosticClues: string[];
      managementHints: string[];
      rtaHint: string | null;
      pearls: string[];
      nextSteps: string[];
      flags: string[];
    };

const contextLabels: Record<ClinicalContext, string> = {
  none: "未指定",
  vomiting: "Vomiting / NG suction",
  diarrhea: "Diarrhea",
  copd: "COPD / chronic hypercapnia",
  sepsis: "Sepsis",
  dka: "DKA",
  aki_ckd: "AKI / CKD",
  salicylate: "Salicylate",
  cirrhosis: "Cirrhosis",
  heart_failure: "Heart failure",
  diuretics: "Diuretic use",
  panic_pain: "Pain / anxiety",
  pregnancy: "Pregnancy",
  toxin: "Toxic alcohol / ingestion",
};

function round(n: number, d = 1) {
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}

function fmtRange(lo: number, hi: number, d = 1) {
  return `${round(lo, d)}-${round(hi, d)}`;
}

function parseOptional(value: string, enabled = true) {
  if (!enabled || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function severityFromPH(pH: number) {
  if (pH < 7.1 || pH > 7.6) return "危急";
  if (pH < 7.25 || pH > 7.55) return "中重度";
  if (pH < 7.35 || pH > 7.45) return "輕度";
  return "接近正常";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function App() {
  const [pH, setPH] = useState("7.25");
  const [pco2, setPco2] = useState("28");
  const [hco3, setHco3] = useState("12");
  const [na, setNa] = useState("140");
  const [cl, setCl] = useState("100");
  const [albumin, setAlbumin] = useState("4.0");
  const [k, setK] = useState("4.2");
  const [lactate, setLactate] = useState("");
  const [volumeStatus, setVolumeStatus] = useState<VolumeStatus>("unknown");
  const [context, setContext] = useState<ClinicalContext>("none");
  const [urineClOn, setUrineClOn] = useState(false);
  const [urineCl, setUrineCl] = useState("");
  const [urineNaOn, setUrineNaOn] = useState(false);
  const [urineNa, setUrineNa] = useState("");
  const [urineKOn, setUrineKOn] = useState(false);
  const [urineK, setUrineK] = useState("");
  const [urinePhOn, setUrinePhOn] = useState(false);
  const [urinePh, setUrinePh] = useState("");
  const [glucoseOn, setGlucoseOn] = useState(false);
  const [glucose, setGlucose] = useState("");
  const [bunOn, setBunOn] = useState(false);
  const [bun, setBun] = useState("");
  const [measuredOsmOn, setMeasuredOsmOn] = useState(false);
  const [measuredOsm, setMeasuredOsm] = useState("");
  const [calculatedOsmOn, setCalculatedOsmOn] = useState(false);
  const [calculatedOsm, setCalculatedOsm] = useState("");
  const [activeTab, setActiveTab] = useState<"calculator" | "guide" | "cases">("calculator");

  const parsed = useMemo(
    () => ({
      pH: Number(pH),
      pco2: Number(pco2),
      hco3: Number(hco3),
      na: Number(na),
      cl: Number(cl),
      albumin: Number(albumin),
      k: Number(k),
      lactate: parseOptional(lactate),
      urineCl: parseOptional(urineCl, urineClOn),
      urineNa: parseOptional(urineNa, urineNaOn),
      urineK: parseOptional(urineK, urineKOn),
      urinePh: parseOptional(urinePh, urinePhOn),
      glucose: parseOptional(glucose, glucoseOn),
      bun: parseOptional(bun, bunOn),
      measuredOsm: parseOptional(measuredOsm, measuredOsmOn),
      calculatedOsm: parseOptional(calculatedOsm, calculatedOsmOn),
    }),
    [albumin, bun, bunOn, calculatedOsm, calculatedOsmOn, cl, glucose, glucoseOn, hco3, k, lactate, measuredOsm, measuredOsmOn, na, pH, pco2, urineCl, urineClOn, urineK, urineKOn, urineNa, urineNaOn, urinePh, urinePhOn],
  );

  const analysis = useMemo<AnalysisResult>(() => {
    const errors: string[] = [];
    const core = [parsed.pH, parsed.pco2, parsed.hco3, parsed.na, parsed.cl, parsed.albumin];
    if (core.some((v) => Number.isNaN(v))) errors.push("請先完整輸入 pH、PaCO2、HCO3、Na、Cl、Albumin。");
    if (parsed.pH < 6.8 || parsed.pH > 7.8) errors.push("pH 數值看起來超出常見生理範圍，請確認輸入。");
    if (parsed.pco2 <= 0 || parsed.hco3 <= 0) errors.push("PaCO2 與 HCO3 必須大於 0。");
    if (errors.length) return { ok: false, errors };

    const acidemia = parsed.pH < 7.35;
    const alkalemia = parsed.pH > 7.45;
    const nearNormal = !acidemia && !alkalemia;
    const ag = parsed.na - (parsed.cl + parsed.hco3);
    const agCorr = ag + 2.5 * (4 - parsed.albumin);
    const confirmedHagma = agCorr > 16;
    const borderlineAg = agCorr > 12 && agCorr <= 16;
    const agType = confirmedHagma ? "High AG" : borderlineAg ? "Borderline AG" : "Normal AG";
    const agReason = confirmedHagma
      ? `AGcorr ${round(agCorr)} > 16，視為確定 high AG metabolic acidosis，才進入 Δ/Δ。`
      : borderlineAg
        ? `AGcorr ${round(agCorr)} 介於 13-16，屬 borderline/接近正常上緣；若 Cl 明顯升高或病史支持腹瀉，先走 hyperchloremic/NAGMA，不直接做 Δ/Δ。`
        : `AGcorr ${round(agCorr)} 未升高，走 normal AG/hyperchloremic metabolic acidosis 分支，不做 Δ/Δ。`;
    const deltaAg = agCorr - 12;
    const deltaHco3 = 24 - parsed.hco3;
    const rawDeltaRatio = deltaHco3 !== 0 ? deltaAg / deltaHco3 : null;
    const serumOsm = parsed.calculatedOsm ?? (parsed.glucose != null && parsed.bun != null ? 2 * parsed.na + parsed.glucose / 18 + parsed.bun / 2.8 : null);
    const osmGap = serumOsm != null && parsed.measuredOsm != null ? parsed.measuredOsm - serumOsm : null;
    const urineAg =
      parsed.urineNa != null && parsed.urineK != null && parsed.urineCl != null
        ? parsed.urineNa + parsed.urineK - parsed.urineCl
        : null;

    let primary = "未定";
    let compensation = "尚無";
    let compensationCheck: CompensationCheck | null = null;
    let deltaApplicable = false;
    let deltaReason = "Δ/Δ 只用在 High AG metabolic acidosis；目前尚未確認是 HAGMA。";
    const mixed: string[] = [];
    const differential: string[] = [];
    let mostLikely = "尚需結合病史與檢查判斷。";
    const diagnosticClues: string[] = [];
    const managementHints: string[] = [];
    const decisionPath: string[] = [];
    let rtaHint: string | null = null;
    const pearls: string[] = [];
    const nextSteps: string[] = [];
    const flags: string[] = [];

    if (acidemia) {
      decisionPath.push("pH < 7.35：acidemia");
      if (parsed.hco3 < 24) {
        primary = "Primary metabolic acidosis";
        decisionPath.push("HCO3 下降：primary metabolic acidosis");
        const expected = 1.5 * parsed.hco3 + 8;
        const lo = expected - 2;
        const hi = expected + 2;
        compensation = `Winter formula 預測 PaCO2 ${round(expected)} mmHg，合理範圍 ${fmtRange(lo, hi)}。`;
        compensationCheck = {
          name: "Winter formula",
          measuredLabel: "實測 PaCO2",
          measured: parsed.pco2,
          expected,
          lo,
          hi,
          unit: "mmHg",
          status: parsed.pco2 < lo ? "low" : parsed.pco2 > hi ? "high" : "ok",
          lowMeaning: "PaCO2 低於預期，代表換氣過度，合併 respiratory alkalosis。",
          highMeaning: "PaCO2 高於 Winter 預期，代表 inadequate respiratory compensation；臨床上要警覺 fatigue、CNS depression 或 evolving respiratory failure，不要只把它當公式代償。",
        };
        if (parsed.pco2 < lo) mixed.push(compensationCheck.lowMeaning);
        if (parsed.pco2 > hi) mixed.push(compensationCheck.highMeaning);
        if (confirmedHagma) {
          decisionPath.push("AGcorr 確定升高：進入 HAGMA 分支");
          decisionPath.push("HAGMA：可做 Δ/Δ 判斷第二個 metabolic process");
          deltaApplicable = true;
          deltaReason = "可使用：目前為 high AG metabolic acidosis，Δ/Δ 可檢查是否合併 NAGMA 或 metabolic alkalosis。";
          differential.push("HAGMA：lactate、ketoacidosis、uremia/AKI、toxin/salicylate");
          mostLikely =
            context === "dka"
              ? "最可能：DKA / ketoacidosis。"
              : context === "sepsis"
                ? "最可能：lactic acidosis from sepsis / hypoperfusion。"
                : context === "aki_ckd"
                  ? "最可能：uremic acidosis / renal failure。"
                  : context === "toxin" || context === "salicylate"
                    ? "最可能：toxin / salicylate-related mixed disorder。"
                    : "最可能：HAGMA，需用 lactate、ketone、renal function、toxin screen 分流。";
          diagnosticClues.push("看 Kussmaul breathing、脫水、低血壓、發燒/感染灶、意識改變、藥物/毒物暴露。");
          managementHints.push("抽 lactate、serum/urine ketone 或 beta-hydroxybutyrate、BUN/Cr、glucose、serum osmolality/osm gap。");
          managementHints.push("若懷疑 sepsis：blood culture、感染源評估並及早給抗生素/輸液；若 DKA：補液、K 評估後 insulin。");
          if (rawDeltaRatio != null && rawDeltaRatio < 1) mixed.push("Delta ratio < 1：HAGMA + NAGMA");
          if (rawDeltaRatio != null && rawDeltaRatio > 2) mixed.push("Delta ratio > 2：HAGMA + metabolic alkalosis 或慢性高 HCO3 背景");
          nextSteps.push("補 lactate、ketone/beta-hydroxybutyrate、renal function、drug/toxin history。");
        } else {
          decisionPath.push(borderlineAg ? "AG borderline + 看 Cl/病史：先走 hyperchloremic/NAGMA 分支" : "AG 持平：進入 NAGMA/hyperchloremic 分支");
          decisionPath.push("NAGMA：不要做 Δ/Δ，改看 UAG / urine osmolar gap / urine pH");
          deltaReason = borderlineAg
            ? "不可使用：AG 只有 borderline，尚未「確定 HAGMA」；本題 Cl 升高/腹瀉情境時應先視為 hyperchloremic NAGMA，直接往 UAG / urine osmolar gap 分流。"
            : "不可使用：目前是 normal AG metabolic acidosis，Δ/Δ 不能用來分型；請改看 UAG / urine osmolar gap 判斷 NH4 排酸。";
          differential.push(borderlineAg ? "Borderline AG + hyperchloremia：先當 NAGMA/hyperchloremic metabolic acidosis 分支處理" : "NAGMA：diarrhea、RTA、early renal failure、urinary diversion、acetazolamide");
          differential.push("NAGMA 常見原因：diarrhea、RTA、early renal failure、urinary diversion、acetazolamide");
          mostLikely =
            context === "diarrhea"
              ? "最可能：diarrhea causing GI HCO3 loss，hyperchloremic NAGMA。"
              : parsed.k > 5
                ? "最可能：type IV RTA / hypoaldosteronism 或 renal failure。"
                : "最可能：NAGMA，需用 UAG/urine pH 分 diarrhea vs RTA。";
          diagnosticClues.push("看腹瀉量、脫水、orthostatic hypotension、黏膜乾、腹痛/感染症狀、用藥如 acetazolamide。");
          diagnosticClues.push("高 Cl 支持 hyperchloremic acidosis；低 K 偏 diarrhea / type I-II RTA，高 K 偏 type IV RTA。Type IV RTA 的核心是 hyperkalemia + NH4 excretion 下降，不是 urine pH。");
          managementHints.push("驗 urine Na/K/Cl 算 UAG，另可加 urine pH；UAG < 0 支持 GI loss，UAG >= 0 支持 renal acidification problem。若 K 高，優先想 type IV RTA/hypoaldosteronism。");
          managementHints.push("抽 BMP/Cr 追腎功能與 K；腹瀉者評估 volume status、補液與補 K，必要時 stool studies。");
          nextSteps.push("若是 NAGMA，補 urine anion gap 或 urine osmolar gap 來看 NH4 排酸是否足夠。");
          if (urineAg != null) {
            if (urineAg < 0) differential.push("UAG < 0：腎臟可排 NH4，較支持 GI HCO3 loss。");
            else differential.push("UAG >= 0：NH4 排出不足，較支持 RTA / renal cause。");
          }
          if (parsed.k > 5) {
            rtaHint = "Type IV RTA pattern：K 高，核心是 aldosterone deficiency/resistance → NH4 excretion 下降；urine pH 可高可低。";
          } else if (parsed.k < 3.5 && parsed.urinePh != null && parsed.urinePh > 5.5) {
            rtaHint = "Type I distal RTA pattern：K 低 + urine pH > 5.5，distal H secretion defect，尿液無法酸化。";
          } else if (parsed.k < 3.5 && parsed.urinePh != null && parsed.urinePh <= 5.5) {
            rtaHint = "低 K NAGMA 但 urine pH <= 5.5：較支持 diarrhea 或 proximal/type II RTA later phase，需結合 UAG 與病史。";
          } else if (parsed.urinePh != null && parsed.urinePh > 5.5) {
            rtaHint = "Urine pH > 5.5 提示尿液酸化不佳；若合併低 K，偏 type I distal RTA。";
          }
          if (rtaHint) {
            differential.push(rtaHint);
            decisionPath.push(`RTA clue：${rtaHint}`);
          }
        }
      } else {
        primary = "Primary respiratory acidosis";
        decisionPath.push("PaCO2 上升主導：primary respiratory acidosis");
        deltaReason = "不可使用：目前 primary process 是 respiratory acidosis，不是 high AG metabolic acidosis。";
        const d = parsed.pco2 - 40;
        const acute = 24 + d / 10;
        const chronic = 24 + 3.5 * (d / 10);
        compensation = `Acute HCO3 約 ${round(acute)}；chronic HCO3 約 ${round(chronic)} mEq/L。`;
        if (Math.abs(parsed.hco3 - acute) <= 2) differential.push("較像 acute respiratory acidosis");
        else if (parsed.hco3 > chronic + 2) {
          differential.push("chronic respiratory acidosis + mild metabolic alkalosis");
          mixed.push("HCO3 高於 chronic compensation 預期：合併 mild metabolic alkalosis，常見 COPD + diuretics 或 contraction alkalosis");
        } else if (Math.abs(parsed.hco3 - chronic) <= 3) differential.push("較像 chronic respiratory acidosis");
        else mixed.push("HCO3 補償不符：考慮另有 metabolic process");
        differential.push("COPD、CNS depression、opioid/sedative、neuromuscular weakness、severe airway obstruction");
        mostLikely = context === "copd" && parsed.hco3 > chronic + 2 ? "最可能：COPD/chronic respiratory acidosis + mild metabolic alkalosis，常見 diuretics 或 contraction alkalosis。" : context === "copd" ? "最可能：COPD/chronic hypercapnia 或急性惡化。" : "最可能：hypoventilation causing respiratory acidosis。";
        diagnosticClues.push("看呼吸速率、呼吸肌使用、wheezing、意識下降、opioid/sedative 使用、neuromuscular weakness。");
        managementHints.push("重抽 ABG/VBG 趨勢、CXR、藥物史；必要時給氧、bronchodilator、NIV/intubation 評估。若 HCO3 高過慢性預期，檢查 diuretics、vomiting、volume depletion、Cl/K。");
      }
    } else if (alkalemia) {
      decisionPath.push("pH > 7.45：alkalemia");
      if (parsed.hco3 > 24) {
        primary = "Primary metabolic alkalosis";
        decisionPath.push("HCO3 上升：primary metabolic alkalosis");
        deltaReason = "不可使用：目前是 metabolic alkalosis；Δ/Δ 只用在 high AG metabolic acidosis。";
        const expected = 40 + 0.7 * (parsed.hco3 - 24);
        const lo = expected - 5;
        const hi = expected + 5;
        compensation = `預測 PaCO2 約 ${round(expected)} mmHg，常見容許範圍 ${fmtRange(lo, hi)}。`;
        compensationCheck = {
          name: "Metabolic alkalosis compensation",
          measuredLabel: "實測 PaCO2",
          measured: parsed.pco2,
          expected,
          lo,
          hi,
          unit: "mmHg",
          status: parsed.pco2 < lo ? "low" : parsed.pco2 > hi ? "high" : "ok",
          lowMeaning: "PaCO2 低於預期，代表換氣過度，合併 respiratory alkalosis。",
          highMeaning: "PaCO2 高於預期，代表額外 hypoventilation / respiratory acidosis，需找 COPD、sedation、呼吸肌疲乏等原因。",
        };
        if (parsed.pco2 < lo) mixed.push(compensationCheck.lowMeaning);
        if (parsed.pco2 > hi) mixed.push(compensationCheck.highMeaning);
        differential.push("Vomiting/NG suction、diuretics、hypokalemia、mineralocorticoid excess、post-hypercapnia");
        mostLikely = context === "vomiting" ? "最可能：vomiting/NG suction causing chloride-responsive metabolic alkalosis。" : "最可能：metabolic alkalosis，需用 urine Cl 分流。";
        diagnosticClues.push("看嘔吐/NG suction、volume depletion、低血壓、低 K、使用 diuretics、hypertension/mineralocorticoid signs。");
        managementHints.push("驗 urine Cl、BMP/Mg；Urine Cl <20 多補 NS/KCl，Urine Cl >=20 評估 diuretics/mineralocorticoid。");
        if (parsed.urineCl != null) {
          if (parsed.urineCl < 20) differential.push("Urine Cl < 20：chloride-responsive，常見 vomiting/remote diuretics。");
          else differential.push("Urine Cl >= 20：chloride-resistant，考慮 active diuretics/mineralocorticoid excess。");
        } else {
          nextSteps.push("metabolic alkalosis 建議加 urine Cl，快速分 chloride-responsive vs resistant。");
        }
      } else {
        primary = "Primary respiratory alkalosis";
        decisionPath.push("PaCO2 下降主導：primary respiratory alkalosis");
        deltaReason = "不可使用：目前 primary process 是 respiratory alkalosis，不是 high AG metabolic acidosis。";
        const d = 40 - parsed.pco2;
        const acute = 24 - 2 * (d / 10);
        const chronic = 24 - 5 * (d / 10);
        compensation = `Acute HCO3 約 ${round(acute)}；chronic HCO3 約 ${round(chronic)} mEq/L。`;
        if (Math.abs(parsed.hco3 - acute) <= 2) differential.push("較像 acute respiratory alkalosis");
        else if (Math.abs(parsed.hco3 - chronic) <= 3) differential.push("較像 chronic respiratory alkalosis");
        else mixed.push("HCO3 補償不符：考慮另有 metabolic process");
        differential.push("Sepsis、hypoxemia/PE、pain/anxiety、pregnancy、liver disease、salicylate");
        mostLikely = context === "sepsis" ? "最可能：sepsis/hypoxemia related respiratory alkalosis。" : "最可能：respiratory alkalosis，需排除 hypoxemia、PE、sepsis、salicylate。";
        diagnosticClues.push("看 fever、tachypnea、SpO2、pleuritic chest pain、leg swelling、pregnancy、cirrhosis signs、tinnitus/salicylate。");
        managementHints.push("依情境抽 lactate、CBC/culture、CXR、D-dimer/CTPA、salicylate level；先處理 hypoxemia/感染源。");
      }
    } else {
      primary = "pH near normal：高度警覺 mixed disorder";
      decisionPath.push("pH 7.35-7.45：不要說 normal，先看 PaCO2/HCO3 是否同時異常");
      compensation = "pH 接近正常但 PaCO2/HCO3 明顯偏離時，不要被正常 pH 騙過。";
      mixed.push("可能有雙重或三重酸鹼病變互相抵消");
      if (confirmedHagma) {
        decisionPath.push("pH 近正常但 AGcorr 確定升高：HAGMA + 第二個抵消 pH 的 process");
        deltaApplicable = true;
        deltaReason = "可謹慎使用：雖然 pH 接近正常，但 corrected AG 升高，需先當作 HAGMA 並尋找第二個 process。";
        differential.push("Corrected AG 升高時，仍需先考慮 HAGMA，再找第二個 process。");
        mostLikely = "最可能：mixed disorder with HAGMA，需找第二個抵消 pH 的 process。";
        diagnosticClues.push("pH 接近正常但 PaCO2/HCO3 異常，是 mixed disorder 的警訊。");
        managementHints.push("重抽 ABG/VBG，抽 lactate、ketone、BUN/Cr、osm gap，並依症狀找 respiratory 或 metabolic 第二病因。");
      } else if (borderlineAg) {
        decisionPath.push("AG borderline：先確認是否真的 HAGMA，不直接套 Δ/Δ");
        deltaReason = "不可使用：AG 只有 borderline，且 pH 接近正常時更不能直接套 Δ/Δ；先確認是否真的有 HAGMA。";
        mostLikely = "最可能：borderline AG 或 mixed disorder，需重驗並回到臨床情境。";
      }
    }

    if (context !== "none") {
      const hintMap: Record<Exclude<ClinicalContext, "none">, string> = {
        vomiting: "情境支持 metabolic alkalosis，也常伴 hypokalemia 與 low urine Cl。",
        diarrhea: "情境支持 NAGMA，腎臟若正常應增加 NH4 排出，UAG 常為負。",
        copd: "情境支持 chronic respiratory acidosis；急性惡化時 pH 會掉得更明顯。",
        sepsis: confirmedHagma ? "情境支持 respiratory alkalosis，且 AG 確定升高時可合併 lactic acidosis。" : "情境支持 respiratory alkalosis；AG 未確定升高時，不要直接套 HAGMA/ΔΔ 流程。",
        dka: confirmedHagma ? "情境支持 DKA/HAGMA，delta ratio 可檢查是否合併 NAGMA 或 alkalosis。" : "情境像 DKA 但 AG 未確定升高：可能是治療後/混合型，請重驗 ketone、AG 與 chloride。",
        aki_ckd: "情境支持 uremic acidosis；CKD 也會限制 NH4 排酸能力。",
        salicylate: "情境支持 respiratory alkalosis + metabolic acidosis 的經典 mixed disorder。",
        cirrhosis: "情境支持 chronic respiratory alkalosis；低 albumin 會低估 AG。",
        heart_failure: "情境可見 diuretic/contraction alkalosis、低灌流 lactic acidosis 或稀釋性低鈉。",
        diuretics: "情境支持 metabolic alkalosis；active use 時 urine Cl 可偏高。",
        panic_pain: "情境支持 acute respiratory alkalosis，但仍需排除 hypoxemia/PE/sepsis。",
        pregnancy: "情境支持 chronic respiratory alkalosis，HCO3 可代償性下降。",
        toxin: confirmedHagma ? "AG 或 osm gap 確定升高時，需警覺 toxic alcohol；salicylate 常是混合型。" : "若懷疑 toxin 但 AG 未確定升高，先看 osm gap、時間軸與重複抽血。",
      };
      differential.unshift(hintMap[context]);
    }

    if (!diagnosticClues.length) diagnosticClues.push("看 vital signs、volume status、呼吸型態、感染/缺氧/毒物/腎功能與 GI loss 線索。");
    if (!managementHints.length) managementHints.push("先重驗 ABG/VBG 與 BMP，依 primary disorder 補 urine studies、lactate、ketone、renal function 或毒物檢查。");

    if (parsed.lactate != null && parsed.lactate >= 2) pearls.push(`Lactate ${parsed.lactate} mmol/L：支持 lactic acidosis，>=4 時臨床風險更高。`);
    if (parsed.albumin < 4) pearls.push(`Albumin ${parsed.albumin} g/dL 偏低，已用 AGcorr 避免漏掉 HAGMA。`);
    if (parsed.k < 3.5) pearls.push("低血鉀會維持 metabolic alkalosis，也提示 vomiting/diuretics/mineralocorticoid 或 RTA 分流。");
    if (parsed.k > 5.0) pearls.push("高血鉀合併 NAGMA 時，請想到 type IV RTA、renal failure 或 hypoaldosteronism；重點是 NH4 excretion 下降，urine pH 可高可低。");
    if (serumOsm != null) pearls.push(`Calculated serum osmolality 約 ${round(serumOsm)} mOsm/kg。`);
    if (osmGap != null && osmGap > 10) flags.push(`Osm gap ${round(osmGap)} 偏高：若 AG 也確定升高，警覺 toxic alcohol。`);
    if (osmGap != null && osmGap > 10 && confirmedHagma) {
      mostLikely = "最可能：toxic alcohol ingestion 或其他 osm gap + HAGMA 狀態。";
      differential.unshift("Osm gap + HAGMA：toxic alcohol（methanol/ethylene glycol）優先排除");
      managementHints.unshift("抽 serum osm、BMP/AG、VBG/ABG、ethylene glycol/methanol level；同時評估 fomepizole、bicarbonate、hemodialysis indication。");
      decisionPath.push("Osm gap 升高 + HAGMA：進入 toxic alcohol 分支");
    }
    if (confirmedHagma) flags.push(`Corrected AG ${round(agCorr)} 確定升高。`);
    else if (borderlineAg) flags.push(`Corrected AG ${round(agCorr)} borderline：不要直接做 Δ/Δ，先看 Cl 與臨床情境。`);
    if (mixed.length > 0) flags.push("補償不符合單一病變，請用 mixed disorder 思維。");
    pearls.push("核心原則：單純補償通常不會把 pH 完全拉回 7.40；太正常反而要小心。");

    return {
      ok: true,
      errors,
      acidemia,
      alkalemia,
      severity: severityFromPH(parsed.pH),
      ag,
      agCorr,
      agType,
      agReason,
      deltaAg,
      deltaHco3,
      deltaRatio: deltaApplicable ? rawDeltaRatio : null,
      deltaApplicable,
      deltaReason,
      serumOsm,
      osmGap,
      urineAg,
      urinePh: parsed.urinePh,
      decisionPath,
      primary,
      compensation,
      compensationCheck,
      mixed,
      differential,
      mostLikely,
      diagnosticClues,
      managementHints,
      rtaHint,
      pearls,
      nextSteps,
      flags,
    };
  }, [context, parsed]);

  const reset = () => {
    setPH("7.25");
    setPco2("28");
    setHco3("12");
    setNa("140");
    setCl("100");
    setAlbumin("4.0");
    setK("4.2");
    setLactate("");
    setVolumeStatus("unknown");
    setContext("none");
    setUrineClOn(false);
    setUrineNaOn(false);
    setUrineKOn(false);
    setUrinePhOn(false);
    setGlucoseOn(false);
    setBunOn(false);
    setMeasuredOsmOn(false);
    setCalculatedOsmOn(false);
    setUrineCl("");
    setUrineNa("");
    setUrineK("");
    setUrinePh("");
    setGlucose("");
    setBun("");
    setMeasuredOsm("");
    setCalculatedOsm("");
  };

  const applyCase = (item: CasePreset) => {
    setPH(item.values.pH);
    setPco2(item.values.pco2);
    setHco3(item.values.hco3);
    setNa(item.values.na);
    setCl(item.values.cl);
    setAlbumin(item.values.albumin);
    setK(item.values.k);
    setLactate(item.values.lactate ?? "");
    setContext(item.context);
    setVolumeStatus(item.volume);
    setActiveTab("calculator");
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <div className="eyebrow"><Wind size={16} /> Acid-Base Clinical Reasoning</div>
          <h1>酸鹼判讀教學型 Calculator</h1>
          <p>
            不是只吐出答案，而是帶學生照著 pH、primary process、compensation、anion gap、delta ratio、尿液線索與臨床情境一步步鑑別。
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" onClick={reset}><RefreshCcw size={16} /> 重設範例</button>
          <button className="primary-button" onClick={() => setActiveTab("guide")}><BookOpen size={16} /> 看流程</button>
        </div>
      </section>

      <nav className="tabs" aria-label="主要頁籤">
        <button className={activeTab === "calculator" ? "active" : ""} onClick={() => setActiveTab("calculator")}>Calculator</button>
        <button className={activeTab === "guide" ? "active" : ""} onClick={() => setActiveTab("guide")}>判讀架構</button>
        <button className={activeTab === "cases" ? "active" : ""} onClick={() => setActiveTab("cases")}>練習情境</button>
      </nav>

      {activeTab === "calculator" && (
        <section className="calculator-grid">
          <Panel title="輸入區" description="先填 ABG 與 chemistry；進階欄位用來強化鑑別。">
            <div className="field-grid three">
              <NumberField label="pH" hint="正常 7.35-7.45" value={pH} setValue={setPH} />
              <NumberField label="PaCO2 mmHg" hint="正常 35-45" value={pco2} setValue={setPco2} />
              <NumberField label="HCO3 mEq/L" hint="正常 22-26" value={hco3} setValue={setHco3} />
            </div>
            <Divider label="Basic chemistry" />
            <div className="field-grid four">
              <NumberField label="Na mEq/L" hint="正常 135-145" value={na} setValue={setNa} />
              <NumberField label="Cl mEq/L" hint="正常 98-106" value={cl} setValue={setCl} />
              <NumberField label="Albumin g/dL" hint="正常約 3.5-5.0" value={albumin} setValue={setAlbumin} />
              <NumberField label="K mEq/L" hint="正常 3.5-5.0" value={k} setValue={setK} />
              <NumberField label="Lactate mmol/L" hint="正常 <2；>=4 高風險" value={lactate} setValue={setLactate} placeholder="optional" />
            </div>
            <Divider label="Clinical context" />
            <div className="field-grid two">
              <SelectField label="體液狀態" value={volumeStatus} setValue={(v) => setVolumeStatus(v as VolumeStatus)} options={[
                ["unknown", "未知"], ["hypovolemic", "Hypovolemic"], ["euvolemic", "Euvolemic"], ["hypervolemic", "Hypervolemic"],
              ]} />
              <SelectField label="臨床情境" value={context} setValue={(v) => setContext(v as ClinicalContext)} options={Object.entries(contextLabels)} />
            </div>
            <Divider label="進階鑑別" />
            <div className="optional-grid">
              <OptionalField label="Urine Cl" hint="<20 chloride-responsive" unit="mEq/L" enabled={urineClOn} setEnabled={setUrineClOn} value={urineCl} setValue={setUrineCl} />
              <OptionalField label="Urine Na" hint="常與 UAG 一起用" unit="mEq/L" enabled={urineNaOn} setEnabled={setUrineNaOn} value={urineNa} setValue={setUrineNa} />
              <OptionalField label="Urine K" hint="UAG = UNa + UK - UCl" unit="mEq/L" enabled={urineKOn} setEnabled={setUrineKOn} value={urineK} setValue={setUrineK} />
              <OptionalField label="Urine pH" hint=">5.5 + low K 偏 type I RTA" unit="pH" enabled={urinePhOn} setEnabled={setUrinePhOn} value={urinePh} setValue={setUrinePh} />
              <OptionalField label="Glucose" hint="空腹約 70-99" unit="mg/dL" enabled={glucoseOn} setEnabled={setGlucoseOn} value={glucose} setValue={setGlucose} />
              <OptionalField label="BUN" hint="正常約 7-20" unit="mg/dL" enabled={bunOn} setEnabled={setBunOn} value={bun} setValue={setBun} />
              <OptionalField label="Measured Osm" hint="正常約 275-295" unit="mOsm/kg" enabled={measuredOsmOn} setEnabled={setMeasuredOsmOn} value={measuredOsm} setValue={setMeasuredOsm} />
              <OptionalField label="Calculated Osm" hint="可直接輸入題目給的 calculated Osm" unit="mOsm/kg" enabled={calculatedOsmOn} setEnabled={setCalculatedOsmOn} value={calculatedOsm} setValue={setCalculatedOsm} />
            </div>
          </Panel>

          <section className="results-column">
            {!analysis.ok ? (
              <AlertCard title="輸入尚未完成" text={analysis.errors[0]} />
            ) : (
              <>
                <div className="metric-grid">
                  <Metric label="Primary" value={analysis.primary} />
                  <Metric label="Severity" value={analysis.severity} />
                  <Metric label="AG / AGcorr" value={`${round(analysis.ag)} / ${round(analysis.agCorr)}`} note={analysis.agType} />
                  <Metric
                    label="Delta ratio"
                    value={analysis.deltaRatio == null ? "N/A" : String(round(analysis.deltaRatio, 2))}
                    disabled={!analysis.deltaApplicable}
                    note={!analysis.deltaApplicable ? "Only confirmed HAGMA" : "Confirmed HAGMA"}
                  />
                  <Metric label="Osm gap" value={analysis.osmGap == null ? "-" : String(round(analysis.osmGap))} />
                  <Metric label="UAG" value={analysis.urineAg == null ? "-" : String(round(analysis.urineAg))} />
                </div>
                {analysis.flags.length > 0 && <FlagStrip items={analysis.flags} />}
                <DecisionPathPanel path={analysis.decisionPath} />
                <CompensationGauge check={analysis.compensationCheck} />
                <DavenportMap pH={parsed.pH} hco3={parsed.hco3} pco2={parsed.pco2} primary={analysis.primary} mixed={analysis.mixed} />
                <Panel title="Step-by-step interpretation" description="以學生上台報告可用的順序整理。">
                  <ResultBlock step="1" title="先看 pH" content={analysis.acidemia ? "Acidemia：往 metabolic acidosis 或 respiratory acidosis 找。" : analysis.alkalemia ? "Alkalemia：往 metabolic alkalosis 或 respiratory alkalosis 找。" : "pH 接近正常：請先懷疑 mixed disorder。"} accent={analysis.acidemia ? "acid" : analysis.alkalemia ? "alk" : "warning"} />
                  <ResultBlock step="2" title="Primary process" content={analysis.primary} />
                  <ResultBlock step="3" title="Compensation" content={analysis.compensation} />
                  <ResultBlock step="4" title="Mixed disorder check" content={analysis.mixed.length ? analysis.mixed.join("；") : "目前未見明顯第二個酸鹼病變。"} accent={analysis.mixed.length ? "warning" : "good"} />
                  <ResultBlock
                    step="5"
                    title="Delta-delta check"
                    content={analysis.deltaApplicable && analysis.deltaRatio != null ? `${analysis.agReason} Δ/Δ = ${round(analysis.deltaRatio, 2)}。${analysis.deltaReason}` : `${analysis.agReason} ${analysis.deltaReason}`}
                    accent={analysis.deltaApplicable ? "neutral" : "muted"}
                  />
                  <ResultBlock step="6" title="Differential diagnosis" content={analysis.differential.length ? analysis.differential.join("；") : "請結合臨床情境補充。"} />
                </Panel>
                <ClinicalActionPanel mostLikely={analysis.mostLikely} clues={analysis.diagnosticClues} actions={analysis.managementHints} />
                <Panel title="Teaching pearls" description="把公式轉成臨床思考。">
                  <div className="badge-row">
                    {volumeStatus !== "unknown" && <span className="badge">Volume: {volumeStatus}</span>}
                    {context !== "none" && <span className="badge">Context: {contextLabels[context]}</span>}
                    {parsed.urineCl != null && <span className="badge">Urine Cl {parsed.urineCl}</span>}
                  </div>
                  <ul className="pearl-list">
                    {analysis.pearls.map((item) => <li key={item}>{item}</li>)}
                    {analysis.nextSteps.map((item) => <li key={item} className="next-step">{item}</li>)}
                  </ul>
                </Panel>
              </>
            )}
          </section>
        </section>
      )}

      {activeTab === "guide" && <Guide />}
      {activeTab === "cases" && <Cases onApply={applyCase} />}

      <footer className="footer">
        教學用途，不能取代臨床判斷。老師講義參照：酸鹼 homeostasis、AG、Delta-Delta 與 metabolic acidosis flow pages 35-43；Pocket Medicine 參照 nephrology acid-base chapter 架構。
      </footer>
    </main>
  );
}

function Guide() {
  const steps = [
    ["1", "先看 pH", "pH < 7.35 是 acidemia；> 7.45 是 alkalemia；接近正常但 PaCO2/HCO3 異常要懷疑 mixed disorder。", Activity],
    ["2", "找 primary process", "acidemia 時 HCO3 低多半是 metabolic acidosis，PaCO2 高多半是 respiratory acidosis；alkalemia 同理反推。", Route],
    ["3", "檢查補償", "用 Winter formula 或 acute/chronic respiratory compensation。補償不合，就找第二個 process。", Calculator],
    ["4", "代謝性酸中毒先算 AG", "AG = Na - (Cl + HCO3)，再用 albumin 校正：AGcorr = AG + 2.5 x (4 - albumin)。", Droplets],
    ["5", "HAGMA 做 Delta ratio", "<1 合併 NAGMA；1-2 較單純 HAGMA；>2 合併 metabolic alkalosis 或慢性高 HCO3。", FlaskConical],
    ["6", "NAGMA 看腎臟有沒有排酸", "UAG = UNa + UK - UCl。負值支持 GI loss；非負值支持 RTA/renal acidification problem。", ClipboardList],
    ["7", "回到病人", "vomiting、diarrhea、COPD、sepsis、DKA、AKI/CKD、salicylate 是最常拉開鑑別的情境。", Stethoscope],
  ] as const;

  return (
    <>
      <section className="guide-layout">
        <div className="step-ladder">
          {steps.map(([n, title, text, Icon]) => (
            <article className="step-card" key={title}>
              <div className="step-index">{n}</div>
              <Icon size={22} />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
        <Panel title="常用公式與分流" description="背公式前先知道它在回答哪個問題。">
          <Formula title="Metabolic acidosis compensation" formula="Winter: expected PaCO2 = 1.5 x HCO3 + 8 +/- 2" note="實測更低是額外 respiratory alkalosis；更高是 inadequate respiratory compensation，需警覺呼吸疲乏/CNS depression。" />
          <Formula title="Respiratory acidosis" formula="Acute HCO3 +1 / 10 mmHg PaCO2；Chronic +3.5 / 10" note="急慢性判讀要結合臨床時間軸。" />
          <Formula title="Respiratory alkalosis" formula="Acute HCO3 -2 / 10 mmHg PaCO2；Chronic -5 / 10" note="sepsis、pregnancy、cirrhosis 常見。" />
          <Formula title="Metabolic alkalosis" formula="Expected PaCO2 = 40 + 0.7 x (HCO3 - 24) +/- 5" note="再用 urine Cl 分 chloride-responsive/resistant。" />
          <Formula title="Delta ratio" formula="(AGcorr - 12) / (24 - HCO3)" note="只在 HAGMA 特別有用，用來抓其他 metabolic process。" />
        </Panel>
      </section>
      <LectureScreenshots />
    </>
  );
}

const lectureScreenshots = [
  ["davenport-map.png", "Davenport acid-base map", "把 pH 與 HCO3 放到圖上，看落點是否符合單純病變的補償區。"],
  ["acid-base-34.png", "Acid-base homeostasis", "腎臟 HCO3 reabsorption、NH4 generation 與每日 acid load 的總覽。"],
  ["acid-base-35.png", "Acidemia / alkalemia", "先用 pH、HCO3、PaCO2 把四大 primary disorder 排出來。"],
  ["acid-base-36.png", "Find the cause", "Respiratory acidosis、metabolic alkalosis、metabolic acidosis、respiratory alkalosis 的常見原因。"],
  ["acid-base-37.png", "Anion gap meaning", "酸增加、HCO3 消耗、Cl 上升與 AG 變化的生理意義。"],
  ["acid-base-38.png", "Delta-delta tips", "HAGMA 時用 delta ratio 抓 NAGMA 或 metabolic alkalosis。"],
  ["acid-base-39.png", "Metabolic acidosis flow", "AG 升高/持平、delta ratio、UAG、urine pH 的代謝性酸中毒流程。"],
  ["acid-base-40.png", "Mixed disorder details", "Delta-delta 與 non-AG metabolic acidosis 合併 metabolic alkalosis 的判斷。"],
  ["acid-base-41.png", "NAGMA evaluation", "用 urine NH4、Cl、Na、FECl/FeNa 分 GI loss、acid ingestion、renal HCO3 loss。"],
  ["acid-base-42.png", "Urine osmolar gap", "用 urine osmolar gap 估算 NH4，補足 UAG 的限制。"],
] as const;

const pocketScreenshots = [
  ["acid-base-pocket-376.png", "Pocket quick reference", "小麻/Pocket Medicine 的 nephrology acid-base 快速公式：AG、Delta-delta、UAG。"],
] as const;

function LectureScreenshots() {
  return (
    <Panel title="老師講義截圖對照" description="酸鹼講義重點頁已嵌入，點圖可開原尺寸。">
      <div className="lecture-grid">
        {lectureScreenshots.map(([file, title, note]) => {
          const src = `/lecture-screenshots/${file}`;
          return (
            <article className="lecture-card" key={file}>
              <a href={src} target="_blank" rel="noreferrer" aria-label={`開啟 ${title} 講義截圖`}>
                <img src={src} alt={`${title} lecture screenshot`} loading="lazy" />
              </a>
              <div>
                <h3>{title}</h3>
                <p>{note}</p>
              </div>
            </article>
          );
        })}
        {pocketScreenshots.map(([file, title, note]) => {
          const src = `/pocket-screenshots/${file}`;
          return (
            <article className="lecture-card" key={file}>
              <a href={src} target="_blank" rel="noreferrer" aria-label={`開啟 ${title} 截圖`}>
                <img src={src} alt={`${title} screenshot`} loading="lazy" />
              </a>
              <div>
                <h3>{title}</h3>
                <p>{note}</p>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function DavenportMap({
  pH,
  hco3,
  pco2,
  primary,
  mixed,
}: {
  pH: number;
  hco3: number;
  pco2: number;
  primary: string;
  mixed: string[];
}) {
  const leftPct = 11.5 + ((clamp(pH, 7.0, 7.8) - 7.0) / 0.8) * (77.5 - 11.5);
  const topPct = 79.5 - (clamp(hco3, 0, 60) / 60) * (79.5 - 3.6);
  const outside = pH < 7.0 || pH > 7.8 || hco3 < 0 || hco3 > 60;
  const zone =
    mixed.length > 0
      ? "落點或補償提示 mixed disorder"
      : primary.includes("metabolic acidosis")
        ? "偏 metabolic acidosis 區"
        : primary.includes("metabolic alkalosis")
          ? "偏 metabolic alkalosis 區"
          : primary.includes("respiratory acidosis")
            ? "偏 respiratory acidosis 區"
            : primary.includes("respiratory alkalosis")
              ? "偏 respiratory alkalosis 區"
              : "接近 normal 或 mixed 交界";

  return (
    <Panel title="酸鹼地圖落點模擬" description="用目前輸入的 pH 與 HCO3 對應到 Davenport 圖；PaCO2 用來輔助檢查補償是否合理。">
      <div className="map-layout">
        <div className="map-figure">
          <div className="davenport-frame">
            <img src="/lecture-screenshots/davenport-map.png" alt="Davenport acid-base map with patient point" />
            <div
              className={`patient-point ${outside ? "outside" : ""}`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              aria-label={`patient point pH ${pH}, HCO3 ${hco3}`}
            >
              <span />
            </div>
          </div>
          <p className="map-caption">紅點是目前輸入的 pH/HCO3 落點；背景灰區是各單純酸鹼病變及其合理代償範圍，落在灰區外或 mixed 區時要懷疑混合型酸鹼異常。</p>
        </div>
        <div className="map-readout">
          <div className="map-value"><span>pH</span><strong>{round(pH, 2)}</strong></div>
          <div className="map-value"><span>HCO3</span><strong>{round(hco3)} mEq/L</strong></div>
          <div className="map-value"><span>PaCO2</span><strong>{round(pco2)} mmHg</strong></div>
          <div className="map-zone">
            <h3>{zone}</h3>
            <p>{primary}</p>
            {outside && <p>數值超出圖上 7.00-7.80 / HCO3 0-60 的範圍，落點已貼到邊界顯示。</p>}
            {mixed.length > 0 && <p>{mixed.join("；")}</p>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

type CasePreset = {
  title: string;
  clue: string;
  expected: string;
  context: ClinicalContext;
  volume: VolumeStatus;
  values: Record<"pH" | "pco2" | "hco3" | "na" | "cl" | "albumin" | "k", string> & { lactate?: string };
};

const cases: CasePreset[] = [
  {
    title: "Sepsis with lactate",
    clue: "pH 低、HCO3 低、PaCO2 也低，先用 Winter 看呼吸補償是否過度。",
    expected: "HAGMA + respiratory alkalosis 可能。",
    context: "sepsis",
    volume: "hypovolemic",
    values: { pH: "7.25", pco2: "22", hco3: "10", na: "140", cl: "101", albumin: "3.0", k: "4.8", lactate: "5.2" },
  },
  {
    title: "Vomiting alkalosis",
    clue: "pH 高、HCO3 高，下一步要看 urine Cl 是否低。",
    expected: "chloride-responsive metabolic alkalosis。",
    context: "vomiting",
    volume: "hypovolemic",
    values: { pH: "7.55", pco2: "49", hco3: "42", na: "138", cl: "84", albumin: "4.2", k: "2.9" },
  },
  {
    title: "COPD chronic retention",
    clue: "PaCO2 高，HCO3 也高，判斷是否符合慢性代償。",
    expected: "chronic respiratory acidosis。",
    context: "copd",
    volume: "euvolemic",
    values: { pH: "7.34", pco2: "65", hco3: "34", na: "140", cl: "98", albumin: "4.0", k: "4.1" },
  },
  {
    title: "Diarrhea NAGMA",
    clue: "HCO3 低、Cl 高、AG 未升高，尿液線索可分 GI vs renal。",
    expected: "normal AG metabolic acidosis。",
    context: "diarrhea",
    volume: "hypovolemic",
    values: { pH: "7.28", pco2: "29", hco3: "14", na: "138", cl: "114", albumin: "4.0", k: "3.1" },
  },
];

function Cases({ onApply }: { onApply: (item: CasePreset) => void }) {
  return (
    <section className="case-grid">
      {cases.map((item) => (
        <article className="case-card" key={item.title}>
          <h3>{item.title}</h3>
          <p>{item.clue}</p>
          <div className="case-expected"><CheckCircle2 size={16} /> {item.expected}</div>
          <button className="secondary-button" onClick={() => onApply(item)}>載入案例 <ChevronRight size={16} /></button>
        </article>
      ))}
    </section>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

function NumberField({ label, hint, value, setValue, placeholder }: { label: string; hint?: string; value: string; setValue: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      <input inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
    </label>
  );
}

function SelectField({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => setValue(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

function OptionalField(props: { label: string; hint?: string; unit: string; enabled: boolean; setEnabled: (value: boolean) => void; value: string; setValue: (value: string) => void }) {
  return (
    <div className="optional-field">
      <label className="check-row">
        <input type="checkbox" checked={props.enabled} onChange={(e) => props.setEnabled(e.target.checked)} />
        <span>{props.label}</span>
      </label>
      {props.hint && <small>{props.hint}</small>}
      <input disabled={!props.enabled} inputMode="decimal" value={props.value} placeholder={props.unit} onChange={(e) => props.setValue(e.target.value)} />
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return <div className="divider"><span>{label}</span></div>;
}

function Metric({ label, value, note, disabled = false }: { label: string; value: string; note?: string; disabled?: boolean }) {
  return (
    <div className={`metric ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function AlertCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="alert-card">
      <AlertTriangle size={20} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function FlagStrip({ items }: { items: string[] }) {
  return <div className="flag-strip">{items.map((item) => <span key={item}><AlertTriangle size={14} /> {item}</span>)}</div>;
}

function DecisionPathPanel({ path }: { path: string[] }) {
  return (
    <Panel title="目前走到講義流程哪裡" description="依照講義圖的 decision tree，把目前判讀路徑攤開。">
      <ol className="decision-path">
        {path.map((item, idx) => (
          <li key={`${idx}-${item}`}>
            <span>{idx + 1}</span>
            <p>{item}</p>
          </li>
        ))}
      </ol>
      <p className="subtle-note">對照講義：metabolic acidosis 先分 AG↑ vs AG持平；AG↑ 才做 Δ/Δ，AG持平直接走 UAG / urine pH / RTA 或 GI loss。</p>
    </Panel>
  );
}

function ClinicalActionPanel({ mostLikely, clues, actions }: { mostLikely: string; clues: string[]; actions: string[] }) {
  return (
    <Panel title="Most likely & next step" description="列出可能診斷後，再提示最可能方向與下一步。">
      <div className="clinical-grid">
        <div className="clinical-box highlight">
          <span>Most likely</span>
          <strong>{mostLikely}</strong>
        </div>
        <div className="clinical-box">
          <span>Symptoms / PE clues</span>
          <ul>
            {clues.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="clinical-box">
          <span>Draw / check next</span>
          <ul>
            {actions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function CompensationGauge({ check }: { check: CompensationCheck | null }) {
  if (!check) {
    return (
      <Panel title="代償範圍檢查" description="目前 primary disorder 不是用單一 PaCO2 預測範圍判讀。">
                <p className="subtle-note">Respiratory disorder 通常要用急性/慢性 HCO3 代償並結合時間軸；metabolic acidosis 時用 Winter formula 看 PaCO2 是否合理下降，若 PaCO2 高於預期要寫 inadequate respiratory compensation。</p>
      </Panel>
    );
  }

  const min = Math.min(0, Math.floor(check.lo - 12), Math.floor(check.measured - 12));
  const max = Math.max(80, Math.ceil(check.hi + 12), Math.ceil(check.measured + 12));
  const span = max - min;
  const rangeLeft = ((check.lo - min) / span) * 100;
  const rangeWidth = ((check.hi - check.lo) / span) * 100;
  const measuredLeft = ((check.measured - min) / span) * 100;
  const statusText =
    check.status === "ok"
      ? "代償符合預期"
      : check.status === "low"
        ? "低於代償範圍"
        : "高於代償範圍";
  const meaning = check.status === "ok" ? "實測值落在預測範圍內，較支持單純代償。" : check.status === "low" ? check.lowMeaning : check.highMeaning;

  return (
    <Panel title={`${check.name} 代償範圍`} description="把預測範圍和病人實測值放在同一條尺上。">
      <div className={`comp-status ${check.status}`}>
        <CheckCircle2 size={18} />
        <div>
          <strong>{statusText}</strong>
          <p>{meaning}</p>
        </div>
      </div>
      <div className="comp-summary">
        <div><span>公式預測</span><strong>{round(check.expected)} {check.unit}</strong></div>
        <div><span>合理範圍</span><strong>{fmtRange(check.lo, check.hi)} {check.unit}</strong></div>
        <div><span>{check.measuredLabel}</span><strong>{round(check.measured)} {check.unit}</strong></div>
      </div>
      <div className="comp-gauge" aria-label={`${check.name} compensation gauge`}>
        <div className="comp-axis" />
        <div className="comp-range" style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}>
          <span>{fmtRange(check.lo, check.hi)} {check.unit}</span>
        </div>
        <div className={`comp-marker ${check.status}`} style={{ left: `${measuredLeft}%` }}>
          <span>{round(check.measured)} {check.unit}</span>
        </div>
      </div>
      <div className="comp-scale">
        <span>{min}</span>
        <span>{max} {check.unit}</span>
      </div>
      <p className="subtle-note">綠色帶是公式預期的代償範圍；黑色標記是病人實測值。落在綠色帶內代表代償合理，落在外面要找第二個酸鹼病變。</p>
    </Panel>
  );
}

function ResultBlock({ step, title, content, accent = "neutral" }: { step: string; title: string; content: string; accent?: Accent | "muted" }) {
  return (
    <article className={`result-block ${accent}`}>
      <div className="step-pill">Step {step}</div>
      <h3>{title}</h3>
      <p>{content}</p>
    </article>
  );
}

function Formula({ title, formula, note }: { title: string; formula: string; note: string }) {
  return (
    <article className="formula">
      <h3>{title}</h3>
      <code>{formula}</code>
      <p>{note}</p>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
