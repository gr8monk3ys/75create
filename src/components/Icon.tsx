// One drawn icon set: 24px grid, 1.75 stroke, round caps — the weight of a
// fineliner on sketch paper. Decorative by default; pass `label` when the icon
// is the only thing naming a control.

const PATHS = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M20.5 16l-5-5-8.5 8.5" />
    </>
  ),
  pen: <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20zM13.5 7l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  // Media glyphs for the setup wizard.
  writing: <path d="M5 19h14M7 15l8.5-8.5a2 2 0 0 1 3 3L10 18H7v-3z" />,
  drawing: (
    <>
      <path d="M4 20c3-1 4-4 7-4s3 3 6 2 3-4 3-4" />
      <path d="M14 4l6 6-7 7-6-6z" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  photography: (
    <>
      <path d="M4 8.5h3.5L9 6h6l1.5 2.5H20v10H4z" />
      <circle cx="12" cy="13" r="3.25" />
    </>
  ),
  video: (
    <>
      <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
      <path d="M15.5 11l5-3v8l-5-3" />
    </>
  ),
  code: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  mixed: (
    <>
      <circle cx="8" cy="8" r="3.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
      <path d="M14 4.5l5 5M19 4.5l-5 5" />
    </>
  ),
  other: <path d="M12 4l8 8-8 8-8-8z" />,
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName
  size?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
