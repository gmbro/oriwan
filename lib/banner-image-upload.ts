export const MAX_BANNER_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_BANNER_TRANSFER_BYTES = 3 * 1024 * 1024;
export async function prepareBannerImage(file: File): Promise<File> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 이미지를 선택해주세요.');
  if (!file.size || file.size>MAX_BANNER_SOURCE_BYTES) throw new Error('이미지는 최대 20MB까지 올릴 수 있어요.');
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas');
    let edge=4096;
    for(let pass=0;pass<4;pass++){
      const ratio=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      const context=canvas.getContext('2d');if(!context)throw new Error('이미지를 준비하지 못했어요.');
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.9-pass*.08));
      if(blob&&blob.size<=MAX_BANNER_TRANSFER_BYTES)return new File([blob],'banner.webp',{type:blob.type});
      edge=Math.round(edge*.8);
    }
    throw new Error('이미지를 줄이지 못했어요. 다른 이미지로 다시 시도해주세요.');
  } finally { bitmap.close(); }
}
