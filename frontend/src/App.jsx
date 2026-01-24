import { useState, useRef } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import axios from 'axios';

function App() {
  const [loading, setLoading] = useState(false);
  
  const [history, setHistory] = useState([]); 
  const historyRef = useRef([]); 

  const [statusMessage, setStatusMessage] = useState("");
  const audioRef = useRef(null);

  const { status, startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => handleAudioStop(blob)
  });

  const handleAudioStop = async (audioBlob) => {
    setLoading(true);
    setStatusMessage("Thinking...");
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'input.wav');
    
    formData.append('history', JSON.stringify(historyRef.current));

    try {
      const response = await axios.post('http://localhost:3000/api/chat', formData, {
        responseType: 'blob' 
      });

      const aiText = response.headers['x-transcript'];
      const userText = response.headers['x-user-transcript'];

      if (userText && aiText) {
        const newEntry = [
          { role: 'user', content: userText },
          { role: 'assistant', content: aiText }
        ];

        setHistory(prev => [...prev, ...newEntry]);
        historyRef.current = [...historyRef.current, ...newEntry]; 
      }

      const audioUrl = URL.createObjectURL(response.data);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
      setStatusMessage(`You: "${userText}" \nAI: "${aiText}"`);

    } catch (error) {
      console.error("Error calling API", error);
      setStatusMessage("Error occurred. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '10px', marginLeft:'450px', fontFamily: 'Arial' }}>
      <h1>Loop AI Hospital Network Assistant</h1>
      
      <div style={{ margin: '30px' }}>
        {status === 'recording' ? (
          <button 
            onClick={stopRecording} 
            style={{ padding: '20px', fontSize: '20px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          >
            ⏹️ Stop
          </button>
        ) : (
          <button 
            onClick={startRecording} 
            disabled={loading} 
            style={{ padding: '20px', fontSize: '20px', backgroundColor: loading ? '#ccc' : '#3b82f6', color: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          >
            {loading ? '⏳' : '🎤'}
          </button>
        )}
      </div>
      
      <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
        {status === 'recording' ? 'Listening...' : loading ? 'Processing...' : 'Start Conversation'}
      </p>
      
      <audio ref={audioRef} controls style={{ display: 'none' }} />
    </div>
  );
}

export default App;