// Avatar processing adapters (spec 02 §8.5). The browser resizes to 256 × 256 WebP so the stored
// data URL stays small; Node (contract tests) keeps the input as is.

export type AvatarProcessor = (bytes: Uint8Array<ArrayBuffer>, mimeType: string) => Promise<string>

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Keeps the original bytes: used in Node, where there is no canvas. */
export const passthroughAvatar: AvatarProcessor = (bytes, mimeType) =>
  Promise.resolve(`data:${mimeType};base64,${toBase64(bytes)}`)

const SIZE = 256

/** Center-crops to a square and encodes 256 × 256 WebP with `OffscreenCanvas`. */
export const browserAvatar: AvatarProcessor = async (bytes, mimeType) => {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }))
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = new OffscreenCanvas(SIZE, SIZE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is not available')
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  )
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
  return `data:image/webp;base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`
}

export function defaultAvatarProcessor(): AvatarProcessor {
  return typeof OffscreenCanvas === 'undefined' ? passthroughAvatar : browserAvatar
}
