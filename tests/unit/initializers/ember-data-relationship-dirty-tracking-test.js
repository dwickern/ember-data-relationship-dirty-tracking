import Application from '@ember/application';

import config from 'dummy/config/environment';
import { initialize } from 'dummy/initializers/ember-data-relationship-dirty-tracking';
import { module, test } from 'qunit';
import Resolver from 'ember-resolver';
import { run } from '@ember/runloop';
import Model from '@ember-data/model';
import RelationshipDirtyTrackingRecordData from 'ember-data-relationship-dirty-tracking/record-data';

module('Unit | Initializer | ember-data-relationship-dirty-tracking', function (hooks) {
  hooks.beforeEach(function () {
    this.TestApplication = class TestApplication extends Application {
      modulePrefix = config.modulePrefix;
      podModulePrefix = config.podModulePrefix;
      Resolver = Resolver;
    };

    this.TestApplication.initializer({
      name: 'initializer under test',
      initialize,
    });

    this.application = this.TestApplication.create({
      autoboot: false,
    });
  });

  hooks.afterEach(function () {
    run(this.application, 'destroy');
  });

  test('register custom RecordData implementation', async function (assert) {
    await this.application.boot();
    const app = this.application.buildInstance();
    const store = app.lookup('service:store');

    class Test extends Model {}
    app.register('model:test', Test);

    const recordData = store.recordDataFor({ type: 'test', id: 1 });
    assert.true(recordData instanceof RelationshipDirtyTrackingRecordData);
  });
});
