import type { Selection, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  icon: 'Mailbox',
  strokeColor: '#d7141e',
  strokeWidth: 2,
  autoStroke: true,
  bgShape: 'none',
  bgColor: '#ffffff',
  bgColor2: '#dbeafe',
  bgGradient: false,
  bgRadius: 22,
  padding: 0,
  shadow: false,
  softenSmall: true,
  customSizes: [24, 64, 256],
}

export const DEFAULT_SELECTION: Selection = {
  extension: true,
  favicon: false,
  pwa: false,
  apple: false,
  custom: false,
}
