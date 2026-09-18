import { DEVICES } from "../log";

interface Props {
  deviceFilter: string;
  onChange: (device: string) => void;
  counts: Record<string, number>;
}

export default function FilterBar({ deviceFilter, onChange, counts }: Props) {
  const options = ["全部", ...DEVICES];
  return (
    <aside className="panel">
      <h2>按设备筛选</h2>
      <p className="aside-hint">看板、台账与交接摘要共用此筛选</p>
      <div className="chips vertical">
        {options.map((d) => (
          <button
            key={d}
            className={"chip" + (deviceFilter === d ? " active" : "")}
            onClick={() => onChange(d)}
          >
            <span>{d}</span>
            <b>{counts[d] ?? 0}</b>
          </button>
        ))}
      </div>
      <p className="aside-foot">数据仅保存在本机浏览器，刷新或切换班次后保持一致。</p>
    </aside>
  );
}
