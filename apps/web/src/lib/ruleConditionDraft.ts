import type { RuleCondition } from "@swms/shared-types";

/**
 * Editable draft shape for the rule condition builder. Mirrors
 * shared-types#RuleCondition (leaf | group, recursive) but keeps `value`
 * as a raw string while editing — parsed into JSON/string on submit — and
 * tags each node with a stable `id` so React keys survive reordering.
 */
export interface LeafDraft {
  kind: "leaf";
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface GroupDraft {
  kind: "group";
  id: string;
  logic: "ALL" | "ANY";
  items: ConditionDraftItem[];
}

export type ConditionDraftItem = LeafDraft | GroupDraft;

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `cond-${nextId}-${Date.now().toString(36)}`;
}

export function emptyLeaf(): LeafDraft {
  return { kind: "leaf", id: newId(), field: "", operator: "equals", value: "true" };
}

export function emptyGroup(logic: "ALL" | "ANY" = "ALL"): GroupDraft {
  return { kind: "group", id: newId(), logic, items: [emptyLeaf()] };
}

/** Best-effort parse so admins can type `true`, `"ELECTRICAL"`, `["A","B"]`, or plain text. */
function parseConditionValue(raw: string): unknown {
  if (raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Converts an editable draft tree into the wire format the API/rules-engine consume. */
export function draftToRuleConditions(items: ConditionDraftItem[]): RuleCondition[] {
  return items
    .filter((item) => item.kind === "group" || item.field.trim() !== "")
    .map((item): RuleCondition =>
      item.kind === "group"
        ? { logic: item.logic, conditions: draftToRuleConditions(item.items) }
        : { field: item.field, operator: item.operator as never, value: parseConditionValue(item.value) },
    );
}
