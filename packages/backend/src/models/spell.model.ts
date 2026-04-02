import { Schema, model, Document } from 'mongoose';
import { Spell, UnlockCondition, SpellEffect } from '@code-clash/shared-types';

export interface ISpell extends Document, Omit<Spell, 'spellId'> {
  spellId: string;
  createdAt: Date;
  updatedAt: Date;
}

const UnlockConditionSchema = new Schema<UnlockCondition>({
  type: {
    type: String,
    required: true,
    enum: ['battles_won', 'elo_reached']
  },
  value: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const SpellEffectSchema = new Schema<SpellEffect>({
  type: {
    type: String,
    required: true,
    enum: ['oracle_hint', 'time_freeze', 'tower_shield', 'debug_ray', 'double_damage', 'code_wipe']
  },
  duration: {
    type: Number,
    min: 0
  },
  value: {
    type: Number,
    min: 0
  }
}, { _id: false });

const SpellSchema = new Schema<ISpell>({
  spellId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  icon: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  cooldownSeconds: {
    type: Number,
    required: true,
    min: 0
  },
  unlockCondition: {
    type: UnlockConditionSchema,
    required: true
  },
  effect: {
    type: SpellEffectSchema,
    required: true
  }
}, {
  timestamps: true,
  collection: 'spells'
});

SpellSchema.index({ 'unlockCondition.type': 1, 'unlockCondition.value': 1 });
SpellSchema.index({ 'effect.type': 1 });

export const SpellModel = model<ISpell>('Spell', SpellSchema);
