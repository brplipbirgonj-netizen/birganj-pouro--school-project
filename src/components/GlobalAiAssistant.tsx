'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Send, 
  Loader2, 
  FileText, 
  UserCheck, 
  CreditCard, 
  GraduationCap, 
  Users, 
  Calendar, 
  ArrowRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useAuth } from '@/hooks/useAuth';
import { useFirestore } from '@/firebase';
import { addNotice } from '@/lib/notice-data';
import { usePathname, useRouter } from 'next/navigation';
import { runUniversalAi, ChatMessage, UniversalAiOutput } from '@/ai/flows/universal-ai-flow';
import { useToast } from '@/hooks/use-toast';

export function GlobalAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: 'আসসালামু আলাইকুম! আমি বিদ্যালয়ের কেন্দ্রীয় AI সহকারী। আপনি যে কোনো সেকশনের কাজ বা তথ্য জানতে পারেন—যেমন নোটিশ তৈরি, উপস্থিতি, ফি, ছাত্র তথ্য ইত্যাদি।'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<UniversalAiOutput['actionData'] | null>(null);
  const [lastActionType, setLastActionType] = useState<string | null>(null);

  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();
  const { user } = useAuth();
  const db = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Don't show in print view or if not needed
  if (typeof window !== 'undefined' && pathname === '/login') {
    return null;
  }

  const handleSend = async (customPrompt?: string) => {
    const queryToSend = customPrompt || inputQuery;
    if (!queryToSend.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: queryToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputQuery('');
    setLoading(true);
    const lowerQuery = queryToSend.trim().toLowerCase();
    
    // Quick local navigation fallback for instant zero-latency redirect
    const quickNavMap: Record<string, string> = {
      'হোম পেজ': '/',
      'হোমপেজ': '/',
      'হোম': '/',
      'home': '/',
      'ড্যাশবোর্ড': '/',
      'নোটিশ বোর্ড': '/notices-management',
      'নোটিশ': '/notices-management',
      'হিসাব': '/accounts',
      'ফি': '/accounts',
      'হাজিরা': '/attendance',
      'উপস্থিতি': '/attendance',
      'ছাত্র তালিকা': '/student-list',
      'রেজাল্ট': '/results',
      'ফলাফল': '/results',
      'শিক্ষক': '/staff',
      'রুটিন': '/routines',
    };

    if (quickNavMap[lowerQuery]) {
      const targetPath = quickNavMap[lowerQuery];
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: `আপনাকে সংশ্লিষ্ট পেজে নিয়ে যাওয়া হচ্ছে...` }
      ]);
      setLoading(false);
      router.push(targetPath);
      toast({
        title: 'পেজ পরিবর্তন করা হচ্ছে...',
        description: targetPath,
      });
      return;
    }

    try {
      const result = await runUniversalAi({
        query: queryToSend,
        academicYear: selectedYear,
        institutionName: schoolInfo.name || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়',
        currentPage: pathname,
        chatHistory: messages,
      });

      const aiMsg: ChatMessage = { role: 'ai', text: result.response };
      setMessages(prev => [...prev, aiMsg]);

      if (result.actionType && result.actionType !== 'CHAT') {
        setLastActionType(result.actionType);
        setLastAction(result.actionData || null);
      }

      // Handle direct page navigation if requested
      if (result.actionType === 'NAVIGATE' && result.actionData?.path) {
        router.push(result.actionData.path);
        toast({
          title: 'পেজ পরিবর্তন করা হচ্ছে...',
          description: result.actionData.path,
        });
      }
    } catch (err: any) {
      console.error('Universal AI Error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: 'দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishNotice = async () => {
    if (!db || !user || !lastAction?.title || !lastAction?.content) return;
    try {
      addNotice(db, {
        title: lastAction.title,
        content: lastAction.content,
        priority: lastAction.priority || 'normal',
        senderName: user.displayName || user.email || 'প্রধান শিক্ষক',
        isScrolling: true,
      });
      toast({
        title: 'নোটিশ প্রকাশিত হয়েছে! ✅',
        description: 'নোটিশ বোর্ডে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।',
      });
      setLastAction(null);
      setLastActionType(null);
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: '✅ আপনার নোটিশটি সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে।' }
      ]);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: 'নোটিশ সংরক্ষণ করা যায়নি।',
      });
    }
  };

  const quickPrompts = [
    { label: 'নোটিশ ড্রাফট', query: 'আজকের একটি জরুরি নোটিশের খসড়া তৈরি করো', icon: FileText },
    { label: 'উপস্থিতি তথ্য', query: 'আজকের শ্রেণিভিত্তিক হাজিরা অবস্থা কেমন?', icon: UserCheck },
    { label: 'বকেয়া ফি', query: 'ফি আদায় ও বকেয়ার সারাংশ দাও', icon: CreditCard },
    { label: 'ছুটির তালিকা', query: 'এই শিক্ষাবর্ষের পরবর্তী ছুটিগুলো কবে?', icon: Calendar },
    { label: 'ছাত্র তথ্য', query: 'বিদ্যালয়ের ছাত্রছাত্রী ও সেকশন সম্পর্কিত তথ্য দাও', icon: Users },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 no-print flex flex-col items-end gap-2">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/20"
            title="AI সহকারী ওপেন করুন"
          >
            <div className="relative">
              <Bot className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <span className="font-kalpurush font-black text-sm tracking-wide pr-1">
              AI সহকারী
            </span>
            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
          </button>
        )}

        {/* Chat Portal Modal */}
        {isOpen && (
          <div 
            className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-indigo-200 overflow-hidden font-kalpurush transition-all duration-300 ${
              isExpanded 
                ? 'w-[95vw] md:w-[720px] h-[88vh] max-h-[850px]' 
                : 'w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh]'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                  <Bot className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base leading-tight">AI মাল্টি-ফাংশন সহকারী</h3>
                    <Badge variant="outline" className="text-[10px] bg-white/10 text-emerald-300 border-emerald-400/30 px-1.5 py-0">
                      সক্রিয়
                    </Badge>
                  </div>
                  <p className="text-[11px] text-indigo-200 font-bold mt-0.5">
                    {schoolInfo.name || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'} • {selectedYear} সেশন
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title={isExpanded ? 'সংক্ষিপ্ত করুন' : 'বড় করুন'}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title="বন্ধ করুন"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="bg-indigo-50/70 border-b border-indigo-100 p-2 overflow-x-auto flex gap-1.5 scrollbar-none">
              {quickPrompts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.query)}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-[11px] font-black bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm transition-all"
                  >
                    <Icon className="h-3 w-3" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-sm">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-normal'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {/* Action Preview Card (For Notice Draft or other actions) */}
              {lastActionType === 'NOTICE_DRAFT' && lastAction && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-amber-700" /> নোটিশ ড্রাফট প্রস্তুত
                    </span>
                    <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 text-[10px]">
                      এক ক্লিকে প্রকাশ
                    </Badge>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                    <h4 className="font-black text-sm text-slate-900">{lastAction.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{lastAction.content}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handlePublishNotice}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-4"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> নোটিশ প্রকাশ করুন
                    </Button>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-none p-3.5 shadow-sm flex items-center gap-2 text-indigo-700 font-bold text-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span>AI চিন্তা করছে এবং তথ্য যাচাই করছে...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
              <Input
                placeholder="বাংলায় যেকোনো প্রশ্ন লিখুন বা কাজের নির্দেশ দিন..."
                value={inputQuery}
                onChange={e => setInputQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={loading}
                className="flex-1 font-medium text-xs md:text-sm h-10 border-indigo-200 focus-visible:ring-indigo-600"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !inputQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 font-black text-xs shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
