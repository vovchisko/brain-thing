import { reactive, watch } from 'vue'

export const LS_UI_KEY = 'dataset-utils-ui'

const THEMES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: '',
})

const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

const browser = reactive({ theme: '' })

const pref = reactive({
  theme: '',
  tableColWidths: {},
})

const applyTheme = () => {
  document.querySelector('html').setAttribute('data-theme', pref.theme || browser.theme)
}

const selectTheme = (new_theme = '') => {
  pref.theme = new_theme
  applyTheme()
}

const detectBrowserTheme = () => {
  browser.theme = query && query.matches ? THEMES.DARK : THEMES.LIGHT
  applyTheme()
}

if (query) query.addEventListener('change', detectBrowserTheme)

const restorePrefs = () => {
  try {
    const _prefs = JSON.parse(localStorage.getItem(LS_UI_KEY))
    pref.theme = _prefs?.theme ?? browser.theme
    pref.tableColWidths = _prefs?.tableColWidths ?? {}
    applyTheme()
  } catch (err) {
    console.error('ui restorePrefs error', err)
  }
}

function init () {
  detectBrowserTheme()
  restorePrefs()

  watch(pref, () => {
    const a = localStorage.getItem(LS_UI_KEY)
    const b = JSON.stringify(pref)
    if (a !== b) localStorage.setItem(LS_UI_KEY, b)
  })

  window.addEventListener('storage', ev => {
    if (ev.key === LS_UI_KEY) restorePrefs()
  })
}

const getTableColWidths = (key) => pref.tableColWidths[key]
const setTableColWidths = (key, value) => (pref.tableColWidths[key] = value)

export const tableSettings = { get: getTableColWidths, set: setTableColWidths }
export const UI = { browser, pref, selectTheme, init, THEMES }
