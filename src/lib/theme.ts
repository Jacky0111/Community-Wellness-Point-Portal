import type { ThemeConfig } from 'antd'

export const BRAND = {
  primary: '#2563EB',
  sidebarFrom: '#1E40AF',
  sidebarTo: '#2563EB',
  pageBg: '#F5F7FA',
  cardRadius: 12,
} as const

export const theme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    borderRadius: 8,
    // Card has no `borderRadiusLG` component token of its own in AntD 5.29 — it
    // reads the global alias token `token.borderRadiusLG` directly, so the card
    // corner radius is set here rather than under `components.Card`.
    borderRadiusLG: BRAND.cardRadius,
    fontSize: 14,
  },
  components: {
    Layout: { bodyBg: BRAND.pageBg, headerBg: '#FFFFFF' },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      // Translucent white so the selected/hovered item reads as a tinted pill
      // against the sidebar gradient, rather than the default opaque colorPrimary
      // fill (which would clash with the deeper-blue top of the gradient).
      darkItemSelectedBg: 'rgba(255, 255, 255, 0.18)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemColor: 'rgba(255, 255, 255, 0.85)',
      darkItemSelectedColor: '#FFFFFF',
      itemBorderRadius: 8,
      subMenuItemBorderRadius: 8,
    },
  },
}
