"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type AuthValue = {
  user: {
    displayName?: string;
    nickname?: string;
    avatar?: string;
    about?: string;
  } | null;
  loading: boolean;
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, updateProfile } = (useAuth() as unknown) as AuthValue;

  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("");
  const [about, setAbout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setNickname(user.nickname || "");
      setAvatar(user.avatar || "");
      setAbout(user.about || "");
    }
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSubmitting(true);
    try {
      await updateProfile({ displayName, nickname, avatar, about });
      setSaved(true);
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setError(m || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">Loading</div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold mb-1">Profile</h1>
      <p className="text-sm text-gray-600 mb-6">Update your name, nickname and avatar</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="displayName">Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            placeholder="https://..."
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />
          <div className="mt-2">
            {avatar ? (
              <img
                src={avatar}
                alt="Preview"
                className="h-16 w-16 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <></>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="about">About</Label>
          <Input
            id="about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </div>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {saved ? (
          <div className="text-sm text-green-700">Saved</div>
        ) : null}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving..." : "Save"}
        </Button>
      </form>
    </div>
  );
}
