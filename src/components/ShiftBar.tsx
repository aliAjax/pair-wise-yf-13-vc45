import { useState } from "react";
import { Shift, WATCHES, Watch, nowDate, shiftSortKey, watchLabel } from "../log";
import { createShift, selectShift } from "../store";

interface Props {
  shifts: Shift[];
  selectedShiftId: string | null;
}

export default function ShiftBar({ shifts, selectedShiftId }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(nowDate());
  const [watch, setWatch] = useState<Watch>("08-12");
  const [engineer, setEngineer] = useState("");
  const [error, setError] = useState("");

  const ordered = [...shifts].sort((a, b) =>
    shiftSortKey(a) < shiftSortKey(b) ? 1 : -1,
  );

  function handleCreate() {
    setError("");
    if (!date) {
      setError("请选择值班日期");
      return;
    }
    if (!engineer.trim()) {
      setError("请填写值班轮机员");
      return;
    }
    const res = createShift({ date, watch, engineer });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setEngineer("");
  }

  return (
    <section className="panel shift-bar">
      <div className="heading">
        <div>
          <p>值班班次</p>
          <h2>班次切换与开班</h2>
        </div>
        <button className="primary" onClick={() => setOpen((v) => !v)}>
          {open ? "取消" : "+ 新开班次"}
        </button>
      </div>

      {open && (
        <div className="shift-create">
          <label>
            <span>值班日期</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>班次时段</span>
            <select value={watch} onChange={(e) => setWatch(e.target.value as Watch)}>
              {WATCHES.map((w) => (
                <option key={w} value={w}>
                  {watchLabel(w)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>值班轮机员</span>
            <input
              placeholder="如：李轮机"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
            />
          </label>
          <button className="primary create-btn" onClick={handleCreate}>
            创建并进入
          </button>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="empty">暂无班次，点击「新开班次」建立第一个值班台账。</p>
      ) : (
        <div className="shift-list">
          {ordered.map((s) => {
            const active = s.id === selectedShiftId;
            return (
              <button
                key={s.id}
                className={"shift-item" + (active ? " active" : "")}
                onClick={() => selectShift(s.id)}
              >
                <span className="shift-name">
                  {s.date} · {s.watch}班
                </span>
                <span className="shift-meta">
                  {s.engineer || "未署名"} ·{" "}
                  <b className={s.status === "handed" ? "tag handed" : "tag onduty"}>
                    {s.status === "handed" ? "已交接·冻结" : "值班中"}
                  </b>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
