import * as XLSX from 'xlsx';

export const handleZerodhaUpload = async (file) => {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert sheet rows to a clean JSON array
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    const holdings = {};

    if (rawRows.length > 0) {
      console.log("=== ZERODHA DEBUG: First Row Headers ===", Object.keys(rawRows[0]));
    }

    for (const row of rawRows) {
      // 1. Match symbol or instrument name using every known Zerodha layout header
      const symbol = (
        row['symbol'] || row['Symbol'] || 
        row['Instrument'] || row['instrument'] || 
        row['Trading Symbol'] || row['tradingsymbol'] || 
        row['ISIN'] || row['isin'] || ''
      ).toString().trim().toUpperCase();

      if (!symbol || symbol.includes("TOTAL") || symbol.includes("SUB-TOTAL")) continue;

      // 2. Match quantities
      const units = parseFloat(
        row['quantity'] || row['Quantity'] || 
        row['Qty.'] || row['Qty'] || 
        row['Available Qty'] || row['Available Quantity'] || 
        row['Cleared Qty'] || 0
      );

      // 3. Match buy/average cost price
      const avgPrice = parseFloat(
        row['average_price'] || row['Average Price'] || 
        row['Avg. Price'] || row['Avg Price'] || 
        row['price'] || row['Price'] || 
        row['Buy Price'] || row['Avg. cost'] || 
        row['Avg Cost'] || row['Buy Average'] || 0
      );

      // 4. Match ISIN (Fallback to symbol string if blank)
      const isin = (row['isin'] || row['ISIN'] || symbol).toString().trim().toUpperCase();

      if (units > 0) {
        if (holdings[isin]) {
          holdings[isin].units += units;
          holdings[isin].cost += (units * avgPrice);
        } else {
          holdings[isin] = {
            isin: isin,
            symbol: symbol,
            units: units,
            cost: units * avgPrice,
            source: 'Zerodha'
          };
        }
      }
    }

    const dataArray = Object.values(holdings);
    if (dataArray.length === 0) {
      throw new Error("Could not find rows with matching Quantity/Price headers. Check browser console for file schema.");
    }

    return { success: true, data: dataArray };
  } catch (error) {
    return { success: false, error: error.message || "Failed to process Zerodha spreadsheet." };
  }
};
