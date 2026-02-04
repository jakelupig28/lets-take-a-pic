import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from './hooks/useWebcam';
import { useSound } from './hooks/useSound';
import { useFaceDetection } from './hooks/useFaceDetection';
import { AppState, FilterType, FrameColor, GridType, PhotoConfig, AnimationType, MaskType, FaceData } from './types';
import { DEFAULT_CONFIG, GRID_CONFIGS, FILTERS, FRAMES, TIMERS, ANIMATIONS, MASKS } from './constants';
import { captureFrame, generateComposite } from './utils/imageProcessing';
import { Icons } from './components/Icon';

// Declare globals for CDN libraries
declare const QRCode: any;

// --- Shared Logic for Overlays ---
const getOverlayStyle = (faceData: FaceData | null | undefined, containerRatio: number): React.CSSProperties => {
  // Default center position if no face found (Fallback Mode)
  let style: React.CSSProperties = {
     left: '50%',
     top: '30%',
     transform: 'translate(-50%, -50%)',
     opacity: 0.8, // Visible by default
     transition: 'left 0.1s linear, top 0.1s linear, transform 0.1s linear' // Faster transition
  };

  if (faceData && faceData.videoWidth && faceData.videoHeight) {
    const videoRatio = faceData.videoWidth / faceData.videoHeight;
    
    let normalizedX = faceData.x;
    let normalizedY = faceData.y;
    // Scale hearts/stars based on face width (0.35 is a reference average face width)
    let scale = faceData.width / 0.35; 

    // We need to know the visible dimensions of the face in the container to position Y correctly
    let visibleH = faceData.height;

    // Calculate Crop Logic (object-fit: cover)
    if (videoRatio > containerRatio) {
       // Video is Wider: Crop Left/Right
       const visibleFraction = (faceData.videoHeight * containerRatio) / faceData.videoWidth;
       const offset = (1 - visibleFraction) / 2;
       
       normalizedX = (faceData.x - offset) / visibleFraction;
       // normalizedY remains same (0-1 maps to 0-1)
       // visibleH remains same (relative to height which is full)
    } 
    else if (videoRatio < containerRatio) {
       // Video is Taller: Crop Top/Bottom
       const visibleFraction = (faceData.videoWidth / containerRatio) / faceData.videoHeight;
       const offset = (1 - visibleFraction) / 2;
       
       normalizedY = (faceData.y - offset) / visibleFraction;
       // Adjust visible height relative to the cropped container height
       visibleH = faceData.height / visibleFraction;
    }

    // NOTE: We do NOT mirror X here (e.g. 1-x). 
    // Instead we apply scaleX(-1) to the container div in the JSX.
    // This ensures coordinate systems align perfectly with the video element.
    const finalLeft = normalizedX * 100;
    
    // Y Correction: Place halo above the head
    // Center of Halo = Face Center Y - (Face Height * 0.6)
    // This places the center of the hearts roughly at the top of the forehead
    const finalTop = (normalizedY - (visibleH * 0.6)) * 100;

    style = {
        left: `${finalLeft}%`,
        top: `${finalTop}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: 1,
        transition: 'left 0.05s linear, top 0.05s linear, transform 0.05s linear' // Snappier
    };
  }
  return style;
};

// --- Hearts Overlay Component ---
const HeartsOverlay: React.FC<{ faceData?: FaceData | null, containerRatio: number }> = ({ faceData, containerRatio }) => {
  const HeartSVG = ({ size, rotate, delay, color }: { size: number, rotate: number, delay: string, color: string }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className="drop-shadow-[0_0_4px_rgba(255,105,180,0.5)] animate-float-heart"
      style={{ 
        transform: `rotate(${rotate}deg)`,
        animationDelay: delay,
        color: color
      }}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );

  const style = getOverlayStyle(faceData, containerRatio);
  
  const darkPink = '#DB2777'; 
  const lightPink = '#FBCFE8'; 
  const midPink = '#F472B6'; 

  return (
    <div 
      className="absolute pointer-events-none flex justify-center overflow-visible"
      style={{ width: '240px', height: '240px', ...style }}
    >
      <div className="relative w-full h-full">
         <div className="absolute" style={{ left: '20%', top: '60%', transform: 'translate(-50%, -50%)' }}>
            <HeartSVG size={20} rotate={-35} delay="0s" color={darkPink} />
         </div>
         <div className="absolute" style={{ left: '35%', top: '45%', transform: 'translate(-50%, -50%)' }}>
            <HeartSVG size={28} rotate={-15} delay="0.4s" color={lightPink} />
         </div>
         <div className="absolute" style={{ left: '50%', top: '35%', transform: 'translate(-50%, -50%)' }}>
            <HeartSVG size={36} rotate={0} delay="0.8s" color={midPink} />
         </div>
         <div className="absolute" style={{ left: '65%', top: '45%', transform: 'translate(-50%, -50%)' }}>
            <HeartSVG size={28} rotate={15} delay="0.2s" color={darkPink} />
         </div>
         <div className="absolute" style={{ left: '80%', top: '60%', transform: 'translate(-50%, -50%)' }}>
            <HeartSVG size={20} rotate={35} delay="0.6s" color={lightPink} />
         </div>
      </div>
    </div>
  );
};

// --- Stars Overlay Component ---
const StarsOverlay: React.FC<{ faceData?: FaceData | null, containerRatio: number }> = ({ faceData, containerRatio }) => {
  const StarSVG = ({ size, rotate, delay, color }: { size: number, rotate: number, delay: string, color: string }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className="drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-float-heart" // Reuse float animation
      style={{ 
        transform: `rotate(${rotate}deg)`,
        animationDelay: delay,
        color: color
      }}
    >
       <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  const style = getOverlayStyle(faceData, containerRatio);
  
  const c1 = '#FDE047'; // Yellow 300
  const c2 = '#FEF08A'; // Yellow 200
  const c3 = '#FCD34D'; // Amber 300

  return (
    <div 
      className="absolute pointer-events-none flex justify-center overflow-visible"
      style={{ width: '240px', height: '240px', ...style }}
    >
      <div className="relative w-full h-full">
         <div className="absolute" style={{ left: '15%', top: '65%', transform: 'translate(-50%, -50%)' }}>
            <StarSVG size={24} rotate={-45} delay="0.1s" color={c1} />
         </div>
         <div className="absolute" style={{ left: '30%', top: '48%', transform: 'translate(-50%, -50%)' }}>
            <StarSVG size={32} rotate={-20} delay="0.5s" color={c2} />
         </div>
         <div className="absolute" style={{ left: '50%', top: '35%', transform: 'translate(-50%, -50%)' }}>
            <StarSVG size={44} rotate={0} delay="0.9s" color={c3} />
         </div>
         <div className="absolute" style={{ left: '70%', top: '48%', transform: 'translate(-50%, -50%)' }}>
            <StarSVG size={32} rotate={20} delay="0.3s" color={c2} />
         </div>
         <div className="absolute" style={{ left: '85%', top: '65%', transform: 'translate(-50%, -50%)' }}>
            <StarSVG size={24} rotate={45} delay="0.7s" color={c1} />
         </div>
      </div>
    </div>
  );
};

// Helper component for individual video feeds
const VideoFeed: React.FC<{
  stream: MediaStream | null;
  filter: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  animation?: AnimationType;
  mask?: MaskType;
  faceData?: FaceData | null;
}> = ({ stream, filter, className, videoRef, animation, mask, faceData }) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = videoRef || internalRef;
  const [containerRatio, setContainerRatio] = useState(4/3);

  useEffect(() => {
    const el = ref.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(e => console.warn("Auto-play blocked", e));
      }
    }
  }, [stream, ref]);

  // Update container aspect ratio on resize for accurate tracking
  useEffect(() => {
    const updateRatio = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width && height) {
          setContainerRatio(width / height);
        }
      }
    };
    
    updateRatio();
    window.addEventListener('resize', updateRatio);
    return () => window.removeEventListener('resize', updateRatio);
  }, []);

  // Determine animation class
  const animClass = animation && animation !== AnimationType.NONE ? `anim-${animation}` : '';

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative ${animClass} ${className || ''}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover hover-scale-mirror"
        style={{ filter, WebkitFilter: filter }}
      />
      
      {/* Overlay Masks */}
      {/* We apply scale-x-[-1] to matches the video mirror effect */}
      {mask === MaskType.HEARTS && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <HeartsOverlay faceData={faceData} containerRatio={containerRatio} />
        </div>
      )}
      {mask === MaskType.STARS && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <StarsOverlay faceData={faceData} containerRatio={containerRatio} />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Core State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [config, setConfig] = useState<PhotoConfig>(DEFAULT_CONFIG);
  const [photos, setPhotos] = useState<string[]>([]);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [showDownloadFeedback, setShowDownloadFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  
  // Video and Recording State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string>('video/mp4');
  const recordedFramesRef = useRef<string[][]>([]); // Array of arrays (clips per photo)
  const currentClipRef = useRef<string[]>([]); // Current photo's frames
  const recordingIntervalRef = useRef<number | null>(null);

  // Timers and Refs
  const [countdown, setCountdown] = useState<number>(0);
  const [flash, setFlash] = useState(false);
  const { videoRef, startCamera, permissionGranted, error, stream } = useWebcam();
  
  // Face Detection - Active if ANY mask is enabled and we are in active modes
  const isDetectionActive = config.maskType !== MaskType.NONE && (appState === AppState.SETUP || appState === AppState.CAPTURE || appState === AppState.COUNTDOWN);
  const faceData = useFaceDetection(videoRef, isDetectionActive);

  // References for timers to allow cancellation
  const timerRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);

  // Audio
  const { initAudio, playCountdown, playShutter, playSuccess, playClick } = useSound();
  
  // Initialize camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Ensure stream is attached to video element whenever state changes (mounting video) or stream updates
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(e => {
            console.warn("Video autoplay prevented:", e);
        });
      }
    }
  }, [stream, appState]);

  // Handlers
  const handleStart = () => {
    try {
      initAudio();
    } catch (e) {
      console.warn("Audio init failed", e);
    }
    
    if (permissionGranted) {
      setAppState(AppState.SETUP);
      setPhotos([]);
      setCompositeUrl(null);
      setVideoUrl(null);
      recordedFramesRef.current = [];
      currentClipRef.current = [];
    }
  };

  const startCaptureSequence = () => {
    // Reset recording buffers
    recordedFramesRef.current = [];
    currentClipRef.current = [];
    
    setAppState(AppState.COUNTDOWN);
    startCountdown();
  };

  // We need a ref for takePhoto to avoid stale closures in the interval
  const takePhotoRef = useRef<() => void>(() => {});
  
  // Keep faceData ref for capture
  const faceDataRef = useRef<FaceData | null>(null);
  useEffect(() => {
    faceDataRef.current = faceData;
  }, [faceData]);

  const startCountdown = useCallback(() => {
    setCountdown(config.timerDuration);
    playCountdown(); 
    setAppState(AppState.COUNTDOWN);
    
    // Start Recording frames
    // We capture at 10fps (100ms)
    // The buffer size must match the timer duration to ensure the video length equals the timer length.
    const captureInterval = 100; // ms
    const maxFrames = Math.ceil((config.timerDuration * 1000) / captureInterval);

    currentClipRef.current = [];
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    
    recordingIntervalRef.current = window.setInterval(() => {
      // Check if video is ready (readyState >= 2 means HAVE_CURRENT_DATA)
      if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
        // Capture frame for Video
        // We use a moderate width (480px) to balance quality and performance for video frames
        // We ensure mask and face data are passed so the video matches the photo
        const frame = captureFrame(videoRef.current, {
           filter: config.filterType,
           mask: config.maskType,
           faceData: faceDataRef.current, // Use ref to get latest face data inside interval
           targetWidth: 480, // Good enough for video composite
           mimeType: "image/jpeg",
           quality: 0.85
        });
        currentClipRef.current.push(frame);
        
        // Keep only maxFrames (matches timer duration)
        if (currentClipRef.current.length > maxFrames) {
          currentClipRef.current.shift();
        }
      }
    }, captureInterval);

    // Clear any existing timer
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (takePhotoRef.current) {
             takePhotoRef.current(); 
          }
          return 0;
        }
        playCountdown(); 
        return prev - 1;
      });
    }, 1000);
  }, [config.timerDuration, config.filterType, config.maskType, playCountdown, videoRef]);

  // Generate MP4/Video from recorded frames using MediaRecorder
  const generateVideo = useCallback(async (qrCodeDataUrl: string | null) => {
    const clips = recordedFramesRef.current;
    if (clips.length === 0) return;

    // Find the minimum number of frames across all clips to ensure synchronization
    // If one clip is significantly shorter (which shouldn't happen unless error), we use the min to sync
    const minFrames = Math.min(...clips.map(c => c.length));
    if (minFrames <= 0) return;

    // We need to construct the composite frames first
    const videoFrames: HTMLImageElement[] = [];

    // Pre-generate composite frames
    for (let i = 0; i < minFrames; i++) {
        const frameImages = clips.map(clip => clip[i]);
        const compositeDataUrl = await generateComposite(
            frameImages, 
            config.gridType, 
            config.frameColor, 
            qrCodeDataUrl
        );
        
        // Load into image element to draw to canvas later
        await new Promise<void>((resolve) => {
           const img = new Image();
           img.onload = () => {
             videoFrames.push(img);
             resolve();
           };
           img.src = compositeDataUrl;
        });
    }

    if (videoFrames.length === 0) return;

    // Determine dimensions from first frame
    const rawWidth = videoFrames[0].width;
    const rawHeight = videoFrames[0].height;

    // Ensure even dimensions for compatibility (H.264/VP9 often fail with odd dimensions)
    const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;
    const height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;

    // Create a hidden canvas for recording
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // FIX 1: Draw first frame immediately to prevent blank start
    ctx.drawImage(videoFrames[0], 0, 0, width, height);

    // Setup MediaRecorder
    // Prefer MP4, fallback to WebM
    const mimeTypes = [
      'video/mp4', 
      'video/webm;codecs=h264', 
      'video/webm;codecs=vp9', 
      'video/webm'
    ];
    
    let selectedMimeType = 'video/webm';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }
    setVideoMimeType(selectedMimeType);

    // Use 30 FPS stream for recorder, but we will feed it at our own pace
    const stream = canvas.captureStream(30); 
    const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType, videoBitsPerSecond: 3000000 });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMimeType });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      // Cleanup stream tracks
      stream.getTracks().forEach(track => track.stop());
    };

    recorder.start();

    // Small delay to ensure recorder is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // FIX 2: Dynamic Interval to match requested timer duration
    // Adjust playback speed so the total video length matches the timer duration (e.g. 3s),
    // even if we dropped frames during capture.
    const targetDurationMs = config.timerDuration * 1000;
    const frameInterval = targetDurationMs / videoFrames.length;

    const startTime = performance.now();

    for (let i = 0; i < videoFrames.length; i++) {
      ctx.drawImage(videoFrames[i], 0, 0, width, height);
      
      // Calculate target time for the end of this frame
      const targetTime = startTime + ((i + 1) * frameInterval);
      const now = performance.now();
      const timeLeft = targetTime - now;
      
      if (timeLeft > 0) {
        await new Promise(resolve => setTimeout(resolve, timeLeft));
      }
    }

    // Wait a bit after last frame to ensure encoding catches up before stopping
    await new Promise(resolve => setTimeout(resolve, 300));

    recorder.stop();
  }, [config]);

  // Process Result needs to be stable or dependent on config
  const processResult = useCallback(async (finalPhotos: string[]) => {
    setAppState(AppState.PROCESSING);
    
    try {
      // 1. Generate QR Code Data URL
      let qrCodeDataUrl = null;
      if (typeof QRCode !== 'undefined') {
         qrCodeDataUrl = await QRCode.toDataURL(window.location.href, { margin: 1, width: 100, color: { dark: config.frameColor === FrameColor.BLACK ? '#FFFFFF' : '#000000', light: '#00000000' } });
      }

      // 2. Generate Strip
      const result = await generateComposite(finalPhotos, config.gridType, config.frameColor, qrCodeDataUrl);
      setCompositeUrl(result);
      
      // 3. Generate Video (Moving Strip)
      generateVideo(qrCodeDataUrl);

      setAppState(AppState.RESULT);
      playSuccess(); 
    } catch (err) {
      console.error("Processing failed", err);
    }
  }, [config, playSuccess, generateVideo]);

  const takePhoto = useCallback(() => {
    if (videoRef.current) {
      playShutter(); 
      setFlash(true);
      setTimeout(() => setFlash(false), 200);

      try {
        // Capture High-Res Photo immediately to sync shutter sound and visual
        // No targetWidth means use full video resolution
        const photoData = captureFrame(videoRef.current, {
            filter: config.filterType,
            mask: config.maskType,
            faceData: faceDataRef.current
        });
        
        // Stop recording for this shot
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
          
          // Append the actual photo frame to the end of the video clip
          // We add it multiple times to create a "freeze frame" effect at the end
          if (currentClipRef.current.length > 0) {
             const freezeFrames = 5; // Adds ~0.5s freeze at 10fps playback equivalent
             for(let i=0; i<freezeFrames; i++) {
                 currentClipRef.current.push(photoData);
             }
             recordedFramesRef.current.push([...currentClipRef.current]);
          }
        }

        setPhotos(prev => {
          const newPhotos = [...prev, photoData];
          const targetCount = GRID_CONFIGS[config.gridType].count;
          
          if (newPhotos.length >= targetCount) {
             setTimeout(() => {
               processResult(newPhotos);
             }, 500);
             return newPhotos;
          } else {
            delayRef.current = window.setTimeout(() => {
              startCountdown();
            }, 1500);
            return newPhotos;
          }
        });
      } catch (err) {
        console.error("Capture failed:", err);
      }
    }
  }, [config, playShutter, startCountdown, videoRef, processResult]);

  useEffect(() => {
    takePhotoRef.current = takePhoto;
  }, [takePhoto]);

  const handleRetake = () => {
    setPhotos([]);
    setCompositeUrl(null);
    setVideoUrl(null);
    recordedFramesRef.current = [];
    setAppState(AppState.SETUP);
  };

  const downloadImage = () => {
    if (compositeUrl) {
      const link = document.createElement('a');
      link.href = compositeUrl;
      link.download = `lets-take-a-pic-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedbackMessage("Your photo strip is downloading successfully.");
      setShowDownloadFeedback(true);
      setTimeout(() => setShowDownloadFeedback(false), 4000);
    }
  };

  const downloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      // Determine extension based on mime type
      const ext = videoMimeType.includes('mp4') ? 'mp4' : 'webm';
      link.download = `lets-take-a-pic-moment-${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedbackMessage("Your video moment is downloading successfully.");
      setShowDownloadFeedback(true);
      setTimeout(() => setShowDownloadFeedback(false), 4000);
    }
  };

  const getGridClasses = (type: GridType) => {
    switch (type) {
      case GridType.GRID_2X2: return 'grid-cols-2 grid-rows-2';
      case GridType.STRIP_3: return 'grid-cols-1 grid-rows-3';
      case GridType.STRIP_4: return 'grid-cols-1 grid-rows-4';
      default: return 'grid-cols-1 grid-rows-1';
    }
  };

  // 1. Landing Screen
  if (appState === AppState.IDLE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 text-booth-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-200/50 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob"></div>
        <div className="absolute top-[10%] right-[-10%] w-[600px] h-[600px] bg-yellow-100/60 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-[15%] w-[600px] h-[600px] bg-pink-200/50 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob animation-delay-4000"></div>

        <main className="z-10 text-center space-y-12 w-full max-w-4xl">
          <div className="space-y-2">
            <h1 className="font-serif italic text-[3rem] md:text-[5rem] tracking-tight text-booth-dark whitespace-nowrap">
              let's take a pic
            </h1>
            <p className="text-gray-500 font-serif italic text-[1rem] md:text-[1.3rem] tracking-wide max-w-2xl mx-auto leading-relaxed opacity-80">
              What we share now will soon turn into a memory, so let's put it in a picture and carry the story of us.
            </p>
          </div>

          {!permissionGranted && !error && (
             <div className="animate-pulse text-sm font-sans bg-white/50 backdrop-blur px-4 py-2 rounded-full inline-block">
               Allow camera access to continue...
             </div>
          )}
          
          {error && (
             <div className="text-red-500 font-sans text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100">
               {error}
             </div>
          )}

          {permissionGranted && (
            <button
              onClick={handleStart}
              className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium tracking-wide text-white transition-all duration-200 bg-booth-dark rounded-full hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-booth-dark shadow-xl"
            >
              <span>Start Capture</span>
              <Icons.Camera className="ml-3 w-5 h-5 transition-transform group-hover:rotate-12" />
            </button>
          )}
        </main>

        <footer className="absolute bottom-6 text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase opacity-60">
           CREATED BY JAKE LUPIG
        </footer>
      </div>
    );
  }

  // 2. Setup Screen
  if (appState === AppState.SETUP) {
    const gridConfig = GRID_CONFIGS[config.gridType];
    const isDarkFrame = config.frameColor === FrameColor.BLACK;
    const textColor = isDarkFrame ? 'text-white' : 'text-booth-dark';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex flex-col md:flex-row">
        {/* Left: Preview */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-8 md:p-12 order-1 md:order-1 min-h-[500px]">
          <div 
            className="relative w-full max-w-xl max-h-full shadow-2xl transition-all duration-300 border-[16px] flex flex-col overflow-hidden"
            style={{ 
              borderColor: config.frameColor,
              backgroundColor: config.frameColor,
              aspectRatio: gridConfig.aspectRatio,
              height: (config.gridType === GridType.STRIP_4 || config.gridType === GridType.STRIP_3) ? 'auto' : undefined,
              maxWidth: (config.gridType === GridType.STRIP_4 || config.gridType === GridType.STRIP_3) ? '320px' : '576px'
            }}
          >
             <div 
               className="w-full relative overflow-hidden transition-colors duration-300 p-4"
               style={{ 
                 aspectRatio: gridConfig.aspectRatio,
                 backgroundColor: config.frameColor 
               }}
             >
                <div className={`grid ${getGridClasses(config.gridType)} gap-4 w-full h-full`}>
                  {Array.from({ length: gridConfig.count }).map((_, i) => (
                    <div key={i} className="relative overflow-hidden w-full h-full bg-black/10 shadow-sm">
                      <VideoFeed 
                        stream={stream} 
                        filter={config.filterType}
                        animation={config.animationType}
                        mask={config.maskType}
                        faceData={faceData} // Pass tracked face data
                        videoRef={i === 0 ? videoRef : undefined}
                      />
                    </div>
                  ))}
                </div>

                 <div className="absolute top-3 right-3 z-20 pointer-events-none">
                   <span className="inline-block bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md uppercase tracking-wider">
                     Preview
                   </span>
                 </div>
             </div>

             <div className="pt-6 pb-2 flex justify-center items-center mt-auto">
               <div className="px-8 py-3">
                 <span className={`font-serif italic ${config.gridType === GridType.STRIP_4 ? 'text-xl' : 'text-2xl'} ${textColor}`}>
                   let's take a pic
                 </span>
               </div>
             </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-96 bg-white border-l border-gray-100 p-8 flex flex-col gap-8 order-2 md:order-2 overflow-y-auto z-10 shadow-lg">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setAppState(AppState.IDLE)} 
               className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors group"
               aria-label="Back"
             >
               <Icons.ArrowLeft className="w-6 h-6 text-gray-400 group-hover:text-booth-dark" />
             </button>
             <h2 className="font-serif text-3xl italic">Settings</h2>
          </div>

          <div className="space-y-3">
             <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
               <Icons.Grid className="w-4 h-4 mr-2"/> Layout
             </label>
             <div className="grid grid-cols-2 gap-3">
               {Object.values(GridType).map((type) => (
                 <button
                   key={type}
                   onClick={() => setConfig(c => ({...c, gridType: type}))}
                   className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 flex items-center justify-center ${
                     config.gridType === type 
                       ? 'border-booth-dark bg-booth-dark text-white' 
                       : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                   }`}
                 >
                   {GRID_CONFIGS[type].label}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
              <Icons.Sparkles className="w-4 h-4 mr-2"/> Mask
            </label>
            <div className="flex flex-wrap gap-2">
              {MASKS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    setConfig(c => ({...c, maskType: m.value}));
                    playClick();
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                    config.maskType === m.value
                      ? 'bg-booth-dark text-white border-booth-dark'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
              <Icons.Palette className="w-4 h-4 mr-2"/> Filter
            </label>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setConfig(c => ({...c, filterType: f.value}));
                    playClick();
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                    config.filterType === f.value
                      ? 'bg-booth-dark text-white border-booth-dark'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
              <Icons.Image className="w-4 h-4 mr-2"/> Effects
            </label>
            <div className="flex flex-wrap gap-2">
              {ANIMATIONS.map((anim) => (
                <button
                  key={anim.value}
                  onClick={() => setConfig(c => ({...c, animationType: anim.value}))}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all border ${
                    config.animationType === anim.value
                      ? 'bg-booth-dark text-white border-booth-dark'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>

           <div className="space-y-3">
            <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
              <Icons.Palette className="w-4 h-4 mr-2"/> Frame
            </label>
            <div className="flex gap-4">
              {FRAMES.map((frame) => (
                <button
                  key={frame.value}
                  onClick={() => setConfig(c => ({...c, frameColor: frame.value}))}
                  className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                    config.frameColor === frame.value ? 'ring-2 ring-offset-2 ring-gray-400 border-gray-400' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: frame.value }}
                  title={frame.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400/80 mb-2">
              <Icons.Timer className="w-4 h-4 mr-2"/> Timer
            </label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {TIMERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setConfig(c => ({...c, timerDuration: t}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.timerDuration === t
                      ? 'bg-white shadow-sm text-booth-dark'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4">
             <button
               onClick={startCaptureSequence}
               className="w-full py-4 bg-booth-dark text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center"
             >
               <Icons.Camera className="mr-2 w-5 h-5"/>
               Start Photo Booth
             </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Capture Mode
  if (appState === AppState.COUNTDOWN || appState === AppState.CAPTURE) {
    const totalPhotos = GRID_CONFIGS[config.gridType].count;
    const animClass = config.animationType !== AnimationType.NONE ? `anim-${config.animationType}` : '';

    return (
      <div className="h-screen w-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 relative flex overflow-hidden">
        {flash && <div className="absolute inset-0 bg-white z-50 animate-fadeOut pointer-events-none" />}
        
        <div className="flex-1 relative flex items-center justify-center p-8 md:p-12">
            <div 
              className={`relative w-full max-w-4xl max-h-[80vh] shadow-2xl rounded-lg overflow-hidden border border-gray-200 bg-gray-100 transition-all duration-300 ${animClass}`}
              style={{ 
                 aspectRatio: 4/3, // Force 4:3 for capture frame
              }}
            >
              <VideoFeed 
                  stream={stream}
                  filter={config.filterType}
                  mask={config.maskType}
                  faceData={faceData}
                  videoRef={videoRef}
                  className="w-full h-full"
              />
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="text-[10rem] md:text-[14rem] font-bold text-white drop-shadow-2xl animate-pulse font-serif italic leading-none">
                    {countdown > 0 ? countdown : ''}
                  </div>
                </div>
            </div>
        </div>

        <div className="hidden md:flex flex-col w-32 lg:w-48 bg-white border-l border-gray-200 p-4 gap-4 z-20 h-full overflow-y-auto">
             <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest text-center py-2 border-b border-gray-200">
                Photos
             </h3>
             <div className="flex flex-col gap-3 w-full flex-1">
               {Array.from({ length: totalPhotos }).map((_, i) => {
                 const hasPhoto = i < photos.length;
                 const isActive = i === photos.length;

                 return (
                   <div 
                     key={i} 
                     className={`w-full aspect-[4/3] rounded-md border overflow-hidden transition-all duration-300 relative ${
                       hasPhoto 
                         ? 'border-transparent bg-gray-100' 
                         : isActive 
                         ? 'border-gray-400 bg-gray-50 animate-pulse'
                         : 'border-gray-200 bg-transparent'
                     }`}
                   >
                     {hasPhoto ? (
                       <img 
                         src={photos[i]} 
                         alt={`Shot ${i + 1}`} 
                         className="w-full h-full object-cover"
                       />
                     ) : (
                       <div className="flex items-center justify-center w-full h-full text-gray-300 font-sans text-sm font-medium">
                         {i + 1}
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
             <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-booth-dark transition-all duration-500 ease-out" 
                  style={{ width: `${(photos.length / totalPhotos) * 100}%` }}
                />
             </div>
          </div>
      </div>
    );
  }

  // 4. Processing / Result
  if (appState === AppState.PROCESSING || appState === AppState.RESULT) {
    const animClass = config.animationType !== AnimationType.NONE ? `anim-${config.animationType}` : '';

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex flex-col items-center justify-center p-6 relative">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>

         {showDownloadFeedback && (
            <div className="fixed top-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
              <div className="bg-white text-booth-dark px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-gray-200 animate-bounce pointer-events-auto">
                <div className="bg-green-500 rounded-full p-1">
                  <Icons.Check className="w-4 h-4 text-white" />
                </div>
                <span className="font-sans font-medium">{feedbackMessage}</span>
              </div>
            </div>
         )}

         <div className="z-10 w-full max-w-6xl flex flex-col md:flex-row gap-16 items-center justify-center">
            
            <div className="relative group shadow-2xl">
               {compositeUrl ? (
                 <div 
                   className={`rounded-sm border-[16px] overflow-hidden ${animClass}`}
                   style={{ 
                     borderColor: config.frameColor, 
                     backgroundColor: config.frameColor 
                   }}
                 >
                   <img 
                     src={compositeUrl} 
                     alt="Photobooth Result" 
                     className="max-h-[75vh] w-auto object-contain block" 
                   />
                 </div>
               ) : (
                 <div className="h-[65vh] w-[350px] bg-gray-200 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-xl">
                    Processing...
                 </div>
               )}
            </div>

            <div className="flex flex-col gap-8 w-full max-w-sm">
               <div className="text-center md:text-left space-y-3">
                 <h2 className="font-serif text-5xl italic text-booth-dark">Ready!</h2>
                 <p className="text-gray-500 text-lg">Your digital photo strip is ready to keep.</p>
               </div>

               <div className="space-y-4">
                 <button 
                   onClick={downloadImage}
                   disabled={!compositeUrl}
                   className="w-full py-5 bg-black text-white rounded-2xl font-bold text-xl flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Icons.Download className="mr-3 w-6 h-6" /> Download Photo
                 </button>

                 <button 
                   onClick={downloadVideo}
                   disabled={!videoUrl}
                   className="w-full py-5 bg-black text-white rounded-2xl font-bold text-xl flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Icons.Image className="mr-3 w-6 h-6" /> Download Video
                 </button>
                 
                 <button 
                   onClick={handleRetake}
                   className="w-full py-5 bg-white text-booth-dark border-2 border-booth-dark rounded-2xl font-bold text-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
                 >
                   <Icons.Refresh className="mr-3 w-6 h-6" /> Take Another
                 </button>
               </div>
            </div>
         </div>
      </div>
    );
  }

  return null;
};

export default App;