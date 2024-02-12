import {
  setupApplicationTest as upstreamSetupApplicationTest,
  setupRenderingTest as upstreamSetupRenderingTest,
  setupTest as upstreamSetupTest,
} from 'ember-qunit';
import Pretender from 'pretender';

// This file exists to provide wrappers around ember-qunit's / ember-mocha's
// test setup functions. This way, you can easily extend the setup that is
// needed per test type.

function setupStore(hooks) {
  hooks.beforeEach(function () {
    this.store = this.owner.lookup('service:store');
  });

  hooks.afterEach(function () {
    this.store = undefined;
  });
}

function setupPretender(hooks) {
  hooks.beforeEach(function () {
    this.server = new Pretender();
  });

  hooks.afterEach(function () {
    this.server.shutdown();
    this.server = undefined;
  });
}

function setupApplicationTest(hooks, options) {
  upstreamSetupApplicationTest(hooks, options);

  // Additional setup for application tests can be done here.
  //
  // For example, if you need an authenticated session for each
  // application test, you could do:
  //
  // hooks.beforeEach(async function () {
  //   await authenticateSession(); // ember-simple-auth
  // });
  //
  // This is also a good place to call test setup functions coming
  // from other addons:
  //
  // setupIntl(hooks); // ember-intl
  // setupMirage(hooks); // ember-cli-mirage
}

function setupRenderingTest(hooks, options) {
  upstreamSetupRenderingTest(hooks, options);

  // Additional setup for rendering tests can be done here.
}

function setupTest(hooks, options) {
  upstreamSetupTest(hooks, options);

  // Additional setup for unit tests can be done here.
  setupStore(hooks);
  setupPretender(hooks);
}

export { setupApplicationTest, setupRenderingTest, setupTest };
