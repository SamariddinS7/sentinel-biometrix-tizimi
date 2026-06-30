import { AttendanceRecord } from "../types";
import { authService } from "./authService";

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

export interface BiometricAnalysisResult {
  estimatedAge: string;
  expression: string;
  features: string;
  wearables: string;
  livenessConfidence: number;
}

export interface ReconstructedBlueprint {
  status: string;
  message: string;
  walls: { id: string; x1: number; y1: number; x2: number; y2: number; height: number }[];
  zones: { id: string; name: string; type: string; color: string; points: { x: number; y: number }[] }[];
  cameras: { cameraId: string; x: number; y: number; height: number; rotation: number; pitch: number }[];
}

// Helper to make authorized JSON post requests to our backend
async function postApi(endpoint: string, body: any) {
  const token = authService.getToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// --- Log Analysis ---
export const analyzeSecurityLogs = async (logs: AttendanceRecord[], language: string = "uz"): Promise<SecurityAuditReport | null> => {
  try {
    return await postApi("/api/ai/analyze-logs", { logs });
  } catch (error) {
    console.error("analyzeSecurityLogs failed, falling back:", error);
    return {
      summary: "Tizim ma'lumot tahlilida vaqtinchalik xatolik. Keyinroq qayta urinib ko'ring.",
      anomalies: [],
      patterns: [],
      recommendations: []
    };
  }
};

// --- Google Maps Grounding Analysis ---
export const fetchLocationIntelligence = async (locationQuery: string, language: string = "uz"): Promise<MapIntelligenceResult | null> => {
  try {
    return await postApi("/api/ai/location-intelligence", { locationQuery });
  } catch (error) {
    console.error("fetchLocationIntelligence failed:", error);
    return {
      text: "Joylashuv ma'lumotlarini olish imkonsiz bo'ldi.",
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
  language: string = "uz"
): Promise<string> => {
  try {
    const res = await postApi("/api/ai/dashboard-insight", { metricTitle, dataPoints, currentValue, trend });
    return res.insight || "AI tahlili mavjud emas.";
  } catch (e) {
    return "Hozirda tahlil tayyorlash imkonsiz.";
  }
};

// --- Semantic Camera Search ---
export const semanticCameraSearch = async (query: string, frames: CameraFrame[], language: string = "uz"): Promise<SearchResult | null> => {
  try {
    return await postApi("/api/ai/camera-search", { query, frames });
  } catch (error) {
    console.error("semanticCameraSearch failed:", error);
    return {
      summary: "Qidiruvda texnik xatolik yuz berdi.",
      matches: []
    };
  }
};

// --- Vision Analysis for Face Detector ---
export const analyzeBiometricFrame = async (base64Image: string, language: string = "uz"): Promise<BiometricAnalysisResult | null> => {
  try {
    return await postApi("/api/ai/biometric-frame", { base64Image });
  } catch (error) {
    console.error("analyzeBiometricFrame failed:", error);
    return null;
  }
};

// --- Blueprint Enhancement and Reconstruction ---
export const enhanceAndReconstructBlueprint = async (base64Image: string): Promise<ReconstructedBlueprint | null> => {
  try {
    return await postApi("/api/ai/blueprint", { base64Image });
  } catch (error) {
    console.error("enhanceAndReconstructBlueprint failed:", error);
    return null;
  }
};

// --- AI Chatbot Service ---
export interface ChatMessage {
  role: "user" | "model";
  text: string;
  attachments?: { type: "image" | "video", data: string, mimeType: string }[];
}

export class AIChatService {
  async sendMessage(
    text: string, 
    attachments: { data: string, mimeType: string }[] = [], 
    thinkingMode: boolean = false,
    language: string = "uz"
  ): Promise<string> {
    try {
      const res = await postApi("/api/ai/chat", { text, attachments, thinkingMode });
      return res.text || "Javob olinmadi.";
    } catch (error: any) {
      console.error("AIChatService failed:", error);
      return `Aloqa xatosi: ${error.message || "Ulanish muvaffaqiyatsiz."}`;
    }
  }

  reset() {
    // No-op for stateless REST proxy
  }
}

export const aiChatService = new AIChatService();

// --- RF-DETR Vision Object Detection ---
export interface DETRObject {
  id: number;
  label: string;
  confidence: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

export const detectObjectsWithRFDetr = async (base64Image: string): Promise<DETRObject[] | null> => {
  try {
    const res = await postApi("/api/ai/detr", { base64Image });
    return res.objects || [];
  } catch (error) {
    console.error("detectObjectsWithRFDetr proxy failed:", error);
    return null;
  }
};

