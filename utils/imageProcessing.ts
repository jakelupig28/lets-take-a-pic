import { GridType, FrameColor, FilterType, MaskType, FaceData } from "../types";
import { GRID_CONFIGS } from "../constants";

// Helper to draw a single heart on the canvas
const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation: number, opacity: number = 0.9) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  // Reduce shadow for cleaner look or match the aesthetic
  ctx.shadowColor = 'rgba(255, 105, 180, 0.5)';
  ctx.shadowBlur = 10;
  
  // Draw Heart Path
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, topCurveHeight);
  // Top left curve
  ctx.bezierCurveTo(
    0, 0, 
    -size / 2, 0, 
    -size / 2, topCurveHeight
  );
  // Bottom left curve
  ctx.bezierCurveTo(
    -size / 2, (size + topCurveHeight) / 2, 
    0, (size + topCurveHeight) / 2, 
    0, size
  );
  // Bottom right curve
  ctx.bezierCurveTo(
    0, (size + topCurveHeight) / 2, 
    size / 2, (size + topCurveHeight) / 2, 
    size / 2, topCurveHeight
  );
  // Top right curve
  ctx.bezierCurveTo(
    size / 2, 0, 
    0, 0, 
    0, topCurveHeight
  );
  ctx.fill();
  ctx.restore();
};

const drawHeartsMask = (ctx: CanvasRenderingContext2D, width: number, height: number, faceData?: FaceData) => {
  // If face detected, use it. Otherwise default to center (approximate position)
  
  let centerX = width / 2;
  let centerY = height * 0.3; // Default forehead
  let baseScale = 1.0;

  if (faceData) {
    // FaceData is normalized 0-1.
    // video frame is flipped in context (mirror effect), but the source faceData is from raw video.
    // Raw Video: X=0 is Left.
    // Canvas Context: Flipped horizontally by `scale(-1, 1)`. 
    // This means coordinate 0 is visually on the Right, and width is on the Left.
    // However, we translate(width, 0) before scaling.
    // So logic:
    // Canvas X=0 corresponds to Source X=0 (Visually Right side of screen)
    // Canvas X=Width corresponds to Source X=Width (Visually Left side of screen)
    // Actually, captureFrame does: translate(width, 0); scale(-1, 1);
    // This effectively maps Source Pixels directly to Canvas Pixels, just mirrored rendering.
    // So if face is at x=100 in source, we draw at x=100 in canvas.
    // The scale(-1, 1) flips the drawing at that position.
    
    centerX = faceData.x * width;
    
    // Y is normal
    centerY = (faceData.y * height) - (faceData.height * height * 0.55); // Slightly higher than center
    
    // Scale hearts based on face width relative to frame width
    // Reference face width might be ~0.3 of screen.
    baseScale = (faceData.width / 0.35); 
  }

  // Radius of the crown arc - Smaller now
  const radiusX = (width * 0.20) * baseScale; 
  const radiusY = (height * 0.10) * baseScale;
  
  // Mixed colors: Light Pink (#F9A8D4) and Dark Pink (#DB2777)
  const colors = ['#F9A8D4', '#DB2777', '#F472B6', '#BE185D', '#FBCFE8'];

  const hearts = [
    { angle: -40, size: 30, rotate: -30, color: colors[0] },
    { angle: -20, size: 38, rotate: -15, color: colors[1] },
    { angle: 0, size: 45, rotate: 0, color: colors[2] },
    { angle: 20, size: 38, rotate: 15, color: colors[3] },
    { angle: 40, size: 30, rotate: 30, color: colors[4] },
  ];

  hearts.forEach(heart => {
     const rad = heart.angle * Math.PI / 180;
     const x = centerX + (radiusX * Math.sin(rad));
     const y = centerY - (radiusY * Math.cos(rad));
     
     // Scale size relative to canvas width (standard reference 640px)
     const scaleFactor = (width / 640) * baseScale;
     
     // Draw with full opacity for the photo
     drawHeart(ctx, x, y, heart.size * scaleFactor, heart.color, heart.rotate, 0.95);
  });
};

/**
 * Captures the current frame from the video element applying the selected filter.
 * Clips the image to a 4:3 aspect ratio.
 */
