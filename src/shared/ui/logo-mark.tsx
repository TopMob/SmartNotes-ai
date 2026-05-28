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
        d="M 120 280 L 120 150 C 120 120, 145 95, 175 95 L 320 95 C 350 95, 375 120, 375 150 L 375 220"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 210 270 L 210 220 C 210 190, 235 165, 265 165 L 410 165 C 440 165, 465 190, 465 220 L 465 350 C 465 380, 440 405, 410 405 L 310 405 L 210 490 L 210 380 C 175 380, 150 355, 150 320 L 150 280"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 285 270 A 45 45 0 1 1 390 270"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M 305 245 L 330 270 L 365 235"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
