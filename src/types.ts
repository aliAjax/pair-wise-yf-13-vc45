/** 轮机值班台账数据模型——仅存储于浏览器 localStorage */

/** 异常处理说明（一旦追加即不可修改、不可删除） */
export interface HandlingNote {
  id: string;
  at: string; // ISO 时间
  text: string;
}

/** 一条班次参数读数记录 */
export interface ReadingEntry {
  id: string;
  shiftId: string;
  at: string; // 读数时间（ISO）
  device: string; // 设备：主机 / 发电机#1 ...
  rpm: string; // 主机转速 rpm
  lubePressure: string; // 滑油压力 MPa
  coolingTemp: string; // 冷却水温 °C
  fuel: string; // 燃油读数 m³
  abnormal: boolean; // 是否异常
  abnormalDesc: string; // 异常描述
  closed: boolean; // 异常是否已闭环
  notes: HandlingNote[]; // 处理说明（只追加）
}

/** 值班班次 */
export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  watch: string; // 08-12
  createdAt: string;
  handoverNote: string; // 交接备注
  handedOver: boolean; // 是否已完成交接（冻结）
  handedOverAt: string | null;
}

export interface LedgerState {
  version: 1;
  shifts: Shift[];
  readings: ReadingEntry[];
}
