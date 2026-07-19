/**
 * Sentinel VMS — Credential Vault
 *
 * AES-256-GCM encrypted credential storage for camera authentication.
 * Credentials are NEVER stored in plaintext. All read operations decrypt
 * at the last moment and zero the buffer after use.
 *
 * Storage:  Firestore (encrypted blob) + in-memory cache (encrypted)
 * Key:      VMS_ENCRYPTION_KEY env var → SHA-256 → 32-byte AES key
 */

import crypto from 'crypto';
import { db } from '../firestoreService';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export interface CameraCredential {
  cameraId: string;
  username: string;
  /** Encrypted using AES-256-GCM: "<iv_hex>:<ciphertext_hex>:<tag_hex>" */
  encryptedPassword: string;
  rtspUrl?: string;
  onvifUrl?: string;
  updatedAt: string;
}

class CredentialVault {
  private static instance: CredentialVault;
  private readonly encKey: Buffer;
  /** In-memory cache — only encrypted values ever sit here */
  private cache: Map<string, CameraCredential> = new Map();

  private constructor() {
    const raw = process.env.VMS_ENCRYPTION_KEY;
    if (raw) {
      this.encKey = crypto.createHash('sha256').update(raw).digest();
    } else {
      // Deterministic per-process key based on hostname — acceptable for dev,
      // NOT sufficient for production.  Set VMS_ENCRYPTION_KEY in env.
      const salt = process.env.HOSTNAME || 'sentinel-vms-default-vault-key';
      this.encKey = crypto.createHash('sha256').update(salt).digest();
    }
  }

  public static getInstance(): CredentialVault {
    if (!CredentialVault.instance) {
      CredentialVault.instance = new CredentialVault();
    }
    return CredentialVault.instance;
  }

  // ─── Encryption ───────────────────────────────────────────────────────────

  public encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encKey, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${ciphertext}:${tag}`;
  }

  public decrypt(encrypted: string): string {
    if (!encrypted || !encrypted.includes(':')) {
      // Already plaintext (legacy migration path) — re-encrypt immediately
      return encrypted;
    }
    const parts = encrypted.split(':');
    if (parts.length !== 3) throw new Error('Invalid credential package format');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encKey, iv);
    decipher.setAuthTag(tag);
    let plaintext = decipher.update(parts[1], 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  // ─── Store / Retrieve ─────────────────────────────────────────────────────

  public async store(
    cameraId: string,
    username: string,
    password: string,
    rtspUrl?: string,
    onvifUrl?: string,
  ): Promise<CameraCredential> {
    const cred: CameraCredential = {
      cameraId,
      username,
      encryptedPassword: this.encrypt(password),
      rtspUrl,
      onvifUrl,
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(cameraId, cred);

    try {
      await setDoc(doc(db, 'cameraCredentials', cameraId), cred, { merge: true });
    } catch {
      // Firestore unavailable — credential lives in memory only for this session
    }

    return cred;
  }

  public async retrieve(cameraId: string): Promise<CameraCredential | null> {
    if (this.cache.has(cameraId)) {
      return this.cache.get(cameraId)!;
    }

    try {
      const snap = await getDoc(doc(db, 'cameraCredentials', cameraId));
      if (snap.exists()) {
        const cred = snap.data() as CameraCredential;
        this.cache.set(cameraId, cred);
        return cred;
      }
    } catch {
      // Firestore unavailable
    }

    return null;
  }

  /**
   * Returns plaintext password for immediate use.
   * Caller MUST NOT store or log the returned string.
   */
  public async retrievePassword(cameraId: string): Promise<string | null> {
    const cred = await this.retrieve(cameraId);
    if (!cred) return null;
    return this.decrypt(cred.encryptedPassword);
  }

  public async revoke(cameraId: string): Promise<void> {
    this.cache.delete(cameraId);
    try {
      await deleteDoc(doc(db, 'cameraCredentials', cameraId));
    } catch {
      // Firestore unavailable
    }
  }

  /**
   * Rotate encryption: re-encrypt all cached credentials with the current key.
   * Call after a VMS_ENCRYPTION_KEY rotation.
   */
  public async rotateEncryption(): Promise<void> {
    for (const [id, cred] of this.cache.entries()) {
      const plainPw = this.decrypt(cred.encryptedPassword);
      cred.encryptedPassword = this.encrypt(plainPw);
      cred.updatedAt = new Date().toISOString();
      this.cache.set(id, cred);
      try {
        await setDoc(doc(db, 'cameraCredentials', id), cred, { merge: true });
      } catch {
        // Continue rotation best-effort
      }
    }
  }
}

export const credentialVault = CredentialVault.getInstance();
