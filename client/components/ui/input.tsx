import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={
          "flex h-10 w-full rounded-md border border-[rgba(15,23,42,0.06)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] disabled:opacity-50 " +
          className
        }
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

