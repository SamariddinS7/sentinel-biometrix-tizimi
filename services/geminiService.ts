
import { GoogleGenAI, Chat, Type, Schema } from "@google/genai";
import { AttendanceRecord } from "../types";

const processApiKey = process.env.API_KEY || '';

export interface DetailedAnomaly {
  type: string;
  description: string;
}

export interface SecurityAuditReport {
  summary: string;
  anomalies: DetailedAnomaly[];
  patterns: string[];
  recommendations: string[];
}

export interface GroundingChunk {
    web?: { uri?: string; title?: string };
    maps?: { 
        uri?: string; 
        title?: string; 
        placeAnswerSources?: { reviewSnippets?: any[] } 
    };
}

export interface MapIntelligenceResult {
    text: string;
    groundingChunks: GroundingChunk[];
}

const LANGUAGE_NAMES: Record<string, string> = {
    'en-US': 'English',
    'es': 'Spanish',
    'uz': 'O\'zbek tili (Uzbek)'
};

// --- Log Analysis ---
export const analyzeSecurityLogs = async (logs: AttendanceRecord[], language: string = 'uz'): Promise<SecurityAuditReport | null> => {
  if (!processApiKey) {
      console.warn("API Key not configured. Using mock response for demo.");
      return {
          summary: "Tizim demo rejimida ishlamoqda. To'liq AI tahlili uchun API kalitini ulang.",
          anomalies: [
            { type: "Ruxsatsiz kirish", description: "Simulyatsiya: Server xonasiga ruxsatsiz kirish urinishi." },
            { type: "Past ishonchlilik", description: "Asosiy kirishda past ishonchlilik (45%) aniqlandi." }
          ],
          patterns: ["Simulyatsiya: Soat 08:00 - 09:00 oralig'ida yuqori tirbandlik.", "IT bo'limida doimiy kechikishlar."],
          recommendations: ["Real vaqt rejimida tahlillarni olish uchun API kalitini faollashtiring.", "CAM-01 kamerasidagi yoritishni tekshiring."]
      };
  }

  const ai = new GoogleGenAI({ apiKey: processApiKey });

  const logSummary = logs.map(l => 
    `[${l.timestamp}] Foydalanuvchi: ${l.userName} (${l.department}), Holat: ${l.status}, Aniqlik: ${l.confidenceScore}, Jonlilik: ${l.livenessVerified}`
  ).join('\n');

  // Force Uzbek if language is 'uz'
  const langName = LANGUAGE_NAMES['uz'];

  const prompt = `
    Siz korporativ biometrik davomat tizimi uchun Xavfsizlik Auditi AI (Sun'iy Intellekt)siz.
    Quyidagi kirish jurnallarini tahlil qiling va xavfsizlik hamda operatsion hisobot tuzing.
    
    Quyidagi yo'nalishlarga e'tibor qarating:
    1. Anomaliyalar: "Buddy punching" (bir xodim boshqasi o'rniga belgi qoldirishi - masalan, qisqa vaqt ichida bir xil kameradan shubhali kirishlar), noodatiy ish soatlari (masalan, tunda yoki dam olish kunlari kirish), va takroriy kechikishlar. Har bir anomaliya uchun BATAFSIL tushuntirish bering (nima uchun bu anomaliya hisoblanadi, qaysi xodimlar aloqador).
    2. Qonuniyatlar (Patterns): KECHIKISHLARNI tahlil qiling. Qaysi xodimlar yoki bo'limlar tez-tez kechikyapti? Vaqt tendentsiyalarini aniqlang.
    3. Operatsion Tavsiyalar: Xavfsizlikni yaxshilash (masalan, "X kamerasini sozlash") yoki samaradorlikni oshirish bo'yicha aniq takliflar bering.

    Tahlil uchun jurnallar:
    ${logSummary}
    
    Javobni quyidagi JSON sxemasida bering.
    MUHIM: Xulosa, anomaliyalar, qonuniyatlar va tavsiyalar ${langName}da bo'lishi SHART.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: `Xavfsizlik holati va davomat bo'yicha qisqacha xulosa (${langName}da).` },
      anomalies: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: `Anomaliya turi (masalan, "Buddy Punching", "Noodatiy vaqt").` },
            description: { type: Type.STRING, description: `Anomaliya haqida batafsil tushuntirish va dalillar.` }
          },
          required: ["type", "description"]
        }, 
        description: `Aniqlangan xavfsizlik anomaliyalari va shubhali holatlar ro'yxati (${langName}da).` 
      },
      patterns: { type: Type.ARRAY, items: { type: Type.STRING }, description: `Kuzatilgan xatti-harakatlar va davomat qonuniyatlari (${langName}da).` },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: `Amaliy xavfsizlik va operatsion tavsiyalar (${langName}da).` },
    },
    required: ["summary", "anomalies", "patterns", "recommendations"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    
    if (response.text) {
        return JSON.parse(response.text) as SecurityAuditReport;
    }
    return null;
  } catch (error: any) {
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return {
            summary: "AI Xizmati limiti tugadi. Keshlangan ma'lumot ko'rsatilmoqda.",
            anomalies: [{ type: "Xatolik", description: "Limit sababli tahlil mavjud emas." }],
            patterns: ["Mavjud emas"],
            recommendations: ["Birozdan so'ng qayta urinib ko'ring."]
        };
    }
    console.error("AI Audit failed:", error);
    return null;
  }
};

