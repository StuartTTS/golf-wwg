'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface UserSettings {
  displayName: string;
  email: string;
  defaultTeeTier: number | null;
}

function NotificationSettings() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const [error, setError] = useState<string | null>(null);

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = async () => {
    setError(null);
    const result = isSubscribed ? await unsubscribe() : await subscribe();
    if (result.error) setError(result.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Get notified about round invitations, tee times, and score updates.
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
          <div>
            <p className="text-sm font-medium text-surface-50">Push Notifications</p>
            <p className="text-xs text-surface-300">
              {isSubscribed
                ? 'You will receive push notifications'
                : 'Enable push notifications to stay updated'}
            </p>
          </div>
          <Button
            variant={isSubscribed ? 'outline' : 'primary'}
            onClick={handleToggle}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : isSubscribed ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}

function SettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useSupabase();
  const { user, loading: authLoading } = useAuth();

  const isSetupMode = searchParams.get('setup') === 'true';
  const setupGroupId = searchParams.get('groupId');

  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    email: '',
    defaultTeeTier: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, email, default_tee_tier')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        setSettings({
          displayName: profile.display_name ?? '',
          email: profile.email ?? user.email ?? '',
          defaultTeeTier: profile.default_tee_tier ?? null,
        });
      } catch (err: any) {
        setError(err.message ?? 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [supabase, user]);

  const handleSaveProfile = async () => {
    if (!supabase || !user) return;

    try {
      setSaving(true);
      setError(null);
      setSaved(false);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: settings.displayName.trim(),
          default_tee_tier: settings.defaultTeeTier,
          profile_completed: true,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Also update user_metadata so middleware knows immediately
      await supabase.auth.updateUser({
        data: { profile_completed: true },
      });

      if (isSetupMode) {
        router.push(setupGroupId ? `/groups/${setupGroupId}` : '/home');
        router.refresh();
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (!supabase) return;

    try {
      setChangingPassword(true);

      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (pwError) throw pwError;

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err: any) {
      setPasswordError(err.message ?? 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">
          {isSetupMode ? 'Complete Your Profile' : 'Settings'}
        </h1>
        <p className="text-sm text-surface-300">
          {isSetupMode
            ? 'Welcome to Golf WWG! Set your display name and preferences to get started.'
            : 'Manage your account preferences'}
        </p>
      </div>

      {/* Profile settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your display name and preferences
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              Display Name
            </label>
            <Input
              value={settings.displayName}
              onChange={(e) =>
                setSettings({ ...settings, displayName: e.target.value })
              }
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              Email
            </label>
            <Input value={settings.email} disabled className="bg-surface-700" />
            <p className="text-xs text-surface-400 mt-1">
              Email cannot be changed here
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              Default Tee Tier
            </label>
            <Select
              value={settings.defaultTeeTier !== null ? String(settings.defaultTeeTier) : ''}
              onValueChange={(v) =>
                setSettings({ ...settings, defaultTeeTier: v ? Number(v) : null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No preference</SelectItem>
                <SelectItem value="1">1 (Front)</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3 (Middle)</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5 (Tips)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-surface-400 mt-1">
              Your preferred tee position (1 = front tees, 5 = tips). Auto-assigned when joining rounds.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {saved && (
            <div className="p-3 bg-golf-900/30 border border-golf-500 rounded-lg text-sm text-golf-600">
              Settings saved successfully
            </div>
          )}

          <Button
            onClick={handleSaveProfile}
            disabled={saving || !settings.displayName.trim()}
          >
            {saving
              ? 'Saving...'
              : isSetupMode
                ? 'Save & Get Started'
                : 'Save Changes'}
          </Button>
        </div>
      </Card>

      {/* Notifications */}
      <NotificationSettings />

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your account password
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              Current Password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              New Password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <p className="text-xs text-surface-400 mt-1">
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <div className="p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-golf-900/30 border border-golf-500 rounded-lg text-sm text-golf-600">
              Password changed successfully
            </div>
          )}

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            variant="outline"
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-400">Account</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-surface-50">Sign Out</p>
              <p className="text-xs text-surface-300">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsForm />
    </Suspense>
  );
}
