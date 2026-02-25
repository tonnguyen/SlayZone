import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { AppearanceContext } from '@slayzone/ui'

export function AppearanceProvider({
  settingsRevision,
  children
}: {
  settingsRevision: number
  children: ReactNode
}) {
  const [settings, setSettings] = useState({
    terminalFontSize: 13,
    editorFontSize: 13,
    reduceMotion: false,
    colorTintsEnabled: true,
  })

  useEffect(() => {
    Promise.all([
      window.api.settings.get('terminal_font_size'),
      window.api.settings.get('editor_font_size'),
      window.api.settings.get('reduce_motion'),
      window.api.settings.get('project_color_tints_enabled'),
    ]).then(([termSize, editorSize, reduceMotion, colorTints]) => {
      setSettings({
        terminalFontSize: termSize ? parseInt(termSize, 10) : 13,
        editorFontSize: editorSize ? parseInt(editorSize, 10) : 13,
        reduceMotion: reduceMotion === '1',
        colorTintsEnabled: colorTints !== '0',
      })
    })
  }, [settingsRevision])

  return (
    <AppearanceContext.Provider value={settings}>
      {children}
    </AppearanceContext.Provider>
  )
}
