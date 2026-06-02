/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, RotateCcw, GripVertical, Sparkles, Send, Loader2, Bot, AlertCircle, HelpCircle } from 'lucide-react';

interface KanbanState {
  todo: string[];
  doing: string[];
  done: string[];
}

const DEFAULT_STATE: KanbanState = {
  todo: ['優化使用者介面設計', '研究 React 性能優化', '準備週會簡報'],
  doing: ['開發 Kanban 核心功能'],
  done: ['專案初始化']
};

const AI_PRESETS = [
  {
    label: '📋 任務拆解',
    prompt: '幫我把目前待辦事項中的複雜任務，細緻拆解為 3-5 個具體、小巧且可立即執行的子行動步驟。'
  },
  {
    label: '⚡ 效率診斷',
    prompt: '分析我目前的 Kanban 看板狀態，檢查是否有流程卡關（比如進行中任務太多、或缺乏規劃）並提出敏捷優化對策。'
  },
  {
    label: '💖 溫暖激勵',
    prompt: '根據我目前的任務看板進展（特別是已完成的成就），給我一句有力量的工作鼓勵，並提供一個提升今日專注力的心流小技巧。'
  }
];

export default function App() {
  const [state, setState] = useState<KanbanState>(() => {
    const saved = localStorage.getItem('kanban_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse kanban_data', e);
      }
    }
    return DEFAULT_STATE;
  });

  const [inputs, setInputs] = useState({
    todo: '',
    doing: '',
    done: ''
  });

  // AI Consultation States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('user_gemini_api_key') || '');
  const [showKey, setShowKey] = useState(false);

  // Drag and Drop States
  const [draggedCard, setDraggedCard] = useState<{ col: keyof KanbanState; index: number } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<keyof KanbanState | null>(null);
  const [dragOverCard, setDragOverCard] = useState<{ col: keyof KanbanState; index: number } | null>(null);

  // Keep localStorage updated when state changes
  useEffect(() => {
    localStorage.setItem('kanban_data', JSON.stringify(state));
  }, [state]);

  const handleAddTask = (col: keyof KanbanState) => {
    const value = inputs[col].trim();
    if (!value) return;

    setState(prev => ({
      ...prev,
      [col]: [...prev[col], value]
    }));

    setInputs(prev => ({
      ...prev,
      [col]: ''
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, col: keyof KanbanState) => {
    if (e.key === 'Enter') {
      handleAddTask(col);
    }
  };

  const handleInputChange = (col: keyof KanbanState, val: string) => {
    setInputs(prev => ({
      ...prev,
      [col]: val
    }));
  };

  const moveTask = (col: keyof KanbanState, index: number, dir: -1 | 1) => {
    const columns: (keyof KanbanState)[] = ['todo', 'doing', 'done'];
    const currentIndex = columns.indexOf(col);
    const targetIndex = currentIndex + dir;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const targetCol = columns[targetIndex];

    setState(prev => {
      const sourceList = [...prev[col]];
      const [task] = sourceList.splice(index, 1);
      const targetList = [...prev[targetCol], task];
      return {
        ...prev,
        [col]: sourceList,
        [targetCol]: targetList
      };
    });
  };

  const removeTask = (col: keyof KanbanState, index: number) => {
    setState(prev => {
      const list = [...prev[col]];
      list.splice(index, 1);
      return {
        ...prev,
        [col]: list
      };
    });
  };

  const handleReset = () => {
    if (window.confirm('確定要將看板重設為預設任務嗎？')) {
      setState(DEFAULT_STATE);
      setInputs({ todo: '', doing: '', done: '' });
      setDraggedCard(null);
      setDragOverCol(null);
      setDragOverCard(null);
    }
  };

  const handleAiConsult = async (presetPrompt?: string) => {
    const promptToSend = (presetPrompt || aiPrompt).trim();
    if (!promptToSend) return;

    if (!userApiKey.trim()) {
      setAiError('未偵測到您的個人 Gemini API Key。為保障隱私並防範金鑰外洩，請先在畫面上方輸入您自有的 API Key。此金鑰僅會儲存於您的瀏覽器本機，不經由任何第三方伺服器傳輸或紀錄。');
      return;
    }

    setIsAiLoading(true);
    setAiError('');
    setAiResponse('');

    try {
      const response = await fetch('/api/ai/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': userApiKey.trim()
        },
        body: JSON.stringify({
          prompt: promptToSend,
          kanbanState: state
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '諮詢失敗，請檢查 API 金鑰或後端設定。');
      }

      const data = await response.json();
      setAiResponse(data.responseText);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || '無法連線至 AI 諮詢伺服器。');
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderAIResponse = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-sm text-zinc-300 leading-relaxed font-sans animate-fade-in">
        {lines.map((line, idx) => {
          let cleanLine = line.trim();
          if (!cleanLine) return <div key={idx} className="h-1.5"></div>;

          // Check if it's a list item
          const isBullet = cleanLine.startsWith('* ') || cleanLine.startsWith('- ');
          if (isBullet) {
            cleanLine = cleanLine.substring(2);
          }

          // Replace **bold** with strong elements
          const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
          const innerContent = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className="font-bold text-zinc-100">{part}</strong>;
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-[#E67E22] mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#E67E22]"></span>
                <span className="flex-grow text-zinc-300">{innerContent}</span>
              </div>
            );
          }

          return <p key={idx} className="mb-1">{innerContent}</p>;
        })}
      </div>
    );
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, col: keyof KanbanState, index: number) => {
    setDraggedCard({ col, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCol = (e: React.DragEvent, col: keyof KanbanState) => {
    e.preventDefault();
    if (dragOverCol !== col) {
      setDragOverCol(col);
    }
  };

  const handleDragLeaveCol = (col: keyof KanbanState) => {
    setDragOverCol(null);
  };

  const handleDragOverCard = (e: React.DragEvent, col: keyof KanbanState, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(col);
    if (dragOverCard?.col !== col || dragOverCard?.index !== index) {
      setDragOverCard({ col, index });
    }
  };

  const handleDragLeaveCard = () => {
    setDragOverCard(null);
  };

  const handleDropOnCol = (e: React.DragEvent, targetCol: keyof KanbanState) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverCard(null);

    if (!draggedCard) return;
    const { col: sourceCol, index: sourceIndex } = draggedCard;
    setDraggedCard(null);

    if (sourceCol === targetCol) {
      // Move to end of the same list
      setState(prev => {
        const list = [...prev[sourceCol]];
        const [task] = list.splice(sourceIndex, 1);
        list.push(task);
        return {
          ...prev,
          [sourceCol]: list
        };
      });
      return;
    }

    setState(prev => {
      const sourceList = [...prev[sourceCol]];
      const [task] = sourceList.splice(sourceIndex, 1);
      const targetList = [...prev[targetCol], task];
      return {
        ...prev,
        [sourceCol]: sourceList,
        [targetCol]: targetList
      };
    });
  };

  const handleDropOnCard = (e: React.DragEvent, targetCol: keyof KanbanState, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    setDragOverCard(null);

    if (!draggedCard) return;
    const { col: sourceCol, index: sourceIndex } = draggedCard;
    setDraggedCard(null);

    setState(prev => {
      const sourceList = [...prev[sourceCol]];
      const [task] = sourceList.splice(sourceIndex, 1);

      if (sourceCol === targetCol) {
        sourceList.splice(targetIndex, 0, task);
        return {
          ...prev,
          [sourceCol]: sourceList
        };
      } else {
        const targetList = [...prev[targetCol]];
        targetList.splice(targetIndex, 0, task);
        return {
          ...prev,
          [sourceCol]: sourceList,
          [targetCol]: targetList
        };
      }
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#121214] flex flex-col p-4 md:p-8 font-sans select-none" id="app_container">
      {/* Header section with responsive layout */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4" id="app_header">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-zinc-100 tracking-tight font-bold" id="app_title">
            個人任務看板 <span className="text-sm font-sans font-normal text-zinc-500 ml-2 uppercase tracking-widest block sm:inline mt-1 sm:mt-0">Task Orchestrator</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end" id="app_meta">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-[#E67E22] bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-[6px] border border-zinc-800 transition-colors cursor-pointer"
            title="重設為預設任務"
            id="btn_reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重設看板</span>
          </button>
          <div className="text-xs text-zinc-500 font-mono bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800" id="status_indicator">
            STATUS: LOCAL_STORAGE_ACTIVE
          </div>
        </div>
      </header>

      {/* Gemini AI Consultation Panel */}
      <section className="mb-8 bg-[#1a1a1c] border border-zinc-800 rounded-[8px] p-4 md:p-6 shadow-sm flex flex-col lg:flex-row gap-6 items-stretch" id="gemini_consultation_section">
        {/* Left Part: Ask Question */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-[#E67E22]/10 p-2 rounded-lg text-[#E67E22] flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="w-full">
              <h2 className="text-lg font-bold text-zinc-100 font-sans flex items-center gap-1.5">
                AI 智慧敏捷教練
              </h2>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                隨時擷取您當前任務看板的所有進度（待辦、進行中、已完成），給予最即時、客製化的拆解建議與效率診斷。
              </p>
              
              {/* User API Key setting area with secure visual design and client persistence */}
              <div className="mt-3 flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-[#241c15] border border-[#4a3424] rounded-[6px] p-3 w-full" id="api_key_setting_bar">
                <span className="text-xs font-bold text-[#E67E22] whitespace-nowrap flex items-center gap-1.5" id="lbl_api_key">
                  🔑 您的 Gemini API Key：
                </span>
                <div className="relative flex-1 flex items-center gap-2" id="api_key_input_wrapper">
                  <input
                    type={showKey ? "text" : "password"}
                    value={userApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserApiKey(val);
                      localStorage.setItem('user_gemini_api_key', val);
                    }}
                    placeholder="請輸入您的個人金鑰 (AIzaSy...)"
                    className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 rounded-[4px] px-3 py-1.5 focus:ring-1 focus:ring-[#E67E22] focus:border-[#E67E22] outline-none font-mono"
                    id="input_user_api_key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-[#E67E22] bg-zinc-800 border border-zinc-700 hover:border-[#E67E22] rounded-[4px] transition-all cursor-pointer select-none whitespace-nowrap"
                    id="btn_toggle_key_visibility"
                  >
                    {showKey ? "隱藏" : "顯示"}
                  </button>
                  {userApiKey.trim() ? (
                    <span className="text-xs text-green-500 font-bold whitespace-nowrap flex items-center gap-1" id="key_status_active">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                      已設定金鑰
                    </span>
                  ) : (
                    <span className="text-xs text-[#E67E22] font-semibold whitespace-nowrap flex items-center gap-1" id="key_status_missing">
                      <span className="w-2 h-2 rounded-full bg-[#E67E22] inline-block animate-pulse"></span>
                      待設定金鑰
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 font-sans uppercase tracking-wider block">
              快速推薦諮詢點：
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAiPrompt(preset.prompt);
                    handleAiConsult(preset.prompt);
                  }}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-[6px] text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-850 hover:border-[#E67E22] hover:text-[#E67E22] hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex gap-2 pt-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAiConsult();
              }}
              placeholder="有新項目要規劃？或是想問任何敏捷專案管理問題...？"
              disabled={isAiLoading}
              className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 text-sm rounded-[6px] px-3.5 py-2.5 focus:ring-1 focus:ring-[#E67E22] focus:border-[#E67E22] text-zinc-100 outline-none transition-all placeholder-zinc-500 font-sans"
            />
            <button
              onClick={() => handleAiConsult()}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="bg-[#E67E22] hover:bg-[#d35400] text-white px-5 py-2.5 rounded-[6px] flex items-center justify-center gap-1.5 font-sans font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>諮詢</span>
            </button>
          </div>
        </div>

        {/* Right Part: Gemini Answer beside it */}
        <div className="lg:w-1/2 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-5 lg:pt-0 lg:pl-6 flex flex-col justify-between min-h-[180px]">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest font-sans">
              <Bot className="w-4 h-4 text-[#8cabcc]" />
              <span>教練解答與提示區</span>
            </div>
            {aiResponse && (
              <button 
                onClick={() => { setAiResponse(''); setAiPrompt(''); }}
                className="text-[10px] text-zinc-500 hover:text-[#E67E22] cursor-pointer underline transition-colors"
                id="btn_clear_ai"
              >
                清除內容
              </button>
            )}
          </div>

          <div className="flex-grow bg-[#141416] border border-zinc-800 rounded-[6px] p-4 overflow-y-auto max-h-[220px]" id="ai_response_box">
            {isAiLoading && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-zinc-500 text-xs gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#E67E22]" />
                <span className="font-sans animate-pulse tracking-wide font-medium">Gemini 正在讀取看板並深度研究最佳方案...</span>
              </div>
            )}
            
            {!isAiLoading && aiError && (
              <div className="bg-red-950/20 border border-red-900/50 rounded-[6px] p-3.5 text-red-400 text-xs flex gap-2 items-start animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                <div className="space-y-1">
                  <p className="font-bold text-red-300">連線或設定異常</p>
                  <p className="leading-relaxed">{aiError}</p>
                </div>
              </div>
            )}

            {!isAiLoading && !aiError && aiResponse && (
              <div className="prose max-w-none text-zinc-300 leading-relaxed text-sm">
                {renderAIResponse(aiResponse)}
              </div>
            )}

            {!isAiLoading && !aiError && !aiResponse && (
              <div className="h-full flex flex-col items-center justify-center py-6 text-zinc-500 text-center">
                <HelpCircle className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs font-sans font-medium text-zinc-400">尚無諮詢內容</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto leading-normal">
                  點擊左側推薦的快速諮詢按鈕，或是輸入自訂疑問。Gemini 將會依據您當前的看板狀態提供策略。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main columns responsive layout */}
      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 items-start" id="columns_grid">
        {/* Column 1: Todo */}
        <div 
          onDragOver={(e) => handleDragOverCol(e, 'todo')}
          onDragLeave={() => handleDragLeaveCol('todo')}
          onDrop={(e) => handleDropOnCol(e, 'todo')}
          className={`flex flex-col bg-zinc-900/60 border border-zinc-850 rounded-[6px] p-4 min-h-[450px] md:h-[calc(100vh-170px)] transition-all duration-200 ${
            dragOverCol === 'todo' ? 'bg-zinc-800/40 ring-2 ring-[#8cabcc]/40' : ''
          }`} 
          id="col_todo_container"
        >
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800" id="col_todo_header">
            <h2 className="font-bold text-zinc-300 tracking-wide font-sans">待辦事項</h2>
            <span id="count-todo" className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#8cabcc] text-zinc-950 transition-all duration-300">
              {state.todo.length}
            </span>
          </div>
          <div id="list-todo" className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px] md:max-h-none">
            {state.todo.length === 0 ? (
              <div className="text-center py-8 text-zinc-555 text-xs italic font-sans" id="todo_empty_tip">
                尚無待辦事項
              </div>
            ) : (
              state.todo.map((task, i) => {
                const isDragging = draggedCard?.col === 'todo' && draggedCard?.index === i;
                const isOver = dragOverCard?.col === 'todo' && dragOverCard?.index === i;
                return (
                  <div 
                    key={`todo-${i}`} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'todo', i)}
                    onDragEnd={() => { setDraggedCard(null); setDragOverCol(null); setDragOverCard(null); }}
                    onDragOver={(e) => handleDragOverCard(e, 'todo', i)}
                    onDragLeave={handleDragLeaveCard}
                    onDrop={(e) => handleDropOnCard(e, 'todo', i)}
                    className={`bg-zinc-900 border border-zinc-800 hover:border-zinc-750 p-3 rounded-[6px] group transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-[#8cabcc]' : ''
                    } ${
                      isOver ? 'border-t-2 border-t-[#E67E22] pt-2 scale-[1.01]' : ''
                    }`} 
                    id={`card-todo-${i}`}
                  >
                    <div className="flex gap-2 items-start mb-2" id={`card-content-todo-${i}`}>
                      <GripVertical className="w-4 h-4 text-zinc-600 mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0 group-hover:text-zinc-500 transition-colors" />
                      <div className="text-sm text-zinc-200 leading-relaxed font-sans font-medium break-all flex-grow font-medium">
                        {task}
                      </div>
                    </div>
                    <div className="flex justify-between items-center opacity-60 md:opacity-40 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/80" id={`card-opts-todo-${i}`}>
                      <div className="flex gap-1" id={`card-moves-todo-${i}`}>
                        {/* Left arrow hidden or disabled for Todo */}
                        <button
                          disabled
                          className="w-6 h-6 flex items-center justify-center text-zinc-600 bg-zinc-950/40 rounded cursor-not-allowed opacity-40"
                          id={`btn-left-todo-${i}`}
                        >
                          ‹
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTask('todo', i, 1); }}
                          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#E67E22] bg-zinc-850 rounded transition-colors cursor-pointer"
                          id={`btn-right-todo-${i}`}
                        >
                          ›
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTask('todo', i); }}
                        className="text-[10px] uppercase tracking-tighter text-red-400 hover:text-red-500 font-sans cursor-pointer"
                        id={`btn-delete-todo-${i}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800/80" id="todo_add_container">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputs.todo}
                onChange={(e) => handleInputChange('todo', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'todo')}
                id="input-todo"
                placeholder="新增任務..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-[6px] px-3 py-2 text-sm focus:ring-1 focus:ring-[#E67E22] focus:border-[#E67E22] text-zinc-200 outline-none transition-all placeholder-zinc-600 font-sans"
              />
              <button
                onClick={() => handleAddTask('todo')}
                className="bg-zinc-800 text-zinc-400 hover:text-white hover:bg-[#E67E22] w-10 h-9 border border-zinc-700/60 rounded-[6px] flex items-center justify-center transition-colors font-sans font-bold text-lg select-none cursor-pointer"
                id="btn-add-todo"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Doing */}
        <div 
          onDragOver={(e) => handleDragOverCol(e, 'doing')}
          onDragLeave={() => handleDragLeaveCol('doing')}
          onDrop={(e) => handleDropOnCol(e, 'doing')}
          className={`flex flex-col bg-zinc-900/60 border border-zinc-850 rounded-[6px] p-4 min-h-[450px] md:h-[calc(100vh-170px)] transition-all duration-200 ${
            dragOverCol === 'doing' ? 'bg-zinc-800/40 ring-2 ring-[#e6b222]/40' : ''
          }`} 
          id="col_doing_container"
        >
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800" id="col_doing_header">
            <h2 className="font-bold text-zinc-300 tracking-wide font-sans">進行中</h2>
            <span id="count-doing" className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#e6b222] text-zinc-950 transition-all duration-300">
              {state.doing.length}
            </span>
          </div>
          <div id="list-doing" className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px] md:max-h-none">
            {state.doing.length === 0 ? (
              <div className="text-center py-8 text-zinc-555 text-xs italic font-sans" id="doing_empty_tip">
                尚無進行中任務
              </div>
            ) : (
              state.doing.map((task, i) => {
                const isDragging = draggedCard?.col === 'doing' && draggedCard?.index === i;
                const isOver = dragOverCard?.col === 'doing' && dragOverCard?.index === i;
                return (
                  <div 
                    key={`doing-${i}`} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'doing', i)}
                    onDragEnd={() => { setDraggedCard(null); setDragOverCol(null); setDragOverCard(null); }}
                    onDragOver={(e) => handleDragOverCard(e, 'doing', i)}
                    onDragLeave={handleDragLeaveCard}
                    onDrop={(e) => handleDropOnCard(e, 'doing', i)}
                    className={`bg-zinc-900 border border-zinc-800 hover:border-zinc-750 p-3 rounded-[6px] group transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-[#e6b222]' : ''
                    } ${
                      isOver ? 'border-t-2 border-t-[#E67E22] pt-2 scale-[1.01]' : ''
                    }`} 
                    id={`card-doing-${i}`}
                  >
                    <div className="flex gap-2 items-start mb-2" id={`card-content-doing-${i}`}>
                      <GripVertical className="w-4 h-4 text-zinc-600 mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0 group-hover:text-zinc-500 transition-colors" />
                      <div className="text-sm text-zinc-200 leading-relaxed font-sans font-medium break-all flex-grow font-medium">
                        {task}
                      </div>
                    </div>
                    <div className="flex justify-between items-center opacity-60 md:opacity-40 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/80" id={`card-opts-doing-${i}`}>
                      <div className="flex gap-1" id={`card-moves-doing-${i}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTask('doing', i, -1); }}
                          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#E67E22] bg-zinc-850 rounded transition-colors cursor-pointer"
                          id={`btn-left-doing-${i}`}
                        >
                          ‹
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTask('doing', i, 1); }}
                          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#E67E22] bg-zinc-850 rounded transition-colors cursor-pointer"
                          id={`btn-right-doing-${i}`}
                        >
                          ›
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTask('doing', i); }}
                        className="text-[10px] uppercase tracking-tighter text-red-400 hover:text-red-500 font-sans cursor-pointer"
                        id={`btn-delete-doing-${i}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800/80" id="doing_add_container">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputs.doing}
                onChange={(e) => handleInputChange('doing', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'doing')}
                id="input-doing"
                placeholder="追蹤進度..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-[6px] px-3 py-2 text-sm focus:ring-1 focus:ring-[#E67E22] focus:border-[#E67E22] text-zinc-200 outline-none transition-all placeholder-zinc-600 font-sans"
              />
              <button
                onClick={() => handleAddTask('doing')}
                className="bg-zinc-800 text-zinc-400 hover:text-white hover:bg-[#E67E22] w-10 h-9 border border-zinc-700/60 rounded-[6px] flex items-center justify-center transition-colors font-sans font-bold text-lg select-none cursor-pointer"
                id="btn-add-doing"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Done */}
        <div 
          onDragOver={(e) => handleDragOverCol(e, 'done')}
          onDragLeave={() => handleDragLeaveCol('done')}
          onDrop={(e) => handleDropOnCol(e, 'done')}
          className={`flex flex-col bg-zinc-900/60 border border-zinc-850 rounded-[6px] p-4 min-h-[450px] md:h-[calc(100vh-170px)] transition-all duration-200 ${
            dragOverCol === 'done' ? 'bg-zinc-800/40 ring-2 ring-[#9ec2b1]/40' : ''
          }`} 
          id="col_done_container"
        >
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800" id="col_done_header">
            <h2 className="font-bold text-zinc-300 tracking-wide font-sans">已完成</h2>
            <span id="count-done" className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#9ec2b1] text-zinc-950 transition-all duration-300">
              {state.done.length}
            </span>
          </div>
          <div id="list-done" className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px] md:max-h-none">
            {state.done.length === 0 ? (
              <div className="text-center py-8 text-zinc-555 text-xs italic font-sans" id="done_empty_tip">
                尚未完成任何任務
              </div>
            ) : (
              state.done.map((task, i) => {
                const isDragging = draggedCard?.col === 'done' && draggedCard?.index === i;
                const isOver = dragOverCard?.col === 'done' && dragOverCard?.index === i;
                return (
                  <div 
                    key={`done-${i}`} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'done', i)}
                    onDragEnd={() => { setDraggedCard(null); setDragOverCol(null); setDragOverCard(null); }}
                    onDragOver={(e) => handleDragOverCard(e, 'done', i)}
                    onDragLeave={handleDragLeaveCard}
                    onDrop={(e) => handleDropOnCard(e, 'done', i)}
                    className={`bg-zinc-900 border border-zinc-800 hover:border-zinc-750 p-3 rounded-[6px] group transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-[#9ec2b1]' : ''
                    } ${
                      isOver ? 'border-t-2 border-t-[#E67E22] pt-2 scale-[1.01]' : ''
                    }`} 
                    id={`card-done-${i}`}
                  >
                    <div className="flex gap-2 items-start mb-2" id={`card-content-done-${i}`}>
                      <GripVertical className="w-4 h-4 text-zinc-600 mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0 group-hover:text-zinc-500 transition-colors" />
                      <div className="text-sm leading-relaxed font-sans font-medium break-all line-through decoration-zinc-700 text-zinc-500 flex-grow font-medium">
                        {task}
                      </div>
                    </div>
                    <div className="flex justify-between items-center opacity-60 md:opacity-40 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/80" id={`card-opts-done-${i}`}>
                      <div className="flex gap-1" id={`card-moves-done-${i}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTask('done', i, -1); }}
                          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#E67E22] bg-zinc-850 rounded transition-colors cursor-pointer"
                          id={`btn-left-done-${i}`}
                        >
                          ‹
                        </button>
                        {/* Right arrow hidden or disabled for Done */}
                        <button
                          disabled
                          className="w-6 h-6 flex items-center justify-center text-zinc-600 bg-zinc-950/40 rounded cursor-not-allowed opacity-40"
                          id={`btn-right-done-${i}`}
                        >
                          ›
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTask('done', i); }}
                        className="text-[10px] uppercase tracking-tighter text-red-500 hover:text-red-700 font-sans cursor-pointer"
                        id={`btn-delete-done-${i}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800/80" id="done_add_container">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputs.done}
                onChange={(e) => handleInputChange('done', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'done')}
                id="input-done"
                placeholder="記錄成就..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-[6px] px-3 py-2 text-sm focus:ring-1 focus:ring-[#E67E22] focus:border-[#E67E22] text-zinc-200 outline-none transition-all placeholder-zinc-600 font-sans"
              />
              <button
                onClick={() => handleAddTask('done')}
                className="bg-zinc-800 text-zinc-400 hover:text-white hover:bg-[#E67E22] w-10 h-9 border border-zinc-700/60 rounded-[6px] flex items-center justify-center transition-colors font-sans font-bold text-lg select-none cursor-pointer"
                id="btn-add-done"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
