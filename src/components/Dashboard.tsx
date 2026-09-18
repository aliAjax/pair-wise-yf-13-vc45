import { DEVICES, hhmm, PARAMS, openAbnormalCount, valueStatus, type ParamMeta } from "../meta";
import { useLedger } from "../store";
import type { ReadingEntry, Shift } from "../types";

interface Stat {
  latest: { value: string; at: string } | null;
  min: number;
  avg: number;
  max: number;
}

function calcStat(entries: ReadingEntry[], key: ParamMeta["key"]): Stat | null {
  const vals = entries
    .filter((e) => e[key].trim() !== "" && Number.isFinite(Number(e[key])))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  if (vals.length === 0) return null;
  const nums = vals.map((v) => Number(v[key]));
  return {
    latest: { value: vals[0][key], at: vals[0].at },
    min: Math.min(...nums),
    avg: nums.reduce((s, n) => s + n, 0) / nums.length,
    max: Math.max(...nums),
  };
}

/** 设备筛选 + 机舱参数看板：筛选条件同时作用于下方记录、异常时间线 */
export function Dashboard({
  shift,
  device,
  onDevice,
}: {
  shift: Shift | null;
  device: string;
  onDevice: (d: string) => void;
}) {
  const { state } = useLedger();

  const inShift = shift ? state.readings.filter((r) => r.shiftId === shift.id) : [];
  const filtered = device === "全部" ? inShift : inShift.filter((r) => r.device === device);
  const deviceCount = (d: string) =>
    d === "全部" ? inShift.length : inShift.filter((r) => r.device === d).length;

  const allDeviceNames = Array.from(new Set([...DEVICES, ...inShift.map((r) => r.device)]));

  const open = openAbnormalCount(inShift);
  const abnormalTotal = inShift.filter((r) => r.abnormal).length;

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>按设备筛选</p>
            <h2>设备</h2>
          </div>
        </div>
        <div className="chips">
          {["全部", ...allDeviceNames].map((d) => (
            <button
              key={d}
              className={"chip" + (device === d ? " active" : "")}
              onClick={() => onDevice(d)}
            >
              {d}
              <em>{deviceCount(d)}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>机舱参数看板</p>
            <h2>{shift ? `${shift.date} ${shift.watch}班` : "请选择班次"}</h2>
          </div>
          <div className="summary-pills">
            <span className="pill">读数 {filtered.length}</span>
            <span className={"pill " + (open > 0 ? "pill-danger" : "pill-ok")}>
              未闭环 {open}
            </span>
            <span className="pill">异常累计 {abnormalTotal}</span>
          </div>
        </div>

        <div className="dash-grid">
          {PARAMS.map((p) => {
            const stat = calcStat(filtered, p.key);
            const status = stat ? valueStatus(p, stat.latest!.value) : "empty";
            return (
              <article key={p.key} className={"dash-card " + status}>
                <header>
                  <small>{p.label}</small>
                  <span className="status-tag">
                    {status === "warn" ? "超参考范围" : status === "empty" ? "无读数" : "正常"}
                  </span>
                </header>
                <strong>
                  {stat ? stat.latest!.value : "—"}
                  <em>{p.unit}</em>
                </strong>
                <p className="dash-hint">{p.hint}</p>
                {stat && (
                  <p className="dash-stats">
                    最低 {stat.min.toFixed(2)} · 均值 {stat.avg.toFixed(2)} · 最高{" "}
                    {stat.max.toFixed(2)}
                    <span className="muted">　更新于 {hhmm(stat.latest!.at)}</span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
        <p className="muted filter-note">
          {device === "全部" ? "当前显示班次内全部设备" : `已筛选：${device}`}
          ；看板、记录、异常时间线与交接摘要共用同一份本地数据。
        </p>
      </section>
    </>
  );
}
