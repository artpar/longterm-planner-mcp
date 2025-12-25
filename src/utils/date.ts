/**
 * Get current timestamp in ISO 8601 format
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Parse an ISO 8601 date string
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format a Date object to ISO 8601 string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date string is valid ISO 8601
 */
export function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr === date.toISOString();
}

/**
 * Get date-only string (YYYY-MM-DD)
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
