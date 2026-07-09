'use client';
// ─── ListingGate — registration wall after N unique listing views ─────
// Anonymous visitors can view up to `limit-1` listings; on the `limit`-th
// distinct listing the blocking AuthModal (signup) appears. Signed-in
// users never see it. Threshold is CMS-driven (config.registration).
import { useEffect, useState } from 'react';
import { recordView } from '@/lib/view-tracker';
import { useUser } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';

export default function ListingGate({ mlsId, limit, enabled }: { mlsId: string; limit: number; enabled: boolean }) {
  const { user, loading } = useUser();
  const [count, setCount] = useState(0);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    if (mlsId) setCount(recordView(String(mlsId)));
  }, [mlsId]);

  const signedIn = !!user || justSignedIn;
  const show = enabled && !loading && !signedIn && limit > 0 && count >= limit;

  return (
    <AuthModal
      open={show}
      blocking
      defaultMode="signup"
      siteSlug="el-cid-homes"
      message="You're clearly serious about El Cid. Create a free account to keep viewing homes, save your favorites, and get new-listing alerts."
      onClose={(r) => { if (r === 'signed-in') setJustSignedIn(true); }}
    />
  );
}
