type LogoMarkProps = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title = "SmartNotes" }: LogoMarkProps) {
  return (
    <svg aria-label={title} className={className} fill="none" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect fill="url(#smartnotes-logo-bg)" height="56" rx="18" width="48" x="8" y="4" />
      <path d="M20 21.5C20 19.567 21.567 18 23.5 18H39.5C41.433 18 43 19.567 43 21.5V22.5C43 24.433 41.433 26 39.5 26H23.5C21.567 26 20 24.433 20 22.5V21.5Z" fill="white" fillOpacity="0.96" />
      <path d="M20 32.5C20 30.567 21.567 29 23.5 29H35.5C37.433 29 39 30.567 39 32.5V33.5C39 35.433 37.433 37 35.5 37H23.5C21.567 37 20 35.433 20 33.5V32.5Z" fill="white" fillOpacity="0.72" />
      <path d="M20 43.5C20 41.567 21.567 40 23.5 40H31.5C33.433 40 35 41.567 35 43.5V44.5C35 46.433 33.433 48 31.5 48H23.5C21.567 48 20 46.433 20 44.5V43.5Z" fill="white" fillOpacity="0.52" />
      <path d="M46.614 15.523L48.162 20.038L52.677 21.586L48.162 23.134L46.614 27.649L45.066 23.134L40.551 21.586L45.066 20.038L46.614 15.523Z" fill="#F8D66D" />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="smartnotes-logo-bg" x1="8" x2="56" y1="4" y2="60">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
