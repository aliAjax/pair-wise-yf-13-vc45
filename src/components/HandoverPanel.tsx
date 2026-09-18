import { useState } from "react";
import {
  DEVICES,
  Entry,
  METRICS,
  Shift,
  formatDateTime,
  isMetricAbnormal,
  sortEntries,
} from "../log";
import { completeHandover, saveHandoverNote } from "../store";

interface Props {
  shift: Shift;
  entries: Entry[];
}

function buildSummaryText(shift: Shift, entries: Entry[]): string {
  const lines: string[] = [];
  lines.push("船舶轮机值班交接班摘要");
  lines.push(`班次：${shift.date} ${shift.watch}班`);
  lines.push(`值班轮机员：${shift.engineer || "（未署名）"}`);
  lines.push(`状态：${shift.status === "handed" ? "已交接冻结" : "值班中"}`);
  if (shift.handedOverAt) lines.push(`交接时间：${formatDateTime(shift.handedOverAt)}`);
  lines.push("");
  lines.push("一、各设备读数统计");
  for (const d of DEVICES) {
    const ds = entries.filter((e) => e.device === d);
    if (ds.length === 0) continue;
    lines.push(`【${d}】共 ${ds.length} 条`);
    for (const e of sortEntries(ds)) {
      const parts = METRICS.filter((m) => e[m.key] !== null).map(
        (m) =>
          `${m.label} ${e[m.key]}${m.unit}${
            isMetricAbnormal(m.key, e[m.key]) ? "(超参考范围)" : ""
          }`,
      );
      lines.push(
        `  ${e.time} ${parts.join("，") || "无读数"}${e.anomaly ? ` [异常${e.resolved ? "·已闭环" : "·未闭环"}]` : ""}`,
      );
      if (e.anomaly) lines.push(`      异常描述：${e.anomalyDesc}`);
      e.handlingNotes.forEach((n) => lines.push(`      处理 [${n.time}]：${n.text}`));
    }
  }
  const open = entries.filter((e) => e.anomaly && !e.resolved);
  lines.push("");
  lines.push(`二、未闭环异常：${open.length} 项`);
  open.forEach((e) => lines.push(`  - ${e.time} ${e.device}：${e.anomalyDesc}`));
  lines.push("");
  lines.push(`三、交接备注：${shift.handoverNote || "（无）"}`);
  return lines.join("\n");
}

export default function HandoverPanel({ shift, entries }: Props) {
  const frozen = shift.status === "handed";
  const [note, setNote] = useState(shift.handoverNote);
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);

  const open = entries.filter((e) => e.anomaly && !e.resolved);
  const anomalyTotal = entries.filter((e) => e.anomaly).length;

  function handleComplete() {
    if (open.length > 0) {
      setError(`存在 ${open.length} 项未闭环异常，不得完成交接`);
      return;
    }
    if (!window.confirm("确认完成交接？交接后班次立即冻结，读数与异常状态不可再修改。")) return;
    const res = completeHandover(shift.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError("");
  }

  function handleExport() {
    const text = buildSummaryText(shift, entries);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `交接摘要-${shift.date}-${shift.watch}班.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 2000);
  }

  return (
    <section className="panel handover">
      <div className="heading">
        <div>
          <p>交接班摘要</p>
          <h2>
            {shift.date} {shift.watch}班
            {frozen && <span className="frozen-flag">已交接 · 冻结</span>}
          </h2>
        </div>
        <button onClick={handleExport}>{exported ? "已导出 ✓" : "导出摘要 .txt"}</button>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>值班轮机员</dt>
          <dd>{shift.engineer || "（未署名）"}</dd>
        </div>
        <div>
          <dt>读数条数</dt>
          <dd>{entries.length}</dd>
        </div>
        <div>
          <dt>异常总数</dt>
          <dd className={anomalyTotal ? "danger" : ""}>{anomalyTotal}</dd>
        </div>
        <div>
          <dt>未闭环</dt>
          <dd className={open.length ? "danger" : "ok"}>{open.length}</dd>
        </div>
        <div>
          <dt>交接时间</dt>
          <dd>{shift.handedOverAt ? formatDateTime(shift.handedOverAt) : "—"}</dd>
        </div>
      </dl>

      {open.length > 0 && (
        <div className="open-list">
          <h3>未闭环异常（交接前必须处理完毕）</h3>
          <ul>
            {open.map((e) => (
              <li key={e.id}>
                {e.time} · {e.device}：{e.anomalyDesc}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="note-label">
        <span>交接备注</span>
        {frozen ? (
          <p className="frozen-note inline">{shift.handoverNote || "（无）"}</p>
        ) : (
          <textarea
            rows={3}
            placeholder="记录交班事项，如舱底水状态、待复查设备等（自动保存）"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              saveHandoverNote(shift.id, e.target.value);
            }}
          />
        )}
      </label>

      {error && <p className="form-error">{error}</p>}
      {frozen ? (
        <p className="frozen-note">
          本班次已完成交接并冻结：读数与异常状态不可修改，仅可继续追加处理说明留档。
        </p>
      ) : (
        <button
          className={"primary handover-btn" + (open.length ? " blocked" : "")}
          onClick={handleComplete}
        >
          {open.length ? `有 ${open.length} 项异常未闭环，无法交接` : "完成交接并冻结班次"}
        </button>
      )}
    </section>
  );
}