// --- Google Maps Grounding Analysis ---
export const fetchLocationIntelligence = async (locationQuery: string, language: string = 'uz'): Promise<MapIntelligenceResult | null> => {
    if (!processApiKey) return null;

    const ai = new GoogleGenAI({ apiKey: processApiKey });
    const modelId = "gemini-2.5-flash";
    const langName = LANGUAGE_NAMES['uz'];

    const prompt = `
        Joylashuvni tahlil qiling: "${locationQuery}".
        Bu yerda joylashgan obyekt uchun xavfsizlik va logistik baho bering.
        Quyidagilarni o'z ichiga oling:
        1. Yaqin atrofdagi asosiy yo'llar yoki transport tugunlari.
        2. Atrof-muhit turi (tijorat, aholi yashash joyi, sanoat).
        3. Xavfsizlik xodimlari uchun mo'ljal bo'lib xizmat qiladigan har qanday mashhur joylar.
        
        Javob to'liq ${langName}da bo'lsin.
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
            },
        });

        const text = response.text || "Tahlil yaratilmadi.";
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        return {
            text,
            groundingChunks: chunks
        };

    } catch (error: any) {
        console.error("Maps Grounding Failed:", error);
        return {
            text: "Joylashuv ma'lumotlarini olishda xatolik yuz berdi.",
            groundingChunks: []
        };
    }
};

// --- Dashboard Insights ---
export const generateDashboardInsight = async (
  metricTitle: string,
  dataPoints: { time: string; val: number }[],
  currentValue: number | string,
  trend: string,
  language: string = 'uz'
): Promise<string> => {
  if (!processApiKey) return "AI prognozi mavjud emas (API Kalit yo'q).";
  
  const ai = new GoogleGenAI({ apiKey: processApiKey });
  const langName = LANGUAGE_NAMES['uz'];

  const prompt = `
    Siz Analitik AI tizimisiz. Davomat tizimi uchun ushbu ko'rsatkichni tahlil qiling.
    Ko'rsatkich: ${metricTitle}
    Joriy Qiymat: ${currentValue}
    Trend Yo'nalishi: ${trend}
    Oxirgi ma'lumotlar: ${JSON.stringify(dataPoints.slice(0, 10))}

    ${langName}da 2 ta gapdan iborat qisqa xulosa bering:
    1. Kuzatilgan holat (masalan, eng yuqori vaqt, barqarorlik).
    2. Qisqa prognoz yoki operatsion tavsiya.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Prognoz mavjud emas.";
  } catch (e) {
    return "Hozirda prognoz mavjud emas.";
  }
};

// --- Semantic Camera Search ---
export interface CameraFrame {
  cameraId: string;
  cameraName: string;
  base64Image: string;
}

export interface SearchMatch {
  cameraId: string;
  explanation: string;
  confidence: number;
}

export interface SearchResult {
  matches: SearchMatch[];
  summary: string;
}

export const semanticCameraSearch = async (query: string, frames: CameraFrame[], language: string = 'uz'): Promise<SearchResult | null> => {
  if (!processApiKey) {
    return {
      summary: "Demo rejim: API kalit ulanmagan.",
      matches: []
    };
  }

  const ai = new GoogleGenAI({ apiKey: processApiKey });
  const langName = LANGUAGE_NAMES[language] || 'Uzbek';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: `Qidiruv natijalari haqida qisqacha xulosa (${langName}da).` },
      matches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            cameraId: { type: Type.STRING, description: "Kamera identifikatori." },
            explanation: { type: Type.STRING, description: `Nimaga bu kamera tanlandi, qisqa sharh (${langName}da).` },
            confidence: { type: Type.NUMBER, description: "Ishonchlilik darajasi 0.0 dan 1.0 gacha." }
          },
          required: ["cameraId", "explanation", "confidence"]
        }
      }
    },
    required: ["summary", "matches"]
  };

  const prompt = `
    Qidiruv so'rovi: "${query}"
    Siz xavfsizlik kamerasi tahlilchisisiz.
    Sizga turli kameralardan olingan kadrlar berilgan. Har bir kadr uchun u qaysi kameraga tegishli ekanligi ko'rsatilgan.
    Ushbu so'rovga (odam, narsa yoki hodisa) mos keladigan kadrlarni toping va javobni faqat JSON formatida, ${langName}da qaytaring.
  `;

  try {
    const parts: any[] = [];
    parts.push({ text: prompt });

    for (const frame of frames) {
      parts.push({ text: `\nKamera: ${frame.cameraName} (ID: ${frame.cameraId})` });
      const cleanBase64 = frame.base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: parts,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as SearchResult;
  } catch (error) {
    console.error("Semantic Camera Search failed:", error);
    return null;
  }
};

