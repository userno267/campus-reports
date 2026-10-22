// SHA-256 hash using the browser's built-in crypto (no extra library).
// Note: crypto.subtle only works on https or localhost, which is fine for ionic serve and the emulator.
export async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase() + ':' + password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}