'use client';

import { type RulesJson, type CommandRule, type VariableRule } from '@/types/codingGame';
import { useMemo } from 'react';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export default function RuleTree({
  rules,
  onChange,
  disabled,
  highlightRuleText,
}: {
  rules: RulesJson | null;
  onChange: (next: RulesJson) => void;
  disabled?: boolean;
  highlightRuleText?: string | null;
}) {
  const safeRules: RulesJson = useMemo(
    () =>
      rules ?? {
        commands: [],
        conditions: [],
        loops: [],
        variables: [],
        events: [],
      },
    [rules]
  );

  const addCommand = () => {
    const next = clone(safeRules);
    const idx = next.commands.length + 1;
    const cmd: CommandRule = {
      id: `cmd_custom_${idx}`,
      name: `custom${idx}`,
      displayName: `自定义动作 ${idx}`,
      category: 'other',
      params: {},
    };
    next.commands.push(cmd);
    onChange(next);
  };

  const addVariable = () => {
    const next = clone(safeRules);
    const idx = next.variables.length + 1;
    const v: VariableRule = {
      name: `var${idx}`,
      type: 'int',
      initial: 0,
      description: `自定义变量 ${idx}`,
    };
    next.variables.push(v);
    onChange(next);
  };

  const updateVariableName = (i: number, name: string) => {
    const next = clone(safeRules);
    if (!next.variables[i]) return;
    next.variables[i].name = name;
    onChange(next);
  };

  const updateCommandDisplayName = (i: number, displayName: string) => {
    const next = clone(safeRules);
    if (!next.commands[i]) return;
    next.commands[i].displayName = displayName;
    onChange(next);
  };

  const removeCommand = (i: number) => {
    const next = clone(safeRules);
    next.commands.splice(i, 1);
    onChange(next);
  };

  const removeVariable = (i: number) => {
    const next = clone(safeRules);
    next.variables.splice(i, 1);
    onChange(next);
  };

  const updateVariableInitial = (i: number, value: string) => {
    const next = clone(safeRules);
    const target = next.variables[i];
    if (!target) return;
    if (target.type === 'bool') {
      target.initial = value === 'true';
    } else {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        target.initial = num;
      }
    }
    onChange(next);
  };

  const bumpVariableInitial = (i: number, delta: number) => {
    const next = clone(safeRules);
    const target = next.variables[i];
    if (!target) return;
    if (target.type === 'bool') {
      target.initial = !Boolean(target.initial);
    } else {
      const cur = typeof target.initial === 'number' ? target.initial : Number(target.initial) || 0;
      target.initial = cur + delta;
    }
    onChange(next);
  };

  const updateCommandParam = (i: number, key: string, value: number) => {
    const next = clone(safeRules);
    const cmd = next.commands[i];
    if (!cmd) return;
    if (!cmd.params) cmd.params = {};
    cmd.params[key] = value;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-medium text-slate-100">规则树</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={addCommand}
            disabled={disabled}
            className="px-2 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-[11px] disabled:opacity-50"
          >
            + 命令
          </button>
          <button
            type="button"
            onClick={addVariable}
            disabled={disabled}
            className="px-2 py-1 rounded-md border border-sky-500/40 bg-sky-500/10 text-[11px] disabled:opacity-50"
          >
            + 变量
          </button>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <div className="font-semibold text-slate-100 mb-1 text-xs">命令（玩家可以做什么）</div>
          {safeRules.commands.length === 0 && (
            <div className="text-[11px] text-slate-500">还没有命令。可以添加“移动”“跳跃”“攻击”等。</div>
          )}
          <div className="space-y-1">
            {safeRules.commands.map((cmd, i) => {
              const speed =
                typeof cmd.params?.speed === 'number' ? cmd.params!.speed : 1;
              const height =
                typeof cmd.params?.height === 'number' ? cmd.params!.height : 1;
              const showSpeed = cmd.name === 'move' || 'speed' in (cmd.params || {});
              const showHeight = cmd.name === 'jump' || 'height' in (cmd.params || {});

              return (
                <div
                  key={cmd.id}
                  className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1.5 space-y-1"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                      {cmd.name}
                    </span>
                    <span className="flex-1 text-xs text-slate-100 truncate">
                      {cmd.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCommand(i)}
                      disabled={disabled}
                      className="text-[10px] text-slate-500 hover:text-red-400 px-1"
                    >
                      ✕
                    </button>
                  </div>
                  {(showSpeed || showHeight) && (
                    <div className="flex flex-col gap-1 pl-1 pr-1 pt-0.5">
                      {showSpeed && (
                        <label className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="w-10">速度</span>
                          <input
                            type="range"
                            min={0.3}
                            max={3}
                            step={0.1}
                            value={speed}
                            disabled={disabled}
                            onChange={(e) =>
                              updateCommandParam(i, 'speed', Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <span className="w-8 text-right text-slate-300">
                            {speed.toFixed(1)}
                          </span>
                        </label>
                      )}
                      {showHeight && (
                        <label className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="w-10">跳跃</span>
                          <input
                            type="range"
                            min={0.5}
                            max={3}
                            step={0.1}
                            value={height}
                            disabled={disabled}
                            onChange={(e) =>
                              updateCommandParam(i, 'height', Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <span className="w-8 text-right text-slate-300">
                            {height.toFixed(1)}
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <div className="font-semibold text-slate-100 mb-1 text-xs">变量（游戏状态）</div>
          {safeRules.variables.length === 0 && (
            <div className="text-[11px] text-slate-500">还没有变量。可以添加“得分”“生命值”等。</div>
          )}
          <div className="space-y-1">
            {safeRules.variables.map((v, i) => (
              <div
                key={`${v.name}-${i}`}
                className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1"
              >
                <span className="w-20 text-xs text-slate-100 truncate">
                  {v.name}
                </span>
                <span className="text-[10px] text-slate-400">{v.type}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => bumpVariableInitial(i, -1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-200 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="min-w-[32px] text-center text-[11px] text-slate-100">
                    {String(v.initial)}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => bumpVariableInitial(i, 1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-200 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeVariable(i)}
                  disabled={disabled}
                  className="text-[10px] text-slate-500 hover:text-red-400 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <div className="font-semibold text-slate-100 mb-1 text-xs">条件 / 循环 / 事件</div>
          {safeRules.conditions.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              还没有条件规则。后续由 AI guide 生成和编辑。
            </div>
          ) : (
            <div className="space-y-1">
              {safeRules.conditions.map((c) => {
                const text = c.description || c.id;
                const active = highlightRuleText && text === highlightRuleText;
                return (
                  <div
                    key={c.id}
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      active
                        ? 'border-amber-400/60 bg-amber-500/10 text-slate-100'
                        : 'border-slate-800 bg-slate-950/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{text}</span>
                      {active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                          触发中
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      if: {c.if} → then: {(c.then || []).join('; ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-2">
            统计：{safeRules.conditions.length} 条条件、{safeRules.loops.length} 个循环、{safeRules.events.length} 个事件。
          </div>
        </section>
      </div>
    </div>
  );
}

