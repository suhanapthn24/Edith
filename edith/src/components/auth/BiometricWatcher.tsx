"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Models served from CDN — loaded once, then browser-cached
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@0.22.2/weights";
const FACE_SCAN_INTERVAL_MS = 2000;
const FACE_MATCH_THRESHOLD = 0.55; // euclidean distance (lower = stricter)

export function BiometricWatcher() {
  const { state, storedFaceEmbedding, authenticate, resetAutoLock } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelsLoadedRef = useRef(false);
  const faceapiRef = useRef<typeof import("@vladmandic/face-api") | null>(null);

  const loadFaceApi = useCallback(async () => {
    if (modelsLoadedRef.current) return faceapiRef.current!;
    const faceapi = await import("@vladmandic/face-api");
    faceapiRef.current = faceapi;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    modelsLoadedRef.current = true;
    return faceapi;
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      // Camera denied or unavailable — face auth won't work
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scanOnce = useCallback(async () => {
    if (!videoRef.current || !storedFaceEmbedding || !modelsLoadedRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return; // not ready

    const faceapi = faceapiRef.current!;
    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) return;

      const dist = faceapi.euclideanDistance(
        detection.descriptor,
        new Float32Array(storedFaceEmbedding)
      );

      if (dist < FACE_MATCH_THRESHOLD) {
        if (state === "locked") {
          authenticate("face");
        } else if (state === "authenticated") {
          resetAutoLock();
        }
      }
    } catch {
      // Detection failed — skip frame
    }
  }, [storedFaceEmbedding, state, authenticate, resetAutoLock]);

  // Start/stop camera and scan loop based on auth state
  useEffect(() => {
    if (state !== "locked" && state !== "authenticated") return;

    let active = true;

    loadFaceApi()
      .then(() => { if (active) startCamera(); })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [state, loadFaceApi, startCamera]);

  // Scan loop — only run when we have a stored face embedding
  useEffect(() => {
    if ((state !== "locked" && state !== "authenticated") || !storedFaceEmbedding) return;

    intervalRef.current = setInterval(scanOnce, FACE_SCAN_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state, storedFaceEmbedding, scanOnce]);

  // Stop camera when app unmounts
  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      aria-hidden="true"
      style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
    />
  );
}
