"use client";

import { useVoice } from "@/lib/useVoice";
import { useState } from "react";

export default function VoiceTest() {
  const [history, setHistory] = useState<string[]>([]);
  const {
    state,
    interimTranscript,
    supported,
    permissionDenied,
    startListening,
    stopListening,
    speak,
  } = useVoice({
    onUserSpoke: (transcript) => {
      setHistory((prev) => [...prev, `You: ${transcript}`]);
      const reply = `I heard you say: ${transcript}. That's interesting.`;
      setHistory((prev) => [...prev, `Aluta: ${reply}`]);
      speak(reply);
    },
  });

  if (!supported) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Voice not supported</h1>
        <p>
          Your browser does not support the Web Speech API. Try Chrome, Edge, or
          Brave.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Voice Test</h1>
      <p className="mb-4">
        State: <strong>{state}</strong>
      </p>
      {permissionDenied && (
        <p className="text-red-600 mb-4">
          Microphone permission denied. Allow it in browser settings.
        </p>
      )}
      <div className="flex gap-2 mb-4">
        <button
          onClick={startListening}
          disabled={state !== "idle"}
          className="bg-purple-700 text-white px-4 py-2 rounded disabled:opacity-40"
        >
          Start listening
        </button>
        <button
          onClick={stopListening}
          disabled={state !== "listening"}
          className="bg-red-700 text-white px-4 py-2 rounded disabled:opacity-40"
        >
          Stop
        </button>
      </div>
      {interimTranscript && (
        <div className="mb-4 italic text-gray-600">
          Listening: {interimTranscript}
        </div>
      )}
      <div className="space-y-2">
        {history.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
