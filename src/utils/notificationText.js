/**
 * The second line of a notification, or '' when it should not be shown.
 *
 * Data-pull notifications ("GST pull completed") used to carry a technical sentence as their message -
 * "GST pull COMPLETED via webhook", "Background processing for GST has ended with status COMPLETED",
 * "Bank Statement analysis FAILED: <provider text>" - which meant nothing to the user and sometimes
 * leaked provider wording. The backend no longer writes those, but notifications already stored still
 * have them, so they are hidden here too: for a data pull the title alone ("GST pull completed") says it.
 *
 * Only data-pull notifications are touched, and only when the message has the technical shape (the word
 * webhook / background processing / "ended with status", or a raw upper-case status such as COMPLETED).
 * Ordinary plain-English messages, and every other kind of notification, are shown exactly as written.
 */
const TECHNICAL_WORDING = /webhook|background processing|ended with status/i;
const RAW_STATUS_WORD = /\b(COMPLETED|FAILED|PROCESSING|INITIATED|SUCCESS|PENDING)\b/; // case-sensitive on purpose

export function notificationMessage(notification) {
  const message = notification?.message;
  if (typeof message !== 'string' || !message.trim()) return '';
  if (notification.event_type !== 'DATA_PULL') return message;
  if (TECHNICAL_WORDING.test(message) || RAW_STATUS_WORD.test(message)) return '';
  return message;
}
