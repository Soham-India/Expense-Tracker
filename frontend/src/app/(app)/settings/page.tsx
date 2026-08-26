"use client";

import { SettingsIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoriesManager } from "@/features/settings/CategoriesManager";
import { RecurringManager } from "@/features/settings/RecurringManager";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Categories power both systems; templates wait for your explicit confirm."
        icon={<SettingsIcon />}
      />
      <div className="space-y-8">
        <CategoriesManager />
        <RecurringManager />
      </div>
    </>
  );
}
