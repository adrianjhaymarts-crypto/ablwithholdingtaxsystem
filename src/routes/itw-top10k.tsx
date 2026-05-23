import { createFileRoute } from "@tanstack/react-router";
import { ITWModule } from "@/components/ITWModule";
import { useAppStore } from "@/store";

export const Route = createFileRoute("/itw-top10k")({
  component: Page,
  head: () => ({ meta: [{ title: "ITW Top 10K — Jhaymarts" }] }),
});

function Page() {
  const { top10k, bulkAddTop10k, updateTop10k, deleteTop10k, clearTop10k } = useAppStore();
  return (
    <ITWModule
      title="ITW Top 10K"
      description="Income Tax Withholding for Top 10,000 Corporations."
      records={top10k}
      bulkAdd={bulkAddTop10k}
      update={updateTop10k}
      remove={deleteTop10k}
      clearAll={clearTop10k}
      module="Top 10K"
    />
  );
}