"use client";

import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { ArrowLeft, Check, CoinsIcon, Hash, Loader2, X, Heart, Shield, Sword, Clock, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import remarkGfm from "remark-gfm";
import { Button } from "~/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Progress } from "~/components/ui/progress";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

// Dynamically import CodeMirror with no SSR
const CodeMirrorNoSSR = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});
const ReactMarkdownNoSSR = dynamic(() => import("react-markdown"), {
  ssr: false,
});

interface TestCase {
  input: string;
  expected: string;
  output: string;
  result: boolean;
  runtimeError?: string;
}

interface SubmissionResult {
  passed: number;
  failed: number;
  total: number;
  runtimeMs: number;
  compileError?: string;
  runtimeError?: string;
}

interface BattlePlayer {
  userId: string;
  username: string;
  hp: number;
  maxHp: number;
  elo: number;
  currentCode: string;
  currentLanguage: string;
  isReady: boolean;
}

interface Spell {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  lastUsed?: Date;
  effect: {
    type: 'damage' | 'shield' | 'freeze' | 'hint' | 'double_damage' | 'debug' | 'wipe';
    value: number;
    duration?: number;
    target?: 'self' | 'opponent';
  };
}

interface BattleArenaProps {
  battleId: string;
  player: BattlePlayer;
  opponent: BattlePlayer;
  puzzle: {
    id: string;
    title: string;
    description: string;
    difficulty: number;
  };
  onSubmission: (code: string, language: string) => Promise<SubmissionResult>;
  onSpellCast: (spellId: string) => Promise<void>;
  onLeaveBattle: () => void;
}

