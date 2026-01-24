Loop AI - Voice-to-Voice Hospital Assistant

A real-time voice AI agent built for the LoopHealth Internship Assignment. This application allows users to find hospitals, check network availability, and ask general questions using natural language voice interaction.

🚀 Features
Voice-to-Voice Interaction: Talk naturally to the AI, and it replies with voice (Latency < 2s).

RAG (Retrieval-Augmented Generation): Custom implementation to search a CSV database of ~2000 hospitals without hallucinating.

Context Awareness: Remembers previous turns (e.g., "Is Manipal in my network?" → "Which city?").

Smart Routing: Handles hospital queries with data, but politely declines out-of-scope questions (e.g., "Who is the PM?").

Twilio Integration: Supports phone calls via ngrok tunneling.

🛠️ Tech Stack
Frontend: React.js, Vite, react-media-recorder

Backend: Node.js, Express

AI Model: Google Gemini 2.5 Flash (via Google Generative AI STUDIO)

Speech-to-Text (STT): Deepgram Nova-2

Text-to-Speech (TTS): Deepgram Aura 

Search Engine: Fuse.js 
