export type BgShape = 'none' | 'square' | 'circle'

export interface Settings {
  /** lucide `icons` 의 PascalCase 키 */
  icon: string
  strokeColor: string
  /** 24px 기준 기본 선 굵기 */
  strokeWidth: number
  /** true 면 작은 크기에서 렌더링 선 굵기가 너무 가늘어지지 않도록 굵게 보정한다 */
  autoStroke: boolean
  bgShape: BgShape
  bgColor: string
  /** 그라데이션 끝 색(bgGradient 가 켜져 있을 때) */
  bgColor2: string
  bgGradient: boolean
  /** 모서리 둥글기: 한 변 길이 대비 %, square 에서만 사용 (0~50) */
  bgRadius: number
  /** 배경 안쪽 여백: 한 변 길이 대비 % (0~40) */
  padding: number
  shadow: boolean
  /** true 면 32px 이하에서 그림자를 끄고 그라데이션을 약하게 한다 */
  softenSmall: boolean
  /** 직접 지정 크기 프리셋에서 만들 크기들 */
  customSizes: number[]
}

export type PresetId = 'extension' | 'favicon' | 'pwa' | 'apple' | 'custom'

export interface Selection {
  extension: boolean
  favicon: boolean
  pwa: boolean
  apple: boolean
  custom: boolean
}

/** 출력 용도별 렌더 규칙: maskable 은 안전 영역 여백, apple 은 불투명 배경 강제 */
export type RenderMode = 'normal' | 'maskable' | 'apple'