export default function BattleArena({
  battleId,
  player,
  opponent,
  puzzle,
  onSubmission,
  onSpellCast,
  onLeaveBattle,
}: BattleArenaProps) {
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>("");
  const [runningCode, setRunningCode] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes
  const [battleStatus, setBattleStatus] = useState<'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED'>('WAITING');
  const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
  const [spellCooldowns, setSpellCooldowns] = useState<Record<string, number>>({});
  const [damageFeed, setDamageFeed] = useState<Array<{player: string; damage: number; timestamp: Date}>>([]);
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);

  const panelRef = useRef(null);

  useEffect(() => {
    // Load saved code and language
    const savedCode = localStorage.getItem(`battle_code_${battleId}`);
    const savedLang = localStorage.getItem(`battle_lang_${battleId}`);
    if (savedCode) setCode(savedCode);
    if (savedLang) setLanguage(savedLang);

    // Load available spells (this would come from user data)
    setAvailableSpells(getDefaultSpells());
  }, [battleId]);

  useEffect(() => {
    // Save code and language to localStorage
    localStorage.setItem(`battle_code_${battleId}`, code);
    localStorage.setItem(`battle_lang_${battleId}`, language);
  }, [code, language, battleId]);

  useEffect(() => {
    // Battle timer
    if (battleStatus !== 'ACTIVE') return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setBattleStatus('ENDED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [battleStatus]);

  useEffect(() => {
    // Spell cooldown timers
    const timer = setInterval(() => {
      setSpellCooldowns((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((spellId) => {
          if (updated[spellId] > 0) {
            updated[spellId]--;
          } else {
            delete updated[spellId];
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (runningCode || battleStatus !== 'ACTIVE') return;

    setRunningCode(true);
    setBattleStatus('JUDGING');

    try {
      const result = await onSubmission(code, language);
      setSubmissionResult(result);
      
      // Calculate damage (this would be done server-side)
      const damage = calculateDamage(result, timeRemaining);
      
      // Add to damage feed
      setDamageFeed((prev) => [
        ...prev,
        { player: player.username, damage, timestamp: new Date() },
      ]);

      // Update opponent HP (this would be handled by server)
      // opponent.hp = Math.max(0, opponent.hp - damage);
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setRunningCode(false);
      setBattleStatus('ACTIVE');
    }
  }, [code, language, runningCode, battleStatus, onSubmission, player.username, timeRemaining]);

  const handleSpellCast = useCallback(async (spellId: string) => {
    if (spellCooldowns[spellId] > 0) return;

    try {
      await onSpellCast(spellId);
      
      // Set cooldown
      const spell = availableSpells.find((s) => s.id === spellId);
      if (spell) {
        setSpellCooldowns((prev) => ({
          ...prev,
          [spellId]: spell.cooldown,
        }));
      }
      
      setSelectedSpell(null);
    } catch (error) {
      console.error('Spell cast failed:', error);
    }
  }, [availableSpells, spellCooldowns, onSpellCast]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getHpColor = (hp: number, maxHp: number): string => {
    const percentage = (hp / maxHp) * 100;
    if (percentage > 60) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Top Bar - HP Bars and Timer */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onLeaveBattle} className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave Battle
            </Button>
            <Badge variant="outline" className="border-purple-500 text-purple-400">
              {puzzle.title}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className={`font-mono font-bold ${timeRemaining < 30 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Badge variant={battleStatus === 'ACTIVE' ? 'default' : 'secondary'}>
              {battleStatus}
            </Badge>
          </div>
        </div>

        {/* HP Bars */}
        <div className="grid grid-cols-2 gap-8">
          {/* Player HP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{player.username}</span>
              <span className="text-sm">{player.hp}/{player.maxHp} HP</span>
            </div>
            <Progress 
              value={(player.hp / player.maxHp) * 100} 
              className="h-3 bg-gray-700"
              // Override the progress bar color
            />
          </div>

          {/* Opponent HP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{opponent.username}</span>
              <span className="text-sm">{opponent.hp}/{opponent.maxHp} HP</span>
            </div>
            <Progress 
              value={(opponent.hp / opponent.maxHp) * 100} 
              className="h-3 bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Main Battle Area */}
      <div className="flex-1 flex">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Problem Description */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full bg-gray-800 p-6 overflow-y-auto">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdownNoSSR remarkPlugins={[remarkGfm]}>
                  {puzzle.description}
                </ReactMarkdownNoSSR>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Code Editor */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col">
              {/* Editor Header */}
              <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectGroup>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                        <SelectItem value="c">C</SelectItem>
                        <SelectItem value="rust">Rust</SelectItem>
                        <SelectItem value="go">Go</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleSubmit} 
                    disabled={runningCode || battleStatus !== 'ACTIVE'}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {runningCode ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Submit ({calculateDamage(submissionResult || { passed: 0, failed: 0, total: 1, runtimeMs: 0 }, timeRemaining)} DMG)
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Length: {code.length}</span>
                </div>
              </div>

              {/* Code Editor */}
              <div className="flex-1 bg-gray-900">
                <CodeMirrorNoSSR
                  value={code}
                  onChange={setCode}
                  theme={dracula}
                  extensions={[loadLanguage(language as any)]}
                  height="100%"
                />
              </div>

              {/* Bottom Panel - Output and Spells */}
              <div className="bg-gray-800 border-t border-gray-700">
                <ResizablePanelGroup direction="horizontal">
                  {/* Output Panel */}
                  <ResizablePanel defaultSize={60}>
                    <div className="h-48 p-4 overflow-y-auto">
                      <h3 className="font-semibold mb-2 text-yellow-400">Output</h3>
                      {submissionResult ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            {submissionResult.passed === submissionResult.total ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-400" />
                            )}
                            <span>
                              Passed: {submissionResult.passed}/{submissionResult.total}
                            </span>
                            <span className="text-gray-400">
                              ({submissionResult.runtimeMs}ms)
                            </span>
                          </div>
                          
                          {submissionResult.compileError && (
                            <div className="bg-red-900/50 border border-red-500 p-2 rounded text-red-300 text-sm">
                              Compile Error: {submissionResult.compileError}
                            </div>
                          )}
                          
                          {submissionResult.runtimeError && (
                            <div className="bg-red-900/50 border border-red-500 p-2 rounded text-red-300 text-sm">
                              Runtime Error: {submissionResult.runtimeError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500">Run your code to see results</p>
                      )}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Spells Panel */}
                  <ResizablePanel defaultSize={40}>
                    <div className="h-48 p-4">
                      <h3 className="font-semibold mb-2 text-purple-400">Spells</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {availableSpells.map((spell) => (
                          <Button
                            key={spell.id}
                            variant={selectedSpell === spell.id ? "default" : "outline"}
                            size="sm"
                            disabled={spellCooldowns[spell.id] > 0}
                            onClick={() => selectedSpell === spell.id ? handleSpellCast(spell.id) : setSelectedSpell(spell.id)}
                            className="text-xs h-auto p-2 flex flex-col items-start"
                          >
                            <div className="font-semibold">{spell.name}</div>
                            <div className="text-xs opacity-75">{spell.description}</div>
                            {spellCooldowns[spell.id] > 0 && (
                              <div className="text-xs text-red-400">
                                Cooldown: {spellCooldowns[spell.id]}s
                              </div>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function getDefaultSpells(): Spell[] {
  return [
    {
      id: 'oracle_hint',
      name: 'Oracle Hint',
      description: 'Reveal a hidden test case',
      cooldown: 60,
      effect: {
        type: 'hint',
        value: 1,
        target: 'self',
      },
    },
    {
      id: 'time_freeze',
      name: 'Time Freeze',
      description: 'Pause timer for 15s',
      cooldown: 90,
      effect: {
        type: 'freeze',
        value: 15,
        duration: 15,
        target: 'self',
      },
    },
    {
      id: 'tower_shield',
      name: 'Tower Shield',
      description: 'Block 50 HP damage',
      cooldown: 120,
      effect: {
        type: 'shield',
        value: 50,
        target: 'self',
      },
    },
    {
      id: 'double_damage',
      name: 'Double Damage',
      description: '2x next submission',
      cooldown: 150,
      effect: {
        type: 'double_damage',
        value: 2,
        target: 'self',
      },
    },
  ];
}

function calculateDamage(result: SubmissionResult, battleTime: number): number {
  if (result.failed === result.total) return 0;
  
  const passRatio = result.passed / result.total;
  let damage = 20 * passRatio;
  
  // Speed bonus
  if (battleTime <= 30) damage *= 2.0;
  else if (battleTime <= 60) damage *= 1.5;
  else if (battleTime <= 120) damage *= 1.2;
  
  // Efficiency bonus
  if (result.runtimeMs <= 100) damage += 5;
  else if (result.runtimeMs <= 500) damage += 3;
  else if (result.runtimeMs <= 1000) damage += 1;
  
  // All-pass bonus
  if (result.passed === result.total) damage += 10;
  
  return Math.min(damage, 70);
}
