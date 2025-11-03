import { encrypt, decrypt, hash } from "@/lib/utils/encryption";

describe("Encryption Utils", () => {
  describe("encrypt", () => {
    it("should encrypt a string", () => {
      const plaintext = "my-secret-token";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe("string");
    });

    it("should produce different ciphertexts for the same plaintext", () => {
      const plaintext = "my-secret-token";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Should be different due to IV (Initialization Vector)
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty strings", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });

    it("should handle special characters", () => {
      const plaintext = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle Unicode characters", () => {
      const plaintext = "你好世界 🌍 émojis";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decrypt", () => {
    it("should decrypt an encrypted string", () => {
      const plaintext = "my-secret-token";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(10000);
    });

    it("should handle JSON strings", () => {
      const jsonData = {
        token: "abc123",
        refresh: "xyz789",
        scope: "read write",
      };
      const plaintext = JSON.stringify(jsonData);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual(jsonData);
    });
  });

  describe("hash", () => {
    it("should hash a string", () => {
      const input = "password123";
      const hashed = hash(input);

      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe("string");
      expect(hashed.length).toBe(64); // SHA256 produces 64 character hex string
    });

    it("should produce consistent hashes for the same input", () => {
      const input = "password123";
      const hash1 = hash(input);
      const hash2 = hash(input);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hash("password123");
      const hash2 = hash("password124");

      expect(hash1).not.toBe(hash2);
    });

    it("should be case-sensitive", () => {
      const hash1 = hash("Password");
      const hash2 = hash("password");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty strings", () => {
      const hashed = hash("");

      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe("string");
      expect(hashed.length).toBe(64);
    });
  });

  describe("encryption round-trip", () => {
    it("should maintain data integrity through multiple encrypt/decrypt cycles", () => {
      const plaintext = "sensitive-data-123";

      let encrypted = encrypt(plaintext);
      let decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);

      // Second cycle
      encrypted = encrypt(decrypted);
      decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);

      // Third cycle
      encrypted = encrypt(decrypted);
      decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle decryption of invalid encrypted text", () => {
      const invalidEncrypted = "this-is-not-valid-encrypted-text";
      const result = decrypt(invalidEncrypted);
      // Decryption of invalid text will return empty string
      expect(result).toBe("");
    });

    it("should handle decryption of corrupted data", () => {
      const encrypted = encrypt("test data");
      const corrupted = encrypted.substring(0, encrypted.length - 5) + "xxxxx";
      const result = decrypt(corrupted);
      // Corrupted data may decrypt to empty or garbled string
      expect(typeof result).toBe("string");
    });
  });
});
