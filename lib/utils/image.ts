import html2canvas from 'html2canvas';
import saveAs from 'file-saver';

export const downloadScreenshot = async (screen: HTMLElement) => {
  try {
    const canvas = await html2canvas(screen, { scale: 2 });
    canvas.toBlob(blob => {
      if (blob !== null) {
        saveAs(blob, '심심풀이 땅콩 복불복 결과.png');
      }
    });
  } catch (error) {
    console.error('Error converting div to image:', error);
  }
};
