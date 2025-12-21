import { GoogleGenAI, Type } from "@google/genai";
import { GeminiModel, Product } from '../types';

// Helper function to safely get env variables
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const apiKey = getEnv('API_KEY');
// Fallback to avoid crash if key is missing, though calls will fail
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

export const getAdventureRecommendation = async (userQuery: string, products: Product[]): Promise<{ text: string, recommendedIds: string[] }> => {
  if (!apiKey) {
    console.error("API Key not found");
    return { 
      text: "Maaf, sistem AI sedang offline. Silakan pilih alat secara manual atau hubungi admin.", 
      recommendedIds: [] 
    };
  }

  // Gunakan daftar produk dinamis yang dikirimkan ke fungsi
  const productContext = products.map(p => `- ${p.name} (ID: ${p.id}, Kategori: ${p.category})`).join('\n');

  const systemInstruction = `
    Anda adalah 'Mamas Guide', asisten ahli outdoor dari rental 'Mamas Outdoor' di Purwokerto.
    Target audiens adalah mahasiswa yang ingin mendaki gunung (seperti Gn. Slamet, Prau, Sindoro, Sumbing) atau camping ceria.
    
    Tugas Anda:
    1. Berikan saran ramah dan singkat dalam Bahasa Indonesia yang santai tapi sopan.
    2. Rekomendasikan alat dari daftar inventaris yang tersedia berdasarkan kebutuhan user.
    3. Jika user bertanya tentang gunung di sekitar Purwokerto (Slamet, dsb), berikan tips singkat.
    
    Inventaris Mamas Outdoor (Live Data):
    ${productContext}
    
    Format respon harus JSON dengan skema:
    {
      "advice": "Saran teks anda disini...",
      "recommendedProductIds": ["id1", "id2"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH,
      contents: userQuery,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advice: { type: Type.STRING },
            recommendedProductIds: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["advice", "recommendedProductIds"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    return {
      text: result.advice || "Saya tidak dapat memberikan saran spesifik saat ini.",
      recommendedIds: result.recommendedProductIds || []
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "Maaf, saya sedang kesulitan berpikir. Mari kita lihat katalog manual saja ya!",
      recommendedIds: []
    };
  }
};