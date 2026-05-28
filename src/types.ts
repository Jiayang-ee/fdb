// 基金历史净值数据
export interface FundNavRecord {
  date: string;          // 日期 YYYY-MM-DD
  unit_nav: number;     // 单位净值
  accumulated_nav: number; // 累计净值
  daily_growth_rate: number; // 每日增长率 (小数, 如 0.01 表示 1%)
}

// 基金元信息
export interface FundInfo {
  code: string;         // 基金代码
  name: string;         // 基金名称
  source: string;       // 数据源
  fetched_at: string;   // 抓取时间 ISO8601
  nav_data: FundNavRecord[]; // 历史净值数据
}

// 定投频率
export type InvestFrequency = 'weekly' | 'biweekly' | 'monthly';

// 定投参数
export interface InvestParams {
  fund_code: string;
  amount: number;       // 每期金额
  frequency: InvestFrequency;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
}

// 回测结果 - 单笔交易
export interface InvestTransaction {
  date: string;
  nav: number;
  amount: number;
  shares: number;
  cumulative_shares: number;
  cumulative_invested: number;
}

// 回测结果 - 资产曲线
export interface AssetPoint {
  date: string;
  nav: number;
  total_shares: number;
  total_asset: number;
  cumulative_invested: number;
}

// 回测结果
export interface BacktestResult {
  fund_code: string;
  fund_name: string;
  params: InvestParams;

  // 关键指标
  total_invested: number;      // 累计投入
  final_asset: number;         // 期末资产
  total_return: number;        // 总收益
  return_rate: number;         // 收益率
  max_drawdown: number;        // 最大回撤

  // 交易明细
  transactions: InvestTransaction[];

  // 资产曲线
  asset_curve: AssetPoint[];

  // 净值曲线 (日期 -> 单位净值)
  nav_curve: { date: string; nav: number }[];

  // 收益曲线 (日期 -> 累计收益)
  profit_curve: { date: string; profit: number; return_rate: number }[];
}

// 一次性买入结果
export interface LumpSumResult {
  fund_code: string;
  fund_name: string;
  total_invested: number;
  final_asset: number;
  total_return: number;
  return_rate: number;
  max_drawdown: number;
  asset_curve: AssetPoint[];
}

// 回测对比结果
export interface BacktestComparison {
  invest: BacktestResult;
  lump_sum: LumpSumResult;
  outperformance: number; // 定投相对一次性买入的收益率差异
}

// 基金列表项
export interface FundListItem {
  code: string;
  name: string;
  fetched_at: string | null;
  nav_count: number;
}