import Model, { attr, hasMany } from '@ember-data/model';

export default class PostModel extends Model {
  @attr('string') title;
  @hasMany('comment', { async: false }) comments;
}
