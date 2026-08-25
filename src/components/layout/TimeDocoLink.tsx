import { ExternalLink } from 'lucide-react';

const TimeDocoLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" className="h-4 w-auto shrink-0">
    <rect x="10" y="10" width="18" height="18" rx="2" className="fill-ink dark:fill-stone" />
    <rect x="32" y="10" width="18" height="18" rx="2" className="fill-ink dark:fill-stone" />
    <polygon points="54,10 66,10 72,16 72,28 54,28" className="fill-rust" />
    <polygon points="66,10 72,16 66,16" className="fill-[#8F452E]" />
    <rect x="10" y="32" width="18" height="18" rx="2" className="fill-stone dark:fill-graphite" />
    <rect x="32" y="32" width="18" height="18" rx="2" className="fill-ink dark:fill-stone" />
    <rect x="54" y="32" width="18" height="18" rx="2" className="fill-ink dark:fill-stone" />
    <rect x="10" y="54" width="18" height="18" rx="2" className="fill-stone dark:fill-graphite" />
    <rect x="32" y="54" width="18" height="18" rx="2" className="fill-ink dark:fill-stone" />
    <rect x="54" y="54" width="18" height="18" rx="2" className="fill-stone dark:fill-graphite" />
    <text x="88" y="54" className="font-sans text-[38px] font-bold tracking-[-0.5px]">
      <tspan className="fill-ink dark:fill-stone">Time</tspan>
      <tspan className="fill-rust">Doco</tspan>
    </text>
  </svg>
);

export function TimeDocoLink() {
  return (
    <a
      href="https://timedoco.com/app/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 px-2 py-2 rounded-panel border border-graphite/10 dark:border-white/10 hover:border-signal/40 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors group"
    >
      <span className="flex items-center gap-2 min-w-0">
        <TimeDocoLogo />
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">Track time with TimeDoco</span>
      </span>
      <ExternalLink size={12} className="text-gray-400 shrink-0 group-hover:text-signal" />
    </a>
  );
}
