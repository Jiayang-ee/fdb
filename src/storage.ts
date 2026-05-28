import * as fs from 'fs';
import * as path from 'path';
import { FundInfo, FundNavRecord } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'funds');

// 基金代码映射
export const FUND_LIST = [
  { code: '110011', name: '易方达中小盘混合' },
  { code: '005827', name: '易方达蓝筹精选混合' },
  { code: '163406', name: '兴全合润混合' },
  { code: '161725', name: '招商中证白酒指数A' },
  { code: '003095', name: '中欧医疗健康混合A' },
  { code: '110003', name: '易方达上证50指数A' },
  { code: '000311', name: '景顺长城沪深300指数增强A' },
  { code: '519674', name: '银河创新成长混合A' },
  { code: '320007', name: '诺安成长混合' },
  { code: '000248', name: '汇添富中证主要消费ETF联接A' },
  { code: '012922', name: '易方达全球成长精选混合(QDII)C(人民币份额)' },
];

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getFundFilePath(code: string): string {
  return path.join(DATA_DIR, `${code}.json`);
}

export function saveFundData(code: string, fundInfo: FundInfo): void {
  ensureDataDir();
  const filePath = getFundFilePath(code);
  fs.writeFileSync(filePath, JSON.stringify(fundInfo, null, 2), 'utf-8');
}

export function loadFundData(code: string): FundInfo | null {
  const filePath = getFundFilePath(code);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as FundInfo;
  } catch {
    return null;
  }
}

export function getAllFundCodes(): string[] {
  return FUND_LIST.map(f => f.code);
}

export function getFundName(code: string): string | null {
  const fund = FUND_LIST.find(f => f.code === code);
  return fund ? fund.name : null;
}

export function listFunds(): { code: string; name: string; fetched_at: string | null; nav_count: number }[] {
  return FUND_LIST.map(f => {
    const fundData = loadFundData(f.code);
    return {
      code: f.code,
      name: f.name,
      fetched_at: fundData?.fetched_at ?? null,
      nav_count: fundData?.nav_data?.length ?? 0,
    };
  });
}

// 获取基金在指定日期范围内的净值数据
export function getNavDataInRange(code: string, start_date: string, end_date: string): FundNavRecord[] | null {
  const fundData = loadFundData(code);
  if (!fundData || !fundData.nav_data) {
    return null;
  }

  return fundData.nav_data.filter(record => {
    return record.date >= start_date && record.date <= end_date;
  });
}

// 检查基金代码是否有效
export function isValidFundCode(code: string): boolean {
  return FUND_LIST.some(f => f.code === code);
}