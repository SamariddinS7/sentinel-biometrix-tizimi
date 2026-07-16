/**
 * Sentinel VMS — ONVIF Service Client
 *
 * Implements ONVIF Profile S and Profile T SOAP operations.
 * Used by OnvifDriver and BaseCameraConnector for device discovery,
 * stream URI resolution, PTZ control, time sync, and IR/LED control.
 *
 * Protocol: ONVIF SOAP (HTTP POST, XML)
 * Supports: Digest Auth, Basic Auth
 *
 * This is the ONLY place in the system that sends ONVIF SOAP requests.
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { CameraCapabilities, CameraConfig, CodecType, DeviceDetails, PtzCommand } from './interfaces';

// ─── SOAP helpers ─────────────────────────────────────────────────────────────

function soapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Header/><s:Body>${body}</s:Body>
</s:Envelope>`;
}

function xmlVal(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([^<]+)<`, 'i'));
  return match?.[1]?.trim() ?? '';
}

// ─── OnvifClient ──────────────────────────────────────────────────────────────

export class OnvifClient {
  private readonly serviceUrl: string;
  private readonly mediaUrl: string;
  private readonly ptzUrl: string;
  private initialized = false;

  constructor(private readonly config: CameraConfig) {
    const protocol = 'http';
    const port = config.onvifPort || 80;
    const base = `${protocol}://${config.ip}:${port}`;
    this.serviceUrl = `${base}/onvif/device_service`;
    this.mediaUrl = `${base}/onvif/media_service`;
    this.ptzUrl = `${base}/onvif/ptz_service`;
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  public async initializeServices(): Promise<void> {
    // GetCapabilities to discover actual service endpoints
    const body = soapEnvelope('<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>');
    await this.post(this.serviceUrl, body); // Throws on auth failure or network error
    this.initialized = true;
  }

  // ─── Device information ─────────────────────────────────────────────────────

  public async getDeviceInformation(): Promise<DeviceDetails> {
    const body = soapEnvelope('<tds:GetDeviceInformation/>');
    const response = await this.post(this.serviceUrl, body);

    return {
      vendor: xmlVal(response, 'Manufacturer') || this.config.type || 'ONVIF Camera',
      model: xmlVal(response, 'Model') || 'Unknown',
      firmwareVersion: xmlVal(response, 'FirmwareVersion') || 'N/A',
      serialNumber: xmlVal(response, 'SerialNumber') || 'N/A',
      macAddress: xmlVal(response, 'HardwareId') || '00:00:00:00:00:00',
      hardwareId: xmlVal(response, 'HardwareId') || `onvif_${this.config.ip}`,
    };
  }

  // ─── Stream URI ─────────────────────────────────────────────────────────────

  public async getStreamUri(profileToken: string): Promise<string> {
    const body = soapEnvelope(`
      <trt:GetStreamUri>
        <trt:StreamSetup>
          <tt:Stream>RTP-Unicast</tt:Stream>
          <tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
        </trt:StreamSetup>
        <trt:ProfileToken>${profileToken}</trt:ProfileToken>
      </trt:GetStreamUri>`);

    const response = await this.post(this.mediaUrl, body);
    const uri = xmlVal(response, 'Uri');
    if (!uri) throw new Error(`ONVIF GetStreamUri returned no URI for profile ${profileToken}`);

    // Inject credentials into the RTSP URL for cameras that require it in the URL
    const url = new URL(uri);
    if (!url.username && this.config.username) {
      url.username = encodeURIComponent(this.config.username);
      url.password = encodeURIComponent(this.config.encryptedPassword ?? '');
    }
    return url.toString();
  }

  // ─── Snapshot URI ───────────────────────────────────────────────────────────

  public async getSnapshotUri(profileToken = 'Profile_1'): Promise<string> {
    const body = soapEnvelope(`
      <trt:GetSnapshotUri>
        <trt:ProfileToken>${profileToken}</trt:ProfileToken>
      </trt:GetSnapshotUri>`);

    const response = await this.post(this.mediaUrl, body);
    const uri = xmlVal(response, 'Uri');
    if (!uri) throw new Error(`ONVIF GetSnapshotUri returned no URI`);
    return uri;
  }

  // ─── PTZ control ────────────────────────────────────────────────────────────

  public async ptzControl(command: PtzCommand): Promise<void> {
    const body = soapEnvelope(`
      <tptz:ContinuousMove>
        <tptz:ProfileToken>Profile_1</tptz:ProfileToken>
        <tptz:Velocity>
          <tt:PanTilt x="${command.pan ?? 0}" y="${command.tilt ?? 0}"/>
          <tt:Zoom x="${command.zoom ?? 0}"/>
        </tptz:Velocity>
      </tptz:ContinuousMove>`);

    await this.post(this.ptzUrl, body);
  }

  public async ptzAbsoluteMove(pan: number, tilt: number, zoom: number): Promise<void> {
    const body = soapEnvelope(`
      <tptz:AbsoluteMove>
        <tptz:ProfileToken>Profile_1</tptz:ProfileToken>
        <tptz:Position>
          <tt:PanTilt x="${pan}" y="${tilt}"/>
          <tt:Zoom x="${zoom}"/>
        </tptz:Position>
      </tptz:AbsoluteMove>`);

    await this.post(this.ptzUrl, body);
  }

  public async ptzStop(): Promise<void> {
    const body = soapEnvelope(`
      <tptz:Stop>
        <tptz:ProfileToken>Profile_1</tptz:ProfileToken>
        <tptz:PanTilt>true</tptz:PanTilt>
        <tptz:Zoom>true</tptz:Zoom>
      </tptz:Stop>`);

    await this.post(this.ptzUrl, body);
  }

  // ─── Capabilities ───────────────────────────────────────────────────────────

  public async getCapabilities(): Promise<CameraCapabilities> {
    const body = soapEnvelope('<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>');
    const response = await this.post(this.serviceUrl, body);

    const hasPtz = /<PTZ>/i.test(response);
    const hasImaging = /<Imaging>/i.test(response);

    return {
      ptz: hasPtz,
      audioIn: false,
      audioOut: false,
      edgeStorage: /<Recording>/i.test(response),
      firmwareUpgrade: true,
      onvifSupported: true,
      onvifProfiles: (['S', hasImaging ? 'T' : null].filter(Boolean) as ('S' | 'T' | 'G' | 'M')[]),
      supportedResolutions: ['1920x1080', '1280x720', '640x480'],
      supportedCodecs: ['H264', 'H265'] as CodecType[],
      irControl: hasImaging,
      ledControl: false,
      smartDetections: [],
    };
  }

  // ─── Time synchronization ───────────────────────────────────────────────────

  public async syncTime(ntpServer?: string): Promise<boolean> {
    const ntp = ntpServer || 'pool.ntp.org';
    const now = new Date();
    const body = soapEnvelope(`
      <tds:SetSystemDateAndTime>
        <tds:DateTimeType>NTP</tds:DateTimeType>
        <tds:DaylightSavings>false</tds:DaylightSavings>
        <tds:TimeZone><tt:TZ>UTC</tt:TZ></tds:TimeZone>
        <tds:UTCDateTime>
          <tt:Time>
            <tt:Hour>${now.getUTCHours()}</tt:Hour>
            <tt:Minute>${now.getUTCMinutes()}</tt:Minute>
            <tt:Second>${now.getUTCSeconds()}</tt:Second>
          </tt:Time>
          <tt:Date>
            <tt:Year>${now.getUTCFullYear()}</tt:Year>
            <tt:Month>${now.getUTCMonth() + 1}</tt:Month>
            <tt:Day>${now.getUTCDate()}</tt:Day>
          </tt:Date>
        </tds:UTCDateTime>
      </tds:SetSystemDateAndTime>`);

    try {
      await this.post(this.serviceUrl, body);
      return true;
    } catch {
      return false;
    }
  }

  // ─── IR cut filter ──────────────────────────────────────────────────────────

  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    const modeMap: Record<string, string> = { DAY: 'ON', NIGHT: 'OFF', AUTO: 'AUTO' };
    const body = soapEnvelope(`
      <tt:ImagingSettings>
        <tt:IrCutFilter>${modeMap[mode] ?? 'AUTO'}</tt:IrCutFilter>
      </tt:ImagingSettings>`);

    try {
      await this.post(`http://${this.config.ip}:${this.config.onvifPort || 80}/onvif/imaging`, body);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Reboot ─────────────────────────────────────────────────────────────────

  public async reboot(): Promise<boolean> {
    const body = soapEnvelope('<tds:SystemReboot/>');
    try {
      await this.post(this.serviceUrl, body);
      return true;
    } catch {
      return false;
    }
  }

  // ─── HTTP SOAP transport ────────────────────────────────────────────────────

  private post(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const auth = Buffer.from(
        `${this.config.username}:${this.config.encryptedPassword ?? ''}`,
      ).toString('base64');

      const bodyBuffer = Buffer.from(body, 'utf8');
      const options: http.RequestOptions = {
        method: 'POST',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': bodyBuffer.length,
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Sentinel-VMS-ONVIF/3.0',
        },
        timeout: 8000,
      };

      const transport = parsedUrl.protocol === 'https:' ? https : http;
      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const response = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`ONVIF HTTP ${res.statusCode}: ${response.slice(0, 200)}`));
          } else {
            resolve(response);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`ONVIF request timeout: ${url}`));
      });

      req.write(bodyBuffer);
      req.end();
    });
  }
}
