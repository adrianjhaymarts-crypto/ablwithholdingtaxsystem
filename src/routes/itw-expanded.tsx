import { createFileRoute } from "@tanstack/react-router";
import { ITWModule } from "@/components/ITWModule";
import { useAppStore } from "@/store";

export const Route = createFileRoute("/itw-expanded")({
  component: Page,
  head: () => ({ meta: [{ title: "ITW Expanded — Jhaymarts" }] }),
});

function Page() {
  const { expanded, bulkAddExpanded, updateExpanded, deleteExpanded, clearExpanded } = useAppStore();
  return (
    <ITWModule
      title="ITW Expanded"
      description="Jhaymarts Industries Incorporated AT SOURCE — Expanded Withholding."
      records={expanded}
      bulkAdd={bulkAddExpanded}
      update={updateExpanded}
      remove={deleteExpanded}
      clearAll={clearExpanded}
      module="Expanded"
    />
  );
}