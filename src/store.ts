import {
  Entry,
  EntryInput,
  LogState,
  Shift,
  Watch,
  nowDate,
  nowTime,
  openAnomalies,
  sortShifts,
  uid,
} from "./log";

// 所有视图共用同一份 localStorage 数据；不接后台、不加依赖
const STORAGE_KEY = "marine-engine-watch-log:v1";

function seedState(): LogState {
  const date = nowDate();
  const prev: Shift = {
    id: uid(),
    date,
    watch: "04-08" as Watch,
    engineer: "张轮机",
    status: "handed",
    createdAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
    handedOverAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    handoverNote: "舱底水泵运行正常；#2 发电机冷却水温已复查正常，全船供电稳定。",
  };
  const current: Shift = {
    id: uid(),
    date,
    watch: "08-12" as Watch,
    engineer: "李轮机",
    status: "on-duty",
    createdAt: new Date().toISOString(),
    handedOverAt: null,
    handoverNote: "",
  };
  const entries: Entry[] = [
    {
      id: uid(),
      shiftId: prev.id,
      device: "主机",
      time: "05:00",
      rpm: 82,
      lubePressure: 0.42,
      coolingTemp: 78,
      fuel: 1284.6,
      anomaly: false,
      anomalyDesc: "",
      handlingNotes: [],
      resolved: false,
      createdAt: new Date(Date.now() - 3600_000 * 3).toISOString(),
    },
    {
      id: uid(),
      shiftId: prev.id,
      device: "发电机#2",
      time: "06:20",
      rpm: null,
      lubePressure: null,
      coolingTemp: 89,
      fuel: null,
      anomaly: true,
      anomalyDesc: "#2 发电机冷却水温偏高至 89℃",
      handlingNotes: [
        { id: uid(), time: "06:40", text: "清洗海水滤器并开大进水阀，温度回落至 82℃" },
        { id: uid(), time: "07:30", text: "复查温度稳定在 81℃，闭环" },
      ],
      resolved: true,
      createdAt: new Date(Date.now() - 3600_000 * 2.4).toISOString(),
    },
    {
      id: uid(),
      shiftId: current.id,
      device: "主机",
      time: "08:30",
      rpm: 85,
      lubePressure: 0.43,
      coolingTemp: 79,
      fuel: 1291.2,
      anomaly: false,
      anomalyDesc: "",
      handlingNotes: [],
      resolved: false,
      createdAt: new Date(Date.now() - 3600_000 * 1.2).toISOString(),
    },
    {
      id: uid(),
      shiftId: current.id,
      device: "舱底水",
      time: nowTime(),
      rpm: null,
      lubePressure: null,
      coolingTemp: null,
      fuel: null,
      anomaly: true,
      anomalyDesc: "舱底井液位接近警戒线，已启动舱底水泵",
      handlingNotes: [{ id: uid(), time: nowTime(), text: "泵运行 20 分钟，液位下降，持续观察" }],
      resolved: false,
      createdAt: new Date().toISOString(),
    },
  ];
  return { shifts: [prev, current], entries, selectedShiftId: current.id };
}

function loadState(): LogState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LogState;
      if (parsed && Array.isArray(parsed.shifts) && Array.isArray(parsed.entries)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回退到空台账
  }
  const seeded = seedState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // 隐私模式等场景下仅保留内存数据
  }
  return seeded;
}

let state: LogState = loadState();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败，内存数据仍可用
  }
  listeners.forEach((fn) => fn());
}

