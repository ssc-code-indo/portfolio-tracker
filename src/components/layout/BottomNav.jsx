export default function BottomNav({ current, onChange }) {
  const tabs = [
    { id:'dashboard', label:'Dashboard' },
    { id:'portfolio', label:'Portfolio' },
    { id:'expenses',  label:'Expenses' },
    { id:'salary',    label:'Salary' },
    { id:'sync',      label:'Sync' },
  ]
  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={`nav-item${current===t.id?' active':''}`} onClick={() => onChange(t.id)}>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
