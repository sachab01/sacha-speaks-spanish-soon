/** A one-line notice above an exercise, e.g. that Mixed Review fell back to a stored sentence. */
export function PracticeNotice({ text }: { text: string }) {
  return <p className="text-xs font-bold opacity-80">{text}</p>;
}
