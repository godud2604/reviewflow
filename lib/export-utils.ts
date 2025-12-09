import * as XLSX from 'xlsx'
import { Schedule, ExtraIncome } from '@/types'

export function exportSchedulesToExcel(schedules: Schedule[]) {
  // 체험단 활동 내역 데이터 변환
  const scheduleData = schedules.map((schedule) => ({
    '번호': schedule.id,
    '제목': schedule.title,
    '상태': schedule.status,
    '플랫폼': schedule.platform,
    '유형': schedule.reviewType,
    '채널': schedule.channel,
    '카테고리': schedule.category,
    '지역': schedule.region,
    '방문일': schedule.visit || '-',
    '방문시간': schedule.visitTime || '-',
    '마감일': schedule.dead || '-',
    '혜택(원)': schedule.benefit,
    '수익(원)': schedule.income,
    '비용(원)': schedule.cost,
    '순수익(원)': schedule.benefit + schedule.income - schedule.cost,
    '포스팅 링크': schedule.postingLink || '-',
    '구매 링크': schedule.purchaseLink || '-',
    '가이드 링크': schedule.guideLink || '-',
    '메모': schedule.memo || '-',
  }))

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  
  // 체험단 활동 내역 시트 생성
  const ws = XLSX.utils.json_to_sheet(scheduleData)
  
  // 열 너비 설정
  const colWidths = [
    { wch: 8 },  // 번호
    { wch: 30 }, // 제목
    { wch: 15 }, // 상태
    { wch: 12 }, // 플랫폼
    { wch: 15 }, // 유형
    { wch: 15 }, // 채널
    { wch: 12 }, // 카테고리
    { wch: 10 }, // 지역
    { wch: 12 }, // 방문일
    { wch: 12 }, // 방문시간
    { wch: 12 }, // 마감일
    { wch: 12 }, // 혜택
    { wch: 12 }, // 수익
    { wch: 12 }, // 비용
    { wch: 12 }, // 순수익
    { wch: 35 }, // 포스팅 링크
    { wch: 35 }, // 구매 링크
    { wch: 35 }, // 가이드 링크
    { wch: 30 }, // 메모
  ]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, '체험단 활동 내역')

  // 파일명 생성 (현재 날짜 포함)
  const today = new Date().toISOString().split('T')[0]
  const fileName = `체험단_활동내역_${today}.xlsx`

  // 파일 다운로드
  XLSX.writeFile(wb, fileName)
}

export function exportExtraIncomeToExcel(extraIncomes: ExtraIncome[]) {
  // 부수입 내역 데이터 변환
  const incomeData = extraIncomes.map((income) => ({
    '번호': income.id,
    '제목': income.title,
    '금액(원)': income.amount,
    '날짜': income.date,
    '메모': income.memo || '-',
  }))

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  
  // 부수입 내역 시트 생성
  const ws = XLSX.utils.json_to_sheet(incomeData)
  
  // 열 너비 설정
  const colWidths = [
    { wch: 8 },  // 번호
    { wch: 30 }, // 제목
    { wch: 12 }, // 금액
    { wch: 12 }, // 날짜
    { wch: 30 }, // 메모
  ]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, '부수입 내역')

  // 파일명 생성 (현재 날짜 포함)
  const today = new Date().toISOString().split('T')[0]
  const fileName = `부수입_내역_${today}.xlsx`

  // 파일 다운로드
  XLSX.writeFile(wb, fileName)
}

export function exportAllDataToExcel(schedules: Schedule[], extraIncomes: ExtraIncome[]) {
  // 체험단 활동 내역 데이터
  const scheduleData = schedules.map((schedule) => ({
    '번호': schedule.id,
    '제목': schedule.title,
    '상태': schedule.status,
    '플랫폼': schedule.platform,
    '유형': schedule.reviewType,
    '채널': schedule.channel,
    '카테고리': schedule.category,
    '지역': schedule.region,
    '방문일': schedule.visit || '-',
    '방문시간': schedule.visitTime || '-',
    '마감일': schedule.dead || '-',
    '혜택(원)': schedule.benefit,
    '수익(원)': schedule.income,
    '비용(원)': schedule.cost,
    '순수익(원)': schedule.benefit + schedule.income - schedule.cost,
    '포스팅 링크': schedule.postingLink || '-',
    '구매 링크': schedule.purchaseLink || '-',
    '가이드 링크': schedule.guideLink || '-',
    '메모': schedule.memo || '-',
  }))

  // 부수입 내역 데이터
  const incomeData = extraIncomes.map((income) => ({
    '번호': income.id,
    '제목': income.title,
    '금액(원)': income.amount,
    '날짜': income.date,
    '메모': income.memo || '-',
  }))

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  
  // 체험단 활동 내역 시트
  const ws1 = XLSX.utils.json_to_sheet(scheduleData)
  ws1['!cols'] = [
    { wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 35 },
    { wch: 35 }, { wch: 35 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, '체험단 활동 내역')

  // 부수입 내역 시트
  const ws2 = XLSX.utils.json_to_sheet(incomeData)
  ws2['!cols'] = [
    { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, '부수입 내역')

  // 파일명 생성 (현재 날짜 포함)
  const today = new Date().toISOString().split('T')[0]
  const fileName = `활동내역_${today}.xlsx`

  // 파일 다운로드
  XLSX.writeFile(wb, fileName)
}
