'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeMember, updateMemberRole, deleteUser } from '@/lib/actions/groups';

interface MemberActionsProps {
  groupId: string;
  userId: string;
  currentRole: string;
  isSiteAdmin?: boolean;
}

export function MemberActions({ groupId, userId, currentRole, isSiteAdmin }: MemberActionsProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const busy = removing || updatingRole || deleting;

  const handleRemove = async () => {
    setRemoving(true);
    const result = await removeMember(groupId, userId);
    if (result.error) {
      alert(result.error);
      setRemoving(false);
    } else {
      router.refresh();
    }
  };

  const handleToggleRole = async () => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    setUpdatingRole(true);
    const result = await updateMemberRole(groupId, userId, newRole);
    if (result.error) {
      alert(result.error);
      setUpdatingRole(false);
    } else {
      router.refresh();
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm('Permanently delete this user and all their data? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    const result = await deleteUser(userId);
    if (result.error) {
      alert(result.error);
      setDeleting(false);
    } else {
      router.refresh();
    }
  };

  const isAdmin = currentRole === 'admin';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleToggleRole}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-golf px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 bg-surface-700 text-surface-200 hover:bg-surface-600 hover:text-surface-50"
      >
        {/* Shield / user icon */}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {isAdmin ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          )}
        </svg>
        {updatingRole ? '...' : isAdmin ? 'Demote' : 'Make Admin'}
      </button>
      <button
        onClick={handleRemove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-golf px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
        </svg>
        {removing ? '...' : 'Remove'}
      </button>
      {isSiteAdmin && (
        <button
          onClick={handleDeleteUser}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-golf px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          {deleting ? '...' : 'Delete Account'}
        </button>
      )}
    </div>
  );
}
