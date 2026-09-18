import { useState } from "react";
import { hhmm, PARAMS, shiftLabel, valueStatus } from "../meta";
import { safeRun, useLedger } from "../store";
import type { ReadingEntry, Shift } from "../types";
import { NotesTimeline } from "./NotesTimeline";

function paramCells(e: ReadingEntry) {
  return PARAMS.map((p) => {
    const raw = e[p.key];
    const status = raw.trim() === "" ? "empty" : valueStatus(p, raw);
    return (
      <span key={p.key} className={"cell " + status} title={p.hint}>
        {raw === "" ? "—" : raw}
        <i>{p.unit}</i>
      </span>
    );
  });
}

export function ReadingList({
  shift,
  device,
  editingId,
  jumpId,
  onEdit,
}: {
  shift: Shift | null;
  device: string;
  editingId: string | null;
  jumpId: string | null;
  onEdit: (e: ReadingEntry) => void;
}) {
  const { state, dispatch } = useLedger();
  const [openNotes, setOpenNotes] = useState<string | null>(null);

  if (!shift) {
    return (
      <section className="panel">
        <p className="muted">请先选择或新建一个值班班次。</p>
      </section>
    );
  }

  const frozen = shift.handedOver;
  const rows = state.readings
    .filter((r) => r.shiftId === shift.id)
    .filter((r) => device === "全部" || r.device === device)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  function remove(e: ReadingEntry) {
    if (!window.confirm(`确认删除 ${hhmm(e.at)} ${e.device} 的读数记录？`)) return;
    const err = safeRun(() => dispatch({ type: "deleteReading", id: e.id }));
    if (err) window.alert(err);
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>值班台账</p>
          <h2>
            {shiftLabel(shift)}
            {device !== "全部" && ` · ${device}`}
          </h2>
        </div>
        <span className={"badge " + (frozen ? "badge-frozen" : "badge-open")}>
          {frozen ? "已冻结 · 仅可追加说明" : "值班中 · 可录入"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="muted">该条件下暂无读数记录。</p>
      ) : (
        <div className="records-timeline">
          {rows.map((e) => (
            <article
              key={e.id}
              id={`rec-${e.id}`}
              className={"record-card" + (e.abnormal ? " abnormal" : "") + (jumpId === e.id ? " flash" : "")}
            >
              <div className="record-main">
                <div className="record-head">
                  <time>{hhmm(e.at)}</time>
                  <b>{e.device}</b>
                  {e.abnormal && (
                    <span className={"badge " + (e.closed ? "badge-closed" : "badge-danger")}>
                      {e.closed ? "异常已闭环" : "异常未闭环"}
                    </span>
                  )}
                </div>
                <div className="param-row">{paramCells(e)}</div>
                {e.abnormal && <p className="abnormal-desc">异常：{e.abnormalDesc}</p>}
                <div className="record-actions">
                  <button className="small" onClick={() => setOpenNotes(openNotes === e.id ? null : e.id)}>
                    处理说明（{e.notes.length}）
                  </button>
                  {!frozen && (
                    <>
                      <button
                        className="small"
                        disabled={editingId === e.id}
                        onClick={() => onEdit(e)}
                      >
                        改写读数
                      </button>
                      <button className="small danger" onClick={() => remove(e)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
              {openNotes === e.id && <NotesTimeline entry={e} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
