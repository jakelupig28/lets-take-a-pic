import { GridType, FrameColor, FilterType } from "../types";
import { GRID_CONFIGS } from "../constants";

/**
 * Captures the current frame from the video element applying the selected filter.
 * Clips the image to a 4:3 aspect ratio.
 */
export const captureFrame = (
  video: HTMLVideoElement,
  filter: FilterType
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

  // Apply filter contextually if supported, otherwise we might need specific logic
  // Note: ctx.filter is supported in most modern browsers.
  if (filter !== FilterType.NORMAL) {
    ctx.filter = filter;
  }

  // Flip horizontally to match mirror view usually expected in photobooths
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // Draw clipped version
  ctx.drawImage(video, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
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
  // We use equal padding and gap to ensure symmetric "borders" around all sides of the photos
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
  // The total empty space at the bottom is padding (now 70px) + bottomLabelHeight (160px) = 230px.
  // We keep the fixed offset logic to ensure it stays visually where expected (lowered).
  // 90px from bottom ensures good separation from the last photo given the increased padding.
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