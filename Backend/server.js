require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@deepgram/sdk');
const { VoiceResponse } = require('twilio').twiml;
const { loadData, searchHospitals } = require('./services/hospitalService');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
    // origin: '*', 
    exposedHeaders: ['X-Transcript', 'X-User-Transcript']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// System Instructions for Gemini
const SYSTEM_INSTRUCTION = `
You are "Loop AI", a helpful voice assistant for the Loop Health hospital network.
1. **First Interaction**: If the conversation history is empty, you MUST start your response with "Hello, I am Loop AI." and then **IMMEDIATELY answer the user's question**. Do not just say hello; handle the request in the same response.
   - Example User: "Find hospitals in Pune."
   - Example You: "Hello, I am Loop AI. Here are the hospitals I found in Pune..."
2. **Clarification**: If the user provides a hospital name but NO city (e.g., "Is Apollo in my network?"), you MUST ask a clarifying question: "I have found several hospitals with this name. In which city are you looking for [HOSPITAL NAME]?"
3. **Tool Usage**: Use the 'get_hospitals' tool to find hospital data.
4. **Out of Scope**: If the user asks about anything unrelated to hospitals (e.g., "Who is the president?"), refuse politely: "I'm sorry, I can't help with that. I am forwarding this to a human agent."
`;

// Tool Definition (Gemini Format)
const tools = {
    functionDeclarations: [{
        name: "get_hospitals",
        description: "Get a list of hospitals based on location or name search",
        parameters: {
            type: "OBJECT",
            properties: {
                location: { type: "STRING", description: "City or area, e.g., Bangalore" },
                name: { type: "STRING", description: "Name of the hospital, e.g., Manipal" },
            },
            required: ["location"], // Hinting that location is important
        },
    }],
};

async function runGeminiChat(userText, history = []) {
    
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [tools]
    });

    const chat = model.startChat({
        history: history, 
    });

    const result = await chat.sendMessage(userText);
    const response = result.response;
    const functionCalls = response.functionCalls();

    let finalText = "";

    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0]; 
        if (call.name === "get_hospitals") {
            const args = call.args;
            console.log("Gemini asking for tool:", args);

            
            const hospitalData = searchHospitals(args.name, args.location);

            
            const toolResult = [{
                functionResponse: {
                    name: "get_hospitals",
                    response: { result: hospitalData }
                }
            }];
            
            const result2 = await chat.sendMessage(toolResult);
            finalText = result2.response.text();
        }
    } else {
        finalText = response.text();
    }

    return finalText;
}

// Function: Deepgram TTS (Text to Speech)
async function textToSpeech(text) {
    try {
        const response = await deepgram.speak.request(
            { text },
            {
                model: "aura-asteria-en",
                encoding: "mp3",
            }
        );

        const stream = await response.getStream();
        if (!stream) throw new Error("Error generating audio stream");
        
        const buffer = await streamToBuffer(stream);
        return buffer;
    } catch (error) {
        console.error("TTS Generation Error:", error);
        throw error; 
    }
}

// Function to convert web stream to node buffer
async function streamToBuffer(stream) {
    if (Buffer.isBuffer(stream)) return stream;
    if (typeof stream.pipe === 'function') {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
    if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        return Buffer.concat(chunks);
    }
    throw new Error("Unknown stream type received");
}


app.post('/api/chat', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No audio file.");
        
        // 1. STT (Deepgram)
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            fs.createReadStream(req.file.path),
            { model: "nova-2", smart_format: true, mimetype: "audio/wav" }
        );
        
        if (error || !result.results) throw new Error("Transcription failed");
        const userText = result.results.channels[0].alternatives[0].transcript;
        
        if (!userText.trim()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send("No speech detected.");
        }
        console.log("User (Web):", userText);

        // 2. Parse History
        let history = [];
        if (req.body.history) {
            try {
                history = JSON.parse(req.body.history)
                    .filter(msg => msg.role !== 'system')
                    .map(msg => ({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    }));
            } catch (e) { console.error(e); }
        }

        
        const isFirstTurn = (history.length === 0);

        // 3. Run Gemini
        let aiReply = await runGeminiChat(userText, history);
        
        if (isFirstTurn) {
            console.log("--> First Turn Detected! Forcing Greeting...");
            if (!aiReply.toLowerCase().includes("loop ai")) {
                aiReply = "Hello, I am Loop AI. " + aiReply;
            }
        }
        
        console.log("AI Reply (Final):", aiReply);

        const speechText = aiReply
            .replace(/\*\*/g, "")   // Remove bold
            .replace(/\*/g, "")     // Remove italics
            .replace(/#/g, "")      // Remove hashtags
            .replace(/- /g, "");    // Remove bullets

        const audioBuffer = await textToSpeech(speechText);
        const headerText = speechText.replace(/[\n\r]+/g, " ");

        res.set({
            'Content-Type': 'audio/mpeg',
            'X-Transcript': headerText,
            'X-User-Transcript': userText
        });
        res.send(audioBuffer);

        fs.unlinkSync(req.file.path);

    } catch (error) {
        console.error("Server Error:", error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).send(error.message);
    }
});

// TWILIO VOICE
app.post('/api/twilio-voice', async (req, res) => {
    const twiml = new VoiceResponse();
    const userSpeech = req.body.SpeechResult;

    try {
        if (!userSpeech) {
            twiml.say("Hello, this is Loop AI. How can I help?");
            twiml.gather({ input: 'speech', action: '/api/twilio-voice', timeout: 4 });
        } else {
            console.log("User (Phone):", userSpeech);
            
            const aiReply = await runGeminiChat(userSpeech, []);
            
            twiml.say(aiReply);

            if (aiReply.includes("forwarding this to a human")) {
                twiml.hangup();
            } else {
                twiml.gather({ input: 'speech', action: '/api/twilio-voice', timeout: 4 });
            }
        }
    } catch (error) {
        console.error("Twilio Error:", error);
        twiml.say("Error occurred.");
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

loadData().then(() => {
    app.listen(3000, () => console.log('Server running on port 3000'));
});

//
