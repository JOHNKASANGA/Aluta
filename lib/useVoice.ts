"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type VoiceState = "idle" | "listening" | "speaking" | "thinking";

type UseVoiceOptions = {
  onUserSpoke: (transcript: string) => void;
};

export function useVoice({ onUserSpoke }: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Detect speech-recognition support
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supported) return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    // Stop any audio that's playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";
    setInterimTranscript("");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setPermissionDenied(true);
      }
      console.error("SpeechRecognition error:", event.error);
      setState("idle");
    };

    recognition.onstart = () => setState("listening");

    recognition.onend = () => {
      const transcript = finalTranscriptRef.current.trim();
      setInterimTranscript("");
      if (transcript) {
        setState("thinking");
        onUserSpoke(transcript);
      } else {
        setState("idle");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Could not start recognition", e);
    }
  }, [supported, onUserSpoke]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Speak via ElevenLabs
  const speak = useCallback(async (text: string, onDone?: () => void) => {
    if (!text) {
      onDone?.();
      return;
    }
    try {
      setState("speaking");
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        let msg = "TTS request failed";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState("idle");
        onDone?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState("idle");
        onDone?.();
      };

      await audio.play();
    } catch (e) {
      console.error("Speak failed:", e);
      setState("idle");
      onDone?.();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return {
    state,
    interimTranscript,
    supported,
    permissionDenied,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    reset,
  };
}
