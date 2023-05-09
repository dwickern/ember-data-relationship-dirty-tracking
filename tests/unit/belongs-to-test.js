import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { setupApplicationTest } from 'ember-qunit';
import Pretender from 'pretender';

module('belongs-to', function (hooks) {
  setupApplicationTest(hooks);

  let store, server;
  hooks.beforeEach(function () {
    store = this.owner.lookup('service:store');
    server = new Pretender();
  });

  hooks.afterEach(function () {
    store = null;
    server.shutdown();
  });

  test('null relationship', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.equal(comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', null);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('explicit null relationship', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
        relationships: {
          post: {
            data: null,
          },
        },
      },
    });
    assert.equal(comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', null);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('change the relationship value', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
        relationships: {
          post: {
            data: {
              type: 'post',
              id: '1',
            },
          },
        },
      },
      included: [
        {
          type: 'post',
          id: '1',
        },
      ],
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');
    assert.false(comment.post.hasDirtyAttributes, 'post is initially clean');

    const originalPost = comment.post;
    comment.set('post', store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', originalPost);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('change attribute of the related model', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
        relationships: {
          post: {
            data: {
              type: 'post',
              id: '1',
            },
          },
        },
      },
      included: [
        {
          type: 'post',
          id: '1',
        },
      ],
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');
    assert.false(comment.post.hasDirtyAttributes, 'post is initially clean');

    comment.post.set('title', 'new post title');
    assert.true(comment.post.hasDirtyAttributes, 'post is dirty');
    assert.false(comment.hasDirtyAttributes, 'comment is still clean');
  });

  test.skip('inverse', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');
    // assert.false(comment.post.hasDirtyAttributes, 'post is initially clean');

    comment.set('post', post);

    assert.equal(comment.post.comments.firstObject, comment, 'the inverse relationship was changed');
    assert.true(comment.hasDirtyAttributes, 'comment is dirty');
    assert.true(comment.post.hasDirtyAttributes, 'post is dirty');
  });

  test.skip('rollback to null', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.equal(comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'initially clean');

    comment.set('post', store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.rollbackAttributes();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after rollback');
    assert.equal(comment.post, null, 'post is is rolled back to null'); // FIXME
  });

  test('save', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    server.patch('/comments/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.equal(data.relationships?.post?.data?.id, post.id, 'save payload should include the post id');
      assert.false(comment.hasDirtyAttributes, 'comment is not dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();

    assert.equal(comment.post, post, 'post is saved');
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });

  test('save returns a new value', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post1 = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const post2 = store.push({
      data: {
        type: 'post',
        id: '2',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    server.patch('/comments/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.equal(data.relationships?.post?.data?.id, post1.id, 'save payload should include the post id');
      assert.false(comment.hasDirtyAttributes, 'comment is not dirty while save is in transit');
      data.relationships.post.data.id = post2.id;
      return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ data })];
    });

    await comment.save();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
    assert.equal(comment.post, post2, 'comment.post has the new canonical post returned by the server');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', post2);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('save fails', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post1 = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    server.patch('/comments/:id', function () {
      assert.false(comment.hasDirtyAttributes, 'comment is clean while save is in transit');
      const errors = [{ id: 'invalid' }];
      return [400, { 'Content-Type': 'application/json' }, JSON.stringify({ errors })];
    });

    await assert.rejects(comment.save(), 'save should fail');

    assert.equal(comment.post, post1, 'post is still changed');
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after save fails');

    server.patch('/comments/:id', function (request) {
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after save succeeds');
  });

  test('create and save', async function (assert) {
    const post = store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment = store.createRecord('comment', { post });
    assert.true(comment.hasDirtyAttributes, 'comment is initially dirty');

    server.post('/comments', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.equal(data.relationships?.post?.data?.id, post.id, 'save payload should include the post id');
      assert.true(comment.hasDirtyAttributes, 'comment is dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });

  test('delete', async function (assert) {
    const comment = store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    server.delete('/comments/:id', function () {
      assert.false(comment.hasDirtyAttributes, 'comment is clean while save is in transit');
      return [204];
    });

    comment.set('post', store.createRecord('post'));
    comment.deleteRecord();
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after delete');

    await comment.save();
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });
});
