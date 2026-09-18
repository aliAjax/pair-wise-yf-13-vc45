// 轮机值班台账的领域模型与常量（纯前端，无后台）

export const WATCHES = [
  "00-04",
  "04-08",
  "08-12",
  "12-16",
  "16-20",
  "20-24",
] as const;
export type Watch = (typeof WATCHES)[number];

export const DEVICES = ["主机", "发电机#1", "发电机#2", "泵组", "舱底水"] as const;
export type Device = (typeof DEVICES)[number];

export type MetricKey = "rpm" | "lubePressure" | "coolingTemp" | "fuel";

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  step: string;
  min?: number;
  max?: number;
  /** 正常范围说明，仅作录入参考 */
  rangeText?: string;
}

// 四项强制记录参数；燃油为流量表累计读数，不设阈值
export const METRICS: MetricDef[] = [
  {
    key: "rpm",
    label: "主机转速",
    unit: "r/min",
    step: "1",
    min: 60,
    max: 100,
    rangeText: "正常参考 60–100 r/min",
  },
  {
    key: "lubePressure",
    label: "滑油压力",
    unit: "MPa",
    step: "0.01",
    min: 0.35,
    max: 0.5,
    rangeText: "正常参考 0.35–0.50 MPa",
  },
  {
    key: "coolingTemp",
    label: "冷却水温",
    unit: "℃",
    step: "1",
    min: 70,
    max: 85,
    rangeText: "正常参考 70–85 ℃",
  },
  {
    key: "fuel",
    label: "燃油读数",
    unit: "m³",
    step: "0.1",
    rangeText: "燃油流量表累计读数",
  },
];

export interface HandlingNote {
  id: string;
  /** 本地 HH:mm 记录时间 */
  time: string;
  text: string;
}

export interface Entry {
  id: string;
  shiftId: string;
  device: Device;
  /** 班次内观测时刻 HH:mm */
  time: string;
  rpm: number | null;
  lubePressure: number | null;
  coolingTemp: number | null;
  fuel: number | null;
  anomaly: boolean;
  anomalyDesc: string;
  /** 处理说明只允许追加 */
  handlingNotes: HandlingNote[];
  /** 异常是否闭环 */
  resolved: boolean;
  createdAt: string;
}

export interface Shift {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  watch: Watch;
  engineer: string;
  status: "on-duty" | "handed";
  createdAt: string;
  handedOverAt: string | null;
  handoverNote: string;
}

export interface LogState {
  shifts: Shift[];
  entries: Entry[];
  selectedShiftId: string | null;
}

export interface EntryInput {
  device: Device;
  time: string;
  rpm: number | null;
  lubePressure: number | null;
  coolingTemp: number | null;
  fuel: number | null;
  anomaly: boolean;
  anomalyDesc: string;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function watchLabel(watch: Watch): string {
  return `${watch.replace("-", ":00–")}:00`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return `${date} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function isMetricAbnormal(key: MetricKey, value: number | null): boolean {
  if (value === null) return false;
  const def = METRICS.find((m) => m.key === key);
  if (!def || def.min === undefined || def.max === undefined) return false;
  return value < def.min || value > def.max;
}

export function entryHasOpenAnomaly(entry: Entry): boolean {
  return entry.anomaly && !entry.resolved;
}

export function openAnomalies(entries: Entry[]): Entry[] {
  return entries.filter(entryHasOpenAnomaly);
}

/** 班次排序键：日期 + 班次时段，越新越靠前 */
export function shiftSortKey(s: Shift): string {
  return `${s.date}-${s.watch}`;
}

export function sortShifts(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => (shiftSortKey(a) < shiftSortKey(b) ? 1 : -1));
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}
