/**
 * تصغير الصور قبل إضافتها للوحة. صورة موبايل 12 ميجابكسل كانت بتتحفظ كنص
 * ضخم جوه لقطات اللوحة وتملى التخزين بسرعة.
 */

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.86;
const KEEPS_TRANSPARENCY = /^image\/(png|gif|webp|svg)/;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّر قراءة الصورة"));
    };
    image.src = url;
  });
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر معالجة الصورة");
  ctx.drawImage(image, 0, 0, width, height);

  const keepAlpha = KEEPS_TRANSPARENCY.test(file.type);
  const dataUrl = keepAlpha
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}
