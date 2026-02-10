import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="Manage staff access, roles, and permissions per restaurant."
      />
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Base page ready for role-based access control and invitations.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
