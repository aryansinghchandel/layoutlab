import html2canvas from 'html2canvas';
import type { AiSkin, DeviceMode, ImageFormat, ThemeMode } from '../types';
import { getSkinPalette } from './skins';

const FORMAT_CONFIG: Record<
  ImageFormat,
  { mime: string; quality: number; extension: string }
> = {
  png: { mime: 'image/png', quality: 1.0, extension: 'png' },
  jpg: { mime: 'image/jpeg', quality: 0.92, extension: 'jpg' },
  webp: { mime: 'image/webp', quality: 0.92, extension: 'webp' },
};

export async function exportCleanImage(
  element: HTMLElement,
  theme: ThemeMode,
  _device: DeviceMode,
  format: ImageFormat,
  skin: AiSkin = 'chatgpt'
): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const bgColor = getSkinPalette(skin, theme).canvasBg;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: bgColor,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc, clonedElement) => {
      clonedDoc.documentElement.style.backgroundColor = bgColor;
      clonedDoc.body.style.backgroundColor = bgColor;
      clonedElement.style.boxShadow = 'none';
      clonedElement.style.margin = '0';
    },
  });

  const { mime, quality, extension } = FORMAT_CONFIG[format];
  const dataUrl = canvas.toDataURL(mime, quality);
  const link = document.createElement('a');
  link.download = `layoutlab-final.${extension}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
