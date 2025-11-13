import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Unauthorized: React.FC<{ message?: string; title?: string }> = ({ message, title }) => {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {title || t('auth.accessDeniedTitle')}
        </h1>
        <p className="text-muted-foreground">
          {message || t('auth.permissionDenied')}
        </p>
      </div>
    </div>
  );
};
