# Personal Finance Dashboard

React + Vite PWA for tracking investments across IBKR, Zerodha, Indian MFs, HDFC/HSBC bank.

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:5173/portfolio-tracker/
```

## Deploy

Push to `main` branch → GitHub Actions deploys to GitHub Pages automatically.

## File Uploads Supported

| File | Source |
|------|--------|
| CAMS CAS PDF | camsrepository.com → Detailed Statement |
| Zerodha Holdings CSV | console.zerodha.com → Portfolio → Download |
| Zerodha P&L XLSX | console.zerodha.com → Reports → P&L |
| Zerodha Tradebook CSV | console.zerodha.com → Reports → Tradebook |
| IBKR Transaction CSV | IBKR → Activity Statement → Export CSV |
| HDFC Bank PDF | HDFC NetBanking → Statements |
| HSBC Bank PDF | HSBC app → Statements |
