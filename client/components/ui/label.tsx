import * as React from "react";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", ...props }: LabelProps) {
  return (
    <label
      className={
        "text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 block " +
        className
      }
      {...props}
    />
  );
}