// --- Vision Analysis for Face Detector ---
export interface BiometricAnalysisResult {
  estimatedAge: string;
  expression: string;
  features: string;
  wearables: string;
  livenessConfidence: number;
}

export const analyzeBiometricFrame = async (base64Image: string, language: string = 'uz'): Promise<BiometricAnalysisResult | null> => {
  if (!processApiKey) {
    console.warn("No API Key found for vision analysis");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: processApiKey });
  const langName = LANGUAGE_NAMES['uz'];
  
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      estimatedAge: { type: Type.STRING, description: "Taxminiy yosh oralig'i (masalan, 25-30)" },
      expression: { type: Type.STRING, description: `Yuz ifodasi (masalan, Neytral, Xursand) - ${langName}da` },
      features: { type: Type.STRING, description: `Asosiy belgilar (soch, soqol) - ${langName}da` },
      wearables: { type: Type.STRING, description: `Kiyilgan narsalar (ko'zoynak, maska) - ${langName}da` },
      livenessConfidence: { type: Type.NUMBER, description: "Jonlilik darajasi 0.0-1.0" },
    },
    required: ["estimatedAge", "expression", "features", "wearables", "livenessConfidence"],
  };

  const prompt = `
    Xavfsizlik kamerasidan olingan ushbu tasvirni tahlil qiling.
    Javoblarni ${langName}ga tarjima qilib qaytaring.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as BiometricAnalysisResult;
  } catch (error: any) {
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return {
            estimatedAge: "Mavjud emas (Limit)",
            expression: "Neytral",
            features: "AI Limiti Tugadi",
            wearables: "Noma'lum",
            livenessConfidence: 0.0
        };
    }
    
    console.error("Vision Analysis failed:", error);
    return null;
  }
};

// --- AI Chatbot Service ---

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: { type: 'image' | 'video', data: string, mimeType: string }[];
}

export class AIChatService {
  private chat: Chat | null = null;
  private ai: GoogleGenAI;
  private modelName = 'gemini-3-pro-preview';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: processApiKey });
  }

  private initChat(thinkingMode: boolean) {
    const config: any = {
      systemInstruction: "Siz Sentinel AI tizimisiz – Biometrik Davomat Tizimi uchun ilg'or xavfsizlik yordamchisi. Siz administratorlarga xavfsizlik videolarini tahlil qilish, kirish jurnallarini tushunish va tizimni boshqarishda yordam berasiz. Javoblaringiz qisqa, professional va xavfsizlikka yo'naltirilgan bo'lsin. Barcha javoblarni faqat O'zbek tilida bering."
    };

    if (thinkingMode) {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    this.chat = this.ai.chats.create({
      model: this.modelName,
      config: config
    });
  }

  async sendMessage(
    text: string, 
    attachments: { data: string, mimeType: string }[] = [], 
    thinkingMode: boolean = false,
    language: string = 'uz'
  ): Promise<string> {
    if (!processApiKey) return "API Kalit yetishmayapti. Sentinel AI bilan bog'lanib bo'lmadi.";

    if (!this.chat) {
      this.initChat(thinkingMode);
    }

    const langName = LANGUAGE_NAMES['uz'];

    try {
      const parts: any[] = [];
      
      for (const att of attachments) {
        const cleanData = att.data.replace(/^data:(image|video)\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: cleanData
          }
        });
      }

      if (text) {
        parts.push({ text: `${text}\n\n(MUHIM: Iltimos, javobni ${langName}da bering)` });
      }

      const result = await this.chat!.sendMessage({
        message: parts
      });

      return result.text || "Javob olinmadi.";
    } catch (error: any) {
      console.error("Chat Error:", error);
      this.chat = null;
      return `Xatolik: ${error.message || "AI bilan aloqa uzildi."}`;
    }
  }

  reset() {
    this.chat = null;
  }
}

export const aiChatService = new AIChatService();

// --- RF-DETR Vision Object Detection ---
export interface DETRObject {
  id: number;
  label: string;
  confidence: number;
  // Bounding box in range 0.0 to 100.0 (top, left, width, height) represented as percentage of container
  top: number;
  left: number;
  width: number;
  height: number;
}

export const detectObjectsWithRFDetr = async (base64Image: string): Promise<DETRObject[] | null> => {
  if (!processApiKey) {
    console.warn("No API Key found for DETR analysis");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: processApiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      objects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: "Unique sequential ID" },
            label: { type: Type.STRING, description: "Object class name (e.g. Person, Laptop, Backpack, Cell Phone, Cup, Chair)" },
            confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
            box: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Bounding box coordinates in [ymin, xmin, ymax, xmax] relative decimals from 0.0 to 1.0"
            }
          },
          required: ["id", "label", "confidence", "box"]
        }
      }
    },
    required: ["objects"]
  };

  const prompt = `
    Analyze this security camera frame mimicking Roboflow's SOTA real-time RF-DETR model (ICLR 2026).
    Detect primary objects (people, laptops, backpacks, cell phones, chairs, cups, boxes, etc.).
    For each object, specify an exact bounding box in [ymin, xmin, ymax, xmax] relative grid coordinate decimals between 0.0 and 1.0. 
    Use the following mapping equations:
    - top = ymin * 100
    - left = xmin * 100
    - width = (xmax - xmin) * 100
    - height = (ymax - ymin) * 100
    Return your response strictly conforming to the requested JSON schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    
    // Map bounding boxes from ymin, xmin, ymax, xmax values to percentage values [top, left, width, height]
    return (parsed.objects || []).map((o: any) => {
      const { box } = o;
      const ymin = box[0] ?? 0;
      const xmin = box[1] ?? 0;
      const ymax = box[2] ?? 0.8;
      const xmax = box[3] ?? 0.8;
      
      return {
        id: o.id,
        label: o.label,
        confidence: o.confidence,
        top: Math.round(ymin * 100),
        left: Math.round(xmin * 100),
        width: Math.max(5, Math.round((xmax - xmin) * 100)),
        height: Math.max(5, Math.round((ymax - ymin) * 100))
      };
    });
  } catch (error) {
    console.error("DETR analysis failed:", error);
    return null;
  }
};

