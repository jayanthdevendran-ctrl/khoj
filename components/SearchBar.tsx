"use client";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search projects, teams, categories…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40">
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search KHOJ"
        className="w-full rounded-full border border-line bg-white py-3 pl-10 pr-4 text-sm placeholder:text-ink/40 focus:border-teal dark:border-white/10 dark:bg-white/5 dark:placeholder:text-paper/40"
      />
    </div>
  );
}
