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

    for (const row of rawRows) {
      // Handles Zerodha standard column headers (Symbol, ISIN, Quantity, Average Price)
      const symbol = (row['symbol'] || row['Symbol'] || row['ISIN'] || '').toString().trim().toUpperCase();
      if (!symbol) continue;

      const units = parseFloat(row['quantity'] || row['Quantity'] || row['Qty.'] || 0);
      const avgPrice = parseFloat(row['average_price'] || row['Average Price'] || row['Price'] || row['Buy Price'] || 0);
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
    if (dataArray.length === 0) throw new Error("No trade positions found in this spreadsheet format.");

    return { success: true, data: dataArray };
  } catch (error) {
    return { success: false, error: error.message || "Failed to process Zerodha spreadsheet." };
  }
};
