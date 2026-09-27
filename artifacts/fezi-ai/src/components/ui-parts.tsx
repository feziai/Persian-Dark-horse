import { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all tactile-button disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_15px_rgba(229,185,90,0.2)]",
    secondary: "bg-surface border border-border text-foreground hover:bg-surface-hover",
    danger: "bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/30",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base"
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 fade-up">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground text-sm max-w-xl">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`tactile-card p-6 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={`w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea 
      className={`w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-muted-foreground ${className}`}
      {...props}
    />
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${className}`}>
      {children}
    </label>
  );
}
