import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// --- Data Types (Moved from frontend) ---
interface Hit {
  prov: number;
  text: string;
  count: number;
  kingdom: string; // full kingdom ID like 5:11
}

// 1. Initialize the Gemini AI client
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = 'gemini-2.5-flash';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Helper function to convert a File to a Generative Part
 */
async function fileToGenerativePart(file: File): Promise<Part> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: file.type || 'image/jpeg',
    },
  };
}

/**
 * --- Parsing Logic (Moved from frontend) ---
 * Processes the raw log text into a structured, grouped object.
 */
const parseLogText = (input: string): Record<string, Hit[]> => {
    const lines = input.split("\n").filter(Boolean);
    const hits: Record<string, Hit> = {};

    for (const line of lines) {
      // Regex matches "from 17 - As Evil As It Gets (5:11)"
      const match = line.match(/from (\d+ - [^(]+\((\d+:\d+)\))/);
      if (match) {
        const name = match[1].trim();
        const kingdom = match[2];
        
        if (!hits[name]) {
          const provMatch = name.match(/^(\d+)\s-/);
          // Safely parse province number
          const prov = provMatch ? parseInt(provMatch[1]) : 0; 
          hits[name] = { prov, text: name, count: 1, kingdom };
        } else {
          hits[name].count += 1;
        }
      }
    }

    const grouped: Record<string, Hit[]> = {};
    Object.values(hits).forEach((hit) => {
      if (!grouped[hit.kingdom]) grouped[hit.kingdom] = [];
      grouped[hit.kingdom].push(hit);
    });

    // Sort provinces within each kingdom
    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => a.prov - b.prov);
    });

    return grouped;
};

// --- Main API Handler ---
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const imagePart = await fileToGenerativePart(file);
    const geminiModel = ai.getGenerativeModel({ model: model });
    
    const promptText = `
      You are an expert Optical Character Recognition (OCR) system for battle logs.
      The image contains a list of battle log entries.
      Your task is to extract *ALL* the text content from the image.
      Do not summarize, interpret, or add any commentary.
      The output should be the raw, line-by-line text content exactly as it appears in the image,
      ready to be parsed by another function. Ensure each distinct log entry is on its own line.
    `;

// ... inside export async function POST(req: Request) { ... }

    // 2. Call the Gemini API for OCR
    const result = await geminiModel.generateContent([
      imagePart, 
      promptText
    ]);
    
    // Explicitly grab the first response part's text
    // The Gemini response is often nested deeper depending on the method.
        const extractedText = result.response.text().trim();
    // OR, if result.response is the issue, check result.text
    // const extractedText = result.text.trim(); 
    
    // ... (rest of the code)

    // 3. Integrate the parsing logic here!
    const groupedHits = parseLogText(extractedText);

    // 4. Return the fully processed object to the frontend
    return NextResponse.json({ groupedHits: groupedHits });

  } catch (error) {
    console.error('Gemini OCR API Error:', error);
    return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
  }
}