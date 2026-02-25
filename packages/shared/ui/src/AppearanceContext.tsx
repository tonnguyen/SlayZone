import { createContext, useContext } from 'react'

export interface AppearanceSettings {
  terminalFontSize: number
  editorFontSize: number
  reduceMotion: boolean
  colorTintsEnabled: boolean
}

const defaults: AppearanceSettings = {
  terminalFontSize: 13,
  editorFontSize: 13,
  reduceMotion: false,
  colorTintsEnabled: true,
}

export const AppearanceContext = createContext<AppearanceSettings>(defaults)

export function useAppearance(): AppearanceSettings {
  return useContext(AppearanceContext)
}
