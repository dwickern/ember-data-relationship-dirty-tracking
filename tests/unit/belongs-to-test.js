import { module, test } from 'qunit';
import { setupTest } from '../helpers';
import Model, { attr, belongsTo } from '@ember-data/model';

module('belongs-to', function (hooks) {
  setupTest(hooks);

  class Post extends Model {
    @attr('string') title;
  }
  class Comment extends Model {
    @attr('string') text;
    @belongsTo('post') post;
  }

  hooks.beforeEach(function () {
    this.owner.register('model:post', Post);
    this.owner.register('model:comment', Comment);
  });

  test('implicit null relationship', async function (assert) {
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.strictEqual(await comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', this.store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', null);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('explicit null relationship', async function (assert) {
    const comment = this.store.push({
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
    assert.strictEqual(await comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', this.store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', null);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('change the relationship value', async function (assert) {
    const comment = this.store.push({
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

    const post = await comment.post;
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    comment.set('post', this.store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', post);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('change attribute of the related model', async function (assert) {
    const comment = this.store.push({
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

    const post = await comment.post;
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    comment.post.set('title', 'new post title');
    assert.true(post.hasDirtyAttributes, 'post is dirty');
    assert.false(comment.hasDirtyAttributes, 'comment is still clean');
  });

  test.skip('rollback to null', async function (assert) {
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.strictEqual(await comment.post, null, 'post is initially null');
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', this.store.createRecord('post'));
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.rollbackAttributes();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after rollback');
    assert.strictEqual(await comment.post, null, 'post is is rolled back to null'); // FIXME
  });

  test('save', async function (assert) {
    assert.expect(6);
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    this.server.patch('/comments/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.strictEqual(data.relationships?.post?.data?.id, post.id, 'save payload should include the post id');
      assert.false(comment.hasDirtyAttributes, 'comment is not dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();

    assert.strictEqual(await comment.post, post, 'post is saved');
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });

  test('save returns a new value', async function (assert) {
    assert.expect(8);
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post1 = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const post2 = this.store.push({
      data: {
        type: 'post',
        id: '2',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    this.server.patch('/comments/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.strictEqual(data.relationships?.post?.data?.id, post1.id, 'save payload should include the post id');
      assert.false(comment.hasDirtyAttributes, 'comment is not dirty while save is in transit');
      data.relationships.post.data.id = post2.id;
      return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ data })];
    });

    await comment.save();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
    assert.strictEqual(await comment.post, post2, 'comment.post has the new canonical post returned by the server');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    comment.set('post', post2);
    assert.false(comment.hasDirtyAttributes, 'comment is clean after reverting comment.post');
  });

  test('save fails', async function (assert) {
    assert.expect(7);
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const post1 = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    comment.set('post', post1);
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after setting comment.post');

    this.server.patch('/comments/:id', function () {
      assert.false(comment.hasDirtyAttributes, 'comment is clean while save is in transit');
      const errors = [{ id: 'invalid' }];
      return [400, { 'Content-Type': 'application/json' }, JSON.stringify({ errors })];
    });

    await assert.rejects(comment.save(), 'save should fail');

    assert.strictEqual(await comment.post, post1, 'post is still changed');
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after save fails');

    this.server.patch('/comments/:id', function (request) {
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();

    assert.false(comment.hasDirtyAttributes, 'comment is clean after save succeeds');
  });

  test('create and save', async function (assert) {
    assert.expect(4);
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment = this.store.createRecord('comment', { post });
    assert.true(comment.hasDirtyAttributes, 'comment is initially dirty');

    this.server.post('/comments', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.strictEqual(data.relationships?.post?.data?.id, post.id, 'save payload should include the post id');
      assert.true(comment.hasDirtyAttributes, 'comment is dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await comment.save();
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });

  test('delete', async function (assert) {
    assert.expect(4);
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    this.server.delete('/comments/:id', function () {
      assert.false(comment.hasDirtyAttributes, 'comment is clean while save is in transit');
      return [204];
    });

    comment.set('post', this.store.createRecord('post'));
    comment.deleteRecord();
    assert.true(comment.hasDirtyAttributes, 'comment is dirty after delete');

    await comment.save();
    assert.false(comment.hasDirtyAttributes, 'comment is clean after saving');
  });
});
