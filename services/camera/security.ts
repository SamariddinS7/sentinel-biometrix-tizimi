import crypto from 'crypto';

class VmsSecurityManager {
  private static instance: VmsSecurityManager;
  private encryptionKey: Buffer;

  private constructor() {
    // 32-byte secure key retrieval or generation
    const configuredKey = process.env.VMS_ENCRYPTION_KEY;
    if (configuredKey) {
      this.encryptionKey = crypto.createHash('sha256').update(configuredKey).digest();
    } else {
      // Production fallback based on node server machine identifiers
      const machineSalt = process.env.HOSTNAME || 'vms_sentinel_fallback_salt_9281729';
      this.encryptionKey = crypto.createHash('sha256').update(machineSalt).digest();
    }
  }

  public static getInstance(): VmsSecurityManager {
    if (!VmsSecurityManager.instance) {
      VmsSecurityManager.instance = new VmsSecurityManager();
    }
    return VmsSecurityManager.instance;
  }

  /**
   * Encrypt a sensitive password string using AES-256-GCM
   */
  public encrypt(plainText: string): string {
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Pack IV, Ciphertext, and AuthTag as colon-separated hex strings
      return `${iv.toString('hex')}:${encrypted}:${authTag}`;
    } catch (error) {
      console.error('VMS Cryptography: Encryption error:', error);
      throw new Error('Xavfsiz parolni shifrlashda xatolik yuz berdi');
    }
  }

  /**
   * Decrypt an encrypted credential string back to cleartext
   */
  public decrypt(encryptedPackage: string): string {
    try {
      if (!encryptedPackage || !encryptedPackage.includes(':')) {
        return encryptedPackage; // Fallback to raw if not encrypted
      }

      const parts = encryptedPackage.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted package format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('VMS Cryptography: Decryption error. Key mismatch or payload corruption:', error);
      throw new Error('Parolni deshifrlashda xatolik yuz berdi (Shifrlash kaliti mos kelmadi)');
    }
  }
}

export const securityManager = VmsSecurityManager.getInstance();
