"use client";

import { useId } from "react";

type LoaderProps = {
  variant?: "page" | "section" | "inline";
  label?: string;
  className?: string;
  /** Disable inside buttons so their visible text remains the accessible name. */
  announce?: boolean;
};

const shape =
  "M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z";

/** Adapted from the loader by andrew-manzyk on Uiverse.io. */
export default function Loader({
  variant = "section",
  label = "Cargando…",
  className = "",
  announce = true,
}: LoaderProps) {
  const id = useId();
  return (
    <span
      role={announce ? "status" : undefined}
      className={`saints-loader saints-loader--${variant} ${className}`}
    >
      <span className="saints-loader__viewport" aria-hidden="true">
        <span className="saints-loader__scene">
          {[0, 1, 2].map((index) => {
            const prefix = `${id}-${index}`;
            const ref = (name: string) => `${prefix}-${name}`;
            return (
              <svg
                key={index}
                className={`saints-loader__figure saints-loader__figure--${index + 1}`}
                viewBox="0 0 100 100"
                focusable="false"
              >
                <defs>
                  <filter id={ref("shine")}>
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                  <mask id={ref("mask")}>
                    <path d={shape} fill="white" />
                  </mask>
                  <radialGradient
                    id={ref("gradient-1")}
                    cx="50"
                    cy="66"
                    fx="50"
                    fy="66"
                    r="30"
                    gradientTransform="translate(0 35) scale(1 0.5)"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="black" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="black" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="black" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient
                    id={ref("gradient-2")}
                    cx="55"
                    cy="20"
                    fx="55"
                    fy="20"
                    r="30"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient
                    id={ref("gradient-3")}
                    cx="85"
                    cy="50"
                    fx="85"
                    fy="50"
                    href={`#${ref("gradient-2")}`}
                  />
                  <radialGradient
                    id={ref("gradient-4")}
                    cx="50"
                    cy="58"
                    fx="50"
                    fy="58"
                    r="60"
                    gradientTransform="translate(0 47) scale(1 0.2)"
                    href={`#${ref("gradient-3")}`}
                  />
                  <linearGradient
                    id={ref("gradient-5")}
                    x1="50"
                    y1="90"
                    x2="50"
                    y2="10"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="black" stopOpacity="0.2" />
                    <stop offset="40%" stopColor="black" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g>
                  <path d={shape} fill="var(--color-gold)" />
                  <path d={shape} fill={`url(#${ref("gradient-1")})`} />
                  <path
                    d={shape}
                    fill="none"
                    stroke="white"
                    opacity="0.3"
                    strokeWidth="3"
                    filter={`url(#${ref("shine")})`}
                    mask={`url(#${ref("mask")})`}
                  />
                  {[2, 3, 4, 5].map((n) => (
                    <path
                      key={n}
                      d={shape}
                      fill={`url(#${ref(`gradient-${n}`)})`}
                    />
                  ))}
                </g>
              </svg>
            );
          })}
        </span>
      </span>
      <span>{label}</span>
    </span>
  );
}
