import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

export interface FetchFundDataOptions {
  code: string;
  start_date?: string;
  end_date?: string;
  max_retries?: number;
  timeout?: number;
}

export interface FetchResult {
  success: boolean;
  code: string;
  data?: {
    unit_nav: number;
    accumulated_nav: number;
    daily_growth_rate: number;
    date: string;
  }[];
  error?: string;
}

// 天天基金历史净值接口
const EAST_MONEY_API = 'https://fundf10.eastmoney.com/F10DataApi.aspx';

export async function fetchFundNavHistory(options: FetchFundDataOptions): Promise<FetchResult> {
  const { code, start_date, end_date, max_retries = 3, timeout = 10000 } = options;

  const allData: { date: string; unit_nav: number; accumulated_nav: number; daily_growth_rate: number }[] = [];
  let page = 1;
  const per = 20;

  while (true) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < max_retries; attempt++) {
      try {
        const params = new URLSearchParams({
          type: 'lsjz',
          code: code,
          page: page.toString(),
          per: per.toString(),
          ...(start_date && { sdate: start_date }),
          ...(end_date && { edate: end_date }),
        });

        // 创建独立的 agent 避免 Express 连接池问题
        const agent = new https.Agent({
          keepAlive: false,
          maxSockets: 1,
        });

        const response = await axios.get(`${EAST_MONEY_API}?${params.toString()}`, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          httpAgent: agent,
          httpsAgent: agent,
        });

        agent.destroy(); // 请求完成后销毁 agent

        const html = response.data as string;
        const $ = cheerio.load(html);

        const rows = $('tbody tr');
        if (rows.length === 0) {
          // 没有更多数据或解析失败
          if (page === 1) {
            return {
              success: false,
              code,
              error: '无法解析数据或无数据返回',
            };
          }
          return {
            success: true,
            code,
            data: allData,
          };
        }

        rows.each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 4) {
            const date = $(cells[0]).text().trim();
            const unit_nav = parseFloat($(cells[1]).text().trim());
            const accumulated_nav = parseFloat($(cells[2]).text().trim());
            const daily_growth_rate = parseFloat($(cells[3]).text().trim().replace('%', '')) / 100;

            if (date && !isNaN(unit_nav) && !isNaN(accumulated_nav) && !isNaN(daily_growth_rate)) {
              allData.push({
                date,
                unit_nav,
                accumulated_nav,
                daily_growth_rate,
              });
            }
          }
        });

        // 解析分页信息
        const pageMatch = html.match(/pages:(\d+)/);
        const curMatch = html.match(/curpage:(\d+)/);
        const totalPages = pageMatch ? parseInt(pageMatch[1], 10) : 1;
        const currentPage = curMatch ? parseInt(curMatch[1], 10) : 1;
        const hasNextPage = currentPage < totalPages;

        if (!hasNextPage || allData.length === 0) {
          return {
            success: true,
            code,
            data: allData,
          };
        }

        page++;
        break; // 成功则跳出重试循环
      } catch (e) {
        lastError = e as Error;
      }
    }

    if (lastError) {
      return {
        success: false,
        code,
        error: `获取失败: ${lastError.message}`,
      };
    }
  }
}