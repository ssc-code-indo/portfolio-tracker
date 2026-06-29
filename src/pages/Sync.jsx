import { useState, useRef } from 'react'
import { parseCASTex } from '../parsers/cas'
import { parseIBKRCsv } from '../parsers/ibkr'
import { parseZerodhaHoldingsCsv, parseZerodhaPnLXlsx, parseZerodhaTradebook } from '../parsers/zerodha'
import { parseBankStatement } from '../parsers/bank'
import { extractPdfTextWithPassword } from '../lib/pdf'
import { uuid, xirr } from '../lib/utils'
import { getState, setState } from '../lib/state'

function UploadSection({ icon, title, subtitle, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      <div className="upload-header" style={{padding:'14px'}} onClick={()=>setOpen(o=>!o)}>
        <span style={{fontSize:20}}>{icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600}}>{title}</div>
          <div style={{fontSize:11,color:'var(--muted)'}}>{subtitle}</div>
        </div>
        <span style={{color:'var(--muted)',transform:open?'rotate(90deg)':'none',transition:'transform 0.2s'}}>›</span>
      </div>
      {open && <div style={{padding:'0 14px 14px'}}>{children}</div>}
    </div>
  )
}

function FileBtn({ label, accept, onFile, variant='outline' }) {
  const ref = useRef()
  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={()=>ref.current.click()}>{label}</button>
      <input ref={ref} type="file" accept={accept} style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)onFile(f);e.target.value='';}}/>
    </>
  )
}

