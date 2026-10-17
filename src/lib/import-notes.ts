/**
 * Parses the plain-text notes format into split days, so an existing program
 * can be pasted in instead of retyped:
 *
 *   Day 1 - Upper Body (2 Chest 1 Shoulder || 1 Chest 2 Shoulder)
 *   * 1 Bench Press: 65lbs | (45 (bar) + 12.5)
 *      * 3 x 8
 *   * 3 Lever Row: 55lbs
 *   * 3 Landmine Row:
 *   * Hip Thrust: 230lbs
 *      * 3x12-15
 *
 * A leading number groups options together; lines without one get their own group.
 */

export interface ParsedSlot {
  name: string;
  weight?: number;
  perSide: boolean;
  sets?: number;
  repFloor?: number;
  repCeiling?: number;
  notes?: string;
}

export interface ParsedGroup {
  number?: number;
  slots: ParsedSlot[];
}

export interface ParsedDay {
  order: number;
  title: string;
  notes?: string;
  groups: ParsedGroup[];
}

const DAY_RE = /^day\s*(\d+)\s*[-–—:]\s*(.+)$/i;
const BULLET_RE = /^(\s*)[*\-•]\s+(.*)$/;
const SETS_RE = /^(\d+)\s*x\s*(\d+)(?:\s*[-–]\s*(\d+))?/i;
const ITEM_RE = /^(?:(\d+)\s+)?([^:]+?)\s*(?::\s*(.*))?$/;
const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*(?:lbs?|kg)\b/i;

export function parseNotes(text: string): ParsedDay[] {
  const days: ParsedDay[] = [];
  let day: ParsedDay | null = null;
  let lastSlot: ParsedSlot | null = null;
  let topIndent: number | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const dayMatch = line.trim().match(DAY_RE);
    if (dayMatch) {
      const [, num, rest] = dayMatch;
      const paren = rest.match(/^(.*?)\s*\((.*)\)\s*$/);
      day = {
        order: Number(num),
        title: (paren ? paren[1] : rest).trim(),
        notes: paren?.[2].trim() || undefined,
        groups: [],
      };
      days.push(day);
      lastSlot = null;
      topIndent = null;
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (!bullet || !day) continue;
    const indent = bullet[1].length;
    const content = bullet[2].trim();
    if (topIndent === null) topIndent = indent;

    // Sub-bullet: sets x reps for the previous exercise (first one wins)
    if (indent > topIndent) {
      const s = content.match(SETS_RE);
      if (s && lastSlot && lastSlot.sets === undefined) {
        lastSlot.sets = Number(s[1]);
        lastSlot.repFloor = Number(s[2]);
        if (s[3]) lastSlot.repCeiling = Number(s[3]);
      } else if (lastSlot) {
        lastSlot.notes = [lastSlot.notes, content].filter(Boolean).join(" · ");
      }
      continue;
    }

    const m = content.match(ITEM_RE);
    if (!m) continue;
    const [, groupNum, name, detail = ""] = m;
    const w = detail.match(WEIGHT_RE);
    const notes = detail
      .replace(WEIGHT_RE, "")
      .replace(/^\s*[|]\s*/, "")
      .replace(/\beach\b/i, "")
      .trim();

    const slot: ParsedSlot = {
      name: name.trim(),
      weight: w ? Number(w[1]) : undefined,
      perSide: /\beach\b/i.test(detail),
      notes: notes || undefined,
    };
    lastSlot = slot;

    const number = groupNum ? Number(groupNum) : undefined;
    const prev = day.groups.at(-1);
    if (number !== undefined && prev?.number === number) {
      prev.slots.push(slot);
    } else {
      day.groups.push({ number, slots: [slot] });
    }
  }

  return days;
}
