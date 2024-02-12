# ember-data-relationship-dirty-tracking

Dirty tracking for ember-data relationships.

## Compatibility

* Ember.js v4.4 or above
* Ember CLI v4.4 or above
* Node.js v14 or above
* Ember-data 3.28 - 4.6


## Installation

```
ember install ember-data-relationship-dirty-tracking
```

## Usage

All relationships are tracked by default.
After modifying a relationship, the model's [hasDirtyAttributes] property will become `true`.

Use the `dirtyTracking` option to disable dirty tracking for specific relationships: 

```js
// app/models/blog-post.js
import Model, { belongsTo, hasMany } from '@ember-data/model';

export default class BlogPostModel extends Model {
  @belongsTo('author', { dirtyTracking: false }) author;
  @hasMany('comment', { dirtyTracking: false }) comments;
}
```

### Inverse Relationships

This addon does not support dirty tracking for inverse relationships.

Pick one side of the relationship to be the primary side.
Modify the relationship from this side only.

Mark the other side of the relationship with `dirtyTracking: false`.
Do not modify the relationship from this side.

For example:
```js
// app/models/blog-post.js
import Model, { hasMany } from '@ember-data/model';

export default class BlogPostModel extends Model {
  // modify the relationship through this property
  @hasMany('tag') tags;
}
```
```js
// app/models/tag.js
import Model, { hasMany } from '@ember-data/model';

export default class TagModel extends Model {
  // treat this property as read-only
  @hasMany('blog-post', { dirtyTracking: false }) blogPosts;
}
```

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.


## License

This project is licensed under the [MIT License](LICENSE.md).

[hasDirtyAttributes]: https://api.emberjs.com/ember-data/3.28/classes/Model/properties/hasDirtyAttributes?anchor=hasDirtyAttributes
