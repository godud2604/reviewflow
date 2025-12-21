'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { Todo } from '@/types';
import type { DbTodo } from '@/types/database';

interface UseTodosOptions {
  enabled?: boolean;
}

interface UseTodosReturn {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  addTodo: (text: string) => Promise<Todo | null>;
  toggleTodo: (id: number) => Promise<boolean>;
  deleteTodo: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// DB -> Frontend 매핑
function mapDbToTodo(db: DbTodo): Todo {
  return {
    id: db.id,
    text: db.text,
    done: db.done,
  };
}

export function useTodos(options: UseTodosOptions = {}): UseTodosReturn {
  const { enabled = true } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

  const showError = useCallback(
    (message: string) => {
      setError(message);
      toast({
        title: '오류가 발생했습니다',
        description: message,
        variant: 'destructive',
        duration: 3000,
      });
    },
    [toast]
  );

  const userId = user?.id;

  const fetchTodos = useCallback(
    async (force = false) => {
      if (!userId) {
        setTodos([]);
        setLoading(false);
        return;
      }

      // Skip if already fetched and not forcing
      if (hasFetchedRef.current && !force) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (fetchError) {
          showError(fetchError.message);
          setTodos([]);
        } else {
          setTodos((data || []).map(mapDbToTodo));
          hasFetchedRef.current = true;
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    },
    [userId, showError]
  );

  useEffect(() => {
    if (enabled) {
      fetchTodos();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchTodos]);

  const addTodo = useCallback(
    async (text: string): Promise<Todo | null> => {
      if (!user) return null;

      try {
        const supabase = getSupabaseClient();
        const { data, error: insertError } = await supabase
          .from('todos')
          .insert([
            {
              user_id: user.id,
              text,
              done: false,
            },
          ])
          .select()
          .single();

        if (insertError) {
          showError(insertError.message);
          return null;
        }

        const newTodo = mapDbToTodo(data);
        setTodos((prev) => [...prev, newTodo]);
        return newTodo;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return null;
      }
    },
    [user, showError]
  );

  const toggleTodo = useCallback(
    async (id: number): Promise<boolean> => {
      if (!user) return false;

      const currentTodo = todos.find((t) => t.id === id);
      if (!currentTodo) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('todos')
          .update({ done: !currentTodo.done })
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, todos, showError]
  );

  const deleteTodo = useCallback(
    async (id: number): Promise<boolean> => {
      if (!user) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: deleteError } = await supabase
          .from('todos')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) {
          showError(deleteError.message);
          return false;
        }

        setTodos((prev) => prev.filter((t) => t.id !== id));
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError]
  );

  return {
    todos,
    loading,
    error,
    addTodo,
    toggleTodo,
    deleteTodo,
    refetch: () => fetchTodos(true),
  };
}
