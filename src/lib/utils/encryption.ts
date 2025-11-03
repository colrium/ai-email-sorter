import CryptoJS from "crypto-js";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production";

/**
 * Encrypts sensitive data like OAuth tokens
 * @param text - Plain text to encrypt
 * @returns Encrypted string
 */
export function encrypt(text: string): string {
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts encrypted data
 * @param encryptedText - Encrypted string
 * @returns Decrypted plain text or empty string on error
 */
export function decrypt(encryptedText: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // Return empty string if decryption produces invalid result
    return decrypted || "";
  } catch (error) {
    console.error("Decryption error:", error);
    return "";
  }
}

/**
 * Hashes data using SHA256
 * @param text - Text to hash
 * @returns Hashed string
 */
export function hash(text: string): string {
  return CryptoJS.SHA256(text).toString();
}
