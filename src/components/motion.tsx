"use client";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/*
 * Small motion islands. Everything here collapses to a plain render when the
 * visitor asks for reduced motion; page-level animation otherwise lives in CSS.
 */

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Fades and lifts its content in once, on mount. */
export function FadeUp({ delay = 0, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggers its <StaggerItem> children in. Use on card grids and lists. */
export function Stagger({ step = 0.06, children, ...rest }: HTMLMotionProps<"div"> & { step?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }} {...rest}>
      {children}
    </motion.div>
  );
}

/** Springs in from small: the scanner result icon, a confirmed stamp. */
export function Pop({ children, ...rest }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
