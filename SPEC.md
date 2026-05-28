# 基金定投回测 Web 工具 — 前端规格

## 1. Concept & Vision

一个专业的基金定投回测分析工具，帮助用户在简洁的界面上比较定投与一次性买入两种策略的历史表现。界面传达 **专业、信赖、清晰** 的气质——不是花哨的营销页，而是让数据说话的精密仪表盘。配色灵感来自晚间台北交易所屏幕：深沉底色上跳动的金色与青色数字。

## 2. Design Language

### Aesthetic
**Dark Financial Terminal** — 深色背景配金色/青色高亮，类 Bloomberg/TradingView 风格，但更温暖现代。等宽数字字体强化数据感。

### Color Palette
```css
--bg-base: #0d1117;
--bg-surface: #161b22;
--bg-elevated: #21262d;
--border: #30363d;
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--text-muted: #6e7681;
--accent-gold: #f0b429;
--accent-gold-dim: #d69e2e;
--accent-teal: #2dd4bf;
--accent-teal-dim: #14b8a6;
--positive: #3fb950;
--negative: #f85149;
--chart-blue: #58a6ff;
--chart-purple: #a371f7;
```

### Typography
- **Display / Headings**: `DM Serif Display` — 衬线字体传达权威与历史感
- **Body / Labels**: `IBM Plex Sans` — 现代、清晰、专业
- **Numbers / Data**: `IBM Plex Mono` — 等宽，数据对齐，数字感

### Spatial System
- Base unit: 8px
- Content max-width: 1200px
- Form/Chart split: 360px form | flex chart area
- Cards: 16px padding, 8px radius, 1px border

### Motion
- Entrance: fade + translateY(12px), 300ms ease-out, staggered 60ms
- Hover: scale(1.01) + border-color shift, 150ms
- Charts: draw animation 800ms ease-out
- Loading: pulse skeleton

### Visual Assets
- Icons: Lucide (via CDN)
- Charts: Chart.js with custom theme
- Decorative: subtle grid lines, noise texture overlay

## 3. Layout & Structure

### Page Architecture
```
┌─────────────────────────────────────────────────────┐
│  Header: Logo + Title + Subtitle                     │
├──────────────────┬──────────────────────────────────┤
│  Parameter Form  │  Metrics Panel                    │
│  (sticky sidebar)│  (6-card grid)                    │
│                  ├──────────────────────────────────┤
│                  │  Chart Area (tabbed)              │
│                  │  [资产曲线] [净值曲线] [收益曲线]  │
│                  │                                    │
│                  │  <canvas>                         │
└──────────────────┴──────────────────────────────────┘
```

### Responsive
- Desktop (≥1024px): side-by-side form + content
- Tablet/Mobile (<1024px): form above content, full width stacked

## 4. Features & Interactions

### Fund Selector
- Dropdown showing fund code + name
- 11 fixed funds as specified
- Hover: subtle gold border

### Parameter Form
- **定投金额**: number input, ¥ prefix, min 100, max 10,000,000
- **定投频率**: radio group — 每周 / 每两周 / 每月
- **开始日期**: date picker, default 3 years ago
- **结束日期**: date picker, default today
- **回测按钮**: primary CTA, disabled during loading
- Validation: inline error below each field on blur

### Metrics Panel (6 cards in 2×3 grid)
| Metric | Description |
|--------|-------------|
| 累计投入 | 定投总投入金额 |
| 期末资产 (定投) | 定投策略最终资产 |
| 总收益 (定投) | 定投绝对收益金额 |
| 定投收益率 | 定投 IRR 收益率 |
| 最大回撤 (定投) | 定投最大回撤 |
| 一次性买入对比 | 期末资产 / 收益率 / 最大回撤 |

Each metric card:
- Large number (mono font)
- Small label below
- Positive values in green, negative in red
- Loading: skeleton pulse

### Charts (tabbed, 3 tabs)
1. **资产曲线**: 定投资产 (gold) + 一次性买入资产 (teal) over time
2. **净值曲线**: 基金净值 (blue) over time
3. **收益曲线**: 收益金额 (gold) + 收益率 (purple) over time

Each chart:
- Legend on top
- Tooltip on hover with date + value
- Empty state: "请先发起回测" centered message

### States
- **Loading**: skeleton pulses on cards, spinner on button
- **No Data**: empty state illustration + message
- **Network/Calc Error**: error banner with message + retry button
- **Parameter Error**: inline field errors, form-level message

## 5. Component Inventory

### `<FundSelect>`
- Default: closed dropdown, placeholder "选择基金"
- Open: scrollable list with 11 funds
- Hover item: gold left border
- Selected: checkmark icon

### `<NumberInput>`
- Default: outlined, placeholder
- Focus: gold border glow
- Error: red border + error text below
- Prefix: ¥ symbol inside

### `<RadioGroup>`
- Default: outlined pills
- Selected: gold background, dark text
- Hover: elevated background

### `<DatePicker>`
- Native date input styled to match theme

### `<MetricCard>`
- States: default, loading (skeleton), positive (green number), negative (red number)

### `<TabBar>`
- Active tab: gold underline + text
- Inactive: muted text
- Hover: text brightens

### `<ChartCanvas>`
- States: empty (centered message), loading (spinner), rendered

### `<ErrorBanner>`
- Red left border
- Error icon + message + retry button

### `<LoadingSkeleton>`
- Animated pulse rectangles matching card layout

## 6. Technical Approach

### Stack
- Single HTML file with embedded CSS/JS
- Chart.js 4.x via CDN for charts
- Lucide icons via CDN
- No build step required

### Mock API
Since backend is not ready, implement local mock that:
- Accepts same params as planned API
- Returns realistic mock data with 300ms simulated delay
- Generates plausible NAV series, investment amounts, returns

### API Contract (to be confirmed with backend)
```typescript
// GET /api/funds → Fund[]
interface Fund { code: string; name: string }

// POST /api/backtest
// Body: { fundCode, amount, frequency, startDate, endDate }
// Response: BacktestResult
interface BacktestResult {
  fundCode: string;
  cumulativeInvestment: number;
  dcaEndingAssets: number;
  dcaTotalReturn: number;
  dcaReturnRate: number;
  dcaMaxDrawdown: number;
  lumpSumEndingAssets: number;
  lumpSumReturnRate: number;
  lumpSumMaxDrawdown: number;
  assetCurve: Array<{ date: string; dca: number; lumpSum: number }>;
  navCurve: Array<{ date: string; nav: number }>;
  returnCurve: Array<{ date: string; return: number; returnRate: number }>;
}
```

### State Management
- Simple vanilla JS state object
- Render functions per component
- Event delegation on form container