-- 월별 성장 추이 뷰: schedules/extra_incomes를 월 단위로 합산합니다.
DROP VIEW IF EXISTS monthly_growth;

CREATE VIEW monthly_growth AS
WITH schedule_months AS (
  SELECT
    user_id,
    date_trunc(
      'month',
      COALESCE(NULLIF(visit_date, '')::date, NULLIF(deadline, '')::date, created_at)
    )::date AS month_start,
    SUM(COALESCE(benefit, 0)) AS benefit_total,
    SUM(COALESCE(income, 0)) AS income_total,
    SUM(COALESCE(cost, 0)) AS cost_total
  FROM schedules
  WHERE COALESCE(NULLIF(visit_date, '')::date, NULLIF(deadline, '')::date, created_at) IS NOT NULL
  GROUP BY user_id, date_trunc('month', COALESCE(NULLIF(visit_date, '')::date, NULLIF(deadline, '')::date, created_at))
),
extra_months AS (
  SELECT
    user_id,
    date_trunc('month', NULLIF(date, '')::date)::date AS month_start,
    SUM(COALESCE(amount, 0)) AS extra_income_total
  FROM extra_incomes
  WHERE NULLIF(date, '') IS NOT NULL
  GROUP BY user_id, date_trunc('month', NULLIF(date, '')::date)
)
SELECT
  COALESCE(s.user_id, e.user_id) AS user_id,
  COALESCE(s.month_start, e.month_start) AS month_start,
  COALESCE(s.benefit_total, 0) AS benefit_total,
  COALESCE(s.income_total, 0) AS income_total,
  COALESCE(s.cost_total, 0) AS cost_total,
  COALESCE(e.extra_income_total, 0) AS extra_income_total,
  COALESCE(s.benefit_total, 0) + COALESCE(s.income_total, 0) + COALESCE(e.extra_income_total, 0) - COALESCE(s.cost_total, 0) AS econ_value
FROM schedule_months s
FULL OUTER JOIN extra_months e
  ON s.user_id = e.user_id
  AND s.month_start = e.month_start;
