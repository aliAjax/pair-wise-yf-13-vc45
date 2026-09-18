import { useState } from "react";
import { safeRun, useLedger } from "../store";
import { shortTime } from "../meta";
import type { ReadingEntry } from "../types";

/**
 * 处理说明时间线：唯一“追加”入口。
 * 即使班次已交接冻结，仍可继续追加说明，但任何已有说明均不可改、不可删。
 */
export function NotesTimeline({ entry }: { entry: ReadingEntry }) {
  const { dispatch } = useLedger();
  const [text, setText] = useState("");
  const [close, setClose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const err = safeRun(() =>
      dispatch({ type: "appendNote", readingId: entry.id, text, closed: close })
    );
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setText("");
    setClose(false);
  }

  return (
    <div className="notes">
      {entry.notes.length === 0 && <p className="muted">暂无处理说明</p>}
      <ol className="note-list">
        {entry.notes.map((n) => (
          <li key={n.id}>
            <time>{shortTime(n.at)}</time>
            <span>{n.text}</span>
          </li>
        ))}
      </ol>
      <div className="note-add">
        <textarea
          value={text}
          rows={2}
          placeholder="追加处理说明（提交后不可修改、不可删除）"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="note-actions">
          {entry.abnormal && !entry.closed && (
            <label className="inline-check">
              <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />
              本次处理后闭环该异常
            </label>
          )}
          <button
            className="small primary"
            disabled={text.trim() === ""}
            onClick={submit}
          >
            追加说明
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
