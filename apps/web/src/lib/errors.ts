export function axiosErrorMessage(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    return response?.data?.error;
  }
  return undefined;
}
