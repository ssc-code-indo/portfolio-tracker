import { fmtIDR, fmtINR, uuid } from '../lib/utils'
import { useState } from 'react'

export default function Salary({ state, setState, showToast }) {
  const slips = (state.salarySlips||[]).sort((a,b)=>new Date(b.month)-new Date(a.month))
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ month:'', gross:'', net:'', tax:'', currency:'IDR' })

  const add = () => {
    if (!form.month || !form.net) return showToast('Month and net pay required','error')
    setState(s => ({ ...s, salarySlips: [...(s.salarySlips||[]), { id:uuid(), ...form, gross:parseFloat(form.gross)||0, net:parseFloat(form.net)||0, tax:parseFloat(form.tax)||0 }] }))
    setShow(false)
    showToast('Salary slip added')
  }

  const fmtSalary = (slip) => slip.currency==='IDR' ? fmtIDR(slip.net) : fmtINR(slip.net)

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Salary</span>
        <button className="btn btn-primary btn-sm" onClick={()=>setShow(s=>!s)}>+ Add</button>
      </div>

      {show && (
        <div className="card">
          <div className="card-title">Add Salary Slip</div>
          <div className="form-group"><label>Month</label><input type="month" value={form.month} onChange={e=>setForm(s=>({...s,month:e.target.value}))}/></div>
          <div className="form-group"><label>Currency</label><select value={form.currency} onChange={e=>setForm(s=>({...s,currency:e.target.value}))}><option>IDR</option><option>INR</option><option>USD</option></select></div>
          <div className="form-group"><label>Gross</label><input type="number" placeholder="0" value={form.gross} onChange={e=>setForm(s=>({...s,gross:e.target.value}))}/></div>
          <div className="form-group"><label>Net (Take-Home)</label><input type="number" placeholder="0" value={form.net} onChange={e=>setForm(s=>({...s,net:e.target.value}))}/></div>
          <div className="form-group"><label>Tax Deducted</label><input type="number" placeholder="0" value={form.tax} onChange={e=>setForm(s=>({...s,tax:e.target.value}))}/></div>
          <button className="btn btn-primary btn-block" onClick={add}>Save Slip</button>
        </div>
      )}

      {slips.map(s => (
        <div key={s.id} className="card">
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:700}}>{new Date(s.month+'-01').toLocaleString('en',{month:'long',year:'numeric'})}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{s.currency}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmtSalary(s)}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>net take-home</div>
            </div>
          </div>
          {s.gross>0 && <div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>Gross: {s.currency==='IDR'?fmtIDR(s.gross):fmtINR(s.gross)} · Tax: {s.currency==='IDR'?fmtIDR(s.tax||0):fmtINR(s.tax||0)}</div>}
        </div>
      ))}

      {slips.length===0 && !show && (
        <div className="card" style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
          <div style={{fontSize:32,marginBottom:8}}>💰</div>
          <div>No salary slips yet</div>
        </div>
      )}
    </div>
  )
}