export interface ReconstructedBlueprint {
  status: string;
  message: string;
  walls: { id: string; x1: number; y1: number; x2: number; y2: number; height: number }[];
  zones: { id: string; name: string; type: string; color: string; points: { x: number; y: number }[] }[];
  cameras: { cameraId: string; x: number; y: number; height: number; rotation: number; pitch: number }[];
}

export const enhanceAndReconstructBlueprint = async (base64Image: string): Promise<ReconstructedBlueprint | null> => {
  if (!processApiKey) {
    console.warn("No API Key found for blueprint enhancement");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: processApiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const prompt = `
    Restore and enhance this blurry photo to ultra-high-quality 4K resolution. Recover fine facial details, sharp focus, natural skin texture, realistic lighting, accurate colors, high dynamic range, clean background, professional photography quality. Remove blur, noise, compression artifacts, and pixelation. Preserve the original identity, proportions, and composition. Ultra-detailed, photorealistic, crystal clear, 4K UHD, maximum sharpness, realistic textures.

    Additionally, analyze this floor plan/blueprint image and reconstruct its architecture. Identify the layout of the building in 2D/3D space (within a coordinate box of X: [-25 to 25], Z: [-15 to 15]).
    Return a structured JSON of the architectural elements (walls, zones, recommended camera placements) so that we can render them beautifully.
    
    Response format must strictly match the following JSON structure:
    {
      "status": "success",
      "message": "Enhanced and converted to 3D successfully",
      "walls": [
        { "id": "W-1", "x1": -20, "y1": -15, "x2": 20, "y2": -15, "height": 3.0 }
      ],
      "zones": [
        { "id": "Z-LAWN1", "name": "Yashil maydon (Garden)", "type": "restricted", "color": "#15803d", "points": [{ "x": 12, "y": -10 }, { "x": 23, "y": -10 }, { "x": 23, "y": 10 }, { "x": 12, "y": 10 }] }
      ],
      "cameras": [
        { "cameraId": "CAM-LAWN", "x": 15, "y": 8, "height": 3.0, "rotation": 180, "pitch": -15 }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ReconstructedBlueprint;
  } catch (error) {
    console.error("Blueprint AI analysis failed:", error);
    return null;
  }
};
