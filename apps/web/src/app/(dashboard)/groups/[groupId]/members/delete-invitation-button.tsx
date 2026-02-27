'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteInvitation } from '@/lib/actions/groups';

interface DeleteInvitationButtonProps {
  groupId: string;
  invitationId: string;
}

export function DeleteInvitationButton({ groupId, invitationId }: DeleteInvitationButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteInvitation(groupId, invitationId);
    if (result.error) {
      alert(result.error);
      setDeleting(false);
    } else {
      router.refresh();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-400 hover:text-red-400 hover:bg-red-900/30"
    >
      {deleting ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
