import React, { useEffect, useRef, useState } from 'react';
import { FaceData } from '../types';

export const useFaceDetection = (videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) => {
  const [faceData, setFaceData] = useState<FaceData | null>(null);
  const modelRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize detection loop
  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setFaceData(null);
      return;
    }

    const detect = async () => {
      // 1. Try to load model if not loaded (handles late script loading)
      if (!modelRef.current && (window as any).blazeface) {
        try {
          // Load the model. We can store the promise to avoid multiple loads, 
          // but blazeface.load() is usually cheap to call or we can use a flag.
          // ideally we just wait for it.
          modelRef.current = await (window as any).blazeface.load();
        } catch (e) {
          // console.warn("Model load pending...");
        }
      }

      // 2. Perform detection if everything is ready
      if (modelRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const predictions = await modelRef.current.estimateFaces(videoRef.current, false);
          
          if (predictions.length > 0) {
            const video = videoRef.current;
            const { videoWidth, videoHeight } = video;
            
            const start = predictions[0].topLeft;
            const end = predictions[0].bottomRight;
            
            // Calculate normalized coordinates
            const x = (start[0] + end[0]) / 2 / videoWidth;
            const y = (start[1] + end[1]) / 2 / videoHeight;
            const w = (end[0] - start[0]) / videoWidth;
            const h = (end[1] - start[1]) / videoHeight;

            setFaceData({ 
              x, y, 
              width: w, 
              height: h,
              videoWidth,
              videoHeight
            });
          } else {
            setFaceData(null);
          }
        } catch (e) {
          // Silently fail on frame error
        }
      }
      
      // 3. Loop
      rafRef.current = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]); // Removed videoRef from dependency to prevent effect thrashing, ref access is stable in loop

  return faceData;
};