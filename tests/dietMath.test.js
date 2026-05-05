import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVITY_MULTIPLIERS,
  bikeExerciseKcal,
  bmrMifflinStJeor,
  cappedDailyDeficit,
  computeIntakePlan,
  cumulativeBalanceSeries,
  dailyBalance,
  intakeTargetKcal,
  minIntakeFloor,
  netIntakeKcal,
  rawDailyDeficit,
  stackedWithinOver,
  tdeeFromBmr,
  totalDeficitKcal,
  totalExerciseKcal,
  walkExerciseKcal,
  wholeDaysBetweenInclusive,
} from "../src/lib/dietMath.js";

test("bmrMifflinStJeor matches known shape (male)", () => {
  const bmr = bmrMifflinStJeor({ weightKg: 70, heightCm: 175, age: 30, sex: "male" });
  assert.ok(bmr > 1500 && bmr < 2000);
});

test("activityMultiplier covers all levels", () => {
  const vals = Object.values(ACTIVITY_MULTIPLIERS);
  assert.ok(vals.every((v) => v >= 1.2 && v <= 2));
});

test("totalDeficitKcal zero when no loss needed", () => {
  assert.equal(totalDeficitKcal(60, 65), 0);
});

test("wholeDaysBetweenInclusive same day is 1", () => {
  assert.equal(wholeDaysBetweenInclusive("2026-05-05", "2026-05-05"), 1);
});

test("cappedDailyDeficit respects ceiling", () => {
  assert.equal(cappedDailyDeficit(2000, 750), 750);
  assert.equal(cappedDailyDeficit(300, 750), 300);
});

test("intakeTarget never below sex floor", () => {
  const t = intakeTargetKcal(1400, 500, "female");
  assert.equal(t, minIntakeFloor("female"));
});

test("walkExerciseKcal scales with weight and km", () => {
  const a = walkExerciseKcal(60, 1);
  const b = walkExerciseKcal(120, 1);
  assert.ok(b > a);
  assert.equal(walkExerciseKcal(70, 0), 0);
});

test("bikeExerciseKcal uses MET hours model", () => {
  const kcal = bikeExerciseKcal(70, 10);
  assert.ok(kcal > 0);
});

test("totalExerciseKcal sums modalities", () => {
  const x = totalExerciseKcal({ weightKg: 65, walkKm: 2, bikeKm: 1, radioSets: 1 });
  assert.ok(x > walkExerciseKcal(65, 2));
});

test("dailyBalance sign: overeating positive", () => {
  assert.equal(dailyBalance(2200, 2000), 200);
  assert.equal(dailyBalance(1800, 2000), -200);
});

test("netIntakeKcal is food minus exercise", () => {
  assert.equal(netIntakeKcal(2000, 300), 1700);
});

test("cumulativeBalanceSeries", () => {
  const { cum, cumUnderMag, cumOverMag } = cumulativeBalanceSeries([100, -50, 30]);
  assert.deepEqual(cum, [100, 50, 80]);
  assert.deepEqual(cumUnderMag, [0, 50, 50]);
  assert.deepEqual(cumOverMag, [100, 100, 130]);
});

test("stackedWithinOver", () => {
  assert.deepEqual(stackedWithinOver(1800, 2000), { within: 1800, over: 0 });
  assert.deepEqual(stackedWithinOver(2200, 2000), { within: 2000, over: 200 });
});

test("computeIntakePlan maintenance when goal passed", () => {
  const p = {
    weightKg: 70,
    heightCm: 170,
    age: 35,
    sex: "male",
    activity: "moderate",
    goalWeightKg: 65,
    goalDate: "2020-01-01",
  };
  const r = computeIntakePlan(p, "2026-01-01");
  assert.equal(r.maintenanceMode, true);
  assert.equal(r.cappedDailyDeficit, 0);
});

test("computeIntakePlan returns finite targets", () => {
  const p = {
    weightKg: 75,
    heightCm: 165,
    age: 40,
    sex: "female",
    activity: "light",
    goalWeightKg: 68,
    goalDate: "2026-12-31",
  };
  const r = computeIntakePlan(p, "2026-05-05");
  assert.ok(Number.isFinite(r.intakeTarget));
  assert.ok(r.intakeTarget >= minIntakeFloor("female"));
});
