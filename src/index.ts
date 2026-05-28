import express, { Request, Response } from 'express';
import { fetchFundNavHistory } from './fundFetcher';
import { FUND_LIST, saveFundData, loadFundData, listFunds, getFundName, isValidFundCode } from './storage';
import { runBacktest, runComparison } from './backtest';
import { InvestParams, InvestFrequency, BacktestResult, BacktestComparison } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 错误响应
function errorResponse(res: Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

// GET /api/funds - 基金列表
app.get('/api/funds', (_req: Request, res: Response) => {
  const funds = listFunds();
  res.json({ funds });
});

// GET /api/funds/:code - 单只基金信息
app.get('/api/funds/:code', (req: Request, res: Response) => {
  const { code } = req.params;

  if (!isValidFundCode(code)) {
    return errorResponse(res, 400, `无效的基金代码: ${code}`);
  }

  const fundData = loadFundData(code);
  if (!fundData) {
    return errorResponse(res, 404, `基金 ${code} 暂无数据，请先刷新`);
  }

  res.json({ fund: fundData });
});

// POST /api/funds/:code/refresh - 刷新基金净值数据
app.post('/api/funds/:code/refresh', async (req: Request, res: Response) => {
  const { code } = req.params;
  const { start_date, end_date } = req.body as { start_date?: string; end_date?: string };

  if (!isValidFundCode(code)) {
    return errorResponse(res, 400, `无效的基金代码: ${code}`);
  }

  const fundInfo = FUND_LIST.find(f => f.code === code);
  if (!fundInfo) {
    return errorResponse(res, 404, `基金 ${code} 不在基金池中`);
  }

  // 默认获取近3年数据
  const end = end_date || new Date().toISOString().split('T')[0];
  const start = start_date || new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await fetchFundNavHistory({ code, start_date: start, end_date: end });

  if (!result.success) {
    return errorResponse(res, 500, result.error || '获取数据失败');
  }

  if (!result.data || result.data.length === 0) {
    return errorResponse(res, 404, '无净值数据');
  }

  const fundData = {
    code,
    name: fundInfo.name,
    source: 'eastmoney',
    fetched_at: new Date().toISOString(),
    nav_data: result.data,
  };

  saveFundData(code, fundData);

  res.json({
    success: true,
    fund: fundData,
    nav_count: result.data.length,
  });
});

// POST /api/funds/refresh-all - 刷新所有基金数据
app.post('/api/funds/refresh-all', async (_req: Request, res: Response) => {
  const results: { code: string; name: string; success: boolean; nav_count?: number; error?: string }[] = [];

  for (const fund of FUND_LIST) {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await fetchFundNavHistory({ code: fund.code, start_date: start, end_date: end });

    if (result.success && result.data && result.data.length > 0) {
      const fundData = {
        code: fund.code,
        name: fund.name,
        source: 'eastmoney',
        fetched_at: new Date().toISOString(),
        nav_data: result.data,
      };
      saveFundData(fund.code, fundData);
      results.push({ code: fund.code, name: fund.name, success: true, nav_count: result.data.length });
    } else {
      results.push({ code: fund.code, name: fund.name, success: false, error: result.error });
    }
  }

  const successCount = results.filter(r => r.success).length;
  res.json({ total: results.length, success: successCount, failed: results.length - successCount, results });
});

// POST /api/backtest - 执行回测
app.post('/api/backtest', (req: Request, res: Response) => {
  const { fund_code, amount, frequency, start_date, end_date } = req.body as {
    fund_code: string;
    amount: number;
    frequency: InvestFrequency;
    start_date: string;
    end_date: string;
  };

  // 参数校验
  if (!fund_code) {
    return errorResponse(res, 400, '缺少基金代码');
  }

  if (!isValidFundCode(fund_code)) {
    return errorResponse(res, 400, `无效的基金代码: ${fund_code}`);
  }

  if (!amount || amount <= 0) {
    return errorResponse(res, 400, '金额必须大于0');
  }

  if (!frequency || !['weekly', 'biweekly', 'monthly'].includes(frequency)) {
    return errorResponse(res, 400, '频率必须是 weekly、biweekly 或 monthly');
  }

  if (!start_date || !end_date) {
    return errorResponse(res, 400, '缺少开始或结束日期');
  }

  if (start_date > end_date) {
    return errorResponse(res, 400, '开始日期不能晚于结束日期');
  }

  // 检查基金数据
  const fundData = loadFundData(fund_code);
  if (!fundData || !fundData.nav_data || fundData.nav_data.length === 0) {
    return errorResponse(res, 404, `基金 ${fund_code} 暂无数据，请先刷新`);
  }

  // 检查日期范围内是否有数据
  const hasDataInRange = fundData.nav_data.some(n => n.date >= start_date && n.date <= end_date);
  if (!hasDataInRange) {
    return errorResponse(res, 400, `基金 ${fund_code} 在指定日期范围内无净值数据`);
  }

  const params: InvestParams = { fund_code, amount, frequency, start_date, end_date };

  const result = runComparison(params);

  if (!result) {
    return errorResponse(res, 500, '回测计算失败');
  }

  res.json({ result });
});

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`基金定投回测服务运行在 http://localhost:${PORT}`);
});