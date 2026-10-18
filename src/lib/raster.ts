/** SVG 문자열을 지정한 크기의 PNG 바이트로 그린다(브라우저 canvas). 벡터를 목표 크기에서 바로 그려 작은 크기 선명도를 유지한다. */
export async function rasterize(svg: string, size: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.width = size
    img.height = size
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다')
    ctx.drawImage(img, 0, 0, size, size)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('PNG 변환에 실패했습니다')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}
