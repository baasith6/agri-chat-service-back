const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import the Google Generative AI SDK
const multer = require('multer');


// Initialize Express app
const app = express();

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
    const allowedOrigins = [allowedOrigin, 'http://localhost:4200', 'http://localhost:5173'];
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));


//app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Initialize Google Generative AI with API key
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro"}); // Use Gemini Pro model


function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}


app.post('/api/chat', upload.single('image'),  async (req, res) => {
    try {
        const userMessage = req.body.message; // Access the user's message
        const imageFile = req.file; // Access the uploaded image file

        if (!userMessage) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let prompt;
        
        // If an image file is uploaded, use it in the prompt
        if (imageFile) {
          prompt = `
            You are an expert agricultural assistant for farmers. Your name is "விவசாய நண்பன்".
            Analyze the attached image. Identify what is in the image (e.g., a plant, a leaf, a pest). 
            If you see signs of a plant disease or pest, identify it and provide a SHORT, clear, and simple solution in TAMIL language.
            Your response should be easy for a farmer to understand. Use bullet points or numbered lists if necessary.
            IMPORTANT: Do NOT talk about the filename or file type (like .webp). Focus ONLY on the visual content relevant to a farmer.
            The user's original message is: "${userMessage}"
          `;

        } else {
          prompt = `
              You are a helpful agricultural assistant for farmers named "விவசாய நண்பன்". 
              Answer the following question clearly and concisely in TAMIL language.
              The user's question is: "${userMessage}"
          `;
        }

        const contents = [prompt];

        // If an image file is provided, convert it to a generative part
        if (imageFile) {
          const imagePart = fileToGenerativePart(imageFile.buffer, imageFile.mimetype);
          contents.push(imagePart);
        }

        // Generate response from Gemini Pro model
        const result = await model.generateContent(contents);
        const response = await result.response;
        const aiResponse = response.text();

        // Send the AI response back to the client
        res.json({ reply: aiResponse });

    } catch (error) {
      console.error("Error processing request:", error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }   
});


// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});