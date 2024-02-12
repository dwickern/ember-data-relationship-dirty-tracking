import { macroCondition, dependencySatisfies, importSync } from '@embroider/macros';
import { assert } from '@ember/debug';
import { isArray } from '@ember/array';

/**
 * The base RecordData class.
 *
 * If ember-data-model-fragments is installed, we extend its `FragmentRecordData`.
 * Otherwise, we extend ember-data's default `RecordData`.
 */
const RecordData = macroCondition(dependencySatisfies('ember-data-model-fragments', '*'))
  ? importSync('ember-data-model-fragments/record-data').default
  : importSync('@ember-data/record-data/-private').RecordData;

class BelongsToBehavior {
  pushData(storeWrapper, relationship) {
    if (relationship == null) {
      return null;
    }
    const { type, id } = relationship;
    return storeWrapper.recordDataFor(type, id);
  }
}

class HasManyBehavior {
  pushData(storeWrapper, relationships) {
    if (relationships == null) {
      return [];
    }
    return relationships.map(({ type, id }) => storeWrapper.recordDataFor(type, id));
  }
}

export default class RelationshipDirtyTrackingRecordData extends RecordData {
  constructor(identifier, storeWrapper) {
    super(identifier, storeWrapper);

    const behavior = Object.create(null);
    const definitions = this.storeWrapper.relationshipsDefinitionFor(this.modelName);
    for (const [key, definition] of Object.entries(definitions)) {
      assert(
        `Unsupported relationship type: ${definition.kind}`,
        definition.kind === 'hasMany' || definition.kind === 'belongsTo'
      );
      assert(
        `Unexpected dirtyTracking option: ${definition.options.dirtyTracking}`,
        definition.options.dirtyTracking === undefined || typeof definition.options.dirtyTracking === 'boolean'
      );
      if (definition.options.dirtyTracking === false) {
        // disable dirty tracking for this property
        continue;
      }
      behavior[key] = definition.kind === 'belongsTo' ? new BelongsToBehavior() : new HasManyBehavior();
    }
    this._relationshipDirtyTrackingBehavior = behavior;
  }

  pushData(data, calculateChange) {
    Object.assign(this._relationshipData, this._getRelationshipData(data));
    return super.pushData(data, calculateChange);
  }

