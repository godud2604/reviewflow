"use client"

import { useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })
  const initializedRef = useRef(false)

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initializedRef.current) return
    initializedRef.current = true

    const supabase = getSupabaseClient()

    // 현재 세션 가져오기
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('세션 조회 오류:', error)
          setAuthState({ user: null, session: null, loading: false })
          return
        }

        setAuthState({
          user: session?.user ?? null,
          session: session,
          loading: false,
        })
      } catch (error) {
        console.error('세션 조회 중 오류 발생:', error)
        setAuthState({ user: null, session: null, loading: false })
      }
    }

    getSession()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only update if user actually changed
        setAuthState(prev => {
          const newUserId = session?.user?.id
          const prevUserId = prev.user?.id
          
          // Skip if same user
          if (newUserId === prevUserId && !prev.loading) {
            return prev
          }
          
          return {
            user: session?.user ?? null,
            session: session,
            loading: false,
          }
        })

        // 로그인/로그아웃 이벤트 로깅 (디버깅용)
        if (event === 'SIGNED_IN') {
          console.log('로그인 성공:', session?.user?.email)
        } else if (event === 'SIGNED_OUT') {
          console.log('로그아웃 완료')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('로그아웃 오류:', error)
      throw error
    }
  }

  return {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    isAuthenticated: !!authState.user,
    signOut,
  }
}
