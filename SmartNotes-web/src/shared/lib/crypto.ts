export async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function secureCompare(left: string, right: string) {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(left);
  const storedBytes = encoder.encode(right);

  if (inputBytes.length !== storedBytes.length) {
    return false;
  }

  // Import raw bytes into CryptoKeys for secure comparison
  const algo = { name: 'HMAC', hash: 'SHA-256' };

  // Generate an ephemeral random key to perform the HMAC securely
  const key = await crypto.subtle.generateKey(algo, false, ['sign']) as CryptoKey;

  const mac1 = await crypto.subtle.sign(algo, key, inputBytes);
  const mac2 = await crypto.subtle.sign(algo, key, storedBytes);

  const mac1Array = new Uint8Array(mac1);
  const mac2Array = new Uint8Array(mac2);

  // Perform bitwise constant-time comparison.
  // Evaluates every single byte, never exiting early.
  let result = 0;
  for (let i = 0; i < mac1Array.length; i++) {
    result |= mac1Array[i] ^ mac2Array[i];
  }

  return result === 0;
}
