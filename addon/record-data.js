// import Store from '@ember-data/store';
// import SingletonMixin, { ID } from 'web/serializers/singleton';
// import { assert } from '@ember/debug';
// import FragmentRecordData from 'ember-data-model-fragments/record-data';
// import { InternalModel, recordIdentifierFor } from '@ember-data/store/-private';
import { RecordData, graphFor } from '@ember-data/record-data/-private';
import require from 'require';

let BaseRecordData;
try {
  // eslint-disable-next-line no-import-assign
  BaseRecordData = require('ember-data-model-fragments/record-data').default;
} catch (e) {
  BaseRecordData = RecordData;
}

// debugger;
// InternalModel.reopen({
//   setDirtyBelongsTo(key, value) {
//     debugger;
//     return super.setDirtyBelongsTo(key, value);
//
//     const currentValue = this._recordData.getAttr(key);
//
//     if (currentValue !== value) {
//       this._recordData.setDirtyAttribute(key, value);
//
//       const isDirty = this._recordData.isAttrDirty(key);
//
//       this.send('didSetProperty', {
//         name: key,
//         isDirty: isDirty,
//       });
//     }
//
//     return value;
//   },
// });

/**
 * Compare array contents by shallow value equality
 */
function isArrayEqual(a, b) {
  if (a === b) return true;
  // if (a == null && b == null) return true;
  // if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default class DirtyTrackingRecordData extends BaseRecordData {
  // constructor(identifier, store) {
  //   super(identifier, store);
  //   // const { type, id, lid } = identifier;
  //   // debugger;
  //   // this._internalModel = this.storeWrapper._store._internalModelForId(type, id, lid);
  // }

  // get _internalModel() {
  // }

  // _notify(name, isDirty) {
  //   const { type, id, lid } = this.identifier;
  //   const internalModel = this.storeWrapper._store._internalModelForId(type, id, lid);
  //   internalModel.send('didSetProperty', { name, isDirty });
  // }

  _notifyStateChange(key) {
    // const { type, id, lid } = this.identifier;
    // this.storeWrapper.notifyStateChange(type, id, lid, key);
    this.storeWrapper.notifyStateChange(this.modelName, this.id, this.clientId, key);
  }

  // _notifyBelongsToChange(key) {
  //   this.storeWrapper.notifyBelongsToChange(this.modelName, this.id, this.clientId, key);
  // }

  _makeIdentifier(resource) {
    return this.storeWrapper.identifierCache.getOrCreateRecordIdentifier(resource);
  }

  _getRelationshipData(data) {
    const result = Object.create(null);
    if (data?.relationships) {
      const relationships = this.storeWrapper.relationshipsDefinitionFor(this.modelName);
      for (const relationship of Object.values(relationships)) {
        const relationshipName = relationship.name;
        const relationshipData = data.relationships[relationshipName];
        if (relationshipData?.data == null) {
          continue;
        }
        if (relationship.kind === 'hasMany') {
          result[relationshipName] = relationshipData.data.map((resource) => this._makeIdentifier(resource));
        } else if (relationship.kind === 'belongsTo') {
          result[relationshipName] = this._makeIdentifier(relationshipData.data);
        }
      }
    }
    return result;
  }

  pushData(data, calculateChange) {
    Object.assign(this._relationshipData, this._getRelationshipData(data));

    // TODO: should we include relationships when we calculate the changedKeys?
    return super.pushData(data, calculateChange);
  }

  setDirtyBelongsTo(key, recordData) {
    super.setDirtyBelongsTo(key, recordData);

    const newValue = recordData?.identifier;
    this._relationships[key] = newValue;

    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key];
    // key in this._inFlightRelationships ? this._inFlightRelationships[key] : this._relationshipData[key];
    const isDirty = newValue !== originalValue;
    if (!isDirty) {
      delete this._relationships[key];
    }
    this._notifyStateChange(key, isDirty);

    // const inverse = this.storeWrapper.inverseForRelationship(this.modelName, key);
    // if (inverse != null) {
    //   recordData._notify(inverse, isDirty);
    // }
  }

  setDirtyHasMany(key, recordDatas) {
    super.setDirtyHasMany(key, recordDatas);

    // const currentValue = this._relationships[key] ?? originalValue;
    // const originalValue = this.getRel(key) ?? [];
    const newValue = recordDatas.map((rd) => rd.identifier);
    this._relationships[key] = newValue;

    // const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const isDirty = !isArrayEqual(newValue, originalValue);
    if (!isDirty) {
      delete this._relationships[key];
    }
    this._notifyStateChange(key, isDirty);
    // this._internalModel.send('didSetProperty', {
    //   name: key,
    //   isDirty: isDirty,
    // });
  }

  addToHasMany(key, recordDatas, idx) {
    // debugger;
    super.addToHasMany(key, recordDatas, idx);

    if (idx == null || recordDatas.length > 1) {
      debugger;
    }

    // const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const currentValue = this._relationships[key] ?? originalValue;
    const newValue = currentValue.slice();
    newValue.splice(idx, 0, ...recordDatas.map((rd) => rd.identifier));
    this._relationships[key] = newValue;

    const isDirty = !isArrayEqual(newValue, originalValue);
    if (!isDirty) {
      delete this._relationships[key];
    }
    this._notifyStateChange(key, isDirty);
    // this._relationships[key] = newValue;
    //
    // const isDirty = !isArrayEqual(newValue, originalValue);
    // if (!isDirty) {
    //   delete this._relationships[key];
    // }
    // this._notify(key, isDirty);
  }
  //
  // getRel(key) {
  //   if (key in this._relationships) {
  //     return this._relationships[key];
  //   } else if (key in this._inFlightRelationships) {
  //     return this._inFlightRelationships[key];
  //   } else {
  //     return this._relationshipData[key];
  //   }
  // }

  removeFromHasMany(key, recordDatas) {
    super.removeFromHasMany(key, recordDatas);

    const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const currentValue = this._relationships[key] ?? originalValue;
    // const originalValue = this._inFlightRelationships[key] ?? this._relationshipData[key] ?? [];
    const newValue = currentValue.filter((identifier) => !recordDatas.some((rd) => identifier === rd.identifier));
    this._relationships[key] = newValue;

    const isDirty = !isArrayEqual(newValue, originalValue);
    if (!isDirty) {
      delete this._relationships[key];
    }
    this._notifyStateChange(key, isDirty);
  }

  willCommit() {
    super.willCommit();
    this._inFlightRelationships = this._relationships;
    this._relationships = null;
  }

  didCommit(data) {
    const newCanonicalRelationships = this._getRelationshipData(data);
    Object.assign(this._relationshipData, this.__inFlightRelationships, newCanonicalRelationships);
    this._inFlightRelationships = null;

    // TODO: should we include relationships when we calculate the changedKeys?
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

  isEmpty() {
    // TODO: what is this for?
    // return super.isEmpty();
    return super.isEmpty() && this.__relationships === null && this.__inFlightRelationships === null && this.__relationshipData === null;
  }
  //
  // changedAttributes() {
  //   debugger;
  //   return super.changedAttributes();
  // }
  //
  // isAttrDirty(key) {
  //   debugger;
  //   return super.isAttrDirty(key);
  // }

  rollbackAttributes() {
    let dirtyKeys;
    if (this.hasChangedRelationships()) {
      dirtyKeys = Object.keys(this._relationships);
      this._relationships = null;
    }
    this._inFlightRelationships = null;
    const dirtyAttributeKeys = super.rollbackAttributes();
    // if (dirtyKeys) {
    //   dirtyKeys.forEach((key) => {
    //     this._notifyBelongsToChange(key);
    //   });
    // }

    if (dirtyAttributeKeys == null) return dirtyKeys;
    if (dirtyAttributeKeys[0] == null) return dirtyKeys; // HACK: for ember-data-model-fragments
    if (dirtyKeys == null) return dirtyAttributeKeys;
    // if (dirtyAttributeKeys?.[0] == null) return dirtyKeys;
    //
    // if (dirtyKeys == null) return dirtyAttributeKeys;
    // if (dirtyAttributeKeys == null) return dirtyKeys;
    return [...dirtyAttributeKeys, ...dirtyKeys];
  }

  hasChangedAttributes() {
    return super.hasChangedAttributes() || this.hasChangedRelationships();
  }

  hasChangedRelationships() {
    return this.__relationships !== null && Object.keys(this.__relationships).length > 0;
  }

  reset() {
    super.reset();
    this.__relationships = null;
    this.__inFlightRelationships = null;
    this.__relationshipData = null;
  }

  // isBelongsToDirty(key) {
  //   if (this._relationships[key] === undefined) {
  //     return false;
  //   }
  //   let originalValue;
  //   if (this._inFlightRelationships[key] !== undefined) {
  //     originalValue = this._inFlightRelationships[key];
  //   } else {
  //     originalValue = this._data[key];
  //   }
  //
  //   return originalValue !== this._relationships[key];
  // }

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
}
