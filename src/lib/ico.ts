/** PNG 데이터를 그대로 담는 .ico 를 만든다(Vista 이후 모든 브라우저가 지원). */
export interface IcoImage {
  size: number
  png: Uint8Array
}

export function encodeIco(images: IcoImage[]): Uint8Array {
  const headerLen = 6 + images.length * 16
  const total = headerLen + images.reduce((n, i) => n + i.png.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, images.length, true)
  let offset = headerLen
  images.forEach((img, i) => {
    const e = 6 + i * 16
    out[e] = img.size >= 256 ? 0 : img.size // 0 은 256 을 뜻한다
    out[e + 1] = img.size >= 256 ? 0 : img.size
    out[e + 2] = 0 // 팔레트 없음
    out[e + 3] = 0
    view.setUint16(e + 4, 1, true) // planes
    view.setUint16(e + 6, 32, true) // bpp
    view.setUint32(e + 8, img.png.length, true)
    view.setUint32(e + 12, offset, true)
    out.set(img.png, offset)
    offset += img.png.length
  })
  return out
}
