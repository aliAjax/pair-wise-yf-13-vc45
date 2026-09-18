import { useEffect, useState } from "react";
import { DEVICES, Device, Entry, EntryInput, METRICS, MetricKey, nowTime } from "../log";
import { addEntry, updateEntry } from "../store";

interface Props {
  shiftId: string;
  frozen: boolean;
  editing: Entry | null;
  onDone: () => void;
}

type NumberFields = Exclude<MetricKey, never>;

function emptyForm() {
  return {
    device: "主机" as Device,
    time: nowTime(),
    rpm: "",
    lubePressure: "",
    coolingTemp: "",
    fuel: "",
    anomaly: false,
    anomalyDesc: "",
  };
}

function fromEntry(e: Entry) {
  return {
    device: e.device,
    time: e.time,
    rpm: e.rpm === null ? "" : String(e.rpm),
    lubePressure: e.lubePressure === null ? "" : String(e.lubePressure),
    coolingTemp: e.coolingTemp === null ? "" : String(e.coolingTemp),
    fuel: e.fuel === null ? "" : String(e.fuel),
    anomaly: e.anomaly,
    anomalyDesc: e.anomalyDesc,
  };
}

export default function EntryForm({ shiftId, frozen, editing, onDone }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // 进入/退出编辑态时把记录内容同步到表单
  useEffect(() => {
    setForm(editing ? fromEntry(editing) : emptyForm());
    setError("");
  }, [editing]);

  const shown = form;
  const patch = (p: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...p }));
    setError("");
  };

  function buildInput(): EntryInput | null {
    const num = (key: NumberFields): number | null => {
      const raw = shown[key].trim();
      if (!raw) return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : Number.NaN;
    };
    const values = {
      rpm: num("rpm"),
      lubePressure: num("lubePressure"),
      coolingTemp: num("coolingTemp"),
      fuel: num("fuel"),
    };
    if (Object.values(values).some((v) => Number.isNaN(v))) {
      setError("参数读数必须是数字");
      return null;
    }
    return {
      device: shown.device,
      time: shown.time,
      ...values,
      anomaly: shown.anomaly,
      anomalyDesc: shown.anomalyDesc,
    };
  }

  function handleSubmit() {
    const input = buildInput();
    if (!input) return;
    const res = editing ? updateEntry(editing.id, input) : addEntry(shiftId, input);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm(emptyForm());
    onDone();
  }

  if (frozen) {
    return (
      <section className="panel form-panel">
        <div className="heading">
          <div>
            <p>参数录入</p>
            <h2>本班次已冻结</h2>
          </div>
        </div>
        <p className="frozen-note">
          已完成交接的班次不可改写读数或清除异常；如发现遗留问题，可在异常项上继续追加处理说明。
        </p>
      </section>
    );
  }

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>参数录入</p>
          <h2>{editing ? "编辑读数记录" : "新增值班读数"}</h2>
        </div>
        {editing && (
          <button
            onClick={() => {
              setForm(emptyForm());
              onDone();
            }}
          >
            取消编辑
          </button>
        )}
      </div>

      <div className="entry-form">
        <div className="entry-head">
          <label>
            <span>观测时刻</span>
            <input
              type="time"
              value={shown.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
          </label>
          <label>
            <span>设备</span>
            <select
              value={shown.device}
              onChange={(e) => patch({ device: e.target.value as Device })}
            >
              {DEVICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-grid">
          {METRICS.map((m) => (
            <label key={m.key}>
              <span>
                {m.label}（{m.unit}）
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={m.step}
                placeholder={m.rangeText}
                value={shown[m.key]}
                onChange={(e) => patch({ [m.key]: e.target.value } as Partial<typeof form>)}
              />
            </label>
          ))}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={shown.anomaly}
            onChange={(e) => patch({ anomaly: e.target.checked })}
          />
          <span>该项为异常（需填写异常描述，并在闭环后方可交接）</span>
        </label>
        {shown.anomaly && (
          <label>
            <span>异常描述</span>
            <textarea
              rows={2}
              placeholder="如：冷却水温持续偏高、滑油压力波动…"
              value={shown.anomalyDesc}
              onChange={(e) => patch({ anomalyDesc: e.target.value })}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button className="primary" onClick={handleSubmit}>
            {editing ? "保存修改" : "记入台账"}
          </button>
        </div>
      </div>
    </section>
  );
}
