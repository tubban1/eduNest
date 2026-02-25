export type CommandId = string;
export type VariableName = string;
export type EventId = string;
export type ConditionId = string;
export type LoopId = string;

export interface CommandRule {
  id: CommandId;
  name: string; // 内部标识，如 "move" / "jump"
  displayName: string; // 给孩子看的名称，如 "跑步" / "跳跃"
  category: 'movement' | 'attack' | 'interaction' | 'other';
  params?: Record<string, number | string | boolean>;
}

export interface ConditionRule {
  id: ConditionId;
  description: string; // 自然语言说明
  if: string; // 简单表达式，如 "touch(monster)" / "fallInto(hole)"
  then: string[]; // 动作表达式，如 ["health -= 1", "gameOver()"]
}

export interface LoopRule {
  id: LoopId;
  description: string;
  everySeconds: number; // > 0 时生效
  actions: string[]; // 如 ["spawnMonster()"]
}

export interface VariableRule {
  name: VariableName;
  type: 'int' | 'float' | 'bool';
  initial: number | boolean;
  description?: string;
}

export interface EventRule {
  id: EventId;
  description: string;
  on:
    | { type: 'key_press'; key: string }
    | { type: 'pointer_tap' }
    | { type: 'collision'; with: 'monster' | 'item' | 'ground' | string };
  actions: string[]; // 如 ["jump()"]
}

export interface RulesJson {
  commands: CommandRule[];
  conditions: ConditionRule[];
  loops: LoopRule[];
  variables: VariableRule[];
  events: EventRule[];
}

export function createEmptyRules(): RulesJson {
  return {
    commands: [],
    conditions: [],
    loops: [],
    variables: [],
    events: [],
  };
}

export function createDefaultRunnerRules(): RulesJson {
  return {
    commands: [
      {
        id: 'cmd_move',
        name: 'move',
        displayName: '移动',
        category: 'movement',
        params: { speed: 1 },
      },
      {
        id: 'cmd_jump',
        name: 'jump',
        displayName: '跳跃',
        category: 'movement',
        params: { height: 1 },
      },
    ],
    variables: [
      { name: 'score', type: 'int', initial: 0, description: '得分' },
      { name: 'health', type: 'int', initial: 3, description: '生命值' },
      { name: 'gemCount', type: 'int', initial: 0, description: '宝石数量' },
    ],
    conditions: [
      {
        id: 'cond_hitMonster',
        description: '碰到怪物就扣一滴血',
        if: 'touch(monster)',
        then: ['health -= 1'],
      },
      {
        id: 'cond_fallHole',
        description: '掉到坑里就游戏结束',
        if: 'fallInto(hole)',
        then: ['gameOver()'],
      },
      {
        id: 'cond_collectGem',
        description: '吃到宝石得分',
        if: 'touch(gem)',
        then: ['gemCount += 1', 'score += 10'],
      },
    ],
    loops: [
      {
        id: 'loop_spawnMonster',
        description: '每 5 秒生成一只怪物',
        everySeconds: 5,
        actions: ['spawnMonster()'],
      },
    ],
    events: [
      {
        id: 'evt_spaceJump',
        description: '按空格键跳跃',
        on: { type: 'key_press', key: 'Space' },
        actions: ['jump()'],
      },
    ],
  };
}

