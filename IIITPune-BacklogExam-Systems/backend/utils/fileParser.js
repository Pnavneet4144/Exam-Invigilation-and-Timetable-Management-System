/**
 * File Parser Utility
 * 
 * Parses CSV and XLSX files into a uniform array-of-objects format.
 * 
 * How it works:
 * 1. Detect file type from the original filename extension (.csv or .xlsx)
 * 2. For CSV: use csv-parse/sync to parse the buffer into rows
 * 3. For XLSX: use xlsx library to read the buffer, take the first sheet,
 *    and convert to JSON with header row
 * 4. Return the array of row objects with lowercase/trimmed keys
 * 
 * Both parsers normalize column headers to lowercase and trim whitespace.
 */

const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

function parseFile(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    return parseCSV(buffer);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSX(buffer);
  } else {
    throw new Error(`Unsupported file format: .${ext}. Please upload a .csv or .xlsx file.`);
  }
}

function parseCSV(buffer) {
  const records = parse(buffer, {
    columns: true,           // Use first row as headers
    skip_empty_lines: true,  // Ignore blank lines
    trim: true,              // Trim whitespace from values
    relax_column_count: true // Allow rows with varying column counts
  });
  return normalizeHeaders(records);
}

function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return normalizeHeaders(records);
}

// Normalize all column headers to lowercase and trim them
function normalizeHeaders(records) {
  return records.map(row => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.toLowerCase().trim()] = typeof value === 'string' ? value.trim() : value;
    }
    return normalized;
  });
}

module.exports = { parseFile };
