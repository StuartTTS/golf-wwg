'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { inviteMember } from '@/lib/actions/groups';

interface InviteFormProps {
  groupId: string;
}

export function InviteForm({ groupId }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('role', 'member');

    const result = await inviteMember(groupId, formData);

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Invitation sent!' });
      setEmail('');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" loading={loading}>
        Invite
      </Button>
      {message && (
        <p className={`self-center text-sm ${message.type === 'error' ? 'text-red-400' : 'text-golf-400'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
