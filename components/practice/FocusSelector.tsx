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
}: {
  basePath: string;
  current: string;
  /** Use light (current-color) trigger styling for placement on a solid accent-colored surface. */
  inverted?: boolean;
}) {
  const options = FOCUS_OPTIONS.map((option) => ({
    ...option,
    href: option.value === "due" ? basePath : `${basePath}?focus=${option.value}`,
  }));

  return <Dropdown label="Focus:" options={options} current={current} inverted={inverted} />;
}