export const captureFrame = (
  video: HTMLVideoElement,
  filter: FilterType,
  mask: MaskType = MaskType.NONE,
  faceData?: FaceData | null
): string => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Desired Aspect Ratio 4:3
  const targetRatio = 4/3;
  const videoRatio = video.videoWidth / video.videoHeight;
  
  let sW, sH, sX, sY;

  // Calculate cropping to center the image within the 4:3 container
  if (videoRatio > targetRatio) {
    // Video is wider (e.g. 16:9). Crop width.
    sH = video.videoHeight;
    sW = sH * targetRatio;
    sX = (video.videoWidth - sW) / 2;
    sY = 0;
  } else {
    // Video is taller or equal. Crop height.
    sW = video.videoWidth;
    sH = sW / targetRatio;
    sX = 0;
    sY = (video.videoHeight - sH) / 2;
  }

  // Ensure integer dimensions
  sW = Math.floor(sW);
  sH = Math.floor(sH);
  sX = Math.floor(sX);
  sY = Math.floor(sY);

  canvas.width = sW;
  canvas.height = sH;

  // Apply filter contextually if supported
  if (filter !== FilterType.NORMAL) {
    ctx.filter = filter;
  }

  // Flip horizontally to match mirror view
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // Draw clipped version
  ctx.drawImage(video, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
  
  // Draw Mask if enabled
  if (mask === MaskType.HEARTS) {
    // We need to adjust faceData for the crop if it exists
    
    let adjustedFaceData = undefined;
    if (faceData) {
        // Convert normalized face coords to source pixels
        const fx_px = faceData.x * video.videoWidth;
        const fy_px = faceData.y * video.videoHeight;
        const fw_px = faceData.width * video.videoWidth;
        const fh_px = faceData.height * video.videoHeight;

        // Check if face is inside the crop
        // The crop rect is (sX, sY, sW, sH)
        
        // Relative to Crop
        const fx_crop = fx_px - sX;
        const fy_crop = fy_px - sY;
        
        // Normalize back to Canvas size
        adjustedFaceData = {
            x: fx_crop / sW,
            y: fy_crop / sH,
            width: fw_px / sW,
            height: fh_px / sH,
            videoWidth: sW, // adjusted video width for the context of mask drawing
            videoHeight: sH
        };
    }

    drawHeartsMask(ctx, canvas.width, canvas.height, adjustedFaceData);
  }

  return canvas.toDataURL("image/png");
};

/**
 * Generates the final composite image (strip or grid).
 */
export const generateComposite = async (
  images: string[],
  gridType: GridType,
  frameColor: FrameColor,
  title: string = "let's take a pic"
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Base configuration
  // Increased to 70px (from 60px) to add more space as requested
  const padding = 70; 
  const gap = 70; 
  const bottomLabelHeight = 160; 
  
  // Assuming all captured images are same size. Load first to get dimensions.
  const loadedImages = await Promise.all(
    images.map(src => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    })
  );

  if (loadedImages.length === 0) return "";

  const sourceW = loadedImages[0].width;
  const sourceH = loadedImages[0].height;

  // Determine Cell Size and Cropping based on Grid Type
  let cellW = sourceW;
  let cellH = sourceH;
  let sX = 0;
  let sY = 0;
  let sW = sourceW;
  let sH = sourceH;

  // For Grid 2x2, we use slight landscape (4:3 ratio) - though images are already 4:3 from capture
  if (gridType === GridType.GRID_2X2) {
      // If source matches 4:3 (which it should), these are pass-through
      const targetRatio = 4/3;
      
      if (sourceW / sourceH > targetRatio) {
          sH = sourceH;
          sW = sourceH * targetRatio;
          sX = (sourceW - sW) / 2;
          sY = 0;
      } else {
          sW = sourceW;
          sH = sourceW / targetRatio;
          sX = 0;
          sY = (sourceH - sH) / 2;
      }
      
      // Floor values to avoid sub-pixel rendering gaps
      sW = Math.floor(sW);
      sH = Math.floor(sH);
      sX = Math.floor(sX);
      sY = Math.floor(sY);
      
      cellW = sW;
      cellH = sH;
  }

  let canvasWidth = 0;
  let canvasHeight = 0;

  // Calculate composite dimensions
  switch (gridType) {
    case GridType.SINGLE:
      canvasWidth = sourceW + (padding * 2);
      canvasHeight = sourceH + (padding * 2) + bottomLabelHeight;
      break;
    case GridType.STRIP_3:
    case GridType.STRIP_4:
      canvasWidth = sourceW + (padding * 2);
      canvasHeight = (sourceH * loadedImages.length) + (gap * (loadedImages.length - 1)) + (padding * 2) + bottomLabelHeight;
      break;
    case GridType.GRID_2X2:
      canvasWidth = (cellW * 2) + gap + (padding * 2);
      canvasHeight = (cellH * 2) + gap + (padding * 2) + bottomLabelHeight;
      break;
  }

  // Setup Canvas with integer dimensions
  canvas.width = Math.ceil(canvasWidth);
  canvas.height = Math.ceil(canvasHeight);

  // Draw Background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Images
  let currentX = padding;
  let currentY = padding;

  loadedImages.forEach((img, index) => {
    if (gridType === GridType.GRID_2X2) {
      const row = Math.floor(index / 2);
      const col = index % 2;
      currentX = padding + (col * (cellW + gap));
      currentY = padding + (row * (cellH + gap));
      
      // Draw with crop
      ctx.drawImage(img, sX, sY, sW, sH, currentX, currentY, cellW, cellH);

    } else {
       // Strips or Single
       currentX = padding;
       currentY = padding + (index * (sourceH + gap));
       ctx.drawImage(img, currentX, currentY, sourceW, sourceH);
    }
  });

  // Draw Footer Text
  ctx.fillStyle = (frameColor === FrameColor.BLACK) ? '#FFFFFF' : '#1A1A1A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate center of the footer text
  const footerCenterY = canvas.height - 90;

  // Title
  ctx.font = 'italic 700 48px "Playfair Display", serif';
  // Date
  const dateFont = '500 24px "DM Sans", sans-serif';

  // Position title and date relative to the visual center
  const titleY = footerCenterY - 24;
  const dateY = footerCenterY + 28;

  ctx.fillText(title, canvas.width / 2, titleY);

  ctx.font = dateFont;
  ctx.globalAlpha = 0.7;
  const dateStr = new Date().toLocaleDateString();
  ctx.fillText(dateStr, canvas.width / 2, dateY);

  return canvas.toDataURL("image/png");
};