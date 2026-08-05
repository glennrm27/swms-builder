"use client";

import {
  emptyGroup,
  emptyLeaf,
  type ConditionDraftItem,
  type GroupDraft,
} from "../../lib/ruleConditionDraft.js";

const OPERATORS = ["equals", "notEquals", "in", "notIn", "includes", "truthy", "falsy"];

// Cycle border colors by depth purely so nested groups are visually
// distinguishable at a glance — not meaningful beyond that.
const DEPTH_BORDER_COLORS = ["border-brand-300", "border-amber-300", "border-emerald-300", "border-violet-300"];

interface Props {
  group: GroupDraft;
  onChange: (next: GroupDraft) => void;
  depth: number;
  onRemove?: () => void;
}

/**
 * Recursive AND/OR condition-group editor. A rule's top-level conditions
 * are themselves just the root of this tree — see admin/rules/page.tsx,
 * which renders one of these with no `onRemove` (the root can't be
 * deleted) and converts the result via draftToRuleConditions on submit.
 */
export function ConditionGroupEditor({ group, onChange, depth, onRemove }: Props) {
  const borderColor = DEPTH_BORDER_COLORS[depth % DEPTH_BORDER_COLORS.length];

  function updateItem(index: number, next: ConditionDraftItem) {
    onChange({ ...group, items: group.items.map((item, i) => (i === index ? next : item)) });
  }

  function removeItem(index: number) {
    onChange({ ...group, items: group.items.filter((_, i) => i !== index) });
  }

  return (
    <div className={`space-y-2 rounded-md border-2 ${borderColor} bg-white p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span>Match</span>
          <select
            className="input w-auto py-1 text-xs"
            value={group.logic}
            onChange={(e) => onChange({ ...group, logic: e.target.value as "ALL" | "ANY" })}
          >
            <option value="ALL">ALL</option>
            <option value="ANY">ANY</option>
          </select>
          <span>of the following{depth > 0 ? " (this group)" : ""}:</span>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
            Remove group
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.items.map((item, index) =>
          item.kind === "group" ? (
            <ConditionGroupEditor
              key={item.id}
              group={item}
              depth={depth + 1}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
            />
          ) : (
            <div key={item.id} className="flex gap-2">
              <input
                className="input"
                placeholder="field, e.g. environment.workingAtHeight"
                value={item.field}
                onChange={(e) => updateItem(index, { ...item, field: e.target.value })}
              />
              <select
                className="input w-auto"
                value={item.operator}
                onChange={(e) => updateItem(index, { ...item, operator: e.target.value })}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder='value, e.g. true or "ELECTRICAL"'
                value={item.value}
                onChange={(e) => updateItem(index, { ...item, value: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="shrink-0 text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ),
        )}
      </div>

      <div className="flex gap-3 text-xs">
        <button
          type="button"
          className="text-brand-700 hover:underline"
          onClick={() => onChange({ ...group, items: [...group.items, emptyLeaf()] })}
        >
          + Add condition
        </button>
        <button
          type="button"
          className="text-brand-700 hover:underline"
          onClick={() => onChange({ ...group, items: [...group.items, emptyGroup()] })}
        >
          + Add nested group
        </button>
      </div>
    </div>
  );
}
