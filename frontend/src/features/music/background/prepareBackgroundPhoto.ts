export type PreparedBackgroundPhoto = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function prepareBackgroundPhoto(
  file: File,
  maxDimension = 1280,
  quality = 0.78,
): Promise<PreparedBackgroundPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
      element.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
