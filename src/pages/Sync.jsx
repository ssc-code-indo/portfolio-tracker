import React, { useState } from "react";
import { handleCamsUpload } from "../parsers/camsParser"; // Links perfectly to your src/parsers folder

export default function Sync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // 1. CAMS PDF Upload Handler
  const onCamsFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result = await handleCamsUpload(file);

    if (result.success) {
      console.log("Parsed CAMS Holdings:", result.data);
      setSuccessMessage(`Successfully loaded ${result.data.length} Mutual Fund positions!`);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Placeholder handlers for your other parsers (to be wired next)
  const onZerodhaFileChange = (e) => console.log("Zerodha file uploaded:", e.target.files[0]);
  const onIbkrFileChange = (e) => console.log("IBKR file uploaded:", e.target.files[0]);
  const onBankFileChange = (e) => console.log("Bank statement uploaded:", e.target.files[0]);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px", color: "#111827" }}>
        Sync Center
      </h2>
      <p style={{ color: "#4b5563", marginBottom: "24px", fontSize: "14px" }}>
        Upload your document exports to instantly recalculate Net Worth, allocations, and spending streams.
      </p>

      {/* Global Status Indicators */}
      {error && (
        <div style={{ backgroundColor: "#fef2f2", color: "#991b1b", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid #fca5a5" }}>
          ⚠️ {error}
        </div>
      )}
      {successMessage && (
        <div style={{ backgroundColor: "#f0fdf4", color: "#166534", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid #86efac" }}>
          ✅ {successMessage}
        </div>
      )}

      <div style={{ display: "grid", gap: "20px" }}>
        
        {/* Card 1: CAMS CAS */}
        <div style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "8px", backgroundColor: "#fff" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px 0", color: "#1f2937" }}>
            CAMS CAS Mutual Funds (India)
          </h3>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 14px 0" }}>
            Accepts standard monthly Consolidated Account Statement PDFs.
          </p>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={onCamsFileChange} 
            disabled={loading}
            style={{ fontSize: "14px" }}
          />
          {loading && <p style={{ color: "#2563eb", fontSize: "13px", marginTop: "8px", margin: 0 }}>Parsing PDF content rules...</p>}
        </div>

        {/* Card 2: Zerodha P&L */}
        <div style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "8px", backgroundColor: "#fff" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px 0", color: "#1f2937" }}>
            Zerodha Equity P&L (India Stocks)
          </h3>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 14px 0" }}>
            Upload your Excel P&L (.xlsx) file directly from Console.
          </p>
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={onZerodhaFileChange}
            style={{ fontSize: "14px" }}
          />
        </div>

        {/* Card 3: IBKR Statement */}
        <div style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "8px", backgroundColor: "#fff" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px 0", color: "#1f2937" }}>
            Interactive Brokers (US Equities)
          </h3>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 14px 0" }}>
            Accepts default Transaction History activity CSV exports.
          </p>
          <input 
            type="file" 
            accept=".csv" 
            onChange={onIbkrFileChange}
            style={{ fontSize: "14px" }}
          />
        </div>

        {/* Card 4: Banking & CC Passers */}
        <div style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "8px", backgroundColor: "#fff" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0
