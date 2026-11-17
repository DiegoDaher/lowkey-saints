import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
};

type StoreActionProps = SharedProps &
  (
    | (Omit<ComponentProps<"button">, keyof SharedProps> & { href?: never })
    | Omit<ComponentProps<typeof Link>, keyof SharedProps>
  );

/** Adapted from Magic UI's Interactive Hover Button. See THIRD_PARTY_NOTICES.md. */
export default function StoreAction({
  children,
  className = "",
  variant = "primary",
  ...props
}: StoreActionProps) {
  const classes = `store-action store-action--${variant} ${className}`;
  const content = (
    <>
      <span className="store-action__label">{children}</span>
      <ArrowRight
        aria-hidden="true"
        className="store-action__arrow"
        size={16}
        strokeWidth={1.7}
      />
    </>
  );

  if ("href" in props && props.href !== undefined) {
    return (
      <Link {...props} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...props} className={classes}>
      {content}
    </button>
  );
}
