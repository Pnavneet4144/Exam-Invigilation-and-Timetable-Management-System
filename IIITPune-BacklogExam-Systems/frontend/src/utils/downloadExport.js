/**
 * Authenticated file download helper.
 * Uses the Axios instance so the JWT Authorization header is always included.
 *
 * @param {object} apiInstance - The configured Axios instance from utils/api.js
 * @param {string} url         - API path (without /api prefix, e.g. '/scheduling/export/pdf')
 * @param {string} filename    - Suggested filename for the save dialog
 * @param {string} mimeType    - Expected MIME type, e.g. 'application/pdf'
 */
export async function downloadExport(apiInstance, url, filename, mimeType) {
  const response = await apiInstance.get(url, { responseType: 'blob' });

  const blob = response.data;

  // If the server returns JSON (e.g. an error body) instead of the real file,
  // the blob type will not match. Parse and surface the error message.
  if (!blob.type.includes(mimeType) && !blob.type.includes('octet-stream')) {
    const text = await blob.text();
    let message = 'Export failed';
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || message;
    } catch (_) {
      message = text || message;
    }
    throw new Error(message);
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
