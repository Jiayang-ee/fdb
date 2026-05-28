import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import axios from 'axios';
import { FundInfo, InvestParams } from '../src/types';
import { saveFundData, loadFundData, listFunds, getFundName, isValidFundCode } from '../src/storage';
import { runBacktest, runComparison } from '../src/backtest';
import * as fs from 'fs';
import * as path from 'path';

// Test fund data - 14 days of known NAV values
const mockFundData: FundInfo = {
  code: '110011',
  name: '易方达中小盘混合',
  source: 'test',
  fetched_at: '2024-01-01T00:00:00Z',
  nav_data: [
    { date: '2024-01-02', unit_nav: 1.00, accumulated_nav: 1.50, daily_growth_rate: 0.010 },
    { date: '2024-01-03', unit_nav: 1.02, accumulated_nav: 1.53, daily_growth_rate: 0.020 },
    { date: '2024-01-04', unit_nav: 1.05, accumulated_nav: 1.575, daily_growth_rate: 0.0294 },
    { date: '2024-01-05', unit_nav: 1.03, accumulated_nav: 1.545, daily_growth_rate: -0.019 },
    { date: '2024-01-08', unit_nav: 1.08, accumulated_nav: 1.62, daily_growth_rate: 0.0485 },
    { date: '2024-01-09', unit_nav: 1.10, accumulated_nav: 1.65, daily_growth_rate: 0.0185 },
    { date: '2024-01-10', unit_nav: 1.12, accumulated_nav: 1.68, daily_growth_rate: 0.0182 },
    { date: '2024-01-11', unit_nav: 1.08, accumulated_nav: 1.62, daily_growth_rate: -0.0357 },
    { date: '2024-01-12', unit_nav: 1.05, accumulated_nav: 1.575, daily_growth_rate: -0.0278 },
    { date: '2024-01-15', unit_nav: 1.10, accumulated_nav: 1.65, daily_growth_rate: 0.0476 },
    { date: '2024-01-16', unit_nav: 1.15, accumulated_nav: 1.725, daily_growth_rate: 0.0455 },
    { date: '2024-01-17', unit_nav: 1.12, accumulated_nav: 1.68, daily_growth_rate: -0.0261 },
    { date: '2024-01-18', unit_nav: 1.08, accumulated_nav: 1.62, daily_growth_rate: -0.0357 },
    { date: '2024-01-19', unit_nav: 1.05, accumulated_nav: 1.575, daily_growth_rate: -0.0278 },
  ],
};

const DATA_DIR = path.join(process.cwd(), 'data', 'funds');

