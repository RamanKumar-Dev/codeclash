"use client";

import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { ArrowLeft, Check, X, Heart, Shield, Sword, Clock, Zap, Eye, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface BattleArenaEnhancedProps {
  battleId: string;
  player: BattlePlayer;
  opponent: BattlePlayer;
  puzzle: {
    id: string;
    title: string;
    description: string;
    difficulty: number;
    lore?: string;
  };
  onSubmission: (code: string, language: string) => Promise<SubmissionResult>;
  onSpellCast: (spellId: string) => Promise<void>;
  onLeaveBattle: () => void;
  spectators?: number;
}

export default function BattleArenaEnhanced({
  battleId,
  player,
  opponent,
  puzzle,
  onSubmission,
  onSpellCast,
  onLeaveBattle,
  spectators = 0,
}: BattleArenaEnhancedProps) {
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>("");
  const [runningCode, setRunningCode] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [battleStatus, setBattleStatus] = useState<'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED'>('WAITING');
  const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
  const [spellCooldowns, setSpellCooldowns] = useState<Record<string, number>>({});
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);
  const [showLore, setShowLore] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  useEffect(() => {
    const savedCode = localStorage.getItem(`battle_code_${battleId}`);
    const savedLang = localStorage.getItem(`battle_lang_${battleId}`);
    if (savedCode) setCode(savedCode);
    if (savedLang) setLanguage(savedLang);

    setAvailableSpells(getDefaultSpells());
  }, [battleId]);

  useEffect(() => {
    localStorage.setItem(`battle_code_${battleId}`, code);
    localStorage.setItem(`battle_lang_${battleId}`, language);
  }, [code, language, battleId]);

  useEffect(() => {
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
      
      const damage = calculateDamage(result, timeRemaining);
      
      // Visual feedback for damage
      if (damage > 0) {
        showDamageAnimation(damage);
      }
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setRunningCode(false);
      setBattleStatus('ACTIVE');
    }
  }, [code, language, runningCode, battleStatus, onSubmission, timeRemaining]);

  const handleSpellCast = useCallback(async (spellId: string) => {
    if (spellCooldowns[spellId] > 0) return;

    try {
      await onSpellCast(spellId);
      
      const spell = availableSpells.find((s) => s.id === spellId);
      if (spell) {
        setSpellCooldowns((prev) => ({
          ...prev,
          [spellId]: spell.cooldown,
        }));
      }
      
      setSelectedSpell(null);
      showSpellEffect(spellId);
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

  const showDamageAnimation = (damage: number) => {
    // Create floating damage number
    const damageElement = document.createElement('div');
    damageElement.className = 'fixed text-red-500 font-bold text-2xl pointer-events-none z-50 animate-bounce';
    damageElement.textContent = `-${damage}`;
    damageElement.style.left = '50%';
    damageElement.style.top = '50%';
    damageElement.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(damageElement);
    
    setTimeout(() => {
      document.body.removeChild(damageElement);
    }, 1000);
  };

  const showSpellEffect = (spellId: string) => {
    // Add spell casting animation
    const spellElement = document.createElement('div');
    spellElement.className = 'fixed text-purple-400 font-bold text-xl pointer-events-none z-50 animate-pulse';
    spellElement.textContent = `✨ ${getSpellName(spellId)}`;
    spellElement.style.left = '50%';
    spellElement.style.top = '30%';
    spellElement.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(spellElement);
    
    setTimeout(() => {
      document.body.removeChild(spellElement);
    }, 2000);
  };

  const getSpellName = (spellId: string): string => {
    const spell = availableSpells.find(s => s.id === spellId);
    return spell?.name || spellId;
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Top Bar - Enhanced with Spectator Count */}
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
            {puzzle.lore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLore(!showLore)}
                className="text-purple-400 hover:text-purple-300"
              >
                📖 {showLore ? 'Hide' : 'Show'} Lore
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {spectators > 0 && (
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                <Eye className="w-3 h-3 mr-1" />
                {spectators} Spectators
              </Badge>
            )}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{player.username}</span>
              <span className="text-sm">{player.hp}/{player.maxHp} HP</span>
            </div>
            <Progress 
              value={(player.hp / player.maxHp) * 100} 
              className="h-3 bg-gray-700"
            />
          </div>

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
          {/* Left Panel - Enhanced Problem Display */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full bg-gray-800 p-6 overflow-y-auto">
              {showLore && puzzle.lore ? (
                <Card className="mb-4 bg-purple-900/20 border-purple-700">
                  <div className="p-4">
                    <div className="text-sm text-purple-300 italic">
                      {puzzle.lore}
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdownNoSSR remarkPlugins={[remarkGfm]}>
                    {puzzle.description}
                  </ReactMarkdownNoSSR>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Enhanced Code Editor */}
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
                        <Zap className="w-4 h-4 mr-2 animate-spin" />
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

              {/* Bottom Panel - Enhanced Output and Spells */}
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
