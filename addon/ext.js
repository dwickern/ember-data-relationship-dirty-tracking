import Store from '@ember-data/store';
import DirtyTrackingRecordData from './record-data';

Store.reopen({
  createRecordDataFor(type, id, lid, storeWrapper) {
    const identifier = this.identifierCache.getOrCreateRecordIdentifier({ type, id, lid });
    return new DirtyTrackingRecordData(identifier, storeWrapper);
  },
});
