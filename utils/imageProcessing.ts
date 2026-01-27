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

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation: number, opacity: number = 0.9) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(253, 224, 71, 0.6)'; // Yellow shadow
  ctx.shadowBlur = 12;

  const spikes = 5;
  const outerRadius = size / 2;
  const innerRadius = size / 4;
  
  ctx.beginPath();
  let rot = Math.PI / 2 * 3;
  let cx = 0; // relative to translate
  let cy = 0;
  let step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    let sx = cx + Math.cos(rot) * outerRadius;
    let sy = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(sx, sy);
    rot += step;

    sx = cx + Math.cos(rot) * innerRadius;
    sy = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(sx, sy);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const drawMask = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    type: MaskType,
    faceData?: FaceData
) => {
  // If face detected, use it. Otherwise default to center (approximate position)
  
  let centerX = width / 2;
  let centerY = height * 0.3; // Default forehead
  let baseScale = 1.0;

  if (faceData) {
    // FaceData is normalized 0-1.
    // video frame is flipped in context (mirror effect), but the source faceData is from raw video.
    centerX = faceData.x * width;
    
    // Y is normal
    // App.tsx uses: normalizedY - (visibleH * 0.6)
    // Here we duplicate that logic, using faceData.height (which is normalized height)
    centerY = (faceData.y - (faceData.height * 0.6)) * height;
    
    // Scale hearts based on face width relative to frame width
    // Reference face width might be ~0.3 of screen.
    baseScale = (faceData.width / 0.35); 
  }

  // Radius of the crown arc - Smaller now
  const radiusX = (width * 0.20) * baseScale; 
  const radiusY = (height * 0.10) * baseScale;
  
  if (type === MaskType.HEARTS) {
    // Mixed colors: Light Pink (#F9A8D4) and Dark Pink (#DB2777)
    const colors = ['#F9A8D4', '#DB2777', '#F472B6', '#BE185D', '#FBCFE8'];

    const items = [
        { angle: -40, size: 30, rotate: -30, color: colors[0] },
        { angle: -20, size: 38, rotate: -15, color: colors[1] },
        { angle: 0, size: 45, rotate: 0, color: colors[2] },
        { angle: 20, size: 38, rotate: 15, color: colors[3] },
        { angle: 40, size: 30, rotate: 30, color: colors[4] },
    ];

    items.forEach(item => {
        const rad = item.angle * Math.PI / 180;
        const x = centerX + (radiusX * Math.sin(rad));
        const y = centerY - (radiusY * Math.cos(rad));
        
        // Scale size relative to canvas width (standard reference 640px)
        const scaleFactor = (width / 640) * baseScale;
        
        drawHeart(ctx, x, y, item.size * scaleFactor, item.color, item.rotate, 0.95);
    });
  } 
  else if (type === MaskType.STARS) {
    const colors = ['#FDE047', '#FEF08A', '#FCD34D', '#BAE6FD', '#FDE047']; // Yellows and light blue

    const items = [
        { angle: -45, size: 35, rotate: -20, color: colors[0] },
        { angle: -22, size: 28, rotate: -10, color: colors[1] },
        { angle: 0, size: 42, rotate: 0, color: colors[2] },
        { angle: 22, size: 28, rotate: 10, color: colors[3] },
        { angle: 45, size: 35, rotate: 20, color: colors[4] },
    ];

    items.forEach(item => {
        const rad = item.angle * Math.PI / 180;
        const x = centerX + (radiusX * Math.sin(rad));
        const y = centerY - (radiusY * Math.cos(rad));
        const scaleFactor = (width / 640) * baseScale;

        drawStar(ctx, x, y, item.size * scaleFactor, item.color, item.rotate, 0.95);
    });
  }
};

/**
 * Captures a low-resolution frame for GIF generation.
 */
export const captureLowResFrame = (
  video: HTMLVideoElement,
  filter: FilterType
): string => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Small size for GIF performance
  const width = 320;
  const height = 240;
  const targetRatio = width / height; // 4:3

  canvas.width = width;
  canvas.height = height;

  if (filter !== FilterType.NORMAL) {
    ctx.filter = filter;
  }

  // Mirror
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  // Calculate Crop to preserve aspect ratio (4:3) and avoid squeezing
  const videoRatio = video.videoWidth / video.videoHeight;
  let sW, sH, sX, sY;

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

  // Draw scaled down with crop
  ctx.drawImage(video, sX, sY, sW, sH, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.6); // Compress slightly
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
  if (mask !== MaskType.NONE) {
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

    drawMask(ctx, canvas.width, canvas.height, mask, adjustedFaceData);
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
  qrCodeUrl?: string | null, // Added QR code support
  title: string = "let's take a pic"
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  
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

  // Dynamic Spacing Logic
  // For high-res (e.g. 1000px wide), we want ~70px padding. Ratio: 0.07
  // For low-res (e.g. 320px wide), we want ~20px padding. Ratio: ~0.06
  const scaleFactor = sourceW < 500 ? 0.5 : 1.0;
  
  const padding = Math.round(70 * scaleFactor); 
  const gap = Math.round(70 * scaleFactor); 
  const bottomLabelHeight = Math.round(160 * scaleFactor); 

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
  
  // Calculate center of the footer text area
  const footerCenterY = canvas.height - (90 * scaleFactor);

  // Title
  const titleSize = Math.round(48 * scaleFactor);
  ctx.font = `italic 700 ${titleSize}px "Playfair Display", serif`;
  // Date
  const dateSize = Math.round(24 * scaleFactor);
  const dateFont = `500 ${dateSize}px "DM Sans", sans-serif`;

  // Position title and date relative to the visual center
  const titleY = footerCenterY - (24 * scaleFactor);
  const dateY = footerCenterY + (28 * scaleFactor);

  ctx.fillText(title, canvas.width / 2, titleY);

  ctx.font = dateFont;
  ctx.globalAlpha = 0.7;
  const dateStr = new Date().toLocaleDateString();
  ctx.fillText(dateStr, canvas.width / 2, dateY);

  // Draw QR Code if provided
  if (qrCodeUrl) {
    const qrImg = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = qrCodeUrl;
    });
    
    // QR Code Placement: Bottom Right, with some padding
    const qrSize = Math.round(100 * scaleFactor);
    const qrX = canvas.width - padding - qrSize;
    const qrY = canvas.height - (bottomLabelHeight / 2) - (qrSize / 2); // Vertically centered in footer
    
    // Reset alpha for QR
    ctx.globalAlpha = 1.0;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  return canvas.toDataURL("image/png");
};