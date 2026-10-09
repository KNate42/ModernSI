// The small line icons of the site (same drawing language as the mock: round caps, 2.2 stroke, currentColor).
// This work made by Anfinogentov Nikita

const shapes = {
  academic: <><path d="M2 9l10-5 10 5-10 5-10-5Z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></>,
  international: <path d="M21 4 3 11l7 2.5L12.5 21 21 4ZM10 13.5 21 4" />,
  community: <path d="M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11Z" />,
  personal: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-4 4-6 7.5-6s6.7 2 7.5 6" /></>,
  events: <path d="M3 6.5h18v3.7a1.8 1.8 0 0 0 0 3.6v3.7H3v-3.7a1.8 1.8 0 0 0 0-3.6V6.5ZM14.5 6.5v11" />,
  ideas: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.6 1.5 2.6h4c0-1 .6-1.9 1.5-2.6A6 6 0 0 0 12 3Z" />,
  forum: <><path d="M4 5h16v11h-8.5L7 20v-4H4V5Z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  pin: <><path d="M12 21.5s-7-6-7-11.7a7 7 0 0 1 14 0c0 5.7-7 11.7-7 11.7Z" /><circle cx="12" cy="9.8" r="2.4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="3.5" /><path d="M3.5 10.5h17M8 3v4M16 3v4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.7.8 2.7 2.5 3 5.2" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  alert: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="m4 8 8 5.5L20 8" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l3 3M14 9l2 2" /></>,
  book: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  camera: <><path d="M3.5 8h3.2l1.6-2.6h7.4L17.3 8h3.2v11h-17V8Z" /><circle cx="12" cy="13.2" r="3.4" /></>,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z" /></>,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  bowl: <path d="M3 12h18c0 4.4-4 7.2-9 7.2S3 16.4 3 12ZM8.5 3.5c-1.2 1.6 1.2 2.6 0 4.5M12.5 3.5c-1.2 1.6 1.2 2.6 0 4.5M16.5 3.5c-1.2 1.6 1.2 2.6 0 4.5" />,
  moon: <path d="M20 14.5A8.2 8.2 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" />,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" /></>,
  waves: <path d="M2.5 9c2.2-2.4 4-2.4 5.8 0s3.6 2.4 5.8 0 4-2.4 5.8 0M2.5 15c2.2-2.4 4-2.4 5.8 0s3.6 2.4 5.8 0 4-2.4 5.8 0" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  caret: <path d="m6 9 6 6 6-6" />,
};

export type IconName = keyof typeof shapes;

// the stroke comes from the .icon class, so an icon follows the text colour; an extra class goes next to it
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className ? `icon ${className}` : "icon"} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
