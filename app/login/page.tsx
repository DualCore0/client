import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const metadata = {
  title: 'Sign in - ClassRank',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginClient />
    </Suspense>
  );
}