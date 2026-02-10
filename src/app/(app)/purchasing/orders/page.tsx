import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PurchasingOrdersPage() {
  return (
    <>
      <PageHeader
        title="Purchasing Orders"
        description="Create and track supplier orders across all restaurants."
      />
      <Card>
        <CardHeader>
          <CardTitle>Orders List</CardTitle>
          <CardDescription>
            Base page ready for PO statuses, approvals, and receiving workflow.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
