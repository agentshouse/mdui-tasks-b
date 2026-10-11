import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWorkspace } from '@/features/workspace/context'
import { useTheme } from '@/context/theme-provider'

type Appearance = { font: 'inter' | 'manrope' | 'system'; theme: 'light' | 'dark' | 'system' }
type Display = { items: string[] }
export type SettingsPresentation = { appearance: Appearance; display: Display }
const initial: SettingsPresentation = { appearance: { font: 'inter', theme: 'system' }, display: { items: ['recents', 'home'] } }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
function decode(value: unknown): SettingsPresentation {
  const settings = object(object(value).settings)
  const appearance = object(settings.appearance)
  const display = object(settings.display)
  return {
    appearance: {
      font: ['inter', 'manrope', 'system'].includes(String(appearance.font)) ? appearance.font as Appearance['font'] : initial.appearance.font,
      theme: ['light', 'dark', 'system'].includes(String(appearance.theme)) ? appearance.theme as Appearance['theme'] : initial.appearance.theme,
    },
    display: { items: Array.isArray(display.items) ? display.items.filter((item): item is string => typeof item === 'string') : initial.display.items },
  }
}
type PresentationContextValue = {
  values: SettingsPresentation; ready: boolean; busy: boolean; error: string | null
  update: <K extends keyof SettingsPresentation>(section: K, value: Partial<SettingsPresentation[K]>) => Promise<void>
  flush: () => Promise<void>
}
const Context = createContext<PresentationContextValue | null>(null)

/** UI preferences use only the documented Runtime Presentation State surface.
 * Writes merge fresh state and preserve unrelated App presentation namespaces. */
export function SettingsPresentationProvider({ children }: { children: ReactNode }) {
  const { runtime } = useWorkspace()
  const { setTheme } = useTheme()
  const [values, setValues] = useState(initial)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const raw = useRef<unknown>({})
  const writes = useRef<Promise<void>>(Promise.resolve())
  const pending = useRef<{ id: number; section: keyof SettingsPresentation; value: Record<string, unknown>; failed?: boolean }[]>([])
  const sequence = useRef(0)
  const applyTheme = useRef(setTheme)
  useEffect(() => { applyTheme.current = setTheme }, [setTheme])
  const redraw = () => {
    const next = decode(raw.current)
    for (const edit of pending.current) Object.assign(next[edit.section], edit.value)
    setValues(next)
  }
  useEffect(() => {
    if (!runtime) return
    let active = true
    let cleanup: (() => void) | undefined
    void runtime.observe('presentation').then(observation => {
      if (!active) { observation.close(); return }
      const receive = (value: unknown) => { raw.current = value; redraw(); setReady(true) }
      receive(observation.current())
      const unsubscribe = observation.subscribe(receive)
      cleanup = () => { unsubscribe(); observation.close() }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false; cleanup?.() }
  }, [runtime])
  // Applying appearance is local rendering, separate from business Room data.
  useEffect(() => { if (ready) applyTheme.current(values.appearance.theme) }, [ready, values.appearance.theme])
  useEffect(() => {
    if (!ready) return
    const family = values.appearance.font === 'system' ? 'ui-sans-serif, system-ui, sans-serif' : "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    document.documentElement.style.setProperty('--font-sans', family)
  }, [ready, values.appearance.font])
  const update: PresentationContextValue['update'] = (section, value) => {
    if (!runtime || !ready) return Promise.reject(new Error('House Presentation State is not ready.'))
    const id = ++sequence.current
    const recovered = Object.assign({}, ...pending.current.filter(edit => edit.failed && edit.section === section).map(edit => edit.value), value)
    pending.current = pending.current.filter(edit => !edit.failed || edit.section !== section)
    pending.current.push({ id, section, value: recovered })
    redraw(); setBusy(true); if (!pending.current.some(edit => edit.failed)) setError(null)
    const work = writes.current.catch(() => undefined).then(async () => {
      const current = object(await runtime.presentation.read())
      const settings = object(current.settings)
      const merged = { ...current, settings: { ...settings, [section]: { ...object(settings[section]), ...recovered } } }
      await runtime.presentation.write(merged)
      raw.current = merged
      pending.current = pending.current.filter(edit => edit.id !== id)
      redraw()
    }).catch(reason => {
      setError(reason instanceof Error ? reason.message : String(reason))
      pending.current = pending.current.map(edit => edit.id === id ? { ...edit, failed: true } : edit)
      // Keep the visible UI edit; a later change or explicit Update retries it.
      throw reason
    }).finally(() => setBusy(pending.current.some(edit => !edit.failed)))
    writes.current = work
    return work
  }
  return <Context value={{ values, ready, busy, error, update, flush: () => writes.current }}>{children}</Context>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsPresentation() {
  const context = useContext(Context)
  if (!context) throw new Error('Settings Presentation provider is missing.')
  return context
}
