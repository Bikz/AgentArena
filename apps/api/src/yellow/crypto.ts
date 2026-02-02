import crypto from "node:crypto";

export type EncryptedBlob = {
  v: 1;
  ivB64: string;
  tagB64: string;
  dataB64: string;
};

export function readKeyBase64(name: string) {
  const raw = process.env[name];
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${name} must be 32 bytes base64`);
  }
  return buf;
}

export function encryptJson(key: Buffer, value: unknown): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    ivB64: iv.toString("base64"),
    tagB64: tag.toString("base64"),
    dataB64: ciphertext.toString("base64"),
  };
}

export function decryptJson<T>(key: Buffer, blob: EncryptedBlob): T {
  if (blob.v !== 1) throw new Error("unsupported_encryption_version");
  const iv = Buffer.from(blob.ivB64, "base64");
  const tag = Buffer.from(blob.tagB64, "base64");
  const data = Buffer.from(blob.dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

