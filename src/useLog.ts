import { useSyncExternalStore } from "react";
import { getState, subscribe } from "./store";
import { LogState } from "./log";

// 全应用共享同一份本地数据，刷新 / 切换班次 / 跨标签页都保持一致
export function useLogState(): LogState {
  return useSyncExternalStore(subscribe, getState, getState);
}
