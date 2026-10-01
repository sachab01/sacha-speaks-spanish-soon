import { Dropdown } from "@/components/ui/Dropdown";

const FOCUS_OPTIONS = [
  { value: "due", label: "Due", description: "Words scheduled for review right now" },
  { value: "weakest", label: "Weakest words", description: "Lowest recall estimates first" },
  { value: "stale", label: "Not reviewed in a while", description: "Longest since last practice" },
] as const;

export function FocusSelector({
  basePath,
  current,
  inverted = false,
  extraQuery = "",
}: {
  basePath: string;
  current: string;
  /** Other query params to keep when switching focus, e.g. "generate=1" — without a leading "?" or "&". */
  extraQuery?: string;
  /** Use light (current-color) trigger styling for placement on a solid accent-colored surface. */
  inverted?: boolean;
}) {
  const options = FOCUS_OPTIONS.map((option) => {
    const query = [option.value === "due" ? "" : `focus=${option.value}`, extraQuery].filter(Boolean).join("&");
    return { ...option, href: query ? `${basePath}?${query}` : basePath };
  });

  return <Dropdown label="Focus:" options={options} current={current} inverted={inverted} />;
}
