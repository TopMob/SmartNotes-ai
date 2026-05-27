type LogoMarkProps = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title = "SmartNotes" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* Left half: Brain outline */}
      <path
        d="M9.5 4.5C6.5 4.5 4.5 6.5 4.5 9.5C4.5 11.2 5.5 12.2 5.5 13C5.5 13.8 4.5 14.8 4.5 16.5C4.5 19 6.5 20.5 9.5 20.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Middle notebook spine */}
      <path
        d="M11 4V20"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right half: Text document lines */}
      <path
        d="M14 6H19M14 10H20M14 14H18M14 18H19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Pulsing Neural/AI Sparkle node */}
      <path
        d="M17 12.5C17 12.5 17.2 13.1 17.6 13.5C18 13.9 18.6 14 18.6 14C18.6 14 18 14.1 17.6 14.5C17.2 14.9 17 15.5 17 15.5C17 15.5 16.8 14.9 16.4 14.5C16 14.1 15.4 14 15.4 14C15.4 14 16 13.9 16.4 13.5C16.8 13.1 17 12.5 17 12.5Z"
        fill="currentColor"
        className="text-accent animate-pulse"
      />
    </svg>
  );
}
