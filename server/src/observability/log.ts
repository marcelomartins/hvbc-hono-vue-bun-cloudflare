// Workers Logs indexes the fields of logged objects, while a process log collector
// needs one JSON document per line, so each entry point chooses the format.
let jsonLines = false;

export function useJsonLogLines(): void {
  jsonLines = true;
}

export function structuredLog(
  level: "info" | "warn" | "error",
  event: Record<string, string | number | boolean | null>
): void {
  const safeEvent = { ...event, level };
  const output = jsonLines ? JSON.stringify(safeEvent) : safeEvent;
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}
