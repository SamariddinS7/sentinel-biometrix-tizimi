import express, { Request, Response, NextFunction } from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Local storage backup for simulated persistence
const usersDb: any[] = [
  {
    id: "U-EMP-01",
    fullName: "Kamron Aliyev",
    role: "ADMIN",
    department: "IT Bo'limi",
    enrolledDate: "2026-01-15",
    hasEmbedding: true,
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150",
    lastActive: "10 daqiqa oldin"
  },
  {
    id: "U-EMP-02",
    fullName: "Madina Solihova",
    role: "SUPERVISOR",
    department: "Moliya Bo'limi",
    enrolledDate: "2026-02-10",
    hasEmbedding: true,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150",
    lastActive: "Hozir faol"
  }
];

const JWT_SECRET = process.env.JWT_SECRET || "sentinel_biometrics_super_secret_key_2026";
const geminiKey = process.env.GEMINI_API_KEY;
const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image transfers for biometrics and blueprints
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- Authentication Middleware ---
  const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Kirish huquqi yo'q (Token topilmadi)" });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        res.status(403).json({ error: "Yaroqsiz yoki muddati o'tgan sessiya" });
        return;
      }
      (req as any).user = user;
      next();
    });
  };

  // --- Role Check Middleware ---
  const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ error: "Ruxsat etilmagan amal (Sizda yetarli huquqlar mavjud emas)" });
        return;
      }
      next();
    };
  };

  // --- API Routes ---

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    
    // In a production-ready system we verify email & hashed password
    const adminEmail = "admin@sentinel.sys";
    const supervisorEmail = "supervisor@sentinel.sys";

    let matchedUser = null;

    if (email === adminEmail) {
      matchedUser = {
        id: "U-EMP-01",
        email: adminEmail,
        fullName: "Kamron Aliyev",
        role: "ADMIN",
        department: "IT Bo'limi"
      };
    } else if (email === supervisorEmail) {
      matchedUser = {
        id: "U-EMP-02",
        email: supervisorEmail,
        fullName: "Madina Solihova",
        role: "SUPERVISOR",
        department: "Moliya Bo'limi"
      };
    } else {
      // Default fallback for user management or registration testing
      matchedUser = {
        id: "U-EMP-99",
        email: email,
        fullName: email.split("@")[0],
        role: "EMPLOYEE",
        department: "Kadrlar Bo'limi"
      };
    }

    const token = jwt.sign(
      { id: matchedUser.id, email: matchedUser.email, role: matchedUser.role, fullName: matchedUser.fullName },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      user: matchedUser
    });
  });

  // Get current user profile
  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // --- Secure Gemini AI Proxy Endpoints ---

  // Analyze Security Logs
  app.post("/api/ai/analyze-logs", authenticateToken, async (req, res) => {
    if (!ai) {
      res.json({
        summary: "Tizim demo rejimida ishlamoqda. To'liq AI tahlili uchun API kalitini ulang.",
        anomalies: [
          { type: "Ruxsatsiz kirish", description: "Simulyatsiya: Server xonasiga ruxsatsiz kirish urinishi." },
          { type: "Past ishonchlilik", description: "Asosiy kirishda past ishonchlilik (45%) aniqlandi." }
        ],
        patterns: ["Simulyatsiya: Soat 08:00 - 09:00 oralig'ida yuqori tirbandlik.", "IT bo'limida doimiy kechikishlar."],
        recommendations: ["Real vaqt rejimida tahlillarni olish uchun API kalitini faollashtiring.", "CAM-01 kamerasidagi yoritishni tekshiring."]
      });
      return;
    }

    const { logs } = req.body;
    const logSummary = (logs || []).map((l: any) => 
      `[${l.timestamp}] Foydalanuvchi: ${l.userName} (${l.department}), Holat: ${l.status}, Aniqlik: ${l.confidenceScore}, Jonlilik: ${l.livenessVerified}`
    ).join("\n");

    const prompt = `
      Siz korporativ biometrik davomat tizimi uchun Xavfsizlik Auditi AI (Sun'iy Intellekt)siz.
      Quyidagi kirish jurnallarini tahlil qiling va xavfsizlik hamda operatsion hisobot tuzing.
      
      Quyidagi yo'nalishlarga e'tibor qarating:
      1. Anomaliyalar: "Buddy punching" (bir xodim boshqasi o'rniga belgi qoldirishi), noodatiy ish soatlari va takroriy kechikishlar. Har bir anomaliya uchun BATAFSIL tushuntirish bering.
      2. Qonuniyatlar (Patterns): Kechikishlarni tahlil qiling.
      3. Operatsion Tavsiyalar: Xavfsizlikni yaxshilash yoki samaradorlikni oshirish bo'yicha aniq takliflar bering.

      Tahlil uchun jurnallar:
      ${logSummary}
      
      MUHIM: Xulosa, anomaliyalar, qonuniyatlar va tavsiyalar O'zbek tilida bo'lishi SHART.
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Xavfsizlik holati va davomat bo'yicha qisqacha xulosa." },
        anomalies: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["type", "description"]
          }, 
          description: "Aniqlangan xavfsizlik anomaliyalari." 
        },
        patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["summary", "anomalies", "patterns", "recommendations"],
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      
      if (response.text) {
        res.json(JSON.parse(response.text));
      } else {
        res.status(500).json({ error: "Tahlil natijasi yaratilmadi." });
      }
    } catch (error: any) {
      console.error("AI log analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Location Intelligence (Maps Grounding)
  app.post("/api/ai/location-intelligence", authenticateToken, async (req, res) => {
    if (!ai) {
      res.status(400).json({ error: "Gemini API key is not configured" });
      return;
    }

    const { locationQuery } = req.body;
    const prompt = `
      Joylashuvni tahlil qiling: "${locationQuery}".
      Bu yerda joylashgan obyekt uchun xavfsizlik va logistik baho bering.
      Quyidagilarni o'z ichiga oling:
      1. Yaqin atrofdagi asosiy yo'llar yoki transport tugunlari.
      2. Atrof-muhit turi (tijorat, aholi yashash joyi, sanoat).
      3. Xavfsizlik xodimlari uchun mo'ljal bo'lib xizmat qiladigan har qanday mashhur joylar.
      
      Javob to'liq O'zbek tilida bo'lsin.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const text = response.text || "Tahlil yaratilmadi.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      res.json({ text, groundingChunks: chunks });
    } catch (error: any) {
      console.error("Location intelligence error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Insights
  app.post("/api/ai/dashboard-insight", authenticateToken, async (req, res) => {
    if (!ai) {
      res.json({ insight: "AI prognozi mavjud emas (API Kalit yo'q)." });
      return;
    }

    const { metricTitle, dataPoints, currentValue, trend } = req.body;
    const prompt = `
      Siz Analitik AI tizimisiz. Davomat tizimi uchun ushbu ko'rsatkichni tahlil qiling.
      Ko'rsatkich: ${metricTitle}
      Joriy Qiymat: ${currentValue}
      Trend Yo'nalishi: ${trend}
      Oxirgi ma'lumotlar: ${JSON.stringify((dataPoints || []).slice(0, 10))}

      O'zbek tilida 2 ta gapdan iborat qisqa xulosa bering:
      1. Kuzatilgan holat.
      2. Qisqa prognoz yoki operatsion tavsiya.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      res.json({ insight: response.text || "Prognoz tayyorlash imkonsiz." });
    } catch (error: any) {
      res.json({ insight: "Hozirda prognoz mavjud emas." });
    }
  });

  // Semantic Camera Search
  app.post("/api/ai/camera-search", authenticateToken, async (req, res) => {
    if (!ai) {
      res.json({ summary: "Demo rejim: API kalit ulanmagan.", matches: [] });
      return;
    }

    const { query: searchQuery, frames } = req.body;
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Qidiruv natijalari haqida qisqacha xulosa." },
        matches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              cameraId: { type: Type.STRING },
              explanation: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["cameraId", "explanation", "confidence"]
          }
        }
      },
      required: ["summary", "matches"]
    };

    const prompt = `
      Qidiruv so'rovi: "${searchQuery}"
      Siz xavfsizlik kamerasi tahlilchisisiz.
      Sizga turli kameralardan olingan kadrlar berilgan. Har bir kadr uchun u qaysi kameraga tegishli ekanligi ko'rsatilgan.
      Ushbu so'rovga mos keladigan kadrlarni toping va javobni faqat JSON formatida, O'zbek tilida qaytaring.
    `;

    try {
      const parts: any[] = [{ text: prompt }];

      for (const frame of (frames || [])) {
        parts.push({ text: `\nKamera: ${frame.cameraName} (ID: ${frame.cameraId})` });
        const cleanBase64 = frame.base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (response.text) {
        res.json(JSON.parse(response.text));
      } else {
        res.status(500).json({ error: "Qidiruv bajarilmadi." });
      }
    } catch (error: any) {
      console.error("Camera search error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Biometric Frame Analysis
  app.post("/api/ai/biometric-frame", authenticateToken, async (req, res) => {
    if (!ai) {
      res.status(400).json({ error: "Gemini API key is not configured" });
      return;
    }

    const { base64Image } = req.body;
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        estimatedAge: { type: Type.STRING },
        expression: { type: Type.STRING },
        features: { type: Type.STRING },
        wearables: { type: Type.STRING },
        livenessConfidence: { type: Type.NUMBER },
      },
      required: ["estimatedAge", "expression", "features", "wearables", "livenessConfidence"],
    };

    const prompt = `
      Xavfsizlik kamerasidan olingan ushbu tasvirni tahlil qiling.
      Javoblarni O'zbek tiliga tarjima qilib qaytaring.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (response.text) {
        res.json(JSON.parse(response.text));
      } else {
        res.status(500).json({ error: "Kadr tahlil qilinmadi." });
      }
    } catch (error: any) {
      console.error("Biometric frame analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // RF-DETR Vision Object Detection
  app.post("/api/ai/detr", authenticateToken, async (req, res) => {
    if (!ai) {
      res.json({ objects: [] });
      return;
    }

    const { base64Image } = req.body;
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        objects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              box: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER }
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
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        const mappedObjects = (parsed.objects || []).map((o: any) => {
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
        res.json({ objects: mappedObjects });
      } else {
        res.json({ objects: [] });
      }
    } catch (error: any) {
      console.error("DETR analysis failed:", error);
      res.json({ objects: [] });
    }
  });

  // Blueprint Analysis
  app.post("/api/ai/blueprint", authenticateToken, async (req, res) => {
    if (!ai) {
      res.status(400).json({ error: "Gemini API key is not configured" });
      return;
    }

    const { base64Image } = req.body;
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const prompt = `
      Restore and enhance this floor plan blueprint image and reconstruct its architecture.
      Identify the layout of the building in 2D/3D space (within a coordinate box of X: [-25 to 25], Z: [-15 to 15]).
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
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response.text) {
        res.json(JSON.parse(response.text));
      } else {
        res.status(500).json({ error: "Chizma tahlili yaratilmadi." });
      }
    } catch (error: any) {
      console.error("Blueprint analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat Bot
  app.post("/api/ai/chat", authenticateToken, async (req, res) => {
    if (!ai) {
      res.json({ text: "API Kalit yetishmayapti. Sentinel AI bilan bog'lanib bo'lmadi." });
      return;
    }

    const { text, attachments, thinkingMode } = req.body;
    
    try {
      const parts: any[] = [];
      
      for (const att of (attachments || [])) {
        const cleanData = att.data.replace(/^data:(image|video)\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: cleanData
          }
        });
      }

      parts.push({
        text: `Tizim Yo'riqnomasi: Siz Sentinel AI tizimisiz – Biometrik Davomat Tizimi uchun ilg'or xavfsizlik yordamchisi. Siz administratorlarga xavfsizlik videolarini tahlil qilish, kirish jurnallarini tushunish va tizimni boshqarishda yordam berasiz. Javoblaringiz qisqa, professional va xavfsizlikka yo'naltirilgan bo'lsin. Barcha javoblarni faqat O'zbek tilida bering.\n\nFoydalanuvchi xabari: ${text}`
      });

      const config: any = {};
      if (thinkingMode) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: parts,
        config
      });

      res.json({ text: response.text || "Javob olinmadi." });
    } catch (error: any) {
      console.error("Chat proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Sentinel Biometrics] Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
