import type { Command } from "@shared/types";

const RISKY_LABEL = /\b(submit|pay|place|purchase|checkout|order|delete|clear|sign in|log in|login)\b/i;

/** Keep the web classifier pure so all consequential-action terms are testable. */
export function isRisky(commands: Command[]): boolean {
  return commands.some(
    (command) =>
      command.confirmRequired ||
      (command.action === "click" &&
        RISKY_LABEL.test(command.target.label ?? command.target.nodeId ?? "")),
  );
}
