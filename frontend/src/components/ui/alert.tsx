import { ReactNode } from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "destructive" | "success" | "warning";
}

export function Alert({
  children,
  variant = "default",
  className = "",
  ...props
}: AlertProps) {
  let base = "rounded-lg p-4 w-full";
  let colorClasses = "bg-gray-50 text-gray-900";

  switch (variant) {
    case "destructive":
      colorClasses = "bg-red-50 text-red-900";
      break;
    case "success":
      colorClasses = "bg-green-50 text-green-900";
      break;
    case "warning":
      colorClasses = "bg-yellow-50 text-yellow-900";
      break;
  }

  return (
    <div className={`${base} ${colorClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AlertTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={`font-medium leading-none mb-1 ${className}`} {...props}>
      {children}
    </h5>
  );
}

export function AlertDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm ${className}`} {...props}>
      {children}
    </p>
  );
}
