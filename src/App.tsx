import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeIntakePlan,
  cumulativeBalanceSeries,
  dailyBalance,
  MAX_DAILY_DEFICIT_KCAL,
  netIntakeKcal,
  stackedWithinOver,
  totalExerciseKcal,
} from "./lib/dietMath.js";
import { addDaysISO, enumerateDates, formatISO, monthStartsBetween, todayISO } from "./lib/dates.js";
import { defaultDay, loadState, saveState } from "./storage";
import type { DayLog, Profile } from "./types";

const DOW = ["月", "火", "水", "木", "金", "土", "日"];

const ACTIVITY_LABEL: Record<Profile["activity"], string> = {
  sedentary: "座りがち（ほぼ運動なし）",
  light: "軽い活動（週1–3回程度）",
  moderate: "普通（週3–5回程度）",
  active: "活発（ほぼ毎日）",
  very_active: "非常に活発（激しい運動）",
};

function defaultProfile(): Profile {
  const t = todayISO();
  return {
    age: 35,
    heightCm: 165,
    weightKg: 62,
    sex: "female",
    activity: "moderate",
    goalWeightKg: 58,
    goalDate: addDaysISO(t, 84),
  };
}

function mergeLog(base: DayLog, patch: Partial<DayLog>): DayLog {
  return { ...base, ...patch };
}

function chartRange(logKeys: string[]): { start: string; end: string } {
  const end = todayISO();
  let start = addDaysISO(end, -420);
  for (const k of logKeys) {
    if (k < start) start = k;
  }
  if (start > end) start = end;
  return { start, end };
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>{title}</h3>
      <div className="chart-box">{children}</div>
    </div>
  );
}

function ChartAxes() {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend />
    </>
  );
}

