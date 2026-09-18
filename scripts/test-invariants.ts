// 核心业务不变量验证：冻结 / 交接规则（node 运行，浏览器 API 做 stub）
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
};
(globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} };

import { reducer, seedState } from "../src/store";
import type { LedgerState, ReadingEntry } from "../src/types";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`PASS ${name}`);
  else {
    console.error(`FAIL ${name}`);
    failures++;
  }
}
function throws(fn: () => void, fragment: string, name: string) {
  try {
    fn();
    console.error(`FAIL ${name}（未抛错）`);
    failures++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name + `（"${msg}"）`, msg.includes(fragment));
  }
}

let s: LedgerState = seedState();
const active = s.shifts.find((x) => !x.handedOver)!;
const frozen = s.shifts.find((x) => x.handedOver)!;
const openAbn = s.readings.find((r) => r.shiftId === active.id && r.abnormal && !r.closed)!;
const closedAbn = s.readings.find((r) => r.shiftId === active.id && r.abnormal)!;
void closedAbn;

// 1. 存在未闭环异常时不能交接
throws(() => reducer(s, { type: "handover", shiftId: active.id }), "未闭环", "未闭环异常阻止交接");

// 2. 闭环后可交接
s = reducer(s, { type: "appendNote", readingId: openAbn.id, text: "处理完毕", closed: true });
check("appendNote 追加说明并闭环", s.readings.find((r) => r.id === openAbn.id)!.closed === true);
s = reducer(s, { type: "handover", shiftId: active.id });
check("全部闭环后可完成交接", s.shifts.find((x) => x.id === active.id)!.handedOver === true);

// 3. 已交接班次冻结：不能改读数
const entry = s.readings.find((r) => r.shiftId === active.id && !r.abnormal)!;
const tampered: ReadingEntry = { ...entry, rpm: "999" };
throws(
  () => reducer(s, { type: "updateReading", entry: tampered }),
  "冻结",
  "冻结后不能改写读数"
);

// 4. 不能新增、删除
throws(
  () =>
    reducer(s, {
      type: "addReading",
      entry: { ...entry, id: "new-one", rpm: "1" },
    }),
  "冻结",
  "冻结后不能新增读数"
);
throws(() => reducer(s, { type: "deleteReading", id: entry.id }), "冻结", "冻结后不能删除读数");

// 5. 冻结后异常不能清除：updateReading 带 abnormal=false 也被整体拒绝
const abnEntry = s.readings.find((r) => r.shiftId === active.id && r.abnormal)!;
throws(
  () => reducer(s, { type: "updateReading", entry: { ...abnEntry, abnormal: false, closed: false } }),
  "冻结",
  "冻结后不能清除异常标记"
);

// 6. 冻结后仍可追加处理说明，且已有说明不可改
const beforeCount = abnEntry.notes.length;
const s2 = reducer(s, { type: "appendNote", readingId: abnEntry.id, text: "接班后复查正常", closed: false });
const after = s2.readings.find((r) => r.id === abnEntry.id)!;
check("冻结后仍可追加处理说明", after.notes.length === beforeCount + 1);
check("历史说明未被改动", after.notes[0].text === abnEntry.notes[0].text);

// 7. updateReading 不能借表单改写 notes；值班中可改读数但改不了 shiftId
s = reducer(s, { type: "addShift", id: "live-shift", date: "2026-09-20", watch: "12-16" });
const liveNew: ReadingEntry = {
  id: "live-reading",
  shiftId: "live-shift",
  at: "2026-09-20T12:30",
  device: "主机",
  rpm: "85",
  lubePressure: "0.4",
  coolingTemp: "80",
  fuel: "300",
  abnormal: false,
  abnormalDesc: "",
  closed: false,
  notes: [{ id: "n1", at: "2026-09-20T12:31", text: "原始说明" }],
};
s = reducer(s, { type: "addReading", entry: liveNew });
const s3 = reducer(s, {
  type: "updateReading",
  entry: { ...liveNew, shiftId: "other-shift", coolingTemp: "88", notes: [] },
});
const updated = s3.readings.find((r) => r.id === liveNew.id)!;
check("值班中可改读数", updated.coolingTemp === "88");
check("更新读数时班次归属不可变", updated.shiftId === "live-shift");
check(
  "更新读数时 notes 永不随表单改写",
  updated.notes.length === 1 && updated.notes[0].text === "原始说明"
);

// 8. 空说明不能追加
throws(
  () => reducer(s, { type: "appendNote", readingId: liveNew.id, text: "  ", closed: false }),
  "不能为空",
  "空处理说明被拒绝"
);

// 9. 不能重复建同班次
throws(
  () => reducer(s, { type: "addShift", id: "x", date: frozen.date, watch: frozen.watch }),
  "已存在",
  "重复班次被拒绝"
);

// 10. 值班中班次可删除读数，已交接班次不可删除
const sDel = reducer(s, { type: "deleteReading", id: liveNew.id });
check("值班中可删除读数", !sDel.readings.some((r) => r.id === liveNew.id));
throws(() => reducer(s, { type: "deleteReading", id: entry.id }), "冻结", "已交接班次不可删除读数");

if (failures > 0) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log("\n全部不变量验证通过");
