import { Dropdown } from "@/components/ui/Dropdown";

const MODE_OPTIONS = [
  { value: "writing", label: "Writing", description: "Type the Spanish translation" },
  { value: "speaking", label: "Speaking", description: "Say it out loud" },
  { value: "listening", label: "Listening", description: "Transcribe what you hear" },
] as const;

/** Quick-jump menu so a topic's practice modes are reachable without opening the topic page first. */
export function TopicPracticeMenu({ topicId }: { topicId: number }) {
  const options = MODE_OPTIONS.map((option) => ({
    ...option,
    href: `/topics/${topicId}/practice/${option.value}`,
  }));

  return <Dropdown label="Practice" options={options} current="" inverted />;
}
