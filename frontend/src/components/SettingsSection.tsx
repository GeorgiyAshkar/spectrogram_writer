import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, children, className = '' }: SettingsSectionProps) {
  return (
    <section className={`panel section ${className}`.trim()}>
      <div className="section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="section__content">{children}</div>
    </section>
  );
}
