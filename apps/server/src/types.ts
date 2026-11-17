/** Omit that distributes over a union (plain Omit collapses discriminated unions). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
