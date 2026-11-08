// Shared formatting helpers: change them here and every screen updates.

// 1234.5 -> "$1,235", -896 -> "-$896"
export const money = (n) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

// "Maria Lopez" -> "ML"
export const initials = (name = "") =>
  name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

// "Good morning" / "Good afternoon" / "Good evening" based on the real clock
export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Real date, e.g. "Sunday, November 8"
export const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
