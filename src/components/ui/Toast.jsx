export default function Toast({ msg, type }) {
  return <div className={`toast${type==='error'?' error':''}`}>{msg}</div>
}
