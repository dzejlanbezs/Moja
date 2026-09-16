"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

type Props = React.ComponentProps<typeof Link> & { href: string };

/**
 * A link that warms the target route the moment the user hovers it or puts a
 * finger on it, so the page is already on its way before the click lands.
 * Every page here is dynamic, which Next does not prefetch on its own.
 */
export function PrefetchLink({ href, children, onMouseEnter, onTouchStart, ...rest }: Props) {
  const router = useRouter();
  const warmed = useRef(false);

  const warm = () => {
    if (warmed.current || href.startsWith("#") || href.startsWith("http")) return;
    warmed.current = true;
    router.prefetch(href);
  };

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        warm();
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        warm();
        onTouchStart?.(event);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
