-- 월별 성장 추이 뷰: schedules/extra_incomes를 월 단위로 합산합니다.
DROP VIEW IF EXISTS monthly_growth;

CREATE VIEW monthly_growth AS
WITH normalized_schedules AS (
  SELECT
    user_id,
    -- 날짜가 없을 때는 생성일 기준으로 묶어서 월별 합산이 누락되지 않도록 처리
    COALESCE(
      NULLIF(visit_date, '')::date,
      NULLIF(deadline, '')::date,
      created_at::date
    ) AS event_date,
    COALESCE(benefit, 0) AS benefit,
    COALESCE(income, 0) AS income,
    COALESCE(cost, 0) AS cost
  FROM schedules
),
normalized_extra_incomes AS (
  SELECT
    user_id,
    -- extra_incomes도 날짜가 비어 있을 때 생성일로 대체
    COALESCE(NULLIF(date, '')::date, created_at::date) AS event_date,
    COALESCE(amount, 0) AS amount
  FROM extra_incomes
),
schedule_months AS (
  SELECT
    user_id,
    date_trunc('month', event_date)::date AS month_start,
    SUM(benefit) AS benefit_total,
    SUM(income) AS income_total,
    SUM(cost) AS cost_total
  FROM normalized_schedules
  GROUP BY user_id, date_trunc('month', event_date)
),
extra_months AS (
  SELECT
    user_id,
    date_trunc('month', event_date)::date AS month_start,
    SUM(amount) AS extra_income_total
  FROM normalized_extra_incomes
  GROUP BY user_id, date_trunc('month', event_date)
)
SELECT
  COALESCE(s.user_id, e.user_id) AS user_id,
  COALESCE(s.month_start, e.month_start) AS month_start,
  COALESCE(s.benefit_total, 0) AS benefit_total,
  COALESCE(s.income_total, 0) AS income_total,
  COALESCE(s.cost_total, 0) AS cost_total,
  COALESCE(e.extra_income_total, 0) AS extra_income_total,
  -- 경제적 가치: 방어한 생활비 + 부수입
  COALESCE(s.benefit_total, 0)
    + COALESCE(e.extra_income_total, 0) AS econ_value
FROM schedule_months s
FULL OUTER JOIN extra_months e
  ON s.user_id = e.user_id
  AND s.month_start = e.month_start;
