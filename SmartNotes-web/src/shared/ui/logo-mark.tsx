type LogoMarkProps = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title = "SmartNotes" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <path
        d="M 100 250 L 100 130 C 100 105, 120 85, 145 85 L 270 85 C 295 85, 315 105, 315 130 L 315 170"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 195 250 L 195 200 C 195 175, 215 155, 240 155 L 375 155 C 400 155, 420 175, 420 200 L 420 250"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 265 240 A 38 38 0 1 1 350 240"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M 285 220 L 305 240 L 330 210"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 195 320 C 195 345, 215 365, 240 365 L 350 365 L 420 435 L 420 320"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="225"
        y1="395"
        x2="325"
        y2="395"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <circle
        cx="350"
        cy="395"
        r="12"
        fill="currentColor"
      />
    </svg>
  );
}
