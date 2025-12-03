export interface Schedule {
  id: number
  title: string
  status: "ready" | "visit" | "done"
  platform: string
  type: "맛집" | "뷰티" | "제품" | "숙박" | "기자단"
  visit: string
  dead: string
  benefit: number
  income: number
  cost: number
  link: string
  memo: string
}

export interface Todo {
  id: number
  text: string
  done: boolean
}
