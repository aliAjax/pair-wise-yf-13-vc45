import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { nowLocalInput, todayStr, uid } from "./meta";
import type { LedgerState, ReadingEntry, Shift } from "./types";

const STORAGE_KEY = "marine-watch-ledger-v1";
const PREFS_KEY = "marine-watch-ledger-prefs-v1";

/* ----------------------------- 初始演示数据 ----------------------------- */

function isoFor(date: string, watchStart: number, minute: number): string {
  return `${date}T${String(watchStart).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function seedState(): LedgerState {
  const today = todayStr();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayStr(d);
  })();

  const frozenId = uid();
  const activeId = uid();

  const shifts: Shift[] = [
    {
      id: frozenId,
      date: yesterday,
      watch: "16-20",
      createdAt: isoFor(yesterday, 16, 0),
      handoverNote: "舱底水位偏高已复查回落；发电机#2 冷却水温继续观察。",
      handedOver: true,
      handedOverAt: isoFor(yesterday, 19, 58),
    },
    {
      id: activeId,
      date: today,
      watch: "08-12",
      createdAt: isoFor(today, 8, 0),
      handoverNote: "",
      handedOver: false,
      handedOverAt: null,
    },
  ];

  const readings: ReadingEntry[] = [
    {
      id: uid(),
      shiftId: frozenId,
      at: isoFor(yesterday, 16, 10),
      device: "主机",
      rpm: "82",
      lubePressure: "0.42",
      coolingTemp: "78.5",
      fuel: "312.6",
      abnormal: false,
      abnormalDesc: "",
      closed: false,
      notes: [],
    },
    {
      id: uid(),
      shiftId: frozenId,
      at: isoFor(yesterday, 17, 30),
      device: "发电机#2",
      rpm: "",
      lubePressure: "0.38",
      coolingTemp: "92.5",
      fuel: "",
      abnormal: true,
      abnormalDesc: "冷却水温偏高，超过参考上限 90°C",
      closed: true,
      notes: [
        {
          id: uid(),
          at: isoFor(yesterday, 18, 5),
          text: "清洗海水滤器并调整流量后水温回落至 86°C，继续观察。",
        },
        {
          id: uid(),
          at: isoFor(yesterday, 19, 40),
          text: "复查水温稳定在 85°C，闭环。",
        },
      ],
    },
    {
      id: uid(),
      shiftId: frozenId,
      at: isoFor(yesterday, 18, 20),
      device: "舱底水泵",
      rpm: "",
      lubePressure: "",
      coolingTemp: "",
      fuel: "",
      abnormal: true,
      abnormalDesc: "舱底液位接近警戒线",
      closed: true,
      notes: [
        {
          id: uid(),
          at: isoFor(yesterday, 19, 15),
          text: "启动舱底泵排水 20 分钟，液位回落至安全范围，闭环。",
        },
      ],
    },
    {
      id: uid(),
      shiftId: activeId,
      at: isoFor(today, 8, 30),
      device: "主机",
      rpm: "84",
      lubePressure: "0.41",
      coolingTemp: "80.0",
      fuel: "306.2",
      abnormal: false,
      abnormalDesc: "",
      closed: false,
      notes: [],
    },
    {
      id: uid(),
      shiftId: activeId,
      at: isoFor(today, 9, 15),
      device: "发电机#2",
      rpm: "",
      lubePressure: "0.37",
      coolingTemp: "91.0",
      fuel: "",
      abnormal: true,
      abnormalDesc: "水温再度偏高，疑似海水流量不足",
      closed: false,
      notes: [
        {
          id: uid(),
          at: isoFor(today, 9, 40),
          text: "已拆检海水滤器，发现少量杂物，暂维持观察。",
        },
      ],
    },
  ];

  return { version: 1, shifts, readings };
}

/* ------------------------------- 持久化 -------------------------------- */

function loadState(): LedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LedgerState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.shifts) && Array.isArray(parsed.readings)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回退到种子数据
  }
  return seedState();
}

export interface Prefs {
  shiftId: string | null;
  device: string; // "全部" 或具体设备
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { shiftId: p.shiftId ?? null, device: p.device ?? "全部" };
    }
  } catch {
    // ignore
  }
  return { shiftId: null, device: "全部" };
}

/* ------------------------------- Reducer ------------------------------- */

type Action =
  | { type: "addShift"; id: string; date: string; watch: string }
  | { type: "setHandoverNote"; shiftId: string; text: string }
  | { type: "handover"; shiftId: string }
  | { type: "addReading"; entry: ReadingEntry }
  | { type: "updateReading"; entry: ReadingEntry }
  | { type: "deleteReading"; id: string }
  | { type: "appendNote"; readingId: string; text: string; closed: boolean }
  | { type: "reset" }
  | { type: "replace"; state: LedgerState };

function assertOpenShift(state: LedgerState, shiftId: string): Shift {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) throw new Error("班次不存在");
  if (shift.handedOver) throw new Error("该班次已完成交接并冻结，不能改写读数");
  return shift;
}

export function reducer(state: LedgerState, action: Action): LedgerState {
  switch (action.type) {
    case "addShift": {
      if (state.shifts.some((s) => s.date === action.date && s.watch === action.watch)) {
        throw new Error(`${action.date} ${action.watch}班 已存在`);
      }
      const shift: Shift = {
        id: action.id,
        date: action.date,
        watch: action.watch,
        createdAt: new Date().toISOString(),
        handoverNote: "",
        handedOver: false,
        handedOverAt: null,
      };
      return { ...state, shifts: [shift, ...state.shifts] };
    }

    case "setHandoverNote": {
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === action.shiftId
            ? { ...s, handoverNote: s.handedOver ? s.handoverNote : action.text }
            : s
        ),
      };
    }

    case "handover": {
      const shift = state.shifts.find((s) => s.id === action.shiftId);
      if (!shift) throw new Error("班次不存在");
      if (shift.handedOver) throw new Error("该班次已完成交接");
      const open = state.readings.filter((r) => r.shiftId === shift.id && r.abnormal && !r.closed);
      if (open.length > 0) {
        throw new Error(`仍有 ${open.length} 项异常未闭环，不能完成交接`);
      }
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === action.shiftId
            ? { ...s, handedOver: true, handedOverAt: new Date().toISOString() }
            : s
        ),
      };
    }

    case "addReading": {
      assertOpenShift(state, action.entry.shiftId);
      return { ...state, readings: [action.entry, ...state.readings] };
    }

    case "updateReading": {
      const existing = state.readings.find((r) => r.id === action.entry.id);
      if (!existing) return state;
      assertOpenShift(state, existing.shiftId);
      // 冻结守卫下的更新只允许读数类字段；处理说明只能通过 appendNote 追加
      return {
        ...state,
        readings: state.readings.map((r) =>
          r.id === action.entry.id
            ? {
                ...action.entry,
                notes: r.notes, // 说明时间线永不随表单改写
                shiftId: r.shiftId,
              }
            : r
        ),
      };
    }

    case "deleteReading": {
      const existing = state.readings.find((r) => r.id === action.id);
      if (!existing) return state;
      assertOpenShift(state, existing.shiftId);
      return { ...state, readings: state.readings.filter((r) => r.id !== action.id) };
    }

    case "appendNote": {
      const text = action.text.trim();
      if (!text) throw new Error("处理说明不能为空");
      return {
        ...state,
        readings: state.readings.map((r) =>
          r.id === action.readingId
            ? {
                ...r,
                closed: action.closed ? true : r.closed,
                notes: [...r.notes, { id: uid(), at: new Date().toISOString(), text }],
              }
            : r
        ),
      };
    }

    case "reset":
      return seedState();

    case "replace":
      return action.state;

    default:
      return state;
  }
}

/* ------------------------------- Context ------------------------------- */

interface LedgerContextValue {
  state: LedgerState;
  dispatch: Dispatch<Action>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // 写回本地：所有视图共用同一份数据
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储空间不足等情况下静默失败
    }
  }, [state]);

  // 跨标签页同步：别处修改后本标签页立即一致
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as LedgerState;
          if (next && next.version === 1) dispatch({ type: "replace", state: next });
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger 必须在 LedgerProvider 内使用");
  return ctx;
}

/** 包装 dispatch：把业务校验错误以 Error 抛出，供 UI 提示 */
export function safeRun(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** 新建读数的默认表单值 */
export function blankForm(shiftId: string): ReadingEntry {
  return {
    id: uid(),
    shiftId,
    at: nowLocalInput(),
    device: "主机",
    rpm: "",
    lubePressure: "",
    coolingTemp: "",
    fuel: "",
    abnormal: false,
    abnormalDesc: "",
    closed: false,
    notes: [],
  };
}
