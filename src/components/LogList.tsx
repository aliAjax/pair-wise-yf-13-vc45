import { useState } from "react";
import {
  Entry,
  METRICS,
  isMetricAbnormal,
  sortEntries,
} from "../log";
import { appendHandlingNote, deleteEntry, setResolved } from "../store";

interface Props {
  entries: Entry[];
  frozen: boolean;
  onEdit: (entry: Entry) => void;
}

function Readings({ entry }: { entry: Entry }) {
  const items = METRICS.map((m) => {
    const v = entry[m.key];
    return { ...m, value: v, abnormal: isMetricAbnormal(m.key, v) };
  }).filter((x) => x.value !== null);
  if (items.length === 0) return <span className="no-readings">无参数读数</span>;
  return (
    <span className="readings">
      {items.map((x) => (
        <b key={x.key} className={x.abnormal || entry.anomaly ? "abn" : ""}>
          {x.label.replace("主机", "")}
          {x.value}
          {x.unit}
          {x.abnormal && <i title="超出参考范围">⚠</i>}
        </b>
      ))}
    </span>
  );
}

export default function LogList({ entries, frozen, onEdit }: Props) {
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ordered = sortEntries(entries);
  const anomalies = ordered.filter((e) => e.anomaly);

  function handleAppend(e: Entry) {
    const text = (noteDraft[e.id] ?? "").trim();
    const res = appendHandlingNote(e.id, text);
    if (!res.ok) {
      setErrors((m) => ({ ...m, [e.id]: res.error }));
      return;
    }
    setNoteDraft((m) => ({ ...m, [e.id]: "" }));
    setErrors((m) => ({ ...m, [e.id]: "" }));
  }

  function handleDelete(e: Entry) {
    if (!window.confirm(`确认删除 ${e.time} 的${e.device}读数记录？此操作不可撤销。`)) return;
    deleteEntry(e.id);
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>值班台账</p>
          <h2>参数读数与异常处理</h2>
        </div>
        <span className="sub">共 {ordered.length} 条</span>
      </div>

      {anomalies.length > 0 && (
        <div className="timeline">
          <h3>异常记录时间线</h3>
          <ul>
            {anomalies.map((e) => (
              <li key={e.id} className={e.resolved ? "resolved" : "open"}>
                <span className="tl-time">{e.time}</span>
                <span className="tl-device">{e.device}</span>
                <span className="tl-desc">{e.anomalyDesc}</span>
                <b className={"tag " + (e.resolved ? "closed" : "open-tag")}>
                  {e.resolved ? "已闭环" : "未闭环"}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="empty">当前筛选下暂无读数记录。</p>
      ) : (
        <div className="entries">
          {ordered.map((e) => (
            <article key={e.id} className={"entry-card" + (e.anomaly ? " anomaly" : "")}>
              <header>
                <div className="entry-title">
                  <b className="entry-time">{e.time}</b>
                  <span className="entry-device">{e.device}</span>
                  {e.anomaly && (
                    <b className={"tag " + (e.resolved ? "closed" : "open-tag")}>
                      {e.resolved ? "异常·已闭环" : "异常·未闭环"}
                    </b>
                  )}
                </div>
                {!frozen && (
                  <div className="entry-ops">
                    <button onClick={() => onEdit(e)}>编辑</button>
                    <button className="danger-btn" onClick={() => handleDelete(e)}>
                      删除
                    </button>
                  </div>
                )}
              </header>

              <Readings entry={e} />
              {e.anomaly && <p className="anomaly-desc">异常：{e.anomalyDesc}</p>}

              {e.handlingNotes.length > 0 && (
                <ul className="notes">
                  {e.handlingNotes.map((n) => (
                    <li key={n.id}>
                      <span className="note-time">[{n.time}]</span> {n.text}
                    </li>
                  ))}
                </ul>
              )}

              {e.anomaly && (
                <div className="note-add">
                  <input
                    placeholder="追加处理说明（任何时候都只能追加，不能改写）"
                    value={noteDraft[e.id] ?? ""}
                    onChange={(ev) =>
                      setNoteDraft((m) => ({ ...m, [e.id]: ev.target.value }))
                    }
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") handleAppend(e);
                    }}
                  />
                  <button onClick={() => handleAppend(e)}>追加说明</button>
                  {!frozen && (
                    <label className="resolve-row">
                      <input
                        type="checkbox"
                        checked={e.resolved}
                        onChange={(ev) => setResolved(e.id, ev.target.checked)}
                      />
                      已闭环
                    </label>
                  )}
                </div>
              )}
              {errors[e.id] && <p className="form-error">{errors[e.id]}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
