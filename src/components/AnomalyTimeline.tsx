import { shortTime } from "../meta";
import type { ReadingEntry, Shift } from "../types";

/** 异常巡检项时间线（当前班次，随设备筛选联动） */
export function AnomalyTimeline({
  shift,
  readings,
  onJump,
}: {
  shift: Shift | null;
  readings: ReadingEntry[];
  onJump: (id: string) => void;
}) {
  if (!shift) return null;
  const abnormal = readings
    .filter((r) => r.abnormal)
    .sort((a, b) => (a.at < b.at ? -1 : 1));

  const open = abnormal.filter((r) => !r.closed).length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>异常巡检项</p>
          <h2>异常处理时间线</h2>
        </div>
        <span className={"badge " + (open > 0 ? "badge-danger" : "badge-closed")}>
          {abnormal.length === 0 ? "无异常" : `${open} 项未闭环 / 共 ${abnormal.length} 项`}
        </span>
      </div>

      {abnormal.length === 0 ? (
        <p className="muted">本班次巡检正常，无异常项。</p>
      ) : (
        <ol className="anomaly-list">
          {abnormal.map((r) => (
            <li key={r.id} className={r.closed ? "closed" : "open"}>
              <div className="anomaly-head">
                <time>{shortTime(r.at)}</time>
                <b>{r.device}</b>
                <span className={"badge " + (r.closed ? "badge-closed" : "badge-danger")}>
                  {r.closed ? "已闭环" : "未闭环"}
                </span>
              </div>
              <p>{r.abnormalDesc}</p>
              {r.notes.length > 0 && (
                <ul className="anomaly-notes">
                  {r.notes.map((n) => (
                    <li key={n.id}>
                      <time>{shortTime(n.at)}</time> {n.text}
                    </li>
                  ))}
                </ul>
              )}
              <button className="small" onClick={() => onJump(r.id)}>
                在台账中处理
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
