// Supabase Database Types

import type { GuideFile } from './index'

export interface DbSchedule {
  id: number
  user_id: string
  title: string
  status: string
  platform: string | null
  review_type: string | null
  channel: string | null
  category: string | null
  region: string | null
  visit_date: string | null
  visit_time: string | null
  deadline: string | null
  benefit: number
  income: number
  cost: number
  posting_link: string
  purchase_link: string
  guide_files: GuideFile[]
  memo: string
  reconfirm_reason: string | null
  visit_review_checklist: {
    naverReservation: boolean
    platformAppReview: boolean
    cafeReview: boolean
    googleReview: boolean
  } | null
  payback_expected: boolean
  payback_confirmed: boolean
  created_at: string
  updated_at: string
}

export interface DbTodo {
  id: number
  user_id: string
  text: string
  done: boolean
  created_at: string
  updated_at: string
}

export interface DbChannel {
  id: number
  user_id: string
  type: string
  name: string
  followers: number | null
  monthly_visitors: number | null
  avg_views: number | null
  avg_reach: number | null
  avg_engagement: number | null
  url: string | null
  created_at: string
  updated_at: string
}

export interface DbFeaturedPost {
  id: number
  user_id: string
  title: string
  thumbnail: string | null
  url: string | null
  views: number
  channel: string | null
  created_at: string
  updated_at: string
}

export interface DbExtraIncome {
  id: number
  user_id: string
  title: string
  amount: number
  date: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface DbMonthlyGrowth {
  user_id: string
  month_start: string
  benefit_total: number
  income_total: number
  cost_total: number
  extra_income_total: number
  econ_value: number
}

// Insert Types (user_id 제외 - 서버에서 추가)
export type DbScheduleInsert = Omit<DbSchedule, 'id' | 'created_at' | 'updated_at'>
export type DbTodoInsert = Omit<DbTodo, 'id' | 'created_at' | 'updated_at'>
export type DbChannelInsert = Omit<DbChannel, 'id' | 'created_at' | 'updated_at'>
export type DbFeaturedPostInsert = Omit<DbFeaturedPost, 'id' | 'created_at' | 'updated_at'>
export type DbExtraIncomeInsert = Omit<DbExtraIncome, 'id' | 'created_at' | 'updated_at'>

// Update Types
export type DbScheduleUpdate = Partial<Omit<DbSchedule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
export type DbTodoUpdate = Partial<Omit<DbTodo, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
export type DbChannelUpdate = Partial<Omit<DbChannel, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
export type DbFeaturedPostUpdate = Partial<Omit<DbFeaturedPost, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
export type DbExtraIncomeUpdate = Partial<Omit<DbExtraIncome, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
