/**
 * Shared error message helper for the AWS adapter stubs.
 *
 * The aws adapters satisfy the port contracts at compile time (Req 16.4) but do
 * not yet perform real AWS calls. Calling any of their methods at runtime
 * throws with a consistent, debuggable message naming the missing operation.
 */
export function AWS_NOT_CONFIGURED(operation: string): string {
  return `AWS adapter not configured: ${operation} has no real implementation yet. Provide AWS env vars and implement the aws adapters, or run on the default mock gateway.`;
}
