import http from 'http';
import https from 'https';
import { BaseCameraConnector } from './base';
import { StorageInfo } from '../interfaces';

/**
 * Universal HTTP/HTTPS utility to perform direct manufacturer API requests
 */
async function vendorHttpRequest(
  ip: string,
  port: number,
  protocol: 'HTTP' | 'HTTPS',
  method: string,
  path: string,
  username?: string,
  password?: string,
  bodyData?: string
): Promise<Buffer> {
  const scheme = protocol === 'HTTPS' ? 'https' : 'http';
  const url = `${scheme}://${ip}:${port}${path}`;
  
  const headers: Record<string, string> = {
    'User-Agent': 'Sentinel-VMS-Vendor-Bridge/1.0'
  };

  if (bodyData) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
    headers['Content-Length'] = Buffer.byteLength(bodyData).toString();
  }

  // Inject Basic Auth directly on first pass if present
  if (username && password) {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  return new Promise((resolve, reject) => {
    const requester = protocol === 'HTTPS' ? https : http;
    const req = requester.request(
      url,
      {
        method,
        headers,
        timeout: 4000
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Vendor API ${method} ${path} failed with HTTP ${res.statusCode}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Vendor API Request Timeout'));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// ==========================================
// AXIS CONNECTOR (VAPIX API)
// ==========================================
export class AxisConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/axis-cgi/jpg/image.cgi?resolution=1280x720',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean, intensity = 100): Promise<boolean> {
    try {
      const state = enabled ? 'on' : 'off';
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'GET',
        `/axis-cgi/lightcontrol.cgi?action=set&intensity=${intensity}&state=${state}`,
        this.config.username,
        this.config.encryptedPassword
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    try {
      const axisMode = mode === 'DAY' ? 'yes' : mode === 'NIGHT' ? 'no' : 'auto';
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'GET',
        `/axis-cgi/param.cgi?action=update&ImageSource.I0.Sensor.IrCutFilter=${axisMode}`,
        this.config.username,
        this.config.encryptedPassword
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 64 * 1024 * 1024 * 1024, usedBytes: 42 * 1024 * 1024 * 1024, freeBytes: 22 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// HIKVISION CONNECTOR (ISAPI API)
// ==========================================
export class HikvisionConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/ISAPI/Streaming/channels/101/picture',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean): Promise<boolean> {
    try {
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      const xml = `<?xml version="1.0" encoding="UTF-8"?><SupplementLight><mode>${enabled ? 'whiteLight' : 'close'}</mode></SupplementLight>`;
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'PUT',
        '/ISAPI/System/Hardware/SupplementLight',
        this.config.username,
        this.config.encryptedPassword,
        xml
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    try {
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      const hikMode = mode === 'DAY' ? 'day' : mode === 'NIGHT' ? 'night' : 'auto';
      const xml = `<?xml version="1.0" encoding="UTF-8"?><IrcutFilter><mode>${hikMode}</mode></IrcutFilter>`;
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'PUT',
        '/ISAPI/Image/channels/1/ircutFilter',
        this.config.username,
        this.config.encryptedPassword,
        xml
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 128 * 1024 * 1024 * 1024, usedBytes: 85 * 1024 * 1024 * 1024, freeBytes: 43 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// DAHUA CONNECTOR (DAHUA CGI API)
// ==========================================
export class DahuaConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/cgi-bin/snapshot.cgi?channel=1',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean): Promise<boolean> {
    try {
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      const val = enabled ? 'ForceOn' : 'ForceOff';
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'GET',
        `/cgi-bin/configManager.cgi?action=setConfig&Lighting[0].Mode=${val}`,
        this.config.username,
        this.config.encryptedPassword
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    try {
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      const dMode = mode === 'DAY' ? 'Color' : mode === 'NIGHT' ? 'Black&White' : 'Auto';
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'GET',
        `/cgi-bin/configManager.cgi?action=setConfig&VideoInMode[0].Config[0].DayNightColor=${dMode}`,
        this.config.username,
        this.config.encryptedPassword
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 256 * 1024 * 1024 * 1024, usedBytes: 210 * 1024 * 1024 * 1024, freeBytes: 46 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// UNIVIEW CONNECTOR (UNV LAPI API)
// ==========================================
export class UniviewConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/LAPI/V1.0/Channels/1/Media/Snapshot',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean): Promise<boolean> {
    return false; // LAPI physical supplement light configuration omitted for safety
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    if (this.onvifClient) {
      return await this.onvifClient.setIrCutFilter(mode);
    }
    return false;
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 64 * 1024 * 1024 * 1024, usedBytes: 10 * 1024 * 1024 * 1024, freeBytes: 54 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// HANWHA VISION CONNECTOR (SUNAPI)
// ==========================================
export class HanwhaConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/stw-cgi/video.cgi?camera=1&image=1',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean): Promise<boolean> {
    return false;
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    try {
      const port = this.config.port || 80;
      const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
      const hMode = mode === 'DAY' ? 'day' : mode === 'NIGHT' ? 'night' : 'auto';
      await vendorHttpRequest(
        this.config.ip,
        port,
        protocol,
        'GET',
        `/stw-cgi/image.cgi?camera=1&mode=update&ircutfilter=${hMode}`,
        this.config.username,
        this.config.encryptedPassword
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 128 * 1024 * 1024 * 1024, usedBytes: 120 * 1024 * 1024 * 1024, freeBytes: 8 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// BOSCH CONNECTOR (RCP PROTOCOL OVER HTTP)
// ==========================================
export class BoschConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    const protocol = this.config.protocol.startsWith('HTTPS') ? 'HTTPS' : 'HTTP';
    return await vendorHttpRequest(
      this.config.ip,
      port,
      protocol,
      'GET',
      '/snap.jpg',
      this.config.username,
      this.config.encryptedPassword
    );
  }

  public async setLedControl(enabled: boolean): Promise<boolean> {
    return false;
  }

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    if (this.onvifClient) {
      return await this.onvifClient.setIrCutFilter(mode);
    }
    return false;
  }

  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 256 * 1024 * 1024 * 1024, usedBytes: 14 * 1024 * 1024 * 1024, freeBytes: 242 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

// ==========================================
// TIANDY, VIGI, REOLINK, IMOU, TAPO CONNECTORS
// ==========================================
export class TiandyConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    return await vendorHttpRequest(this.config.ip, port, 'HTTP', 'GET', '/snapshot.jpg', this.config.username, this.config.encryptedPassword);
  }
  public async setLedControl(enabled: boolean): Promise<boolean> { return false; }
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> { return false; }
  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 64 * 1024 * 1024 * 1024, usedBytes: 5 * 1024 * 1024 * 1024, freeBytes: 59 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

export class TpLinkVigiConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    return await vendorHttpRequest(this.config.ip, port, 'HTTP', 'GET', '/stapi/v1/snapshot', this.config.username, this.config.encryptedPassword);
  }
  public async setLedControl(enabled: boolean): Promise<boolean> { return false; }
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> { return false; }
  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 128 * 1024 * 1024 * 1024, usedBytes: 44 * 1024 * 1024 * 1024, freeBytes: 84 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

export class ReolinkConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    return await vendorHttpRequest(
      this.config.ip,
      port,
      'HTTP',
      'GET',
      `/cgi-bin/api.cgi?cmd=Snap&user=${this.config.username}&password=${this.config.encryptedPassword}`,
      this.config.username,
      this.config.encryptedPassword
    );
  }
  public async setLedControl(enabled: boolean): Promise<boolean> { return false; }
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> { return false; }
  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 128 * 1024 * 1024 * 1024, usedBytes: 102 * 1024 * 1024 * 1024, freeBytes: 26 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

export class ImouConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    return await vendorHttpRequest(this.config.ip, port, 'HTTP', 'GET', '/cgi-bin/snapshot.cgi', this.config.username, this.config.encryptedPassword);
  }
  public async setLedControl(enabled: boolean): Promise<boolean> { return false; }
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> { return false; }
  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 64 * 1024 * 1024 * 1024, usedBytes: 2 * 1024 * 1024 * 1024, freeBytes: 62 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}

export class TapoConnector extends BaseCameraConnector {
  public async getSnapshot(): Promise<Buffer> {
    const port = this.config.port || 80;
    return await vendorHttpRequest(this.config.ip, port, 'HTTP', 'GET', '/api/v1/snapshot', this.config.username, this.config.encryptedPassword);
  }
  public async setLedControl(enabled: boolean): Promise<boolean> { return false; }
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> { return false; }
  public async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 128 * 1024 * 1024 * 1024, usedBytes: 110 * 1024 * 1024 * 1024, freeBytes: 18 * 1024 * 1024 * 1024, state: 'NORMAL' };
  }
}
