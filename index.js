// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --------------------------
// Express App Setup
// --------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Multer (Store images in memory)
const upload = multer({ storage: multer.memoryStorage() });

// --------------------------
// Gemini AI Configuration
// --------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Error: .env கோப்பில் GEMINI_API_KEY இல்லை!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Choose Model (You said 2.5 flash)
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

// Convert Image → Base64 Part
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    }
  };
}

// --------------------------
// Chat Endpoint
// --------------------------
app.post('/api/chat', upload.single('image'), async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const imageFile = req.file;

    console.log(`📥 Request → Text: "${userMessage}" | Image: ${imageFile ? 'Yes' : 'No'}`);

    if (!userMessage && !imageFile) {
      return res.status(400).json({ error: "Message or Image is required" });
    }

    let parts = [];
    let promptText = "";

    // --------------------------
    // If message contains Image
    // --------------------------
    if (imageFile) {
      promptText = `
நீங்கள் ஒரு நிபுணர் விவசாய உதவியாளர் "விவசாய நண்பன்". 
பயனர் அனுப்பிய படத்தை முழுமையாக பகுப்பாய்வு செய்யுங்கள். 
அந்த படத்தில் இருக்கும் செடி / பூச்சி / நோய் / சேதம் எது என்பதை கண்டறிக.
படத்தில் இருக்கும் பிரச்சனை இருந்தால் மிக தெளிவாக, ஆனால் குறைந்த வார்த்தைகளில் தமிழில் பதில் கொடுங்கள்.

⚠ முக்கியம்:
- பயனர் படம் upload செய்ததை மட்டும் கவனியுங்கள்.
- Image filename, resolution, upload details போன்றவற்றை பேசக்கூடாது.
- VERY SHORT & CLEAR answer.

பயனர் கேள்வி: "${userMessage || 'இந்த படம் பற்றி சொல்லுங்கள்'}"
      `;

      parts.push(promptText);
      parts.push(fileToGenerativePart(imageFile.buffer, imageFile.mimetype));
    }

    // --------------------------
    // If only text question
    // --------------------------
    else {
      promptText = `
நீங்கள் ஒரு பயனருக்கு உதவும் விவசாய உதவியாளர் "விவசாய நண்பன்".
பின்வரும் கேள்விக்கு எளிமையாகவும் தெளிவாகவும் தமிழில் பதில் கொடுங்கள்.

பயனர் கேள்வி: "${userMessage}"
      `;
      parts.push(promptText);
    }

    // --------------------------
    // Call Gemini
    // --------------------------
    const result = await model.generateContent(parts);

    // Safe response extraction (avoids undefined errors)
    let aiResponse = "";
    if (result?.response?.text) {
      aiResponse = result.response.text();
    } else {
      aiResponse = "மன்னிக்கவும், தற்போதைய கோரிக்கையை செயலாக்க முடியவில்லை.";
    }

    console.log("✅ Gemini Response Returned");

    return res.json({ reply: aiResponse });

  } catch (error) {
    console.error("❌ Server Error:", error?.message);
    return res.status(500).json({
      error: "Internal Server Error — please try again."
    });
  }
});

// --------------------------
// Start Server
// --------------------------
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🤖 Chatbot Server Running → http://localhost:${PORT}`);
});
