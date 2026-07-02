import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// A small palette of soft gradients; pick deterministically from the name so a
// given vendor/payee always gets the same colour.
const GRADIENTS = [
  "from-indigo-500 to-blue-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-sky-500 to-cyan-500",
  "from-fuchsia-500 to-pink-500",
  "from-lime-500 to-emerald-500",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const grad = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white shadow-sm ring-2 ring-white",
        grad,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
