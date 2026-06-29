import { holdingValue, holdingInvested, holdingPL, fmtINR, fmtIDR, fmtPct } from '../lib/utils'

function getThisMonthSpending(state) {
  const now = new Date(), m = now.getMonth(), y = now.getFullYear()
  const EXCLUDE = /^(Investment|Self Transfer)/i
  return (state.expenses || []).filter(e => {
    const d = new Date(e.date)
    return d.getMonth()===m && d.getFullYear()===y && !EXCLUDE.test(e.category||'')
  })
}

export default function Dashboard({ state, setState, showToast }) {
  const holdings = state.holdings || []
  const tv = holdings.filter(h=>h.type!=='loan'&&h.type!=='insurance')
    .reduce((a,h) => a + holdingValue(h, state), 0)
  const ti = holdings.reduce((a,h) => a + holdingInvested(h, state), 0)
  const pl = tv - ti
  const plp = ti > 0 ? pl/ti*100 : 0

  const latest = (state.salarySlips||[]).sort((a,b)=>new Date(b.month)-new Date(a.month))[0]
  const netPay = latest?.net || 0
  const salaryCur = latest?.currency || 'IDR'
  const netPayINR = salaryCur==='IDR' ? netPay/(state.inrIdr||189) : netPay*(state.usdInr||84)

  const spending = getThisMonthSpending(state)
  const totalSpent = spending.reduce((a,e) => a + (
    e.currency==='IDR' ? e.amount/(state.inrIdr||189) : e.amount
  ), 0)
  const saved = Math.max(0, netPayINR - totalSpent)
  const savedPct = netPayINR > 0 ? saved/netPayINR*100 : 0

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Portfolio</span>
        <button className="btn-icon btn" onClick={() => showToast('Refreshing prices...')}>↻</button>
      </div>

      {/* Net Worth */}
      <div className="nw-card">
        <div className="nw-label">Net Worth</div>
        <div className="nw-value">{fmtINR(tv)}</div>
        <div className="nw-sub">
          <div className="nw-sub-item"><span className="nw-sub-label">Assets</span><span className="nw-sub-val">{fmtINR(tv)}</span></div>
          <div className="nw-sub-item"><span className="nw-sub-label">Total P&L</span><span className="nw-sub-val" style={{color: pl>=0?'#86efac':'#fca5a5'}}>{fmtPct(plp)}</span></div>
          {ti>0 && <div className="nw-sub-item"><span className="nw-sub-label">Invested</span><span className="nw-sub-val">{fmtINR(ti)}</span></div>}
        </div>
      </div>

      {/* Money Flow */}
      <div className="flow-row">
        <div className="flow-card">
          <div className="flow-label">Take-Home</div>
          <div className="flow-value">{netPay>0 ? (salaryCur==='IDR'?fmtIDR(netPay):fmtINR(netPay)) : '—'}</div>
          <div className="flow-sub">{latest ? new Date(latest.month+'-01').toLocaleString('en',{month:'short',year:'numeric'}) : 'No salary'}</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-card">
          <div className="flow-label">Spent</div>
          <div className="flow-value" style={{color: totalSpent>0?'var(--red)':undefined}}>{totalSpent>0?fmtINR(totalSpent):'—'}</div>
          <div className="flow-sub">{spending.length>0?spending.length+' txns':'Add expenses'}</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-card" style={{borderColor: totalSpent>0&&netPayINR>0?(savedPct>=30?'var(--green)':savedPct<20?'var(--red)':undefined):undefined}}>
          <div className="flow-label">Saved</div>
          {netPayINR>0 && totalSpent>0
            ? <><div className="flow-value" style={{color:savedPct>=30?'var(--green)':savedPct<20?'var(--red)':'var(--amber)'}}>{fmtINR(saved)}</div>
                <div className="flow-sub" style={{color:savedPct>=30?'var(--green)':'var(--muted)'}}>{savedPct.toFixed(0)}% saved</div></>
            : <><div className="flow-value" style={{color:'var(--muted)'}}>—</div><div className="flow-sub">Add expenses</div></>
          }
        </div>
      </div>

      {/* Portfolio mini */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Portfolio</span>
          <span style={{fontSize:11,color:'var(--muted)'}}>{holdings.length} holdings</span>
        </div>
        <div style={{fontSize:24,fontWeight:700,fontFamily:'var(--font-mono)',marginTop:4}}>{fmtINR(tv)}</div>
        <div style={{fontSize:12,color:pl>=0?'var(--green)':'var(--red)'}}>{pl>=0?'+':''}{fmtINR(pl)} ({fmtPct(plp)})</div>
      </div>

      {/* FX Rates */}
      <div className="card">
        <div className="card-title">FX Rates</div>
        <div style={{fontSize:16,fontWeight:700,fontFamily:'var(--font-mono)'}}>$1 = ₹{(state.usdInr||84).toFixed(2)}</div>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>$1 = Rp{((state.usdInr||84)*(state.inrIdr||189)).toFixed(0)}</div>
        <div style={{fontSize:12,color:'var(--muted)'}}>₹1 = Rp{(state.inrIdr||189).toFixed(2)}</div>
      </div>
    </div>
  )
}
