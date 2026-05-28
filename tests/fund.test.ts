import { describe, it, expect } from 'vitest';
import { fetchFundNavHistory } from '../src/fundFetcher';
import { FUND_LIST, getFundName, isValidFundCode, getAllFundCodes } from '../src/storage';

describe('storage', () => {
  it('should have correct fund list', () => {
    expect(FUND_LIST).toHaveLength(11);
    expect(getAllFundCodes()).toHaveLength(11);
  });

  it('should return fund name for valid code', () => {
    expect(getFundName('110011')).toBe('易方达中小盘混合');
    expect(getFundName('005827')).toBe('易方达蓝筹精选混合');
  });

  it('should return null for invalid fund code', () => {
    expect(getFundName('999999')).toBeNull();
  });

  it('should validate fund codes correctly', () => {
    expect(isValidFundCode('110011')).toBe(true);
    expect(isValidFundCode('005827')).toBe(true);
    expect(isValidFundCode('000000')).toBe(false);
    expect(isValidFundCode('invalid')).toBe(false);
  });
});