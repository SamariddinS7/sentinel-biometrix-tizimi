import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { CameraConfig, CameraCapabilities, DeviceDetails, PtzCommand, StorageInfo } from './interfaces';
import { securityManager } from './security';

export class OnvifClient {
  private serviceUrls: Map<string, string> = new Map();
  private username = '';
  private password = '';

  constructor(private readonly config: CameraConfig) {
    this.username = config.username || 'admin';
    this.password = config.encryptedPassword || '';
    
    // Core Device Management endpoint is the root bootstrap uri
    const scheme = config.protocol === 'HTTPS' ? 'https' : 'http';
    const port = config.onvifPort || 80;
    this.serviceUrls.set('device', `${scheme}://${config.ip}:${port}/onvif/device_service`);
  }

  /**
   * Helper to execute SOAP XML Requests to camera endpoints
   */
  private async soapRequest(serviceType: string, action: string, body: string): Promise<string> {
    const urlStr = this.serviceUrls.get(serviceType);
    if (!urlStr) {
      throw new Error(`ONVIF Service url for "${serviceType}" not initialized yet. Perform GetServices/GetCapabilities first.`);
    }

    const url = new URL(urlStr);
    const soapEnvelope = this.buildSoapEnvelope(action, body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver10/device/wsdl/' + action + '"',
      'Content-Length': Buffer.byteLength(soapEnvelope).toString(),
      'User-Agent': 'Sentinel-ONVIF-Client/2.5.0'
    };

    return new Promise((resolve, reject) => {
      const requestOptions: http.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: headers,
        timeout: 5000
      };

      const requester = url.protocol === 'https:' ? https : http;

      const req = requester.request(requestOptions, (res) => {
        let responseData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`ONVIF SOAP HTTP Failure Status ${res.statusCode}: ${responseData}`));
          } else {
            resolve(responseData);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`ONVIF request timeout to ${urlStr}`));
      });
      
      req.write(soapEnvelope);
      req.end();
    });
  }

  /**
   * Constructs a standard W3C SOAP 1.2 envelope with WS-Security credentials
   */
  private buildSoapEnvelope(action: string, body: string): string {
    const created = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('base64');
    
    // Hash password according to WS-Security specification (Digest = SHA1(Nonce + Created + Password))
    const sha1 = crypto.createHash('sha1');
    sha1.update(Buffer.concat([
      Buffer.from(nonce, 'base64'),
      Buffer.from(created, 'utf8'),
      Buffer.from(this.password, 'utf8')
    ]));
    const passwordDigest = sha1.digest('base64');

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" 
               xmlns:tds="http://www.onvif.org/ver10/device/wsdl" 
               xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
               xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
               xmlns:tim="http://www.onvif.org/ver20/imaging/wsdl">
  <soap:Header>
    <Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
      <UsernameToken>
        <Username>${this.username}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>
      </UsernameToken>
    </Security>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Retrieve camera capabilities and service mappings
   */
  public async initializeServices(): Promise<void> {
    try {
      const body = `<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>`;
      const responseXml = await this.soapRequest('device', 'GetCapabilities', body);
      
      // Parse service URIs using regex to extract addresses
      this.extractServiceUrl(responseXml, 'Media', 'media');
      this.extractServiceUrl(responseXml, 'PTZ', 'ptz');
      this.extractServiceUrl(responseXml, 'Imaging', 'imaging');
      this.extractServiceUrl(responseXml, 'Events', 'events');
      
      console.log(`[ONVIF Client] Initialized services for camera ${this.config.ip}:`, Array.from(this.serviceUrls.keys()));
    } catch (error) {
      console.warn(`[ONVIF Client] GetCapabilities failed for ${this.config.ip} (Partial ONVIF impl assumed):`, error);
      // Fallback: Map default standard paths used by most vendors
      const scheme = this.config.protocol === 'HTTPS' ? 'https' : 'http';
      const port = this.config.onvifPort || 80;
      this.serviceUrls.set('media', `${scheme}://${this.config.ip}:${port}/onvif/media`);
      this.serviceUrls.set('ptz', `${scheme}://${this.config.ip}:${port}/onvif/ptz`);
      this.serviceUrls.set('imaging', `${scheme}://${this.config.ip}:${port}/onvif/imaging`);
    }
  }

  private extractServiceUrl(xml: string, serviceName: string, serviceKey: string): void {
    const regex = new RegExp(`<[^>:]*:${serviceName}>\\s*<[^>:]*:XAddr>([^<]+)</[^>:]*:XAddr>`, 'i');
    const match = xml.match(regex);
    if (match && match[1]) {
      this.serviceUrls.set(serviceKey, match[1].trim());
    }
  }

  /**
   * Query device information details
   */
  public async getDeviceInformation(): Promise<DeviceDetails> {
    const body = `<tds:GetDeviceInformation/>`;
    const responseXml = await this.soapRequest('device', 'GetDeviceInformation', body);
    
    return {
      vendor: this.extractXmlTagValue(responseXml, 'Manufacturer') || this.config.type || 'Generic ONVIF',
      model: this.extractXmlTagValue(responseXml, 'Model') || 'IP Camera',
      firmwareVersion: this.extractXmlTagValue(responseXml, 'FirmwareVersion') || '1.0.0',
      serialNumber: this.extractXmlTagValue(responseXml, 'SerialNumber') || 'N/A',
      macAddress: this.extractXmlTagValue(responseXml, 'MacAddress') || '00:00:00:00:00:00',
      hardwareId: this.extractXmlTagValue(responseXml, 'HardwareId') || 'HW-001'
    };
  }

  /**
   * Pull active profile stream URI for Profile S/T clients
   */
  public async getStreamUri(profileToken = 'Profile_1'): Promise<string> {
    const body = `<trt:GetStreamUri>
      <trt:StreamSetup>
        <trt:Stream>RTP-Unicast</trt:Stream>
        <trt:Transport><trt:Protocol>TCP</trt:Protocol></trt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>${profileToken}</trt:ProfileToken>
    </trt:GetStreamUri>`;
    
    try {
      const responseXml = await this.soapRequest('media', 'GetStreamUri', body);
      const uri = this.extractXmlTagValue(responseXml, 'Uri');
      if (uri) return uri;
    } catch (e) {
      console.warn(`[ONVIF Media] Failed to fetch stream URI via SOAP:`, e);
    }
    return this.config.streamUrl; // Fallback to config stream URL
  }

  /**
   * PTZ Telemetry controller for Profile T models
   */
  public async ptzControl(cmd: PtzCommand): Promise<void> {
    if (!this.serviceUrls.has('ptz')) return;
    
    let body = '';
    let action = '';

    if (cmd.action === 'MOVE_CONTINUOUS') {
      action = 'ContinuousMove';
      body = `<tptz:ContinuousMove>
        <tptz:ProfileToken>Profile_1</tptz:ProfileToken>
        <tptz:Velocity>
          <tt:PanTilt x="${cmd.pan || 0}" y="${cmd.tilt || 0}" xmlns:tt="http://www.onvif.org/ver10/schema"/>
          <tt:Zoom x="${cmd.zoom || 0}" xmlns:tt="http://www.onvif.org/ver10/schema"/>
        </tptz:Velocity>
        <tptz:Timeout>PT10S</tptz:Timeout>
      </tptz:ContinuousMove>`;
    } else if (cmd.action === 'STOP') {
      action = 'Stop';
      body = `<tptz:Stop>
        <tptz:ProfileToken>Profile_1</tptz:ProfileToken>
        <tptz:PanTilt>true</tptz:PanTilt>
        <tptz:Zoom>true</tptz:Zoom>
      </tptz:Stop>`;
    } else {
      return; // Skip complex absolute movements in this pass
    }

    await this.soapRequest('ptz', action, body);
  }

  /**
   * Set physical camera IRcut modes
   */
  public async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    if (!this.serviceUrls.has('imaging')) return false;

    const onvifMode = mode === 'DAY' ? 'ON' : mode === 'NIGHT' ? 'OFF' : 'AUTO';
    const body = `<tim:SetImagingSettings>
      <tim:VideoSourceToken>VideoSource_1</tim:VideoSourceToken>
      <tim:ImagingSettings>
        <tt:IrCutFilter>${onvifMode}</tt:IrCutFilter>
      </tim:ImagingSettings>
    </tim:SetImagingSettings>`;

    try {
      await this.soapRequest('imaging', 'SetImagingSettings', body);
      return true;
    } catch (e) {
      console.error(`[ONVIF Imaging] Failed to set IR-cut filter:`, e);
      return false;
    }
  }

  /**
   * Synchronize on-board RTC clock
   */
  public async syncTime(): Promise<boolean> {
    const now = new Date();
    const body = `<tds:SetSystemDateAndTime>
      <tds:DateTimeType>Manual</tds:DateTimeType>
      <tds:DaylightSavings>false</tds:DaylightSavings>
      <tds:TimeZone><tt:TZ>GMT-0</tt:TZ></tds:TimeZone>
      <tds:UTCDateTime>
        <tt:Time><tt:Hour>${now.getUTCHours()}</tt:Hour><tt:Minute>${now.getUTCMinutes()}</tt:Minute><tt:Second>${now.getUTCSeconds()}</tt:Second></tt:Time>
        <tt:Date><tt:Year>${now.getUTCFullYear()}</tt:Year><tt:Month>${now.getUTCMonth() + 1}</tt:Month><tt:Day>${now.getUTCDate()}</tt:Day></tt:Date>
      </tds:UTCDateTime>
    </tds:SetSystemDateAndTime>`;

    try {
      await this.soapRequest('device', 'SetSystemDateAndTime', body);
      return true;
    } catch (e) {
      console.error(`[ONVIF Device] Failed to synchronize clock:`, e);
      return false;
    }
  }

  /**
   * Fetch capabilities flags safely
   */
  public async getCapabilities(): Promise<CameraCapabilities> {
    const caps: CameraCapabilities = {
      ptz: this.serviceUrls.has('ptz'),
      audioIn: true,
      audioOut: false,
      edgeStorage: true,
      firmwareUpgrade: true,
      onvifSupported: true,
      onvifProfiles: ['S', 'T'],
      supportedResolutions: ['1920x1080', '1280x720', '640x480'],
      supportedCodecs: ['H264', 'H265'],
      irControl: this.serviceUrls.has('imaging'),
      ledControl: false,
      smartDetections: ['MOTION_DETECTION']
    };
    return caps;
  }

  private extractXmlTagValue(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<[^>:]*:${tagName}[^>]*>([^<]+)</[^>:]*:${tagName}>`, 'i');
    const match = xml.match(regex);
    if (match && match[1]) return match[1].trim();
    
    const fallbackRegex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i');
    const fallbackMatch = xml.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1]) return fallbackMatch[1].trim();

    return null;
  }
}
