// Hero's Shore palette: sand and sea by day, moonlit indigo by night.
import type { makeColors } from './make-colors.js'
export const PALETTE: Parameters<typeof makeColors>[0] = {
  label: "Hero's Shore",
  roles: { accent: '#3aa8e0', danger: '#d8452e', success: '#3fae4a', warning: '#e89a24', pro: '#9a5ae0' },
  light: {
    roles: { accent: '#1f7fa0' },
    gray: {
      anchors: {
        'surface-0': '#eee6d4',
        'surface-1': '#f4eddf',
        'surface-2': '#faf6ec',
        'text-primary': '#1c1a2e',
        'text-secondary': '#3e3954',
        'text-muted': '#575170',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0e1030',
        'surface-1': '#14163e',
        'surface-2': '#191b48',
        'surface-3': '#1d1f4e',
        'text-primary': '#f3efff',
        'text-secondary': '#cec9ee',
        'text-muted': '#a49fd8',
      },
    },
  },
}
