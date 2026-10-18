// Keep explanatory formulas in the workings, not in method titles.
export const methodLabel = value => String(value || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