export default function Sync({ state, setState: _set, showToast }) {
  const [status, setStatus] = useState({})

  const setS = (key, msg, type='info') => setStatus(s=>({...s,[key]:{msg,type}}))

  // ── MF / CAMS ──
  async function handleCAS(file) {
    setS('mf','Reading PDF...')
    try {
      const { text, flat } = await extractPdfTextWithPassword(file)
      let funds = parseCASTex(text)
      if (!funds.length) funds = parseCASTex(flat)
      if (!funds.length) { setS('mf','No holdings found in PDF — is this a CAMS/KFintech CAS?','error'); return }
      
      const state = getState()
      let added=0, updated=0
      funds.forEach(h => {
        const existing = state.holdings.find(e => (h.isin && e.isin===h.isin) || e.name===h.name)
        if (existing) { Object.assign(existing,{...h,id:existing.id}); updated++ }
        else { state.holdings.push({...h, id:uuid(), broker:'CAMS', lastUpdated:new Date().toISOString(), isManual:false}); added++ }
      })
      setState({holdings:[...state.holdings]})
      setS('mf',`✓ ${added} added, ${updated} updated (${funds.length} funds)`,'success')
    } catch(e) { setS('mf','Error: '+e.message,'error') }
  }

  // ── IBKR ──
  async function handleIBKR(file) {
    setS('ibkr','Reading...')
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        const holdings = parseIBKRCsv(text)
        if (!holdings.length) { setS('ibkr','No positions found in CSV','error'); return }
        const state = getState()
        let added=0, updated=0
        holdings.forEach(h => {
          const ex = state.holdings.find(e=>e.symbol===h.symbol&&e.market==='US')
          if (ex) { Object.assign(ex,{...h,id:ex.id}); updated++ }
          else { state.holdings.push(h); added++ }
        })
        setState({holdings:[...state.holdings]})
        setS('ibkr',`✓ ${added} added, ${updated} updated`,'success')
      } else {
        setS('ibkr','Use CSV export from IBKR (Activity → Export)','error')
      }
    } catch(e) { setS('ibkr','Error: '+e.message,'error') }
  }

  // ── ZERODHA ──
  async function handleZerodhaCSV(file) {
    setS('zerodha','Reading CSV...')
    try {
      const text = await file.text()
      const holdings = parseZerodhaHoldingsCsv(text)
      if (!holdings.length) { setS('zerodha','No holdings found','error'); return }
      const state = getState()
      let added=0, updated=0
      holdings.forEach(h => {
        const ex = state.holdings.find(e=>(h.isin&&e.isin===h.isin)||(e.symbol===h.symbol&&e.market==='IN'))
        if (ex) { Object.assign(ex,{...h,id:ex.id}); updated++ }
        else { state.holdings.push(h); added++ }
      })
      setState({holdings:[...state.holdings]})
      setS('zerodha',`✓ Holdings CSV: ${added} added, ${updated} updated`,'success')
    } catch(e) { setS('zerodha','CSV Error: '+e.message,'error') }
  }

  async function handleZerodhaXLSX(file) {
    setS('zerodha','Reading XLSX...')
    try {
      const holdings = await parseZerodhaPnLXlsx(file)
      if (!holdings.length) { setS('zerodha','No holdings found in XLSX','error'); return }
      const state = getState()
      let added=0, updated=0
      holdings.forEach(h => {
        const ex = state.holdings.find(e=>(h.isin&&e.isin===h.isin)||(e.symbol===h.symbol&&e.market==='IN'))
        if (ex) { Object.assign(ex,{...h,id:ex.id}); updated++ }
        else { state.holdings.push(h); added++ }
      })
      setState({holdings:[...state.holdings]})
      setS('zerodha',`✓ P&L XLSX: ${added} added, ${updated} updated`,'success')
    } catch(e) { setS('zerodha','XLSX Error: '+e.message,'error') }
  }

  async function handleTradebook(file) {
    setS('zerodha','Computing XIRR...')
    try {
      const text = await file.text()
      const bySymbol = parseZerodhaTradebook(text)
      const today = new Date()
      const state = getState()
      let updated=0
      Object.entries(bySymbol).forEach(([sym,{trades}]) => {
        const h = state.holdings.find(e=>e.symbol===sym&&e.market==='IN')
        if (!h) return
        const ltp = h.currentPrice || h.avgCost || 0
        const openQty = h.quantity || 0
        const cfs = trades.map(t=>({date:t.date, amount:t.type==='buy'?-t.amount:t.amount}))
        if (openQty>0 && ltp>0) cfs.push({date:today, amount:openQty*ltp})
        const xi = xirr(cfs)
        const firstBuy = trades.filter(t=>t.type==='buy').sort((a,b)=>a.date-b.date)[0]?.date
        h.xirr = xi
        h.xirrReliable = firstBuy ? (today-firstBuy)/(86400000*90) >= 1 : false
        h.firstBuyDate = firstBuy?.toISOString().slice(0,10)
        h.daysHeld = firstBuy ? Math.round((today-firstBuy)/86400000) : 0
        updated++
      })
      setState({holdings:[...state.holdings]})
      setS('zerodha',`✓ XIRR computed for ${updated} holdings`,'success')
    } catch(e) { setS('zerodha','Tradebook Error: '+e.message,'error') }
  }

  // ── BANK ──
  async function handleBank(file, bankType) {
    setS('bank','Reading...')
    try {
      const { text, flat } = await extractPdfTextWithPassword(file)
      const auto = bankType || (text.slice(0,2000).includes('HDFC BANK') || text.includes('SAVINGS - NRO') ? 'HDFC' : text.includes('HSBC') ? 'HSBC' : 'HDFC')
      const result = parseBankStatement(text.length > 500 ? text : flat, auto)
      if (!result.expenses?.length) { setS('bank',`Parsed but no transactions found (${auto})`) ; return }
      const state = getState()
      if (!state.expenses) state.expenses = []
      const fp = `${result.source}|${result.expenses[0]?.date?.slice(0,7)}|${result.expenses.length}`
      if ((state.importedFiles||[]).includes(fp)) { setS('bank','Already imported this statement','error'); return }
      state.importedFiles = [...(state.importedFiles||[]), fp]
      state.expenses = [...state.expenses, ...result.expenses]
      setState({expenses:state.expenses, importedFiles:state.importedFiles})
      setS('bank',`✓ ${result.expenses.length} transactions from ${auto} (${result.source})`,'success')
    } catch(e) { setS('bank','Error: '+e.message,'error') }
  }

  const StatusBox = ({k}) => status[k] ? (
    <div className={`upload-${status[k].type==='error'?'error':'success'}`} style={{marginTop:8}}>{status[k].msg}</div>
  ) : null

  return (
    <div className="page">
      <div className="page-header"><span className="page-title">Import</span></div>

      <div className="section-title">Upload Files</div>

      <UploadSection icon="🏦" title="Mutual Funds" subtitle="CAMS or KFintech CAS PDF (use CAMS for cost basis)">
        <FileBtn label="Choose CAMS PDF" accept=".pdf" onFile={handleCAS}/>
        <StatusBox k="mf"/>
      </UploadSection>

      <UploadSection icon="🇮🇳" title="Indian Stocks" subtitle="Zerodha Holdings CSV, P&L XLSX, or Tradebook CSV">
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <FileBtn label="Holdings CSV" accept=".csv" onFile={handleZerodhaCSV}/>
          <FileBtn label="P&L XLSX" accept=".xlsx" onFile={handleZerodhaXLSX}/>
          <FileBtn label="Tradebook (XIRR)" accept=".csv" onFile={handleTradebook}/>
        </div>
        <StatusBox k="zerodha"/>
      </UploadSection>

      <UploadSection icon="🇺🇸" title="IBKR US Stocks" subtitle="Transaction History CSV from IBKR Activity Statement">
        <FileBtn label="Transaction CSV" accept=".csv" onFile={handleIBKR}/>
        <StatusBox k="ibkr"/>
      </UploadSection>

      <UploadSection icon="🏧" title="Bank Statement" subtitle="HDFC India or HSBC Indonesia PDF">
        <div style={{display:'flex',gap:6}}>
          <FileBtn label="HDFC PDF" accept=".pdf" onFile={f=>handleBank(f,'HDFC')}/>
          <FileBtn label="HSBC PDF" accept=".pdf" onFile={f=>handleBank(f,'HSBC')}/>
          <FileBtn label="Auto-detect" accept=".pdf" onFile={f=>handleBank(f,'')}/>
        </div>
        <StatusBox k="bank"/>
      </UploadSection>

      <div className="section-title">Data</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <button className="btn btn-outline" onClick={()=>{
          const d=JSON.stringify(getState(),null,2)
          const a=document.createElement('a'); a.href='data:application/json,'+encodeURIComponent(d)
          a.download='portfolio-backup.json'; a.click()
        }}>↑ Export JSON</button>
        <button className="btn btn-outline" onClick={()=>{
          const inp=document.createElement('input'); inp.type='file'; inp.accept='.json'
          inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);setState(d);showToast('Data restored')}catch{showToast('Invalid JSON','error')}};r.readAsText(f)}
          inp.click()
        }}>↓ Import JSON</button>
      </div>
    </div>
  )
}
