import { module, test } from 'qunit';
import { setupTest } from '../helpers';
import Model, { attr, hasMany } from '@ember-data/model';

module('has-many', function (hooks) {
  setupTest(hooks);

  class Post extends Model {
    @attr('string') title;
    @hasMany('comment') comments;
  }
  class Comment extends Model {
    @attr('string') text;
  }

  hooks.beforeEach(function () {
    this.owner.register('model:post', Post);
    this.owner.register('model:comment', Comment);
  });

  test('empty state', async function (assert) {
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.strictEqual(post.comments.length, 0, 'comments are empty');
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [this.store.createRecord('comment')]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.set('comments', []);
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
  });

  test('modify the array', async function (assert) {
    const post = this.store.push({
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
          text: 'hello',
        },
      ],
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');
    assert.strictEqual(post.comments.length, 1, 'post has 1 comment');

    const comment = post.comments.firstObject;
    assert.false(comment.hasDirtyAttributes, 'comment is initially clean');

    post.comments.replace(0, 0, [this.store.createRecord('comment'), this.store.createRecord('comment')]);
    assert.strictEqual(post.comments.length, 3, 'post has 3 comments');
    assert.true(post.hasDirtyAttributes, 'post is dirty after adding to post.comments');

    post.comments.clear();
    assert.strictEqual(post.comments.length, 0, 'post has 0 comments');
    assert.true(post.hasDirtyAttributes, 'post is still dirty after clearing post.comments');

    post.comments.pushObject(comment);
    assert.strictEqual(post.comments.length, 1, 'post has 1 comment');
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');

    comment.set('text', 'new text');
    assert.false(post.hasDirtyAttributes, 'post is still clean after changing comment text');
  });

  test('rollback to empty', async function (assert) {
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    assert.strictEqual(post.comments.length, 0, 'comments are empty');
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [this.store.createRecord('comment')]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.rollbackAttributes();

    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
    assert.strictEqual(post.comments.length, 0, 'comments are rolled back to empty');
  });

  test('save', async function (assert) {
    assert.expect(6);
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [comment]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    this.server.patch('/posts/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.strictEqual(
        data.relationships?.comments?.data?.[0]?.id,
        comment.id,
        'save payload should include the comment id'
      );
      assert.false(post.hasDirtyAttributes, 'post is not dirty while save is in transit');
      return [200, { 'Content-Type': 'application/json' }, request.requestBody];
    });

    await post.save();

    assert.strictEqual(post.comments.firstObject, comment, 'comment is saved');
    assert.false(post.hasDirtyAttributes, 'post is clean after saving');
  });

  test('save returns a new array', async function (assert) {
    assert.expect(8);
    const post = this.store.push({
      data: {
        type: 'post',
        id: '1',
      },
    });
    const comment1 = this.store.push({
      data: {
        type: 'comment',
        id: '1',
      },
    });
    const comment2 = this.store.push({
      data: {
        type: 'comment',
        id: '2',
      },
    });
    const comment3 = this.store.push({
      data: {
        type: 'comment',
        id: '3',
      },
    });
    assert.false(post.hasDirtyAttributes, 'post is initially clean');

    post.set('comments', [comment1]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    this.server.patch('/posts/:id', function (request) {
      const { data } = JSON.parse(request.requestBody);
      assert.strictEqual(
        data.relationships?.comments?.data?.[0]?.id,
        comment1.id,
        'save payload should include the comment id'
      );
      assert.false(post.hasDirtyAttributes, 'post is not dirty while save is in transit');
      data.relationships.comments.data = [
        { type: 'comments', id: comment2.id },
        { type: 'comments', id: comment3.id },
      ];
      return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ data })];
    });

    await post.save();

    assert.strictEqual(
      post.comments.firstObject,
      comment2,
      'post.comments has the new canonical comment returned by the server'
    );
    assert.false(post.hasDirtyAttributes, 'post is clean after saving');

    post.set('comments', [comment1]);
    assert.true(post.hasDirtyAttributes, 'post is dirty after setting post.comments');

    post.set('comments', [comment2, comment3]);
    assert.false(post.hasDirtyAttributes, 'post is clean after reverting post.comments');
  });
});
