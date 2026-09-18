import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { AnomalyTimeline } from "./components/AnomalyTimeline";
import { Dashboard } from "./components/Dashboard";
import { HandoverSummary } from "./components/HandoverSummary";
import { ReadingForm } from "./components/ReadingForm";
import { ReadingList } from "./components/ReadingList";
import { ShiftBar } from "./components/ShiftBar";
import { compareShifts } from "./meta";
import { LedgerProvider, loadPrefs, safeRun, useLedger } from "./store";
import type { ReadingEntry } from "./types";

function Workspace() {
  const { state, dispatch } = useLedger();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jumpId, setJumpId] = useState<string | null>(null);

  // 选中班次：优先记住的选择，其次最新班次
  const selectedId = useMemo(() => {
    const sorted = [...state.shifts].sort(compareShifts);
    if (prefs.shiftId && state.shifts.some((s) => s.id === prefs.shiftId)) {
      return prefs.shiftId;
    }
    return sorted[0]?.id ?? null;
  }, [state.shifts, prefs.shiftId]);

  const shift = state.shifts.find((s) => s.id === selectedId) ?? null;

  // 设备筛选（按设备筛选 / 看板 / 摘要共用）
  const device = prefs.device;

  useEffect(() => {
    localStorage.setItem("marine-watch-ledger-prefs-v1", JSON.stringify(prefs));
  }, [prefs]);

  // 正在改写的读数对象；不属于当前班次则忽略
  const editing: ReadingEntry | null =
    (editingId && state.readings.find((r) => r.id === editingId)) || null;

  const visibleReadings = useMemo(() => {
    if (!shift) return [];
    return state.readings
      .filter((r) => r.shiftId === shift.id)
      .filter((r) => device === "全部" || r.device === device);
  }, [state.readings, shift, device]);

  // 从异常时间线跳转到对应读数卡片
  useEffect(() => {
    if (jumpId) {
      document.getElementById(`rec-${jumpId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [jumpId, visibleReadings.length]);

  function jumpToReading(id: string) {
    // 时间线跳转时切到“全部设备”，确保目标记录可见
    setPrefs((p) => ({ ...p, device: "全部" }));
    setJumpId(id);
  }

  function resetAll() {
    if (
      !window.confirm(
        "确认清空浏览器中的全部台账数据并恢复演示数据？此操作不可撤销（无后台备份）。"
      )
    )
      return;
    safeRun(() => dispatch({ type: "reset" }));
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="kicker">hxyfront-62001 · 机舱轮机日志</p>
          <h1>船舶轮机值班台账</h1>
          <span className="local-note">
            数据仅保存在本浏览器（localStorage），不接后台；刷新 / 切换班次 / 多标签页均保持一致。
          </span>
        </div>
        <button className="small" onClick={resetAll}>
          清空本地数据
        </button>
      </header>

      <ShiftBar
        selected={shift}
        onSelect={(id) => {
          setEditingId(null);
          setPrefs((p) => ({ ...p, shiftId: id }));
        }}
      />

      <Dashboard
        shift={shift}
        device={device}
        onDevice={(d) => setPrefs((p) => ({ ...p, device: d }))}
      />

      <div className="main-grid">
        <div className="col-left">
          <ReadingForm
            shift={shift}
            editing={editing}
            onDone={() => setEditingId(null)}
          />
        </div>
        <div className="col-right">
          <ReadingList
            shift={shift}
            device={device}
            editingId={editingId}
            jumpId={jumpId}
            onEdit={(e) => setEditingId(e.id)}
          />
        </div>
      </div>

      <div className="bottom-grid">
        <AnomalyTimeline shift={shift} readings={visibleReadings} onJump={jumpToReading} />
        <HandoverSummary shift={shift} />
      </div>

      <footer className="footer-note">
        规则：已交接班次立即冻结——读数不可改写、异常不可清除，仅可追加处理说明；存在未闭环异常时不能完成交接。
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <LedgerProvider>
      <Workspace />
    </LedgerProvider>
  );
}
