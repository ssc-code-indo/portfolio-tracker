import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { getState, setState, subscribe } from './lib/state'
import Dashboard  from './pages/Dashboard'
import Portfolio  from './pages/Portfolio'
import Expenses   from './pages/Expenses'
import Salary     from './pages/Salary'
import Sync       from './pages/Sync'
import BottomNav  from './components/layout/BottomNav'
import Toast      from './components/ui/Toast'
import './index.css'

function App() {
  const state = useSyncExternalStore(subscribe, getState, getState)
  const [page, setPage] = useState('dashboard')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() })
    setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => setState({ usdInr: d.rates?.INR || 84, inrIdr: (d.rates?.IDR || 15900) / (d.rates?.INR || 84) }))
      .catch(() => {})
  }, [])

  const pages = { dashboard: Dashboard, portfolio: Portfolio, expenses: Expenses, salary: Salary, sync: Sync }
  const Page = pages[page] || Dashboard

  return (
    <div className="app" data-theme={state.displayMode || 'dark'}>
      <Page state={state} setState={setState} showToast={showToast} />
      <BottomNav current={page} onChange={setPage} />
      {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} />}
    </div>
  )
}

export default App
