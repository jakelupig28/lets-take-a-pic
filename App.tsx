import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from './hooks/useWebcam';
import { useSound } from './hooks/useSound';
import { AppState, FilterType, FrameColor, GridType, PhotoConfig, AnimationType } from './types';
import { DEFAULT_CONFIG, GRID_CONFIGS, FILTERS, FRAMES, TIMERS, ANIMATIONS } from './constants';
import { captureFrame, generateComposite } from './utils/imageProcessing';
import { Icons } from './components/Icon';

// Helper component for individual video feeds
const VideoFeed: React.FC<{
  stream: MediaStream | null;
  filter: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  animation?: AnimationType;
}> = ({ stream, filter, className, videoRef, animation }) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef || internalRef;

  useEffect(() => {
    const el = ref.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(e => console.warn("Auto-play blocked", e));
      }
    }
  }, [stream, ref]);

  // Determine animation class
  const animClass = animation && animation !== AnimationType.NONE ? `anim-${animation}` : '';

  return (
    <div className={`w-full h-full overflow-hidden ${animClass} ${className || ''}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover hover-scale-mirror"
        style={{ filter, WebkitFilter: filter }}
      />
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
  
  // Timers and Refs
  const [countdown, setCountdown] = useState<number>(0);
  const [flash, setFlash] = useState(false);
  const { videoRef, startCamera, permissionGranted, error, stream } = useWebcam();
  
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
    }
  };

  const startCaptureSequence = () => {
    setAppState(AppState.COUNTDOWN);
    startCountdown();
  };

  // We need a ref for takePhoto to avoid stale closures in the interval
  const takePhotoRef = useRef<() => void>(() => {});

  const startCountdown = useCallback(() => {
    setCountdown(config.timerDuration);
    playCountdown(); 
    setAppState(AppState.COUNTDOWN);

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
  }, [config.timerDuration, playCountdown]);

  // Process Result needs to be stable or dependent on config
  const processResult = useCallback(async (finalPhotos: string[]) => {
    setAppState(AppState.PROCESSING);
    try {
      // Use current config state here
      const result = await generateComposite(finalPhotos, config.gridType, config.frameColor);
      setCompositeUrl(result);
      setAppState(AppState.RESULT);
      playSuccess(); 
    } catch (err) {
      console.error("Processing failed", err);
    }
  }, [config, playSuccess]);

  const takePhoto = useCallback(() => {
    if (videoRef.current) {
      playShutter(); 
      setFlash(true);
      setTimeout(() => setFlash(false), 200);

      try {
        const photoData = captureFrame(videoRef.current, config.filterType);
        
        setPhotos(prev => {
          const newPhotos = [...prev, photoData];
          const targetCount = GRID_CONFIGS[config.gridType].count;
          
          if (newPhotos.length >= targetCount) {
             setTimeout(() => {
               processResult(newPhotos);
             }, 500);
             return newPhotos;
          } else {
            // Store delay timeout to allow cancellation
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

  // Keep ref updated
  useEffect(() => {
    takePhotoRef.current = takePhoto;
  }, [takePhoto]);

  const handleRetake = () => {
    setPhotos([]);
    setCompositeUrl(null);
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

      // Trigger feedback
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

  // --- Render Components --- //

  // 1. Landing Screen
  if (appState === AppState.IDLE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 text-booth-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Background Blobs - Enhanced */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-200/50 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob"></div>
        <div className="absolute top-[10%] right-[-10%] w-[600px] h-[600px] bg-yellow-100/60 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-[15%] w-[600px] h-[600px] bg-pink-200/50 rounded-full mix-blend-multiply filter blur-[96px] opacity-60 animate-blob animation-delay-4000"></div>

        <main className="z-10 text-center space-y-12 w-full max-w-4xl">
          <div className="space-y-4">
            <h1 className="font-serif italic text-5xl md:text-8xl tracking-tight text-booth-dark whitespace-nowrap">
              let's take a pic
            </h1>
            <p className="text-gray-500 font-sans tracking-widest uppercase text-sm">
              The minimalist photo booth
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

        <footer className="absolute bottom-6 text-xs text-gray-400 font-sans">
           Created by Jake Lupig
        </footer>
      </div>
    );
  }

  // 2. Setup Screen (Live Preview + Controls)
  if (appState === AppState.SETUP) {
    const gridConfig = GRID_CONFIGS[config.gridType];
    const isDarkFrame = config.frameColor === FrameColor.BLACK;
    const textColor = isDarkFrame ? 'text-white' : 'text-booth-dark';
    
    return (
      <div className="min-h-screen bg-booth-cream flex flex-col md:flex-row">
        {/* Left: Preview */}
        <div className="flex-1 relative flex flex-col items-center justify-center bg-gray-100 p-8 md:p-12 order-1 md:order-1">
          <div 
            className="relative w-full max-w-xl shadow-2xl transition-all duration-300 border-[16px] flex flex-col"
            style={{ 
              borderColor: config.frameColor,
              backgroundColor: config.frameColor,
            }}
          >
             {/* Dynamic Grid Preview */}
             <div 
               className="w-full relative overflow-hidden transition-colors duration-300"
               style={{ 
                 aspectRatio: gridConfig.aspectRatio,
                 backgroundColor: config.frameColor 
               }}
             >
                <div className={`grid ${getGridClasses(config.gridType)} gap-2 w-full h-full`}>
                  {Array.from({ length: gridConfig.count }).map((_, i) => (
                    <div key={i} className="relative overflow-hidden w-full h-full bg-black/10">
                      <VideoFeed 
                        stream={stream} 
                        filter={config.filterType}
                        animation={config.animationType}
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

             {/* Footer Branding inside the frame */}
             <div className="pt-6 pb-2 flex justify-center items-center">
               <div className="px-8 py-3">
                 <span className={`font-serif italic text-2xl ${textColor}`}>
                   let's take a pic
                 </span>
               </div>
             </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-96 bg-white border-l border-gray-100 p-8 flex flex-col gap-8 order-2 md:order-2 overflow-y-auto z-10 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-3xl italic">Settings</h2>
            <button onClick={() => setAppState(AppState.IDLE)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Icons.Close className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
             <label className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-400">
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
            <label className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-400">
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
            <label className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-400">
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
            <label className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-400">
              <Icons.Image className="w-4 h-4 mr-2"/> Frame
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
            <label className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-400">
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

  // 3. Capture Mode (Countdown + Flash + Side Gallery)
  if (appState === AppState.COUNTDOWN || appState === AppState.CAPTURE) {
    const totalPhotos = GRID_CONFIGS[config.gridType].count;
    const animClass = config.animationType !== AnimationType.NONE ? `anim-${config.animationType}` : '';

    return (
      <div className="h-screen w-screen bg-white relative flex overflow-hidden">
        {flash && <div className="absolute inset-0 bg-white z-50 animate-fadeOut pointer-events-none" />}
        
        {/* Main Camera Area */}
        <div className="flex-1 relative flex items-center justify-center p-8 md:p-12">
            <div 
              className={`relative w-full max-w-4xl max-h-[80vh] shadow-2xl rounded-lg overflow-hidden border border-gray-200 bg-gray-100 transition-all duration-300 ${animClass}`}
              style={{ 
                 aspectRatio: GRID_CONFIGS[config.gridType].aspectRatio,
              }}
            >
              <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover transform -scale-x-100 transition-[filter] duration-300"
                  style={{ filter: config.filterType, WebkitFilter: config.filterType }}
                />
                
                {/* Countdown Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="text-[10rem] md:text-[14rem] font-bold text-white drop-shadow-2xl animate-pulse font-serif italic leading-none">
                    {countdown > 0 ? countdown : ''}
                  </div>
                </div>
            </div>
        </div>

        {/* Right Sidebar: Live Gallery */}
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
             {/* Progress Bar */}
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
      <div className="min-h-screen bg-booth-cream flex flex-col items-center justify-center p-6 relative">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>

         {/* Download Feedback Toast */}
         {showDownloadFeedback && (
            <div className="fixed top-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
              <div className="bg-white text-booth-dark px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-gray-200 animate-bounce pointer-events-auto">
                <div className="bg-green-500 rounded-full p-1">
                  <Icons.Check className="w-4 h-4 text-white" />
                </div>
                <span className="font-sans font-medium">Your photo strip is downloading successfully.</span>
              </div>
            </div>
         )}

         <div className="z-10 w-full max-w-6xl flex flex-col md:flex-row gap-16 items-center justify-center">
            
            {/* The Final Image */}
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

            {/* Actions */}
            <div className="flex flex-col gap-8 w-full max-w-sm">
               <div className="text-center md:text-left space-y-3">
                 <h2 className="font-serif text-5xl italic text-booth-dark">Ready!</h2>
                 <p className="text-gray-500 text-lg">Your digital photo strip is ready to keep.</p>
               </div>

               <div className="space-y-4">
                 <button 
                   onClick={downloadImage}
                   disabled={!compositeUrl}
                   className="w-full py-5 bg-booth-dark text-white rounded-2xl font-bold text-xl flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Icons.Download className="mr-3 w-6 h-6" /> Download
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