import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import Pretender from 'pretender';

module('has-many', function (hooks) {
  setupTest(hooks);

  let store, server;
  hooks.beforeEach(function () {
    store = this.owner.lookup('service:store');
    server = new Pretender();
  });

  hooks.afterEach(function () {
    store = null;
    server.shutdown();
  });

  test('empty state', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.equal(post.comments.length, 0, 'comments are empty');
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [store.createRecord('comment')]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.set('comments', []);
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
  });

  test('modify the array', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
        relationships: {
          comments: {
            data: [
              {
                type: 'comment',
                id: '1',
              },
            ],
          },
        },
      },
      included: [
        {
          type: 'comment',
          id: '1',
        },
      ],
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');
    assert.equal(post.comments.length, 1, 'post has 1 comment');

    const comment = post.comments.firstObject;
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    const comment2 = store.createRecord('comment');
    post.comments.pushObject(comment2);
    assert.equal(post.comments.length, 2, 'post has 2 comments');
    assert.true(post.hasDirtyAttributes, 'post is dirty after adding to post.comments');

    const comment3 = store.createRecord('comment');
    post.comments.pushObject(comment3);
    assert.equal(post.comments.length, 3, 'post has 3 comments');
    assert.true(post.hasDirtyAttributes, 'post is still dirty after adding another to post.comments');

    post.comments.clear();
    assert.equal(post.comments.length, 0, 'post has 0 comments');
    assert.true(post.hasDirtyAttributes, 'post is still dirty after clearing post.comments');

    post.comments.pushObject(comment);
    assert.equal(post.comments.length, 1, 'post has 1 comment');
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
  });

  test.skip('rollback to empty', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.equal(post.comments.length, 0, 'comments are empty');
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [store.createRecord('comment')]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.rollbackAttributes();

    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
    assert.equal(post.comments.length, 0, 'comments are rolled back to empty');
  });

  test('save', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [comment]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    server.patch('/posts/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.equal(data.relationships?.comments?.data?.[0]?.id, comment.id, 'save payload should include the comment id');
      assert.false(post.hasDirtyAttributes, 'post is not dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await post.save();

    assert.equal(post.comments.firstObject, comment, 'comment is saved');
    assert.false(post.hasDirtyAttributes, 'post is clean after saving');
  });

  test('save returns a new array', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment1 = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const comment2 = store.push({
      data: {
        type: 'comment',
        id: '2',
      },
    });
    const comment3 = store.push({
      data: {
        type: 'comment',
        id: '3',
      },
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [comment1]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    server.patch('/posts/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.equal(data.relationships?.comments?.data?.[0]?.id, comment1.id, 'save payload should include the comment id');
      assert.false(post.hasDirtyAttributes, 'post is not dirty while save is in transit');
      data.relationships.comments.data = [
        { type: 'comments', id: comment2.id },
        { type: 'comments', id: comment3.id },
      ];
      return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ data })];
    });

    await post.save();

    assert.equal(post.comments.firstObject, comment2, 'post.comments has the new canonical comment returned by the server');
    assert.false(post.hasDirtyAttributes, 'post is clean after saving');

    post.set('comments', [comment1]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.set('comments', [comment2, comment3]);
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
  });
});
