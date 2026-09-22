export const TAKE_MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export function selectTakeMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string {
  return TAKE_MIME_CANDIDATES.find((candidate) => isTypeSupported(candidate)) ?? '';
}

export function takeFileExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}
