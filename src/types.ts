export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Profile = {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: "male" | "female";
  activity: ActivityLevel;
  goalWeightKg: number;
  goalDate: string;
};

export type DayLog = {
  foodKcal: number;
  walkKm: number;
  bikeKm: number;
  radioSets: number;
};

export type AppState = {
  profile: Profile | null;
  logs: Record<string, DayLog>;
};