function clearTestFundData(code: string): void {
  const filePath = path.join(DATA_DIR, `${code}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

let app: Express;
let server: any;

beforeAll(() => {
  // Clear and save test data
  clearTestFundData('110011');
  saveFundData('110011', mockFundData);

  // Create Express app for testing
  app = express();
  app.use(express.json());

  // GET /api/funds
  app.get('/api/funds', (_req, res) => {
    const funds = listFunds();
    res.json({ funds });
  });

  // GET /api/funds/:code
  app.get('/api/funds/:code', (req, res) => {
    const { code } = req.params;
    if (!isValidFundCode(code)) {
      return res.status(400).json({ error: `无效的基金代码: ${code}` });
    }
    const fundData = loadFundData(code);
    if (!fundData) {
      return res.status(404).json({ error: `基金 ${code} 暂无数据，请先刷新` });
    }
    res.json({ fund: fundData });
  });

  // POST /api/backtest
  app.post('/api/backtest', (req, res) => {
    const { fund_code, amount, frequency, start_date, end_date } = req.body;

    if (!fund_code) {
      return res.status(400).json({ error: '缺少基金代码' });
    }
    if (!isValidFundCode(fund_code)) {
      return res.status(400).json({ error: `无效的基金代码: ${fund_code}` });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '金额必须大于0' });
    }
    if (!frequency || !['weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: '频率必须是 weekly、biweekly 或 monthly' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '缺少开始或结束日期' });
    }
    if (start_date > end_date) {
      return res.status(400).json({ error: '开始日期不能晚于结束日期' });
    }

    const fundData = loadFundData(fund_code);
    if (!fundData || !fundData.nav_data || fundData.nav_data.length === 0) {
      return res.status(404).json({ error: `基金 ${fund_code} 暂无数据，请先刷新` });
    }

    const hasDataInRange = fundData.nav_data.some(n => n.date >= start_date && n.date <= end_date);
    if (!hasDataInRange) {
      return res.status(400).json({ error: `基金 ${fund_code} 在指定日期范围内无净值数据` });
    }

    const params: InvestParams = { fund_code, amount, frequency, start_date, end_date };
    const result = runComparison(params);
    if (!result) {
      return res.status(500).json({ error: '回测计算失败' });
    }
    res.json({ result });
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  server = app.listen(3001);
});

afterAll(() => {
  if (server) server.close();
});

beforeEach(() => {
  clearTestFundData('110011');
  saveFundData('110011', mockFundData);
});

const BASE_URL = 'http://localhost:3001';

describe('API: GET /api/funds', () => {
  it('should return list of all 11 funds', async () => {
    const response = await axios.get(`${BASE_URL}/api/funds`);
    expect(response.status).toBe(200);
    expect(response.data.funds).toHaveLength(11);
    expect(response.data.funds[0]).toHaveProperty('code');
    expect(response.data.funds[0]).toHaveProperty('name');
  });
});

describe('API: GET /api/funds/:code', () => {
  it('should return fund data for valid code with data', async () => {
    const response = await axios.get(`${BASE_URL}/api/funds/110011`);
    expect(response.status).toBe(200);
    expect(response.data.fund).toHaveProperty('code', '110011');
    expect(response.data.fund).toHaveProperty('nav_data');
    expect(response.data.fund.nav_data.length).toBeGreaterThan(0);
  });

  it('should return 404 for fund without data', async () => {
    clearTestFundData('110011');
    try {
      await axios.get(`${BASE_URL}/api/funds/110011`);
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(404);
    }
  });

  it('should return 400 for invalid fund code', async () => {
    try {
      await axios.get(`${BASE_URL}/api/funds/000000`);
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
    }
  });
});

describe('API: POST /api/backtest - parameter validation', () => {
  it('should reject missing fund_code', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { amount: 1000, frequency: 'weekly', start_date: '2024-01-01', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('缺少基金代码');
    }
  });

  it('should reject invalid fund_code', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '000000', amount: 1000, frequency: 'weekly', start_date: '2024-01-01', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('无效的基金代码');
    }
  });

  it('should reject amount <= 0', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: 0, frequency: 'weekly', start_date: '2024-01-01', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('金额必须大于0');
    }
  });

  it('should reject negative amount', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: -100, frequency: 'weekly', start_date: '2024-01-01', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('金额必须大于0');
    }
  });

  it('should reject invalid frequency', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: 1000, frequency: 'daily', start_date: '2024-01-01', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('频率必须是');
    }
  });

  it('should reject missing start_date', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: 1000, frequency: 'weekly', end_date: '2024-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('缺少开始或结束日期');
    }
  });

  it('should reject start_date after end_date', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: 1000, frequency: 'weekly', start_date: '2024-01-31', end_date: '2024-01-01' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('开始日期不能晚于结束日期');
    }
  });

  it('should reject when no data in date range', async () => {
    try {
      await axios.post(`${BASE_URL}/api/backtest`, { fund_code: '110011', amount: 1000, frequency: 'weekly', start_date: '2023-01-01', end_date: '2023-01-31' });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.response.status).toBe(400);
      expect(e.response.data.error).toContain('在指定日期范围内无净值数据');
    }
  });
});

describe('API: POST /api/backtest - calculation logic', () => {
  it('should return valid backtest result with correct structure', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    expect(response.status).toBe(200);
    const { result } = response.data;

    expect(result).toHaveProperty('invest');
    expect(result).toHaveProperty('lump_sum');
    expect(result).toHaveProperty('outperformance');

    const { invest, lump_sum } = result;
    expect(invest).toHaveProperty('fund_code', '110011');
    expect(invest).toHaveProperty('total_invested');
    expect(invest).toHaveProperty('final_asset');
    expect(invest).toHaveProperty('total_return');
    expect(invest).toHaveProperty('return_rate');
    expect(invest).toHaveProperty('max_drawdown');
    expect(invest).toHaveProperty('transactions');
    expect(invest).toHaveProperty('asset_curve');
    expect(invest).toHaveProperty('nav_curve');
    expect(invest).toHaveProperty('profit_curve');

    expect(lump_sum).toHaveProperty('fund_code', '110011');
    expect(lump_sum).toHaveProperty('total_invested');
    expect(lump_sum).toHaveProperty('final_asset');
    expect(lump_sum).toHaveProperty('return_rate');
    expect(lump_sum).toHaveProperty('asset_curve');

    expect(lump_sum.total_invested).toBe(invest.total_invested);
  });

  it('should calculate weekly investment with correct transaction count', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-02',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest } = result;

    expect(invest.transactions.length).toBeGreaterThanOrEqual(3);
    expect(invest.transactions.length).toBeLessThanOrEqual(6);

    for (const tx of invest.transactions) {
      expect(tx).toHaveProperty('date');
      expect(tx).toHaveProperty('nav');
      expect(tx).toHaveProperty('amount', 1000);
      expect(tx).toHaveProperty('shares');
      expect(tx).toHaveProperty('cumulative_shares');
      expect(tx).toHaveProperty('cumulative_invested');
    }

    expect(invest.total_invested).toBe(invest.transactions[invest.transactions.length - 1].cumulative_invested);
  });

  it('should calculate monthly investment correctly', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 500,
      frequency: 'monthly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest } = result;

    expect(invest.transactions.length).toBeGreaterThanOrEqual(1);
    expect(invest.transactions.length).toBeLessThanOrEqual(2);
  });

  it('should calculate max_drawdown between 0 and 1', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest, lump_sum } = result;

    expect(invest.max_drawdown).toBeGreaterThanOrEqual(0);
    expect(invest.max_drawdown).toBeLessThanOrEqual(1);
    expect(lump_sum.max_drawdown).toBeGreaterThanOrEqual(0);
    expect(lump_sum.max_drawdown).toBeLessThanOrEqual(1);
  });

  it('should validate asset curve: total_asset = total_shares * nav', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest } = result;

    for (const point of invest.asset_curve) {
      const calculatedAsset = point.total_shares * point.nav;
      expect(Math.abs(point.total_asset - calculatedAsset)).toBeLessThan(0.01);
    }
  });

  it('should validate profit curve: profit = total_asset - cumulative_invested', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest } = result;

    for (const point of invest.profit_curve) {
      const matchingAsset = invest.asset_curve.find(a => a.date === point.date);
      if (matchingAsset) {
        const expectedProfit = matchingAsset.total_asset - matchingAsset.cumulative_invested;
        expect(point.profit).toBeCloseTo(expectedProfit, 2);
      }
    }
  });

  it('should have outperformance = invest.return_rate - lump_sum.return_rate', async () => {
    const response = await axios.post(`${BASE_URL}/api/backtest`, {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    const { result } = response.data;
    const { invest, lump_sum, outperformance } = result;

    const expectedOutperformance = invest.return_rate - lump_sum.return_rate;
    expect(outperformance).toBeCloseTo(expectedOutperformance, 10);
  });
});

describe('API: health check', () => {
  it('should return ok status', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'ok');
    expect(response.data).toHaveProperty('timestamp');
  });
});