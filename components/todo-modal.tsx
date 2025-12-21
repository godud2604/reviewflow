'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Todo } from '@/types';

export default function TodoModal({
  isOpen,
  onClose,
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}: {
  isOpen: boolean;
  onClose: () => void;
  todos: Todo[];
  onAddTodo: (text: string) => void;
  onToggleTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
}) {
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const addingRef = useRef(false);
  const { toast } = useToast();

  const handleAdd = () => {
    if (!newTodo.trim() || addingRef.current) return;
    addingRef.current = true;
    setIsAdding(true);
    onAddTodo(newTodo.trim());
    setNewTodo('');
    toast({
      title: '할 일이 추가되었습니다',
      duration: 2000,
    });
    setTimeout(() => {
      addingRef.current = false;
      setIsAdding(false);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleToggle = (id: number) => {
    const todo = todos.find((t) => t.id === id);
    onToggleTodo(id);
    if (todo) {
      toast({
        title: todo.done ? '할 일을 미완료로 변경했습니다' : '할 일을 완료했습니다 🎉',
        duration: 2000,
      });
    }
  };

  const handleDelete = (id: number) => {
    onDeleteTodo(id);
    toast({
      title: '할 일이 삭제되었습니다',
      duration: 2000,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />
      <div className="absolute bottom-0 left-0 w-full min-h-[30%] max-h-[60%] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up">
        <div className="relative p-5 border-b border-neutral-100 text-center font-bold text-[16px]">
          할 일 목록
          <button
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticky Input Section */}
        <div className="sticky top-0 bg-white px-4 pt-4 pb-4 border-b border-neutral-100 z-10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-[#FF5722]/30"
              placeholder="사장님께 방문 일정 문자 남기기 ..."
            />
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white border-none rounded-xl font-bold hover:bg-[#F4511E] transition-colors text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              추가
            </button>
          </div>
        </div>

        {/* Scrollable Todo List */}
        <div
          className={`flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 touch-pan-y min-h-[150px] ${todos.length === 0 ? 'flex items-center justify-center' : ''}`}
        >
          {todos.length === 0 ? (
            <div className="text-center px-6">
              <p className="text-[15px] text-neutral-500 font-medium">확인해야 할 일이 없어요</p>
            </div>
          ) : (
            <div className="space-y-0 w-full px-6 py-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center py-3 border-b border-neutral-100 last:border-none"
                >
                  <div
                    onClick={() => handleToggle(todo.id)}
                    className={`w-[22px] h-[22px] border-2 rounded-full mr-3 cursor-pointer flex items-center justify-center transition-all ${
                      todo.done
                        ? 'bg-orange-50 border-[#FF5722] scale-110'
                        : 'border-neutral-300 hover:border-[#FF5722]/50'
                    }`}
                  >
                    {todo.done && <Check className="w-3 h-3 text-[#FF5722]" />}
                  </div>
                  <div
                    className={`flex-1 text-[15px] transition-all ${todo.done ? 'line-through text-neutral-400' : 'text-[#333]'}`}
                  >
                    {todo.text}
                  </div>
                  <div
                    onClick={() => handleDelete(todo.id)}
                    className="text-neutral-300 cursor-pointer p-1.5 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
