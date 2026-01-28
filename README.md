Loop AI - Voice-to-Voice Hospital Assistant

-- This application allows users to find hospitals, check network availability, and ask general questions using natural language voice interaction.

🚀 Features

-- Voice-to-Voice Interaction: Talk naturally to the AI, and it replies with voice (Latency < 2s).

-- RAG (Retrieval-Augmented Generation): Custom implementation to search a CSV database of ~2000 hospitals without hallucinating.

-- Context Awareness: Remembers previous turns (e.g., "Is Manipal in my network?" → "Which city?").

-- Smart Routing: Handles hospital queries with data, but politely declines out-of-scope questions (e.g., "Who is the PM?").

-- Twilio Integration: Supports phone calls via ngrok tunneling.

🛠️ Tech Stack

1. Frontend: React.js, Vite, react-media-recorder

2. Backend: Node.js, Express

3. AI Model: Google Gemini 2.5 Flash (via Google Generative AI STUDIO)

4. Speech-to-Text (STT): Deepgram Nova-2

5. Text-to-Speech (TTS): Deepgram Aura 

6. Search Engine: Fuse.js 

Deployed Link - https://loop-ai-hospital-network-assistant.onrender.com/
##
