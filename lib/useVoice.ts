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
  const [voiceLevel, setVoiceLevel] = useState(0); // 0–1, drives orb visuals

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  // Web Audio analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) setSupported(false);
  }, []);

  // --- Microphone analysis (real audio reactivity while listening) ---

  const stopAnalysis = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVoiceLevel(0);
  }, []);

  const startAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new Ctx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        // Weighted average — emphasize voice range (low/mid frequencies)
        let sum = 0;
        const limit = Math.floor(data.length * 0.6); // ignore high freqs (mostly noise)
        for (let i = 0; i < limit; i++) sum += data[i];
        const avg = sum / limit / 255;
        // Boost low-amplitude signals so subtle speech still moves the orb
        const boosted = Math.min(1, Math.pow(avg, 0.6) * 1.4);
        setVoiceLevel(boosted);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Microphone analysis unavailable:", e);
    }
  }, []);

  // --- Speech recognition ---

  const startListening = useCallback(() => {
    if (!supported) return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    startAnalysis();

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
        if (result.isFinal) final += result[0].transcript + " ";
        else interim += result[0].transcript;
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
      stopAnalysis();
      setState("idle");
    };

    recognition.onstart = () => setState("listening");

    recognition.onend = () => {
      const transcript = finalTranscriptRef.current.trim();
      setInterimTranscript("");
      stopAnalysis();
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
      stopAnalysis();
    }
  }, [supported, onUserSpoke, startAnalysis, stopAnalysis]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // --- Speaking (browser TTS) + simulated audio level ---

  const speakWithBrowser = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setState("idle");
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const chosen =
      voices.find((v) => v.lang === "en-NG") ||
      voices.find((v) => v.lang.startsWith("en-GB")) ||
      voices.find((v) => v.lang.startsWith("en-US")) ||
      voices[0];
    if (chosen) u.voice = chosen;
    u.rate = 0.95;
    u.pitch = 0.9;
    u.onstart = () => setState("speaking");
    u.onend = () => {
      setState("idle");
      onDone?.();
    };
    u.onerror = () => {
      setState("idle");
      onDone?.();
    };
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      speakWithBrowser(text, onDone);
    },
    [speakWithBrowser],
  );

  // Simulated voice level while speaking (browser TTS audio isn't analyzable directly)
  useEffect(() => {
    if (state !== "speaking") return;
    let raf: number;
    let t = 0;
    const tick = () => {
      t += 0.18;
      // Two overlapping sine waves + small noise = speech-like rhythm
      const wave =
        0.35 +
        0.25 * Math.abs(Math.sin(t)) +
        0.15 * Math.abs(Math.sin(t * 2.3)) +
        0.1 * Math.random();
      setVoiceLevel(Math.min(1, wave));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      setVoiceLevel(0);
    };
  }, [state]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    stopAnalysis();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
  }, [stopAnalysis]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopAnalysis();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopAnalysis]);

  return {
    state,
    interimTranscript,
    supported,
    permissionDenied,
    voiceLevel,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    reset,
  };
}
