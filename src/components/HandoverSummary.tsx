import { PARAMS, shiftLabel, shortTime, valueStatus } from "../meta";
import { safeRun, useLedger } from "../store";
import type { ReadingEntry, Shift } from "../types";

function fmt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "") || "0";
}

function rangeLine(entries: ReadingEntry[]): { label: string; value: string }[] {
  return PARAMS.map((p) => {
    const vals = entries
      .map((e) => e[p.key])
      .filter((v) => v.trim() !== "" && Number.isFinite(Number(v)))
      .map(Number);
    const latest = [...entries]
      .filter((e) => e[p.key].trim() !== "")
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    let text = "无记录";
    if (vals.length > 0) {
      text = `末值 ${latest![p.key]}${p.unit}（${fmt(Math.min(...vals))}–${fmt(Math.max(...vals))}）`;
      if (latest && valueStatus(p, latest[p.key]) === "warn") text += " ⚠";
    }
    return { label: p.label, value: text };
  });
}

/** 交接班摘要：存在未闭环异常时明确禁止交接 */
export function HandoverSummary({ shift }: { shift: Shift | null }) {
  const { state, dispatch } = useLedger();
  if (!shift) return null;
  const cur: Shift = shift;

  const entries = state.readings
    .filter((r) => r.shiftId === shift.id)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const abnormal = entries.filter((r) => r.abnormal);
  const open = abnormal.filter((r) => !r.closed);
  const frozen = shift.handedOver;

  function doHandover() {
    if (open.length > 0) {
      window.alert(
        `存在 ${open.length} 项未闭环异常，不能完成交接。\n请逐项追加处理说明并勾选“闭环”。`
      );
      return;
    }
    if (!window.confirm(`确认完成 ${shiftLabel(cur)} 交接并冻结？`)) return;
    const err = safeRun(() => dispatch({ type: "handover", shiftId: cur.id }));
    if (err) window.alert(err);
  }

  return (
    <section className="panel handover">
      <div className="heading">
        <div>
          <p>交接班摘要</p>
          <h2>{shiftLabel(shift)}</h2>
        </div>
        <span className={"badge " + (frozen ? "badge-frozen" : open.length > 0 ? "badge-danger" : "badge-open")}>
          {frozen
            ? `已于 ${shift.handedOverAt ? shortTime(shift.handedOverAt) : "—"} 交接冻结`
            : open.length > 0
              ? "禁止交接：异常未闭环"
              : "可交接"}
        </span>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>读数条目</dt>
          <dd>{entries.length} 条</dd>
        </div>
        <div>
          <dt>异常项</dt>
          <dd>
            {abnormal.length} 项（未闭环 {open.length}）
          </dd>
        </div>
        {rangeLine(entries).map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>

      {abnormal.length > 0 && (
        <div className="summary-abnormal">
          <h3>异常交接明细</h3>
          <ul>
            {abnormal.map((r) => (
              <li key={r.id} className={r.closed ? "closed" : "open"}>
                <b>
                  {shortTime(r.at)} {r.device}
                </b>
                <span>{r.abnormalDesc}</span>
                <em>{r.closed ? `已闭环（${r.notes.length} 条说明）` : "未闭环 — 须继续跟踪"}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="handover-note-label">
        <span>交接备注</span>
        <textarea
          rows={2}
          value={shift.handoverNote}
          disabled={frozen}
          placeholder={frozen ? "" : "下班次需重点跟踪的事项……"}
          onChange={(e) =>
            dispatch({ type: "setHandoverNote", shiftId: shift.id, text: e.target.value })
          }
        />
      </label>

      {!frozen && (
        <div className="handover-foot">
          <p className={open.length > 0 ? "error" : "muted"}>
            {open.length > 0
              ? `尚有 ${open.length} 项异常未闭环，交接按钮不可用。`
              : "异常均已闭环，可以完成交接；交接后班次立即冻结。"}
          </p>
          <button className="handover-btn" disabled={open.length > 0} onClick={doHandover}>
            完成交接并冻结
          </button>
          <button className="small" onClick={() => window.print()}>
            打印 / 另存为 PDF
          </button>
        </div>
      )}
    </section>
  );
}
