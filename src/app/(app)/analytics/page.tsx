import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Review sales, costs, and inventory metrics per location or globally."
      />
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>
            Base page ready for KPI charts and period comparisons.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
