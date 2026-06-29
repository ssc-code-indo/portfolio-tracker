import { holdingValue, holdingInvested, holdingPL, holdingPLPct, fmtINR, fmtPct, uuid } from '../lib/utils'

const COLORS = ['#16a34a','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#65a30d']

export default function Portfolio({ state, setState, showToast }) {
  const holdings = state.holdings || []

  // Group by type
  const groups = {}
  holdings.forEach(h => {
    if (h.type === 'loan' || h.type === 'insurance') return
    const g = h.type === 'mf' ? 'Mutual Funds' : h.market === 'US' ? 'US Stocks' : h.type === 'equity' ? 'Indian Stocks' : h.type === 'gold' ? 'Gold' : h.type === 'fd' ? 'Fixed Deposits' : 'Bank'
    if (!groups[g]) groups[g] = []
    groups[g].push(h)
  })

  const total = holdings.filter(h=>h.type!=='loan'&&h.type!=='insurance').reduce((a,h)=>a+holdingValue(h,state),0)

  // Allocation
  const typeTotal = {}
  holdings.forEach(h => {
    if (h.type==='loan'||h.type==='insurance') return
    const k = h.type==='mf'?'MF':h.market==='US'?'US Equity':h.type==='equity'?'IN Equity':h.type
    typeTotal[k] = (typeTotal[k]||0) + holdingValue(h,state)
  })

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Portfolio</span>
        <span style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmtINR(total)}</span>
      </div>

      {/* Allocation bar */}
      {total > 0 && (
        <div className="card">
          <div className="card-title">Allocation</div>
          <div className="alloc-bar">
            {Object.entries(typeTotal).map(([k,v],i) => (
              <div key={k} className="alloc-segment" style={{width:`${v/total*100}%`,background:COLORS[i%COLORS.length]}}/>
            ))}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px 14px',marginTop:6}}>
            {Object.entries(typeTotal).map(([k,v],i) => (
              <div key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}>
                <div style={{width:8,height:8,borderRadius:2,background:COLORS[i%COLORS.length]}}/>
                <span>{k} {(v/total*100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings by group */}
      {Object.entries(groups).map(([gName, gHoldings]) => {
        const gTotal = gHoldings.reduce((a,h)=>a+holdingValue(h,state),0)
        const gInvested = gHoldings.reduce((a,h)=>a+holdingInvested(h,state),0)
        const gPL = gTotal - gInvested
        const gPLp = gInvested>0 ? gPL/gInvested*100 : 0
        return (
          <div key={gName} className="card">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div>
                <div style={{fontWeight:700}}>{gName}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{gHoldings.length} holdings</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmtINR(gTotal)}</div>
                <div style={{fontSize:11,color:gPL>=0?'var(--green)':'var(--red)'}}>{gPL>=0?'+':''}{fmtINR(gPL)} ({fmtPct(gPLp)})</div>
              </div>
            </div>
            {gHoldings.map(h => {
              const val = holdingValue(h,state)
              const plp = holdingPLPct(h)
              return (
                <div key={h.id} className="holding-row">
                  <div style={{flex:1,minWidth:0}}>
                    <div className="holding-name">{h.name||h.symbol}</div>
                    <div className="holding-sub">{h.quantity?.toLocaleString()} units · avg ₹{h.avgCost?.toFixed(2)} · {h.broker}</div>
                  </div>
                  <div className="holding-right">
                    <div className="holding-val">{fmtINR(val)}</div>
                    <span className={`badge badge-${plp>=0?'gain':'loss'}`}>{plp>=0?'+':''}{plp.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {holdings.length === 0 && (
        <div className="card" style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
          <div style={{fontSize:32,marginBottom:8}}>📊</div>
          <div>No holdings yet</div>
          <div style={{fontSize:12,marginTop:4}}>Go to Sync to import your portfolio</div>
        </div>
      )}
    </div>
  )
}
