export function normalizeQuestion(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[!?.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
