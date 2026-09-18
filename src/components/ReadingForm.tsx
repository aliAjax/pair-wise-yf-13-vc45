import { useEffect, useState } from "react";
import { DEVICES, PARAMS, valueStatus } from "../meta";
import { blankForm, safeRun, useLedger } from "../store";
import type { ReadingEntry, Shift } from "../types";

export function ReadingForm({
  shift,
  editing,
  onDone,
}: {
  shift: Shift | null;
  editing: ReadingEntry | null;
  onDone: () => void;
}) {
  const { dispatch } = useLedger();
  const [form, setForm] = useState<ReadingEntry>(() => blankForm(shift?.id ?? ""));
  const [error, setError] = useState<string | null>(null);

  // 切换班次或编辑目标时重置表单
  useEffect(() => {
    setForm(editing ? { ...editing } : blankForm(shift?.id ?? ""));
    setError(null);
  }, [shift?.id, editing]);

  const frozen = !!shift?.handedOver;

  function set<K extends keyof ReadingEntry>(key: K, value: ReadingEntry[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    if (!shift) {
      setError("请先选择或新建班次");
      return;
    }
    const hasReading = PARAMS.some((p) => form[p.key].trim() !== "");
    if (!hasReading && !form.abnormal) {
      setError("至少填写一项参数读数");
      return;
    }
    if (form.abnormal && form.abnormalDesc.trim() === "") {
      setError("标记异常时必须填写异常描述");
      return;
    }
    const entry: ReadingEntry = {
      ...form,
      // 未勾异常时不允许带着“已闭环”状态
      closed: form.abnormal ? form.closed : false,
      abnormalDesc: form.abnormal ? form.abnormalDesc.trim() : "",
    };
    const err = safeRun(() =>
      dispatch({ type: editing ? "updateReading" : "addReading", entry })
    );
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onDone();
  }

  if (frozen) {
    return (
      <section className="panel form-panel">
        <div className="heading">
          <div>
            <p>参数读数</p>
            <h2>班次已冻结</h2>
          </div>
        </div>
        <p className="frozen-banner">
          该班次已完成交接：读数不可改写、异常不可清除。如需补充，请在下方异常项或记录中
          <b>追加处理说明</b>（追加后同样不可修改）。
        </p>
      </section>
    );
  }

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>参数读数</p>
          <h2>{editing ? "改写读数" : "新增读数"}</h2>
        </div>
        {editing && <button onClick={onDone}>取消改写</button>}
      </div>

      <div className="field-grid">
        <label>
          <span>读数时间</span>
          <input
            type="datetime-local"
            value={form.at.slice(0, 16)}
            onChange={(e) => set("at", e.target.value)}
          />
        </label>
        <label>
          <span>设备名称</span>
          <input
            list="device-options"
            value={form.device}
            placeholder="选择或输入设备"
            onChange={(e) => set("device", e.target.value)}
          />
          <datalist id="device-options">
            {DEVICES.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>

        {PARAMS.map((p) => {
          const status = valueStatus(p, form[p.key]);
          return (
            <label key={p.key} className={status === "warn" ? "param-warn" : ""}>
              <span>
                {p.label}（{p.unit}）
                {status === "warn" && <b className="warn-tip">超出参考范围</b>}
              </span>
              <input
                type="number"
                step={p.step}
                placeholder={p.placeholder}
                value={form[p.key]}
                onChange={(e) => set(p.key, e.target.value)}
              />
            </label>
          );
        })}
      </div>

      <div className="abnormal-block">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={form.abnormal}
            onChange={(e) => set("abnormal", e.target.checked)}
          />
          标记为异常巡检项
        </label>
        {form.abnormal && (
          <>
            <textarea
              rows={2}
              placeholder="异常描述（现象、部位、初步判断）"
              value={form.abnormalDesc}
              onChange={(e) => set("abnormalDesc", e.target.value)}
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={form.closed}
                onChange={(e) => set("closed", e.target.checked)}
              />
              现场已处理并闭环
            </label>
          </>
        )}
      </div>

      <div className="form-actions">
        <button className="primary" onClick={save}>
          {editing ? "保存改写" : "保存读数"}
        </button>
        {error && <span className="error">{error}</span>}
        <span className="muted">
          完成交接后此表单将锁定；处理说明随时可追加。
        </span>
      </div>
    </section>
  );
}
