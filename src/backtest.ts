import {
  InvestParams,
  InvestFrequency,
  BacktestResult,
  InvestTransaction,
  AssetPoint,
  LumpSumResult,
  BacktestComparison,
} from './types';
import { loadFundData, getFundName } from './storage';

// 添加天数
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// 获取下一个交易日 (即有净值数据的日期)
function getNextTradingDay(dates: string[], fromDate: string): string | null {
  for (const date of dates) {
    if (date >= fromDate) {
      return date;
    }
  }
  return null;
}

// 计算定投日期
function generateInvestDates(start_date: string, end_date: string, frequency: InvestFrequency): string[] {
  const dates: string[] = [];
  let currentDate = start_date;

  // 找到第一个有净值的交易日
  const allDates = getAllDatesInRange(start_date, end_date);

  while (currentDate <= end_date) {
    const nextTradingDay = getNextTradingDay(allDates, currentDate);
    if (nextTradingDay && nextTradingDay <= end_date) {
      dates.push(nextTradingDay);
    }

    // 计算下一个定投日期
    switch (frequency) {
      case 'weekly':
        currentDate = addDays(currentDate, 7);
        break;
      case 'biweekly':
        currentDate = addDays(currentDate, 14);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
    }
  }

  return dates;
}

// 获取日期范围内的所有日期
function getAllDatesInRange(start_date: string, end_date: string): string[] {
  const dates: string[] = [];
  let current = new Date(start_date);
  const end = new Date(end_date);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// 添加月份
function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

// 计算最大回撤
function calculateMaxDrawdown(assetCurve: AssetPoint[]): number {
  let maxDrawdown = 0;
  let peak = assetCurve[0]?.total_asset ?? 0;

  for (const point of assetCurve) {
    if (point.total_asset > peak) {
      peak = point.total_asset;
    }
    const drawdown = (peak - point.total_asset) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// 计算净值曲线
function buildNavCurve(navRecords: { date: string; unit_nav: number }[]): { date: string; nav: number }[] {
  return navRecords.map(r => ({ date: r.date, nav: r.unit_nav }));
}

// 计算收益曲线
function buildProfitCurve(
  assetCurve: AssetPoint[],
): { date: string; profit: number; return_rate: number }[] {
  return assetCurve.map(point => ({
    date: point.date,
    profit: point.total_asset - point.cumulative_invested,
    return_rate: point.cumulative_invested > 0
      ? (point.total_asset - point.cumulative_invested) / point.cumulative_invested
      : 0,
  }));
}

// 执行回测
export function runBacktest(params: InvestParams): BacktestResult | null {
  const fundData = loadFundData(params.fund_code);
  if (!fundData || !fundData.nav_data || fundData.nav_data.length === 0) {
    return null;
  }

  const fundName = getFundName(params.fund_code) ?? params.fund_code;
  const navData = fundData.nav_data;

  // 按日期排序
  navData.sort((a, b) => a.date.localeCompare(b.date));

  // 生成定投日期
  const investDates = generateInvestDates(params.start_date, params.end_date, params.frequency);

  // 交易记录
  const transactions: InvestTransaction[] = [];
  let cumulativeShares = 0;
  let cumulativeInvested = 0;

  // 按日期处理每笔定投
  for (const investDate of investDates) {
    // 找到该日期或之后最近的有净值日
    const navRecord = navData.find(r => r.date >= investDate);
    if (!navRecord) continue;

    const shares = params.amount / navRecord.unit_nav;
    cumulativeShares += shares;
    cumulativeInvested += params.amount;

    transactions.push({
      date: navRecord.date,
      nav: navRecord.unit_nav,
      amount: params.amount,
      shares,
      cumulative_shares: cumulativeShares,
      cumulative_invested: cumulativeInvested,
    });
  }

  // 构建资产曲线
  const assetCurveMap = new Map<string, AssetPoint>();

  // 初始化：期初资产
  const startNav = navData.find(r => r.date >= params.start_date);
  if (startNav) {
    assetCurveMap.set(startNav.date, {
      date: startNav.date,
      nav: startNav.unit_nav,
      total_shares: 0,
      total_asset: 0,
      cumulative_invested: 0,
    });
  }

  // 逐日更新资产曲线
  let currentShares = 0;
  let currentInvested = 0;

  for (const nav of navData) {
    // 计算到该日为止的总份额（定投）
    const txAtOrBefore = transactions.filter(t => t.date <= nav.date);
    currentShares = txAtOrBefore.length > 0
      ? txAtOrBefore[txAtOrBefore.length - 1].cumulative_shares
      : 0;
    currentInvested = txAtOrBefore.length > 0
      ? txAtOrBefore[txAtOrBefore.length - 1].cumulative_invested
      : 0;

    if (nav.date >= params.start_date && nav.date <= params.end_date) {
      assetCurveMap.set(nav.date, {
        date: nav.date,
        nav: nav.unit_nav,
        total_shares: currentShares,
        total_asset: currentShares * nav.unit_nav,
        cumulative_invested: currentInvested,
      });
    }
  }

  const assetCurve = Array.from(assetCurveMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 净值曲线
  const navCurve = buildNavCurve(navData.filter(n => n.date >= params.start_date && n.date <= params.end_date));

  // 收益曲线
  const profitCurve = buildProfitCurve(assetCurve);

  // 期末资产
  const lastAssetPoint = assetCurve[assetCurve.length - 1];
  const finalAsset = lastAssetPoint ? lastAssetPoint.total_asset : 0;

  // 最大回撤
  const maxDrawdown = calculateMaxDrawdown(assetCurve);

  return {
    fund_code: params.fund_code,
    fund_name: fundName,
    params,
    total_invested: cumulativeInvested,
    final_asset: finalAsset,
    total_return: finalAsset - cumulativeInvested,
    return_rate: cumulativeInvested > 0 ? (finalAsset - cumulativeInvested) / cumulativeInvested : 0,
    max_drawdown: maxDrawdown,
    transactions,
    asset_curve: assetCurve,
    nav_curve: navCurve,
    profit_curve: profitCurve,
  };
}

// 执行一次性买入回测
export function runLumpSumBacktest(
  fund_code: string,
  total_amount: number,
  start_date: string,
  end_date: string,
): LumpSumResult | null {
  const fundData = loadFundData(fund_code);
  if (!fundData || !fundData.nav_data || fundData.nav_data.length === 0) {
    return null;
  }

  const fundName = getFundName(fund_code) ?? fund_code;
  const navData = fundData.nav_data.sort((a, b) => a.date.localeCompare(b.date));

  // 找到开始日或之后第一个交易日
  const startNav = navData.find(r => r.date >= start_date);
  if (!startNav) {
    return null;
  }

  // 一次性买入
  const shares = total_amount / startNav.unit_nav;

  // 构建资产曲线
  const assetCurve: AssetPoint[] = [];

  for (const nav of navData) {
    if (nav.date >= start_date && nav.date <= end_date) {
      assetCurve.push({
        date: nav.date,
        nav: nav.unit_nav,
        total_shares: shares,
        total_asset: shares * nav.unit_nav,
        cumulative_invested: total_amount,
      });
    }
  }

  // 最大回撤
  const maxDrawdown = calculateMaxDrawdown(assetCurve);

  const finalAsset = assetCurve.length > 0 ? assetCurve[assetCurve.length - 1].total_asset : 0;

  return {
    fund_code,
    fund_name: fundName,
    total_invested: total_amount,
    final_asset: finalAsset,
    total_return: finalAsset - total_amount,
    return_rate: total_amount > 0 ? (finalAsset - total_amount) / total_amount : 0,
    max_drawdown: maxDrawdown,
    asset_curve: assetCurve,
  };
}

// 对比回测
export function runComparison(params: InvestParams): BacktestComparison | null {
  const investResult = runBacktest(params);
  if (!investResult) {
    return null;
  }

  const lumpSumResult = runLumpSumBacktest(
    params.fund_code,
    investResult.total_invested,
    params.start_date,
    params.end_date,
  );

  if (!lumpSumResult) {
    return null;
  }

  return {
    invest: investResult,
    lump_sum: lumpSumResult,
    outperformance: investResult.return_rate - lumpSumResult.return_rate,
  };
}