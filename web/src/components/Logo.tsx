export function Logo({ size = 20, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ ["--rm-accent" as string]: "var(--accent)" }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="10" y="7" width="19" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M11.4 8.6 L19.5 16 L27.6 8.6" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
        <g stroke="var(--rm-accent, currentColor)" strokeWidth="2" strokeLinecap="round">
          <path d="M4.5 11.5 H7.5" /><path d="M1 16 H7.5" /><path d="M4.5 20.5 H7.5" />
        </g>
      </svg>
      {withWordmark && (
        <span className="text-[14px] tracking-[-0.01em]">
          <span className="font-semibold">Ray</span><span className="font-normal">Mail</span>
        </span>
      )}
    </span>
  );
}
