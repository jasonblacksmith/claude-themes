// Sky Realm palette: a blue menu-window night and an open-sky day.
import type { makeColors } from './make-colors.js'
export const PALETTE: Parameters<typeof makeColors>[0] = {
  label: 'Sky Realm',
  roles: { accent: '#f2c230', danger: '#e0403a', success: '#3fbf6a', warning: '#f29a2e', pro: '#a66cff' },
  light: {
    roles: { accent: '#2f55c8' },
    gray: {
      anchors: {
        'surface-0': '#dce7f6',
        'surface-1': '#e5eefa',
        'surface-2': '#f1f6fd',
        'text-primary': '#121838',
        'text-secondary': '#353d68',
        'text-muted': '#4c5583',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0c1240',
        'surface-1': '#121a4e',
        'surface-2': '#172058',
        'surface-3': '#1b245e',
        'text-primary': '#f5f3ff',
        'text-secondary': '#cfd2f2',
        'text-muted': '#a3a9dc',
      },
    },
  },
}