function emitCrossTab() {
  // storage 事件天然支持跨标签页；同标签页由 persist 直接通知
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function getState(): LogState {
  return state;
}

export function getShift(id: string | null): Shift | undefined {
  return state.shifts.find((s) => s.id === id);
}

export function entriesOfShift(shiftId: string): Entry[] {
  return state.entries.filter((e) => e.shiftId === shiftId);
}

export function selectShift(shiftId: string) {
  state = { ...state, selectedShiftId: shiftId };
  persist();
  emitCrossTab();
}

export function createShift(input: {
  date: string;
  watch: Watch;
  engineer: string;
}): { ok: true; shift: Shift } | { ok: false; error: string } {
  const duplicate = state.shifts.some(
    (s) => s.date === input.date && s.watch === input.watch,
  );
  if (duplicate) {
    return { ok: false, error: `${input.date} ${input.watch} 班已存在，请直接切换到该班次` };
  }
  const shift: Shift = {
    id: uid(),
    date: input.date,
    watch: input.watch,
    engineer: input.engineer.trim(),
    status: "on-duty",
    createdAt: new Date().toISOString(),
    handedOverAt: null,
    handoverNote: "",
  };
  state = {
    ...state,
    shifts: [...state.shifts, shift],
    selectedShiftId: shift.id,
  };
  persist();
  return { ok: true, shift };
}

function openShiftOrError(
  shiftId: string,
): { shift?: Shift; error?: string } {
  const shift = getShift(shiftId);
  if (!shift) return { error: "班次不存在" };
  if (shift.status === "handed")
    return { error: "该班次已完成交接并冻结，读数不可修改" };
  return { shift };
}

export function addEntry(
  shiftId: string,
  input: EntryInput,
): { ok: true; entry: Entry } | { ok: false; error: string } {
  const guard = openShiftOrError(shiftId);
  if (guard.error) return { ok: false, error: guard.error };
  if (!input.time) return { ok: false, error: "请填写观测时刻" };
  if (
    input.rpm === null &&
    input.lubePressure === null &&
    input.coolingTemp === null &&
    input.fuel === null
  ) {
    return { ok: false, error: "至少填写一项参数读数" };
  }
  if (input.anomaly && !input.anomalyDesc.trim()) {
    return { ok: false, error: "标记异常时必须填写异常描述" };
  }
  const entry: Entry = {
    id: uid(),
    shiftId,
    device: input.device,
    time: input.time,
    rpm: input.rpm,
    lubePressure: input.lubePressure,
    coolingTemp: input.coolingTemp,
    fuel: input.fuel,
    anomaly: input.anomaly,
    anomalyDesc: input.anomalyDesc.trim(),
    handlingNotes: [],
    resolved: false,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, entries: [...state.entries, entry] };
  persist();
  return { ok: true, entry };
}

export function updateEntry(
  entryId: string,
  input: EntryInput,
): { ok: true } | { ok: false; error: string } {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, error: "记录不存在" };
  const guard = openShiftOrError(entry.shiftId);
  if (guard.error) return { ok: false, error: guard.error };
  if (!input.time) return { ok: false, error: "请填写观测时刻" };
  if (
    input.rpm === null &&
    input.lubePressure === null &&
    input.coolingTemp === null &&
    input.fuel === null
  ) {
    return { ok: false, error: "至少填写一项参数读数" };
  }
  if (input.anomaly && !input.anomalyDesc.trim()) {
    return { ok: false, error: "标记异常时必须填写异常描述" };
  }
  state = {
    ...state,
    entries: state.entries.map((e) =>
      e.id === entryId
        ? {
            ...e,
            device: input.device,
            time: input.time,
            rpm: input.rpm,
            lubePressure: input.lubePressure,
            coolingTemp: input.coolingTemp,
            fuel: input.fuel,
            anomaly: input.anomaly,
            anomalyDesc: input.anomalyDesc.trim(),
            // 取消异常标记后，异常闭环标记随之失效（处理说明保留备查）
            resolved: input.anomaly ? e.resolved : false,
          }
        : e,
    ),
  };
  persist();
  return { ok: true };
}

export function deleteEntry(entryId: string): { ok: true } | { ok: false; error: string } {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, error: "记录不存在" };
  const guard = openShiftOrError(entry.shiftId);
  if (guard.error) return { ok: false, error: guard.error };
  state = { ...state, entries: state.entries.filter((e) => e.id !== entryId) };
  persist();
  return { ok: true };
}

// 处理说明：任何班次（含已冻结班次）都只能追加，不能改写或删除
export function appendHandlingNote(
  entryId: string,
  text: string,
): { ok: true } | { ok: false; error: string } {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, error: "记录不存在" };
  if (!entry.anomaly) return { ok: false, error: "该条记录不是异常项" };
  if (!text.trim()) return { ok: false, error: "处理说明不能为空" };
  const note = { id: uid(), time: nowTime(), text: text.trim() };
  state = {
    ...state,
    entries: state.entries.map((e) =>
      e.id === entryId ? { ...e, handlingNotes: [...e.handlingNotes, note] } : e,
    ),
  };
  persist();
  return { ok: true };
}

export function setResolved(entryId: string, resolved: boolean) {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry || !entry.anomaly) return;
  const shift = getShift(entry.shiftId);
  if (!shift || shift.status === "handed") return; // 冻结班次不可改闭环状态
  state = {
    ...state,
    entries: state.entries.map((e) => (e.id === entryId ? { ...e, resolved } : e)),
  };
  persist();
}

export function saveHandoverNote(shiftId: string, note: string) {
  const shift = getShift(shiftId);
  if (!shift || shift.status === "handed") return; // 冻结班次备注只读
  state = {
    ...state,
    shifts: state.shifts.map((s) =>
      s.id === shiftId ? { ...s, handoverNote: note } : s,
    ),
  };
  persist();
}

export function completeHandover(
  shiftId: string,
): { ok: true } | { ok: false; error: string } {
  const shift = getShift(shiftId);
  if (!shift) return { ok: false, error: "班次不存在" };
  if (shift.status === "handed") return { ok: false, error: "该班次已完成交接" };
  const open = openAnomalies(entriesOfShift(shiftId));
  if (open.length > 0) {
    return {
      ok: false,
      error: `仍有 ${open.length} 项异常未闭环（见异常时间线），全部闭环后才能完成交接`,
    };
  }
  state = {
    ...state,
    shifts: state.shifts.map((s) =>
      s.id === shiftId
        ? { ...s, status: "handed" as const, handedOverAt: new Date().toISOString() }
        : s,
    ),
  };
  persist();
  return { ok: true };
}

export function resetAllData() {
  state = { shifts: [], entries: [], selectedShiftId: null };
  persist();
}

export { sortShifts };
