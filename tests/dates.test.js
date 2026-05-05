import assert from "node:assert/strict";
import test from "node:test";
import { addDaysISO, enumerateDates, formatISO, monthStartsBetween } from "../src/lib/dates.js";

test("enumerateDates inclusive range", () => {
  assert.deepEqual(enumerateDates("2026-05-01", "2026-05-03"), [
    "2026-05-01",
    "2026-05-02",
    "2026-05-03",
  ]);
});

test("enumerateDates empty when reversed", () => {
  assert.deepEqual(enumerateDates("2026-05-03", "2026-05-01"), []);
});

test("addDaysISO crosses month", () => {
  assert.equal(addDaysISO("2026-04-30", 1), "2026-05-01");
});

test("monthStartsBetween", () => {
  assert.deepEqual(monthStartsBetween("2026-04-28", "2026-05-02"), ["2026-04-01", "2026-05-01"]);
});

test("formatISO stable", () => {
  assert.equal(formatISO(new Date(2026, 4, 5)), "2026-05-05");
});