  setDirtyBelongsTo(key, recordData) {
    super.setDirtyBelongsTo(key, recordData);

    if (!this._relationshipDirtyTrackingBehavior[key]) {
      // dirty tracking is disabled for this relationship
      return;
    }
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key];
    const newValue = recordData;
    const isDirty = newValue !== originalValue;
    this._setDirtyRelationship(key, isDirty, newValue);
  }

  setDirtyHasMany(key, recordDatas) {
    super.setDirtyHasMany(key, recordDatas);

    if (!this._relationshipDirtyTrackingBehavior[key]) {
      // dirty tracking is disabled for this relationship
      return;
    }
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const newValue = recordDatas;
    const isDirty = !isArrayEqual(newValue, originalValue);
    this._setDirtyRelationship(key, isDirty, newValue);
  }

  addToHasMany(key, recordDatas, idx) {
    super.addToHasMany(key, recordDatas, idx);

    if (!this._relationshipDirtyTrackingBehavior[key]) {
      // dirty tracking is disabled for this relationship
      return;
    }
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const oldValue = this._relationships[key] ?? originalValue;
    const newValue = oldValue.slice();
    newValue.splice(idx, 0, ...recordDatas);
    const isDirty = !isArrayEqual(newValue, originalValue);
    this._setDirtyRelationship(key, isDirty, newValue);
  }

  removeFromHasMany(key, recordDatas) {
    super.removeFromHasMany(key, recordDatas);

    if (!this._relationshipDirtyTrackingBehavior[key]) {
      // dirty tracking is disabled for this relationship
      return;
    }
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const oldValue = this._relationships[key] ?? originalValue;
    const newValue = arrayDiff(oldValue, recordDatas);
    const isDirty = !isArrayEqual(newValue, originalValue);
    this._setDirtyRelationship(key, isDirty, newValue);
  }

  _setDirtyRelationship(key, isDirty, value) {
    const oldDirty = this.isRelationshipDirty(key);
    if (isDirty) {
      this._relationships[key] = value;
    } else {
      delete this._relationships[key];
    }
    if (isDirty !== oldDirty) {
      this._notifyStateChange(key);
    }
  }

  willCommit() {
    super.willCommit();
    this._inFlightRelationships = this._relationships;
    this._relationships = null;
  }

  didCommit(data) {
    const newCanonicalRelationships = this._getRelationshipData(data);
    Object.assign(this._relationshipData, this._inFlightRelationships, newCanonicalRelationships);
    this._inFlightRelationships = null;
    return super.didCommit(data);
  }

  commitWasRejected(identifier, errors) {
    const keys = Object.keys(this._inFlightRelationships);
    if (keys.length > 0) {
      const relationships = this._relationships;
      for (let i = 0; i < keys.length; i++) {
        if (relationships[keys[i]] === undefined) {
          relationships[keys[i]] = this._inFlightRelationships[keys[i]];
        }
      }
    }
    this._inFlightRelationships = null;
    super.commitWasRejected(identifier, errors);
  }

  rollbackAttributes() {
    let dirtyRelationshipKeys;
    if (this.hasChangedRelationships()) {
      dirtyRelationshipKeys = Object.keys(this._relationships);
      this._relationships = null;
    }
    this._inFlightRelationships = null;
    return mergeChangedKeys(super.rollbackAttributes(), dirtyRelationshipKeys);
  }

  hasChangedAttributes() {
    return super.hasChangedAttributes() || this.hasChangedRelationships();
  }

  hasChangedRelationships() {
    return this.__relationships !== null && Object.keys(this.__relationships).length > 0;
  }

  isRelationshipDirty(key) {
    return this.__relationships?.[key] !== undefined;
  }

  reset() {
    super.reset();
    this.__relationships = null;
    this.__inFlightRelationships = null;
    this.__relationshipData = null;
  }

  get _relationshipData() {
    if (this.__relationshipData === null) {
      this.__relationshipData = Object.create(null);
    }
    return this.__relationshipData;
  }

  set _relationshipData(v) {
    this.__relationshipData = v;
  }

  get _relationships() {
    if (this.__relationships === null) {
      this.__relationships = Object.create(null);
    }
    return this.__relationships;
  }

  set _relationships(v) {
    this.__relationships = v;
  }

  get _inFlightRelationships() {
    if (this.__inFlightRelationships === null) {
      this.__inFlightRelationships = Object.create(null);
    }
    return this.__inFlightRelationships;
  }

  set _inFlightRelationships(v) {
    this.__inFlightRelationships = v;
  }
  _notifyStateChange(key) {
    this.storeWrapper.notifyStateChange(this.modelName, this.id, this.clientId, key);
  }

  _getRelationshipData(data) {
    const result = Object.create(null);
    for (const [key, behavior] of Object.entries(this._relationshipDirtyTrackingBehavior)) {
      const relationship = data?.relationships?.[key]?.data;
      result[key] = behavior.pushData(this.storeWrapper, relationship);
    }
    return result;
  }
}

/**
 * Compare array contents by shallow value equality
 */
function isArrayEqual(a, b) {
  assert('expected array for `a`', isArray(a));
  assert('expected array for `b`', isArray(b));
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function arrayDiff(a, b) {
  assert('expected array for `a`', isArray(a));
  assert('expected array for `b`', isArray(b));
  return a.filter((rd) => !b.includes(rd));
}

function mergeChangedKeys(a, b) {
  if (b == null) return a;
  if (a == null) return b;
  return [...a, ...b];
}
