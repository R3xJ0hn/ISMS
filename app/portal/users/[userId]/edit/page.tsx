import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { getUserForEdit } from "@/lib/users/admin";
import { UserImageForm } from "../../user-image-form";

export default async function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await getUserForEdit((await params).userId);
  if (!user) notFound();

  return (
    <PortalFormPage backHref="/portal/users" backLabel="Back to users" label="Users" title="Edit user" description={user.name ? `Update the profile photo for ${user.name}.` : "Update this account's profile photo."}>
      <UserImageForm key={user.id} user={user} />
    </PortalFormPage>
  );
}
