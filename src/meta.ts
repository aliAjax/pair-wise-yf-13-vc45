import type { ReadingEntry, Shift } from "./types";

/** 班次时段（4 小时一班） */
export const WATCHES = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"] as const;

/** 可筛选设备（读数录入设备可在其基础上自定义） */
export const DEVICES = ["主机", "发电机#1", "发电机#2", "舱底水泵", "燃油泵"] as const;

/** 四个核心参数的元数据与参考范围（范围只用于看板提示，异常以人工判定为准） */
export interface ParamMeta {
  key: "rpm" | "lubePressure" | "coolingTemp" | "fuel";
  label: string;
  unit: string;
  step: string;
  placeholder: string;
  /** 参考工作范围；无范围（如燃油读数）为 null */
  range: { min: number; max: number } | null;
  hint: string;
}

export const PARAMS: ParamMeta[] = [
  {
    key: "rpm",
    label: "主机转速",
    unit: "rpm",
    step: "1",
    placeholder: "如 82",
    range: { min: 60, max: 110 },
    hint: "参考范围 60–110 rpm",
  },
  {
    key: "lubePressure",
    label: "滑油压力",
    unit: "MPa",
    step: "0.01",
    placeholder: "如 0.42",
    range: { min: 0.3, max: 0.5 },
    hint: "参考范围 0.30–0.50 MPa",
  },
  {
    key: "coolingTemp",
    label: "冷却水温",
    unit: "°C",
    step: "0.1",
    placeholder: "如 78.5",
    range: { min: 70, max: 90 },
    hint: "参考范围 70–90 °C",
  },
  {
    key: "fuel",
    label: "燃油读数",
    unit: "m³",
    step: "0.01",
    placeholder: "如 312.6",
    range: null,
    hint: "油舱液位 / 累计读数",
  },
];

export function valueStatus(meta: ParamMeta, raw: string): "normal" | "warn" | "empty" {
  if (raw.trim() === "") return "empty";
  const v = Number(raw);
  if (!Number.isFinite(v) || (meta.range && (v < meta.range.min || v > meta.range.max))) {
    return "warn";
  }
  return "normal";
}

/** 生成唯一 id（优先原生 crypto.randomUUID） */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地时区的 YYYY-MM-DD */
export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 本地时区的 datetime-local 值：YYYY-MM-DDTHH:mm */
export function nowLocalInput(d: Date = new Date()): string {
  return `${todayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:mm */
export function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** MM-DD HH:mm */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shiftLabel(s: Shift): string {
  return `${s.date.slice(5)} ${s.watch}班`;
}

/** 班次排序：日期 + 时段，越晚越靠前 */
export function compareShifts(a: Shift, b: Shift): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ia = WATCHES.indexOf(a.watch as (typeof WATCHES)[number]);
  const ib = WATCHES.indexOf(b.watch as (typeof WATCHES)[number]);
  return (ib === -1 ? 0 : ib) - (ia === -1 ? 0 : ia);
}

/** 班次是否存在未闭环异常（含“标记异常但未闭环”的读数） */
export function openAbnormalCount(readings: ReadingEntry[]): number {
  return readings.filter((r) => r.abnormal && !r.closed).length;
}
