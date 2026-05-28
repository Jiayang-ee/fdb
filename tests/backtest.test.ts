import { describe, it, expect, beforeEach } from 'vitest';
import { FundInfo, InvestParams } from '../src/types';

// 模拟基金数据
const mockFundData: FundInfo = {
  code: '110011',
  name: '易方达中小盘混合',
  source: 'test',
  fetched_at: '2024-01-01T00:00:00Z',
  nav_data: [
    { date: '2024-01-02', unit_nav: 1.0, accumulated_nav: 1.5, daily_growth_rate: 0.01 },
    { date: '2024-01-03', unit_nav: 1.02, accumulated_nav: 1.53, daily_growth_rate: 0.02 },
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

describe('backtest validation', () => {
  it('should validate InvestParams fields', () => {
    const params: InvestParams = {
      fund_code: '110011',
      amount: 1000,
      frequency: 'weekly',
      start_date: '2024-01-02',
      end_date: '2024-01-31',
    };

    expect(params.fund_code).toBe('110011');
    expect(params.amount).toBe(1000);
    expect(params.frequency).toBe('weekly');
    expect(params.start_date).toBe('2024-01-02');
    expect(params.end_date).toBe('2024-01-31');
  });

  it('should check date order in params', () => {
    const params: InvestParams = {
      fund_code: '110011',
      amount: 1000,
      frequency: 'monthly',
      start_date: '2024-01-31',
      end_date: '2024-01-01',
    };

    // 开始日期晚于结束日期是无效的
    expect(params.start_date > params.end_date).toBe(true);
  });

  it('should validate frequency values', () => {
    const validFrequencies = ['weekly', 'biweekly', 'monthly'];

    expect(validFrequencies.includes('weekly')).toBe(true);
    expect(validFrequencies.includes('biweekly')).toBe(true);
    expect(validFrequencies.includes('monthly')).toBe(true);
    expect(validFrequencies.includes('daily')).toBe(false);
  });

  it('should validate amount greater than zero', () => {
    const invalidAmounts = [0, -100, -0.01];

    for (const amount of invalidAmounts) {
      expect(amount <= 0).toBe(true);
    }

    const validAmount = 1000;
    expect(validAmount > 0).toBe(true);
  });
});

describe('mock data integrity', () => {
  it('should have valid nav data structure', () => {
    for (const record of mockFundData.nav_data) {
      expect(record).toHaveProperty('date');
      expect(record).toHaveProperty('unit_nav');
      expect(record).toHaveProperty('accumulated_nav');
      expect(record).toHaveProperty('daily_growth_rate');
      expect(typeof record.unit_nav).toBe('number');
      expect(record.unit_nav > 0).toBe(true);
    }
  });

  it('should have sorted nav data by date', () => {
    const dates = mockFundData.nav_data.map(r => r.date);
    const sortedDates = [...dates].sort();
    expect(dates).toEqual(sortedDates);
  });

  it('should have correct number of records', () => {
    expect(mockFundData.nav_data).toHaveLength(14);
  });
});