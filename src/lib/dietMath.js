/**
 * MET・時間の前提は README の「運動の換算」に記載。
 * kcal = MET × 体重(kg) × 時間(h)
 */

export const MET_WALK_PER_KM = 3.3;
/** 約 5 km/h → 1 km = 0.2 h */
export const HOURS_PER_KM_WALK = 0.2;

export const MET_BIKE_LEISURE_PER_KM = 4.0;
/** ゆっくり ~10 km/h → 1 km = 0.1 h */
export const HOURS_PER_KM_BIKE = 0.1;

/** 軽い体操系に近い値として固定 */
export const MET_RADIO_CALISTHENICS = 3.5;
/** ラジオ体操 1 セット ≈ 5 分 */
export const HOURS_PER_RADIO_SET = 5 / 60;

/** 1 kg の体脂肪相当に近い総カロリー換算（近似） */
export const KCAL_PER_KG_FAT = 7700;

/** 1 日の赤字上限（安全側のキャップ）。それ以上は目標日に間に合わない可能性あり */
export const MAX_DAILY_DEFICIT_KCAL = 750;

export const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
});

/**
 * @param {{ weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' }} p
 */
export function bmrMifflinStJeor(p) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/** @param {keyof typeof ACTIVITY_MULTIPLIERS} level */
export function activityMultiplier(level) {
  return ACTIVITY_MULTIPLIERS[level];
}

export function tdeeFromBmr(bmr, level) {
  return bmr * activityMultiplier(level);
}

export function minIntakeFloor(sex) {
  return sex === "female" ? 1200 : 1500;
}

/**
 * 必要総赤字 (kcal)。減量しない・増量なら 0。
 * @param {number} currentKg
 * @param {number} goalKg
 */
export function totalDeficitKcal(currentKg, goalKg) {
  const lossKg = currentKg - goalKg;
  if (lossKg <= 0) return 0;
  return lossKg * KCAL_PER_KG_FAT;
}

/**
 * @param {string} isoDateStart YYYY-MM-DD (ローカル基準でパース)
 * @param {string} isoDateEnd
 */
export function wholeDaysBetweenInclusive(isoDateStart, isoDateEnd) {
  const a = parseLocalDate(isoDateStart);
  const b = parseLocalDate(isoDateEnd);
  if (b.getTime() < a.getTime()) return 1;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {number} totalDeficitKcal
 * @param {number} wholeDays 残り日数（当日含む）。1 未満は 1 扱い。
 */
export function rawDailyDeficit(totalDeficitKcal, wholeDays) {
  const days = Math.max(1, wholeDays);
  return totalDeficitKcal / days;
}

export function cappedDailyDeficit(rawDailyDeficit, cap = MAX_DAILY_DEFICIT_KCAL) {
  if (!Number.isFinite(rawDailyDeficit) || rawDailyDeficit <= 0) return 0;
  return Math.min(rawDailyDeficit, cap);
}

/**
 * @param {number} tdee
 * @param {number} dailyDeficit
 * @param {'male' | 'female'} sex
 */
export function intakeTargetKcal(tdee, dailyDeficit, sex) {
  const raw = tdee - dailyDeficit;
  return Math.max(minIntakeFloor(sex), raw);
}

export function exerciseKcalFromMet(weightKg, met, hours) {
  if (weightKg <= 0 || hours <= 0) return 0;
  return met * weightKg * hours;
}

export function walkExerciseKcal(weightKg, kmRepeats) {
  const km = Math.max(0, kmRepeats);
  return exerciseKcalFromMet(weightKg, MET_WALK_PER_KM, km * HOURS_PER_KM_WALK);
}

export function bikeExerciseKcal(weightKg, kmRepeats) {
  const km = Math.max(0, kmRepeats);
  return exerciseKcalFromMet(weightKg, MET_BIKE_LEISURE_PER_KM, km * HOURS_PER_KM_BIKE);
}

export function radioExerciseKcal(weightKg, sets) {
  const s = Math.max(0, sets);
  return exerciseKcalFromMet(weightKg, MET_RADIO_CALISTHENICS, s * HOURS_PER_RADIO_SET);
}

/**
 * @param {{ weightKg: number; walkKm: number; bikeKm: number; radioSets: number }} ex
 */
export function totalExerciseKcal(ex) {
  return (
    walkExerciseKcal(ex.weightKg, ex.walkKm) +
    bikeExerciseKcal(ex.weightKg, ex.bikeKm) +
    radioExerciseKcal(ex.weightKg, ex.radioSets)
  );
}

/** 実効摂取 = 食事 − 運動 */
export function netIntakeKcal(foodKcal, exerciseKcal) {
  return foodKcal - exerciseKcal;
}

/** プラス = 食べすぎ（目標より実効摂取が多い） */
export function dailyBalance(netIntake, targetIntake) {
  return netIntake - targetIntake;
}

/**
 * @param {number[]} dailyBalances
 * @returns {{ cum: number[]; cumUnderMag: number[]; cumOverMag: number[] }}
 */
export function cumulativeBalanceSeries(dailyBalances) {
  let acc = 0;
  let under = 0;
  let over = 0;
  const cum = [];
  const cumUnderMag = [];
  const cumOverMag = [];
  for (const b of dailyBalances) {
    acc += b;
    cum.push(acc);
    under += Math.max(0, -b);
    over += Math.max(0, b);
    cumUnderMag.push(under);
    cumOverMag.push(over);
  }
  return { cum, cumUnderMag, cumOverMag };
}

/**
 * 積み上げ棒: 目標以内の実効摂取 / 超過分
 */
export function stackedWithinOver(netIntake, targetIntake) {
  const n = Math.max(0, netIntake);
  const t = Math.max(0, targetIntake);
  const within = Math.min(n, t);
  const over = Math.max(0, n - t);
  return { within, over };
}

/**
 * プロフィールと基準日から摂取目標などを一括計算。
 * @param {{ weightKg: number; heightCm: number; age: number; sex: 'male' | 'female'; activity: keyof typeof ACTIVITY_MULTIPLIERS; goalWeightKg: number; goalDate: string }} profile
 * @param {string} asOfIsoDate YYYY-MM-DD（通常は当日）
 */
export function computeIntakePlan(profile, asOfIsoDate) {
  const bmr = bmrMifflinStJeor(profile);
  const tdee = tdeeFromBmr(bmr, profile.activity);
  const end = parseLocalDate(profile.goalDate);
  const start = parseLocalDate(asOfIsoDate);
  const goalPassed = end.getTime() < start.getTime();

  const totalDef = totalDeficitKcal(profile.weightKg, profile.goalWeightKg);
  const days = goalPassed ? 1 : wholeDaysBetweenInclusive(asOfIsoDate, profile.goalDate);
  const raw = goalPassed || totalDef <= 0 ? 0 : rawDailyDeficit(totalDef, days);
  const capped = goalPassed ? 0 : cappedDailyDeficit(raw);
  const intakeTarget = intakeTargetKcal(tdee, capped, profile.sex);

  return {
    bmr,
    tdee,
    rawDailyDeficit: raw,
    cappedDailyDeficit: capped,
    intakeTarget,
    uncappedDeficit: raw > MAX_DAILY_DEFICIT_KCAL,
    maintenanceMode: goalPassed || totalDef <= 0,
  };
}
