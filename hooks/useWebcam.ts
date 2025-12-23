import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebcam = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const startCamera = useCallback(async () => {
    const handleStream = (mediaStream: MediaStream) => {
      setStream(mediaStream);
      setPermissionGranted(true);
      setError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    };

    // Clear previous errors
    setError(null);

    // Attempt 1: Ideal Resolution (1080p), User Facing
    try {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user"
        },
        audio: false,
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      handleStream(mediaStream);
      return;
    } catch (e) {
      console.warn("High-quality camera constraint failed or timed out. Retrying with standard constraints...", e);
    }

    // Attempt 2: Standard User Facing (No resolution constraints)
    try {
      const constraints = {
        video: {
          facingMode: "user"
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      handleStream(mediaStream);
      return;
    } catch (e) {
      console.warn("User-facing camera failed. Retrying with fallback...", e);
    }

    // Attempt 3: Fallback (Any video source)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      handleStream(mediaStream);
    } catch (err: any) {
      console.error("Critical error accessing camera:", err);
      
      let errorMessage = "Unable to access camera.";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow access in your browser settings.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera device found.";
      } else if (err.name === 'NotReadableError' || err.message?.includes('Timeout')) {
        errorMessage = "Camera is likely in use by another application or not responding.";
      }

      setError(errorMessage);
      setPermissionGranted(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { videoRef, stream, error, permissionGranted, startCamera, stopCamera };
};