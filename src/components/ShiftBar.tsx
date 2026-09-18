import { useState } from "react";
import { compareShifts, openAbnormalCount, shiftLabel, todayStr, uid, WATCHES } from "../meta";
import { safeRun, useLedger } from "../store";
import type { Shift } from "../types";

export function ShiftBar({
  selected,
  onSelect,
}: {
  selected: Shift | null;
  onSelect: (id: string) => void;
}) {
  const { state, dispatch } = useLedger();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [watch, setWatch] = useState<string>(WATCHES[2]);
  const [error, setError] = useState<string | null>(null);

  const shifts = [...state.shifts].sort(compareShifts);

  function createShift() {
    const id = uid();
    const err = safeRun(() => dispatch({ type: "addShift", id, date, watch }));
    if (err) {
      setError(err);
      return;
    }
    onSelect(id);
    setError(null);
    setAdding(false);
  }

  function doHandover(shift: Shift) {
    const open = state.readings.filter(
      (r) => r.shiftId === shift.id && r.abnormal && !r.closed
    );
    const tip =
      open.length > 0
        ? `该班次仍有 ${open.length} 项异常未闭环，不能完成交接。\n请在异常项中追加处理说明并勾选闭环。`
        : `确认完成 ${shiftLabel(shift)} 的交接？\n交接后班次立即冻结：读数不可改写、异常不可清除，仅可追加处理说明。`;
    if (open.length > 0) {
      window.alert(tip);
      return;
    }
    if (!window.confirm(tip)) return;
    const err = safeRun(() => dispatch({ type: "handover", shiftId: shift.id }));
    if (err) window.alert(err);
  }

  return (
    <section className="panel shift-bar">
      <div className="shift-tabs" role="tablist">
        {shifts.map((s) => {
          const open = openAbnormalCount(
            state.readings.filter((r) => r.shiftId === s.id)
          );
          return (
            <button
              key={s.id}
              role="tab"
              className={
                "shift-tab" +
                (selected?.id === s.id ? " active" : "") +
                (s.handedOver ? " frozen" : "")
              }
              onClick={() => onSelect(s.id)}
            >
              <span className="shift-tab-name">{shiftLabel(s)}</span>
              <span className={"badge " + (s.handedOver ? "badge-frozen" : open > 0 ? "badge-danger" : "badge-open")}>
                {s.handedOver ? "已交接" : open > 0 ? `${open} 项未闭环` : "值班中"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="shift-side">
        {!adding && <button onClick={() => setAdding(true)}>+ 新建班次</button>}
        {adding && (
          <div className="new-shift">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <select value={watch} onChange={(e) => setWatch(e.target.value)}>
              {WATCHES.map((w) => (
                <option key={w} value={w}>
                  {w}班
                </option>
              ))}
            </select>
            <button className="primary" onClick={createShift}>
              创建
            </button>
            <button onClick={() => setAdding(false)}>取消</button>
          </div>
        )}

        {selected && !selected.handedOver && (
          <button className="handover-btn" onClick={() => doHandover(selected)}>
            完成交接并冻结
          </button>
        )}
        {selected?.handedOver && (
          <span className="frozen-note">班次已冻结，仅可追加处理说明</span>
        )}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
