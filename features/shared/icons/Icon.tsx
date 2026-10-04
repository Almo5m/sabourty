import type { SVGProps } from "react";

export type IconName =
  | "select"
  | "pen"
  | "spray"
  | "highlighter"
  | "eraser"
  | "text"
  | "sticky"
  | "voice"
  | "rectangle"
  | "circle"
  | "triangle"
  | "line"
  | "arrow"
  | "star"
  | "undo"
  | "redo"
  | "image"
  | "pdf"
  | "png"
  | "voiceList"
  | "templates"
  | "mindmap"
  | "orgchart"
  | "timeline"
  | "fishbone"
  | "flowchart"
  | "video"
  | "eye"
  | "eyeOff"
  | "lock"
  | "unlock"
  | "trash"
  | "chevronUp"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "close"
  | "plus"
  | "more"
  | "play"
  | "stop"
  | "record"
  | "rename"
  | "duplicate"
  | "layers"
  | "cloud"
  | "user"
  | "logout"
  | "google"
  | "minus"
  | "maximize"
  | "group"
  | "ungroup";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function paths(name: IconName) {
  switch (name) {
    case "select":
      return (
        <path d="M6 4.5 17 11l-4.6 1.3L14.8 17 12.4 18l-2.4-4.7L6 16.5V4.5Z" />
      );
    case "pen":
      return (
        <>
          <path d="M14.5 4.5 18 8l-9.5 9.5-4 1 1-4L14.5 4.5Z" />
          <path d="M12.5 6.5 16 10" />
        </>
      );
    case "spray":
      return (
        <>
          <path d="M9 10h8l1.5 8h-11L9 10Z" />
          <path d="M12 10V7" />
          <path d="M9.5 5h5" />
          <circle cx="5" cy="7" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="4" cy="11" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="6" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "highlighter":
      return (
        <>
          <path d="M7 15.5 14 5l3 2-7 10.5-4.5 1.5.5-3.5Z" />
          <path d="M4 20.5h9" />
        </>
      );
    case "eraser":
      return (
        <>
          <path d="M9 15.5 16 8.5a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8L13.5 20H8l-3-3 4-1.5Z" />
          <path d="M8 20H5l-1.5-1.5" />
        </>
      );
    case "text":
      return (
        <>
          <path d="M6 6h12" />
          <path d="M12 6v13" />
          <path d="M9 19h6" />
        </>
      );
    case "sticky":
      return (
        <>
          <path d="M5 4.5h10.5L19 8v11.5H5V4.5Z" />
          <path d="M15.5 4.5V8H19" />
        </>
      );
    case "voice":
      return (
        <>
          <rect x="4" y="7" width="16" height="10" rx="4" />
          <path d="M8 10.5v3" />
          <path d="M11.3 9v5.5" />
          <path d="M14.6 10.5v3" />
          <path d="M17.5 9.5v4" />
        </>
      );
    case "rectangle":
      return <rect x="4.5" y="6.5" width="15" height="11" rx="1.5" />;
    case "circle":
      return <circle cx="12" cy="12" r="7.5" />;
    case "triangle":
      return <path d="M12 5 20 19H4L12 5Z" />;
    case "line":
      return <path d="M5 19 19 5" />;
    case "arrow":
      return (
        <>
          <path d="M5 19 18 6" />
          <path d="M11 6h7v7" />
        </>
      );
    case "star":
      return (
        <path d="M12 4.5 14.1 9.6 19.5 10 15.5 13.6 16.7 19 12 16.1 7.3 19 8.5 13.6 4.5 10 9.9 9.6 12 4.5Z" />
      );
    case "undo":
      return (
        <>
          <path d="M7 8 4 11l3 3" />
          <path d="M4 11h10a5.5 5.5 0 0 1 0 11h-3" />
        </>
      );
    case "redo":
      return (
        <>
          <path d="M17 8l3 3-3 3" />
          <path d="M20 11H10a5.5 5.5 0 0 0 0 11h3" />
        </>
      );
    case "image":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <circle cx="9" cy="10" r="1.4" />
          <path d="M4.5 17.5 9.5 13l3 2.7 3-3.4 4 4.7" />
        </>
      );
    case "pdf":
      return (
        <>
          <path d="M7 3.5h7.5L18 7v13.5H7V3.5Z" />
          <path d="M14.5 3.5V7H18" />
          <path d="M9.2 13.2h5.6" />
          <path d="M9.2 16h5.6" />
        </>
      );
    case "png":
      return (
        <>
          <path d="M12 4v11.5" />
          <path d="M7.5 11 12 15.5 16.5 11" />
          <path d="M5 19h14" />
        </>
      );
    case "voiceList":
      return (
        <>
          <path d="M4 5.5h16" />
          <path d="M4 18.5h16" />
          <rect x="7" y="9.5" width="10" height="5" rx="2.5" />
          <path d="M9.5 12v0.1" />
          <path d="M12 11v2" />
          <path d="M14.5 12v0.1" />
        </>
      );
    case "templates":
      return (
        <>
          <circle cx="12" cy="5.5" r="1.6" />
          <circle cx="6" cy="17" r="1.6" />
          <circle cx="18" cy="17" r="1.6" />
          <path d="M12 7.1V11" />
          <path d="M12 11 6 15.6" />
          <path d="M12 11l6 4.6" />
        </>
      );
    case "mindmap":
      return (
        <>
          <circle cx="12" cy="12" r="2.4" />
          <circle cx="4.5" cy="6" r="1.5" />
          <circle cx="19.5" cy="6" r="1.5" />
          <circle cx="4.5" cy="18" r="1.5" />
          <circle cx="19.5" cy="18" r="1.5" />
          <path d="M10.2 10.5 5.6 7" />
          <path d="M13.8 10.5 18.4 7" />
          <path d="M10.2 13.5 5.6 17" />
          <path d="M13.8 13.5 18.4 17" />
        </>
      );
    case "orgchart":
      return (
        <>
          <rect x="9" y="3.5" width="6" height="4" rx="1" />
          <rect x="3.5" y="16.5" width="6" height="4" rx="1" />
          <rect x="14.5" y="16.5" width="6" height="4" rx="1" />
          <path d="M12 7.5v4" />
          <path d="M6.5 11.5h11" />
          <path d="M6.5 11.5v5" />
          <path d="M17.5 11.5v5" />
        </>
      );
    case "timeline":
      return (
        <>
          <path d="M3.5 12h17" />
          <circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="17" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M7 12V7.5" />
          <path d="M17 12v4.5" />
        </>
      );
    case "fishbone":
      return (
        <>
          <path d="M3.5 12h13" />
          <path d="M16.5 12 20.5 8.5v7L16.5 12Z" />
          <path d="M7 12 4.5 8.5" />
          <path d="M10.5 12 8 8.5" />
          <path d="M7 12 4.5 15.5" />
          <path d="M10.5 12 8 15.5" />
        </>
      );
    case "flowchart":
      return (
        <>
          <rect x="8" y="3.5" width="8" height="4" rx="1" />
          <path d="M12 7.5v3" />
          <path d="M12 14 8.2 10.5h7.6L12 14Z" />
          <path d="M12 14v2.5" />
          <rect x="8" y="16.5" width="8" height="4" rx="1" />
        </>
      );
    case "video":
      return (
        <>
          <rect x="3.5" y="6" width="12" height="12" rx="1.5" />
          <path d="M15.5 10.2 20.5 7v10l-5-3.2" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      );
    case "eyeOff":
      return (
        <>
          <path d="M4 4l16 16" />
          <path d="M10.6 6.2C11 6.1 11.5 6 12 6c5.5 0 9 6 9 6a15 15 0 0 1-3 3.6" />
          <path d="M6.8 7.9A14.8 14.8 0 0 0 3 12s3.5 6 9 6c1 0 1.9-.2 2.8-.5" />
          <path d="M9.9 10a2.4 2.4 0 0 0 3.3 3.3" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5.5" y="10.5" width="13" height="9" rx="1.8" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </>
      );
    case "unlock":
      return (
        <>
          <rect x="5.5" y="10.5" width="13" height="9" rx="1.8" />
          <path d="M8 10.5V8a4 4 0 0 1 7.4-2" />
        </>
      );
    case "trash":
      return (
        <>
          <path d="M5 7h14" />
          <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
          <path d="M7 7l1 12.2A1.5 1.5 0 0 0 9.5 20.5h5A1.5 1.5 0 0 0 16 19.2L17 7" />
          <path d="M10.3 11v6" />
          <path d="M13.7 11v6" />
        </>
      );
    case "chevronUp":
      return <path d="M6 14.5 12 8.5 18 14.5" />;
    case "chevronDown":
      return <path d="M6 9.5 12 15.5 18 9.5" />;
    case "chevronLeft":
      return <path d="M14.5 18 8.5 12l6-6" />;
    case "chevronRight":
      return <path d="M9.5 18l6-6-6-6" />;
    case "close":
      return (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case "more":
      return (
        <>
          <circle cx="12" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
        </>
      );
    case "play":
      return <path d="M8 5.5 18.5 12 8 18.5V5.5Z" />;
    case "stop":
      return <rect x="7" y="7" width="10" height="10" rx="1.5" />;
    case "record":
      return <circle cx="12" cy="12" r="5.5" />;
    case "rename":
      return (
        <>
          <path d="M6 17.5 6.7 14.3 15.5 5.5a1.8 1.8 0 0 1 2.5 0l0.5.5a1.8 1.8 0 0 1 0 2.5L9.7 17.3 6 18Z" />
        </>
      );
    case "duplicate":
      return (
        <>
          <rect x="4.5" y="4.5" width="11" height="11" rx="1.5" />
          <path d="M8.5 15.5V17a2.5 2.5 0 0 0 2.5 2.5h6A2.5 2.5 0 0 0 19.5 17v-6A2.5 2.5 0 0 0 17 8.5h-1.5" />
        </>
      );
    case "layers":
      return (
        <>
          <path d="M12 4 20 8.5 12 13 4 8.5 12 4Z" />
          <path d="M4 13l8 4.5 8-4.5" />
        </>
      );
    case "cloud":
      return (
        <path d="M7.5 17.5a4 4 0 0 1-.5-8 5 5 0 0 1 9.7-1.5A4.2 4.2 0 0 1 17 17.5H7.5Z" />
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8.5" r="3.2" />
          <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H9" />
          <path d="M13 8l4 4-4 4" />
          <path d="M17 12H9.5" />
        </>
      );
    case "google":
      return (
        <>
          <path d="M20 12.2c0-.7-.06-1.4-.18-2H12v3.8h4.5a3.9 3.9 0 0 1-1.68 2.55v2.1h2.7c1.6-1.47 2.48-3.63 2.48-6.45Z" />
          <path d="M12 20c2.3 0 4.2-.76 5.5-2.05l-2.7-2.1c-.75.5-1.7.8-2.8.8-2.15 0-4-1.45-4.65-3.4H4.55v2.15A8 8 0 0 0 12 20Z" />
          <path d="M7.35 13.25a4.8 4.8 0 0 1 0-3.1V8H4.55a8 8 0 0 0 0 7.4l2.8-2.15Z" />
          <path d="M12 6.5c1.25 0 2.37.43 3.25 1.27l2.4-2.4A8 8 0 0 0 4.55 8l2.8 2.15C7.99 8.12 9.83 6.5 12 6.5Z" />
        </>
      );
    case "minus":
      return <path d="M5 12h14" />;
    case "group":
      return (
        <>
          <rect x="4" y="4" width="12" height="12" rx="2" />
          <rect
            x="8"
            y="8"
            width="12"
            height="12"
            rx="2"
            fill="var(--color-surface, #fff)"
          />
        </>
      );
    case "ungroup":
      return (
        <>
          <rect x="3.5" y="3.5" width="8" height="8" rx="1.8" />
          <rect x="12.5" y="12.5" width="8" height="8" rx="1.8" />
        </>
      );
    case "maximize":
      return (
        <>
          <path d="M9 4.5H5.5a1 1 0 0 0-1 1V9" />
          <path d="M15 4.5h3.5a1 1 0 0 1 1 1V9" />
          <path d="M9 19.5H5.5a1 1 0 0 1-1-1V15" />
          <path d="M15 19.5h3.5a1 1 0 0 0 1-1V15" />
        </>
      );
    default:
      return null;
  }
}

export function Logomark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#1f6f63" />
      <path
        d="M12 27.5 16 15l4 8 4-11 4 15.5"
        stroke="#faf9f5"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="28.5" cy="12.5" r="1.8" fill="#d98c3b" />
    </svg>
  );
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      {...rest}
      aria-hidden="true"
    >
      {paths(name)}
    </svg>
  );
}
