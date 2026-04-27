import { Sparkles } from "lucide-react";

type SectionIntroProps = {
  title: string;
  text: string;
};

export function SectionIntro({ title, text }: SectionIntroProps) {
  return (
    <div className="flex items-start gap-3">
      <Sparkles className="mt-0.5 h-4 w-4 text-accent sm:mt-1 sm:h-5 sm:w-5" />
      <div>
        <h2 className="text-xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground/62 sm:mt-2 sm:text-sm sm:leading-7">{text}</p>
      </div>
    </div>
  );
}
