import { useMemo, useState } from "react";
import "./styles.css";
import { Entry, Shift, watchLabel } from "./log";
import { entriesOfShift, resetAllData } from "./store";
import { useLogState } from "./useLog";
import ShiftBar from "./components/ShiftBar";
import FilterBar from "./components/FilterBar";
import Dashboard from "./components/Dashboard";
import EntryForm from "./components/EntryForm";
import LogList from "./components/LogList";
import HandoverPanel from "./components/HandoverPanel";

function App() {
  const state = useLogState();
  const [deviceFilter, setDeviceFilter] = useState("全部");
  const [editing, setEditing] = useState<Entry | null>(null);

  const shift: Shift | undefined = state.shifts.find((s) => s.id === state.selectedShiftId);
  const shiftEntries = shift ? entriesOfShift(shift.id) : [];
  const visibleEntries = useMemo(
    () =>
      shiftEntries.filter((e) => deviceFilter === "全部" || e.device === deviceFilter),
    // entries 引用随每次数据变更而更新，无需额外依赖
    [shiftEntries, deviceFilter, state.entries],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: shiftEntries.length };
    for (const e of shiftEntries) c[e.device] = (c[e.device] ?? 0) + 1;
    return c;
  }, [shiftEntries, state.entries]);

  function handleReset() {
    if (!window.confirm("将清空本机浏览器中的全部班次与台账数据，且不可恢复，确认继续？")) return;
    resetAllData();
    setEditing(null);
  }

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62001 · 船舶轮机值班台账 · 数据仅存本机浏览器</p>
        <h1>船舶轮机值班台账</h1>
        <span>
          按班次记录主机转速、滑油压力、冷却水温与燃油读数；异常项可持续追加处理说明，闭环后方可交接。
          已交接班次立即冻结，只能追加说明，不能改写读数或清除异常。
        </span>
      </section>

      <ShiftBar shifts={state.shifts} selectedShiftId={state.selectedShiftId} />

      {!shift ? (
        <section className="panel">
          <p className="empty">请先在上方「新开班次」，随后即可录入参数读数。</p>
        </section>
      ) : (
        <>
          <div className="metrics shift-strip">
            <article>
              <small>当前班次</small>
              <strong className="strip-value">
                {shift.date} {shift.watch}班
              </strong>
              <span className="metric-foot">{watchLabel(shift.watch)}</span>
            </article>
            <article>
              <small>值班轮机员</small>
              <strong className="strip-value">{shift.engineer || "未署名"}</strong>
              <span className="metric-foot">
                {shift.status === "handed" ? "已交接冻结" : "值班中"}
              </span>
            </article>
            <article>
              <small>本班读数</small>
              <strong className="strip-value">{shiftEntries.length}</strong>
              <span className="metric-foot">
                异常 {shiftEntries.filter((e) => e.anomaly).length} 项 · 未闭环{" "}
                {shiftEntries.filter((e) => e.anomaly && !e.resolved).length} 项
              </span>
            </article>
          </div>

          <div className="workspace">
            <FilterBar
              deviceFilter={deviceFilter}
              onChange={(d) => {
                setDeviceFilter(d);
                setEditing(null);
              }}
              counts={counts}
            />
            <div className="main-col">
              <Dashboard
                entries={shiftEntries}
                deviceFilter={deviceFilter}
                frozen={shift.status === "handed"}
              />
              <EntryForm
                key={shift.id}
                shiftId={shift.id}
                frozen={shift.status === "handed"}
                editing={editing}
                onDone={() => setEditing(null)}
              />
            </div>
          </div>

          <div className="workspace bottom">
            <LogList
              entries={visibleEntries}
              frozen={shift.status === "handed"}
              onEdit={(e) => setEditing(e)}
            />
            <HandoverPanel shift={shift} entries={shiftEntries} />
          </div>
        </>
      )}

      <footer className="foot">
        <span>
          不接后台、不加依赖 · 看板 / 设备筛选 / 交接摘要共用同一份本地数据，刷新或切换班次后保持一致
        </span>
        <button className="danger-btn" onClick={handleReset}>
          清空全部本地数据
        </button>
      </footer>
    </main>
  );
}

export default App;
