import { Entry, METRICS, MetricKey, isMetricAbnormal, sortEntries } from "../log";

interface Props {
  entries: Entry[];
  deviceFilter: string;
  frozen: boolean;
}

function latestValue(entries: Entry[], key: MetricKey): Entry | undefined {
  const withValue = sortEntries(entries).filter((e) => e[key] !== null);
  return withValue[withValue.length - 1];
}

export default function Dashboard({ entries, deviceFilter, frozen }: Props) {
  const filtered = entries.filter((e) => deviceFilter === "全部" || e.device === deviceFilter);
  const anomalyCount = filtered.filter((e) => e.anomaly).length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>机舱参数看板</p>
          <h2>
            最新读数{frozen && <span className="frozen-flag">班次已冻结 · 只读</span>}
          </h2>
        </div>
        <span className="sub">
          设备筛选：{deviceFilter} · 异常项 <b className={anomalyCount ? "danger" : "ok"}>{anomalyCount}</b>
        </span>
      </div>
      <div className="metrics dashboard-grid">
        {METRICS.map((m) => {
          const latest = latestValue(filtered, m.key);
          const value = latest ? latest[m.key] : null;
          const abnormal = value !== null && isMetricAbnormal(m.key, value);
          return (
            <article key={m.key} className={abnormal ? "metric danger" : "metric"}>
              <small>
                {m.label}
                {m.rangeText && <em>{m.rangeText}</em>}
              </small>
              {latest && value !== null ? (
                <>
                  <strong>
                    {value}
                    <i>{m.unit}</i>
                  </strong>
                  <span className={"metric-foot" + (abnormal ? " danger" : "")}>
                    {latest.device} · {latest.time}
                    {abnormal ? " · 超参考范围" : ""}
                  </span>
                </>
              ) : (
                <strong className="no-data">—</strong>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
