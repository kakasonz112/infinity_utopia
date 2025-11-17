import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// --- Data Types ---
interface Hit {
  prov: number;
  text: string;
  count: number;
  kingdom: string; // full kingdom ID like 5:11
}

// 1. Initialize the Gemini AI client
// IMPORTANT: Ensure GEMINI_API_KEY is set in your environment variables.
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = 'gemini-2.5-flash';

// --- Next.js Config ---
export const config = {
  api: {
    // This setting is necessary for reading files from `req.formData()`
    bodyParser: false,
  },
};

/**
 * Helper function to convert a File to a Generative Part for the Gemini API
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
 * Processes the raw log text into a structured, grouped object.
 * Logic is taken from your provided snippet.
 */
const parseLogText = (input: string): Record<string, Hit[]> => {
    const lines = input.split("\n").filter(Boolean);
    const hits: Record<string, Hit> = {};

    for (const line of lines) {
      // **NOTE on Regex:** Using the original, more targeted regex.
      // If OCR is still inaccurate, review the regex to make it more flexible 
      // as suggested in the previous response's analysis.
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
    
    // **Revised Prompt for better OCR accuracy (as discussed)**
    const promptText = `
      You are an expert Optical Character Recognition (OCR) system for game battle logs.
      The image contains a list of detailed log entries.
      Your task is to extract *ONLY* the textual content of the log entries.
      For each log entry, output the entire line of text, starting from the entry number (e.g., "18 - My strange needs...") and ending with the final coordinate (e.g., "...doctor (5:11)").

      **CRITICAL INSTRUCTIONS:**
      1. **Exclude** the date, time, and UI elements (icons, shields, header, footer).
      2. **Do not** summarize, interpret, or add any commentary.
      3. The output must be the raw, line-by-line text content of the log entries only, ensuring each distinct log entry is on its own line.
      4. Ensure the province number and the final kingdom coordinate (e.g., 5:11) are correctly captured.
    `;

    // 2. Call the Gemini API for OCR
    const result = await geminiModel.generateContent([
      imagePart, 
      promptText
    ]);
    
    // Extract the raw text from the Gemini response
    const extractedText = result.response.text().trim();
    
    // 3. Optional: Add Post-Processing Cleanup here if needed for common OCR errors
    // let cleanText = extractedText.replace(/[’‘]/g, "'"); // Example cleanup
    
    // 4. Integrate the parsing logic
    const groupedHits = parseLogText(extractedText);

    // 5. Return the fully processed object to the frontend
    return NextResponse.json({ groupedHits: groupedHits });

  } catch (error) {
    console.error('Gemini OCR API Error:', error);
    // Be careful not to expose sensitive error details in a production environment
    return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
  }
}