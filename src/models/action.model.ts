export type ActionResult<T = unknown> =
  | { success: true; data: T; total?: number }
  | { success: false; message: string }
  | undefined;
