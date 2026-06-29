import { fmtINR, fmtIDR } from '../lib/utils'

const CAT_COLORS = {
  'Food & Dining':'#f97316','Groceries':'#22c55e','Transport':'#3b82f6',
  'Shopping':'#a855f7','Subscriptions':'#06b6d4','Health & Medical':'#ef4444',
  'Utilities':'#64748b','EMI / Loan':'#f59e0b','Insurance':'#8b5cf6',
  'Self Transfer':'#94a3b8','Investment - FD':'#10b981','Investment - Stocks':'#6366f1',
  'Investment - MF':'#06b6d4','Other':'#94a3b8'
}

const SPENDING_CATS = /^(Investment|Self Transfer)/i

export default function Expenses({ state, setState, showToast }) {
  const now = new Date()
  const allExp = state.expenses || []
  const thisMonth = allExp.filter(e => {
    const d = new Date(e.date)
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  })
  const spending = thisMonth.filter(e => !SPENDING_CATS.test(e.category||''))
  const investments = thisMonth.filter(e => SPENDING_CATS.test(e.category||''))

  const toINR = (e) => e.currency==='IDR' ? e.amount/(state.inrIdr||189) : e.amount

  const totalSpent = spending.reduce((a,e) => a+toINR(e), 0)
  const totalInvested = investments.reduce((a,e) => a+toINR(e), 0)

  // Group by category
  const byCat = {}
  spending.forEach(e => {
    const c = e.category||'Other'
    if (!byCat[c]) byCat[c] = {total:0,items:[]}
    byCat[c].total += toINR(e)
    byCat[c].items.push(e)
  })

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Expenses</span>
        <span style={{fontSize:12,color:'var(--muted)'}}>{now.toLocaleString('en',{month:'long',year:'numeric'})}</span>
      </div>

      {/* Summary */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',fontWeight:700}}>Spent</div>
            <div style={{fontSize:24,fontWeight:700,fontFamily:'var(--font-mono)',color:'var(--red)'}}>{fmtINR(totalSpent)}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>{spending.length} transactions</div>
          </div>
          {totalInvested > 0 && (
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',fontWeight:700}}>Invested/Saved</div>
              <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)',color:'var(--green)'}}>{fmtINR(totalInvested)}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{investments.length} transfers</div>
            </div>
          )}
        </div>
      </div>

      {/* By category */}
      {Object.entries(byCat).sort(([,a],[,b])=>b.total-a.total).map(([cat,{total,items}]) => (
        <div key={cat} className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:10,height:10,borderRadius:3,background:CAT_COLORS[cat]||'#94a3b8'}}/>
              <span style={{fontWeight:600,fontSize:13}}>{cat}</span>
            </div>
            <span style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmtINR(total)}</span>
          </div>
          {items.slice(0,5).map(e => (
            <div key={e.id} className="exp-row">
              <div className="exp-desc">
                <div className="exp-merchant">{e.description}</div>
                <div className="exp-cat">{e.date}</div>
              </div>
              <div className="exp-amt">{e.currency==='IDR'?fmtIDR(e.amount):fmtINR(e.amount)}</div>
            </div>
          ))}
          {items.length>5 && <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>+{items.length-5} more</div>}
        </div>
      ))}

      {/* Investment transfers */}
      {investments.length > 0 && (
        <div className="card">
          <div className="card-title" style={{color:'var(--green)'}}>Investments & Transfers (not counted in spending)</div>
          {investments.map(e => (
            <div key={e.id} className="exp-row">
              <div className="exp-desc">
                <div className="exp-merchant" style={{color:'var(--green)'}}>{e.description}</div>
                <div className="exp-cat">{e.category} · {e.date}</div>
              </div>
              <div className="exp-amt" style={{color:'var(--green)'}}>{fmtINR(toINR(e))}</div>
            </div>
          ))}
        </div>
      )}

      {thisMonth.length === 0 && (
        <div className="card" style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
          <div style={{fontSize:32,marginBottom:8}}>💳</div>
          <div>No expenses this month</div>
          <div style={{fontSize:12,marginTop:4}}>Upload bank statements in Sync</div>
        </div>
      )}
    </div>
  )
}