function MonthGrid({
  monthStart,
  today,
  logs,
  onPick,
}: {
  monthStart: string;
  today: string;
  logs: Record<string, DayLog>;
  onPick: (iso: string) => void;
}) {
  const [y, m] = monthStart.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const dim = new Date(y, m, 0).getDate();
  const cells: { iso: string | null }[] = [];
  for (let i = 0; i < pad; i++) cells.push({ iso: null });
  for (let d = 1; d <= dim; d++) {
    cells.push({ iso: formatISO(new Date(y, m - 1, d)) });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null });
  return (
    <div className="month-block">
      <div className="month-title">
        {y}年{m}月
      </div>
      <div className="week-row dow">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <div className="week-row" key={row}>
          {cells.slice(row * 7, row * 7 + 7).map((c, i) => {
            if (!c.iso) return <div className="day-cell empty" key={i} />;
            const log = logs[c.iso] ?? defaultDay();
            const has =
              log.foodKcal > 0 || log.walkKm > 0 || log.bikeKm > 0 || log.radioSets > 0;
            const muted = c.iso > today;
            return (
              <div
                className={`day-cell${has ? " has-data" : ""}${muted ? " muted" : ""}`}
                key={c.iso}
              >
                <button type="button" className="inner" onClick={() => onPick(c.iso!)}>
                  <div>{Number(c.iso.slice(8))}</div>
                  {has ? <div style={{ fontSize: "0.65rem", color: "#15803d" }}>●</div> : null}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [draft, setDraft] = useState<Profile>(() => state.profile ?? defaultProfile());
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (state.profile) setDraft(state.profile);
  }, [state.profile]);

  const plan = useMemo(() => {
    if (!state.profile) return null;
    return computeIntakePlan(state.profile, todayISO());
  }, [state.profile]);

  const chartRows = useMemo(() => {
    if (!state.profile) return [];
    const { start, end } = chartRange(Object.keys(state.logs));
    const dates = enumerateDates(start, end);
    const p = state.profile;
    const rows = dates.map((iso) => {
      const log = state.logs[iso] ?? defaultDay();
      const ex = totalExerciseKcal({
        weightKg: p.weightKg,
        walkKm: log.walkKm,
        bikeKm: log.bikeKm,
        radioSets: log.radioSets,
      });
      const net = netIntakeKcal(log.foodKcal, ex);
      const target = computeIntakePlan(p, iso).intakeTarget;
      const balance = dailyBalance(net, target);
      const { within, over } = stackedWithinOver(net, target);
      return {
        iso,
        label: iso.slice(5),
        net,
        target,
        balance,
        within,
        over,
        cum: 0,
        cumUnder: 0,
        cumOver: 0,
      };
    });
    const bal = rows.map((r) => r.balance);
    const cum = cumulativeBalanceSeries(bal);
    rows.forEach((r, i) => {
      r.cum = cum.cum[i]!;
      r.cumUnder = cum.cumUnderMag[i]!;
      r.cumOver = cum.cumOverMag[i]!;
    });
    return rows;
  }, [state.profile, state.logs]);

  const calMonths = useMemo(() => {
    const end = todayISO();
    const start = addDaysISO(end, -540);
    return monthStartsBetween(start, addDaysISO(end, 180));
  }, []);

  function persistProfile() {
    setState((s) => ({ ...s, profile: { ...draft } }));
  }

  function updateLog(iso: string, patch: Partial<DayLog>) {
    setState((s) => {
      const prev = s.logs[iso] ?? defaultDay();
      const nextLog = mergeLog(prev, patch);
      const logs = { ...s.logs, [iso]: nextLog };
      return { ...s, logs };
    });
  }

  const pickedLog = pick ? (state.logs[pick] ?? defaultDay()) : null;
  const pickPlan =
    pick && state.profile ? computeIntakePlan(state.profile, pick).intakeTarget : 0;
  const pickEx =
    pickedLog && state.profile
      ? totalExerciseKcal({
          weightKg: state.profile.weightKg,
          walkKm: pickedLog.walkKm,
          bikeKm: pickedLog.bikeKm,
          radioSets: pickedLog.radioSets,
        })
      : 0;
  const pickNet = pickedLog ? netIntakeKcal(pickedLog.foodKcal, pickEx) : 0;

  return (
    <div className="app">
      <header>
        <h1>Diet Mom</h1>
        <p className="lead">
          プロフィールから摂取目標を算出し、食事と運動を記録してグラフで差を確認します。
        </p>
      </header>

      <section className="card">
        <h2>プロフィール</h2>
        <div className="grid-form">
          <label className="field">
            年齢
            <input
              type="number"
              min={10}
              max={120}
              value={draft.age}
              onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            身長 (cm)
            <input
              type="number"
              min={120}
              max={230}
              value={draft.heightCm}
              onChange={(e) => setDraft({ ...draft, heightCm: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            体重 (kg)
            <input
              type="number"
              min={30}
              max={250}
              step={0.1}
              value={draft.weightKg}
              onChange={(e) => setDraft({ ...draft, weightKg: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            性別
            <select
              value={draft.sex}
              onChange={(e) =>
                setDraft({ ...draft, sex: e.target.value as Profile["sex"] })
              }
            >
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </label>
          <label className="field">
            活動レベル
            <select
              value={draft.activity}
              onChange={(e) =>
                setDraft({ ...draft, activity: e.target.value as Profile["activity"] })
              }
            >
              {(Object.keys(ACTIVITY_LABEL) as Profile["activity"][]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            目標体重 (kg)
            <input
              type="number"
              min={30}
              max={250}
              step={0.1}
              value={draft.goalWeightKg}
              onChange={(e) => setDraft({ ...draft, goalWeightKg: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            目標日
            <input
              type="date"
              value={draft.goalDate}
              onChange={(e) => setDraft({ ...draft, goalDate: e.target.value })}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={persistProfile}>
            保存
          </button>
          <button type="button" className="ghost" onClick={() => setDraft(defaultProfile())}>
            初期値に戻す
          </button>
        </div>
      </section>

      {plan && state.profile ? (
        <section className="card">
          <h2>今日の目安（基準日: {todayISO()}）</h2>
          <div className="summary-grid">
            <div className="stat">
              BMR <strong>{Math.round(plan.bmr)}</strong>kcal / 日
            </div>
            <div className="stat">
              TDEE <strong>{Math.round(plan.tdee)}</strong>kcal / 日
            </div>
            <div className="stat">
              目標赤字（キャップ後）<strong>{Math.round(plan.cappedDailyDeficit)}</strong>kcal / 日
            </div>
            <div className="stat">
              摂取目標 <strong>{Math.round(plan.intakeTarget)}</strong>kcal / 日
            </div>
          </div>
          {plan.uncappedDeficit ? (
            <div className="warn">
              理論上必要な日次赤字が {plan.rawDailyDeficit.toFixed(0)}
              kcal と大きく、このアプリでは安全のため 1 日 {MAX_DAILY_DEFICIT_KCAL}
              kcal を上限にしています。期限内に届かない場合があります。
            </div>
          ) : null}
          {plan.maintenanceMode ? (
            <div className="warn">
              目標体重に到達済み、または目標日が過去のため、維持カロリー（TDEE ベース）として扱っています。
            </div>
          ) : null}
          <p style={{ fontSize: "0.82rem", color: "#57534e", marginTop: "0.6rem" }}>
            実効摂取 = 食事カロリー − 運動による消費。日次の差分は「実効摂取 − 摂取目標」。プラスは食べすぎ寄りです。
          </p>
        </section>
      ) : (
        <section className="card">
          <p style={{ margin: 0 }}>プロフィールを保存すると摂取目標が表示されます。</p>
        </section>
      )}

      <section className="card">
        <h2>カレンダー</h2>
        <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#57534e" }}>
          日付をタップして食事・運動を入力。過去にスクロールして遡れます。
        </p>
        <div className="calendar-scroll">
          {calMonths.map((ms) => (
            <MonthGrid
              key={ms}
              monthStart={ms}
              today={todayISO()}
              logs={state.logs}
              onPick={setPick}
            />
          ))}
        </div>
      </section>

      {chartRows.length > 0 && state.profile ? (
        <section className="card charts">
          <h2 style={{ marginBottom: "0.35rem" }}>グラフ</h2>
          <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#57534e" }}>
            横軸は日付（表示は MM-DD）。縦軸はカロリー。
          </p>

          <ChartCard title="日次: 差分（折れ線）">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <ChartAxes />
                <Line type="monotone" dataKey="balance" name="実効−目標" stroke="#b45309" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="日次: 実効摂取の積み上げ（目標内 / 超過）">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <ChartAxes />
                <Bar dataKey="within" stackId="d" name="目標以内" fill="#22c55e" />
                <Bar dataKey="over" stackId="d" name="超過" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="累積: 差分（折れ線）">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <ChartAxes />
                <Line type="monotone" dataKey="cum" name="累積差分" stroke="#7c3aed" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="累積: 超過分・抑制分の積み上げ">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <ChartAxes />
                <Bar dataKey="cumUnder" stackId="c" name="累積 max(0, 目標−実効)" fill="#0ea5e9" />
                <Bar dataKey="cumOver" stackId="c" name="累積 max(0, 実効−目標)" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      ) : null}

      {pick && pickedLog && state.profile ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPick(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{pick} の記録</h3>
            <div className="grid-form">
              <label className="field">
                食事 (kcal)
                <input
                  type="number"
                  min={0}
                  value={pickedLog.foodKcal}
                  onChange={(e) =>
                    updateLog(pick, { foodKcal: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="field">
                徒歩 1km × 回
                <input
                  type="number"
                  min={0}
                  value={pickedLog.walkKm}
                  onChange={(e) =>
                    updateLog(pick, { walkKm: Math.max(0, Math.floor(Number(e.target.value))) })
                  }
                />
              </label>
              <label className="field">
                自転車 1km × 回
                <input
                  type="number"
                  min={0}
                  value={pickedLog.bikeKm}
                  onChange={(e) =>
                    updateLog(pick, { bikeKm: Math.max(0, Math.floor(Number(e.target.value))) })
                  }
                />
              </label>
              <label className="field">
                ラジオ体操 × セット
                <input
                  type="number"
                  min={0}
                  value={pickedLog.radioSets}
                  onChange={(e) =>
                    updateLog(pick, {
                      radioSets: Math.max(0, Math.floor(Number(e.target.value))),
                    })
                  }
                />
              </label>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#44403c" }}>
              運動消費の目安 {Math.round(pickEx)} kcal / 実効摂取 {Math.round(pickNet)} kcal /
              その日の摂取目標 {Math.round(pickPlan)} kcal
            </p>
            <div className="actions">
              <button type="button" className="primary" onClick={() => setPick(null)}>
                閉じる
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => updateLog(pick, { ...defaultDay() })}
              >
                この日をクリア
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="fine-print">
        データはこのブラウザにのみ保存されます。機種変更やブラウザのデータ削除で失われることがあります。
      </p>
    </div>
  );
}
