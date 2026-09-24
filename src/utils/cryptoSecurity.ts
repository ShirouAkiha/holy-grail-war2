import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const VAULT_KEY_PATH = path.join(process.cwd(), 'data', '.vault_master.key');

let cachedEncryptionKey: Buffer | null = null;

/**
 * Retrieves or initializes the 256-bit AES master encryption key.
 * 1. Checks process.env.BYOK_ENCRYPTION_KEY or process.env.ENCRYPTION_SECRET
 * 2. Fallbacks to persistent secure vault file in data/.vault_master.key (mode 0600)
 * 3. Hashes with SHA-256 to guarantee a strict 32-byte key buffer.
 */
function getMasterEncryptionKey(): Buffer {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  const envKey = process.env.BYOK_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET;
  if (envKey && envKey.trim().length >= 16) {
    cachedEncryptionKey = crypto.createHash('sha256').update(envKey.trim()).digest();
    return cachedEncryptionKey;
  }

  try {
    const dataDir = path.dirname(VAULT_KEY_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(VAULT_KEY_PATH)) {
      const raw = fs.readFileSync(VAULT_KEY_PATH, 'utf-8').trim();
      if (raw.length >= 32) {
        cachedEncryptionKey = crypto.createHash('sha256').update(raw).digest();
        return cachedEncryptionKey;
      }
    }

    // Generate new random 256-bit vault seed
    const newSeed = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(VAULT_KEY_PATH, newSeed, { mode: 0o600 });
    cachedEncryptionKey = crypto.createHash('sha256').update(newSeed).digest();
    return cachedEncryptionKey;
  } catch (err) {
    // Ephemeral fallback if filesystem is read-only
    const fallbackSeed = process.env.GEMINI_API_KEY || 'fate-holy-grail-vault-secret-seed-v1';
    cachedEncryptionKey = crypto.createHash('sha256').update(fallbackSeed).digest();
    return cachedEncryptionKey;
  }
}

/**
 * Checks if a string is already encrypted with our AES-256-GCM scheme.
 */
export function isEncrypted(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('enc:v1:');
}

/**
 * Encrypts a sensitive string (API Key) using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<cipher_hex>
 */
export function encryptSecret(plainText?: string | null): string {
  if (!plainText || typeof plainText !== 'string') return '';
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  if (isEncrypted(trimmed)) return trimmed; // Already encrypted

  try {
    const key = getMasterEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Additional Authenticated Data to bind cipher context
    cipher.setAAD(Buffer.from('fate_byok_auth_v1', 'utf-8'));

    const encrypted = Buffer.concat([
      cipher.update(trimmed, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    console.error('[Security] Encryption failed:', err);
    throw new Error('Cryptographic subsystem failure: could not encrypt secret.');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted secret.
 * If the string is plain text (legacy unencrypted), it returns it as-is for backwards compatibility.
 */
export function decryptSecret(cipherOrPlain?: string | null): string {
  if (!cipherOrPlain || typeof cipherOrPlain !== 'string') return '';
  const trimmed = cipherOrPlain.trim();
  if (!trimmed) return '';

  if (!isEncrypted(trimmed)) {
    return trimmed; // Plaintext legacy key
  }

  try {
    const parts = trimmed.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      return '';
    }

    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encryptedText = Buffer.from(parts[4], 'hex');

    const key = getMasterEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from('fate_byok_auth_v1', 'utf-8'));
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    // Decryption failed (corrupted or tampered ciphertext)
    return '';
  }
}

/**
 * Securely masks an API key revealing strictly the last 4 characters.
 * Decrypts transparently if encrypted, ensuring ciphertexts are never displayed.
 */
export function maskApiKeySecurely(keyOrCipher?: string | null): string {
  if (!keyOrCipher) return 'Not configured';
  const raw = decryptSecret(keyOrCipher);
  if (!raw || raw.trim().length === 0) return 'Not configured';

  const clean = raw.trim();
  if (clean.length <= 4) return '••••••••';
  return `••••••••••••${clean.slice(-4)}`;
}

/**
 * Redacts any known API key signatures and secrets from error strings, URLs, or log messages.
 * Prevents accidental leak in Discord messages or server console outputs.
 */
export function redactSensitiveKeysFromText(text?: string | null, extraKeys: string[] = []): string {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;

  // Google Gemini API keys (AIza...)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]');

  // OpenAI / OpenRouter / NanoGPT keys
  sanitized = sanitized.replace(/sk-(?:or-v1-)?[a-zA-Z0-9_\-\.]{20,}/g, '[REDACTED_API_KEY]');

  // Bearer tokens in headers or URLs
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer [REDACTED_TOKEN]');

  // HTTP URL query parameters containing keys (e.g. ?key=... or &api_key=...)
  sanitized = sanitized.replace(/([?&](?:api_key|key|apiKey)=)[^&\s]+/gi, '$1[REDACTED_KEY]');

  // Extra explicitly provided raw user keys
  for (const rawKey of extraKeys) {
    if (rawKey && rawKey.length >= 8) {
      sanitized = sanitized.replaceAll(rawKey, '[REDACTED_USER_KEY]');
    }
  }

  return sanitized;
}
