

var _ = require('lodash');
var Posts = require('../collections/posts');
var Post = require('../models/post');
var Categories = require('../collections/categories');
var Category = require('../models/category');
var Tags = require('../models/tag');





function processTags(tags) {
  if (!tags) {
    return false;
  }

  tags = tags.split(',');

  tags = tags.map(function (tag) {
    return {name: tag.trim()};
  });

  return tags;
}




module.exports = {


  /*
   * GET /blog/:slug
   * loads a blog post by slug
   */
  getPost: function (req, res) {
    var slug = req.params.slug;

    return Post.forge({slug: slug, published: 1})
    .fetch({withRelated: ['created_by', 'tags']})
    .then(function (post) {
      res.render('posts_post', {
        page: 'post',
        gravatar: post.related('created_by').gravatar(48),
        title: post.get('meta_title'),
        description: post.get('meta_description'),
        tags: post.related('tags').toJSON(),
        author: post.related('created_by').toJSON(),
        post: post.toJSON()
      });

      // disabled until model events are sorted
      post.viewed();
    })
    .otherwise(function () {
      req.flash('errors', {'msg': 'Post not found :('});
      res.redirect('/blog');      
    });
  },



  /*
   * GET /blog/edit/:id
   * loads a blog post by slug
   */
  getEdit: function (req, res) {
    var id = req.params.id;
    var user_id = req.user.get('id');
    var categories = new Categories();

    categories.fetch()
    .then(function (cats) {
      Post.forge({id: id, user_id: user_id})
      .fetch({withRelated: ['tags']})
      .then(function (post) {
        res.render('posts_edit', {
          page: 'postedit',
          title: 'Post edit',
          description: 'Post edit',
          categories: cats.toJSON(),
          tags: post.related('tags').toJSON(),
          post: post.toJSON()
        });
      })
      .otherwise(function () {
        req.flash('errors', {'msg': 'You do not have permission to edit that post'});
        res.redirect('back');      
      });
    });
  },


  /**
   * GET /blog
   */
  getPosts: function (req, res) {
    var posts = new Posts();
    var page = parseInt(req.query.p, 10);
  
    posts.limit = 5;
    posts.currentpage = page || 1;
    posts.base = '/blog';
    posts.whereQuery = ['published_at', '<', new Date()];
    posts.andWhereQuery = ['published', '=', 1];
  
    posts.fetchItems()
    .then(function (collection) {
      res.render('posts_posts', {
        title: 'Blog',
        pagination: posts.paginated,
        posts: collection.toJSON(),
        description: 'Node.js tutorials, articles and news',
        page: 'blog',
        query: {}
      });
    })
    .otherwise(function () {
      req.flash('errors', {'msg': 'Database error.'});
      res.redirect('/');      
    });
  },


  /**
   * GET /blog/category/:slug
   */
  getPostsByCategory: function (req, res) {
    var posts = new Posts();
    var slug = req.params.slug;
    var page = parseInt(req.query.p, 10);
  
    posts.limit = 5;
    posts.currentpage = page || 1;
    posts.base = '/blog/category/' + slug;
    
    
    Category.forge({slug: slug})
    .fetch()
    .then(function (model) {
      
      posts.whereQuery = ['published_at', '<', new Date()];
      posts.andWhereQuery = ['category_id', '=', model.get('id')];

      posts.fetchItems()
      .then(function (collection) {
        res.render('posts_posts', {
          title: 'Blog',
          pagination: posts.paginated,
          posts: collection.toJSON(),
          description: 'Node.js tutorials, articles and news',
          page: 'blog',
          query: {}
        });
      })
      .otherwise(function () {
        req.flash('errors', {'msg': 'Database error.'});
        res.redirect('/');      
      });
    })
    .otherwise(function () {
      req.flash('errors', {'msg': 'Database error.'});
      res.redirect('/');      
    });
  },


  /**
   * GET /blog/tags/:slug
   */
  getPostsByTag: function (req, res) {
    var slug = req.params.slug;

    Tags.forge({slug: slug})
    .fetch()
    .then(function (tag) {
      tag.posts()
      .fetch()
      .then(function (collection) {

        res.render('posts_posts', {
          title: 'Blog',
          pagination: collection.paginated,
          posts: collection.toJSON(),
          description: 'Node.js tutorials, articles and news',
          page: 'blog',
          query: {}
        });
      })
      .otherwise(function () {
        res.redirect('back');
      });
    })
    .otherwise(function () {
      res.redirect('back');
    });
  },



  /**
   * GET /events
   * get upcoming events
   */
  newPostsAdmin: function (req, res) {
    var posts = new Posts();
    var page = parseInt(req.query.p, 10);
  
    posts.limit = 10;
    posts.currentpage = page || 1;
    posts.base = '/account/blog';
    posts.whereQuery = ['user_id', '=', req.user.get('id')];
  
    posts.fetchItems()
    .then(function (collection) {
      res.render('posts_admin', {
        title: 'Blog',
        pagination: posts.paginated,
        posts: collection.toJSON(),
        description: 'Node.js tutorials, articles and news',
        page: 'adminblog',
        query: {}
      });
    })
    .otherwise(function () {
      req.flash('errors', {'msg': 'Database error.'});
      res.redirect('/');      
    });
  },



  /*
   * GET /account/blog/new
   * load new post page
   */
  newPost: function (req, res) {
    var categories = new Categories();

    categories.fetch()
    .then(function (collection) {
      res.render('posts_new', {
        title: 'New Post',
        description: 'Create a new post',
        page: 'newpost',
        categories: collection.toJSON()
      });
    })
    .otherwise(function () {
      req.flash('errors', {'msg': 'Database error.'});
      res.redirect('/account/blog');       
    });
  },



  /**
   * POST /account/blog/new
   * Edit user account.
  */
  postPost: function(req, res, next) {
    var post = new Post();

    req.assert('title', 'Title must be at least 6 characters long').len(6);
    req.assert('tags', 'Tags must not be empty').notEmpty();
    req.assert('markdown', 'Post must be at least 32 characters long').len(32);

    var opts = {
      user_id: req.user.get('id'),
      title: req.body.title,
      category_id: req.body.category,
      meta_title: req.body.meta_title || req.body.title,
      meta_description: req.body.meta_description || req.body.title,
      markdown: req.body.markdown,
      published: !!req.body.published,
      featured: !!req.body.featured
    };

    post.save(opts, {updateTags: processTags(req.body.tags)})
    .then(function() {
      req.flash('success', { msg: 'Post successfully created.' });
      res.redirect('/account/blog');
    })
    .otherwise(function (error) {
      console.log(error);
      req.flash('error', {msg: 'Post could not be created.'});
      res.redirect('/account/blog');
    });
  },


  /**
   * POST /blog/edit
   * Edit user account.
  */
  postEdit: function(req, res, next) {
    req.assert('title', 'Title must be at least 6 characters long').len(6);
    req.assert('tags', 'Tags must not be empty').notEmpty();
    req.assert('markdown', 'Post must be at least 32 characters long').len(32);

    var opts = {
      id: req.body.id,
      user_id: req.user.get('id'),
      title: req.body.title,
      category_id: req.body.category,
      meta_title: req.body.meta_title || req.body.title,
      meta_description: req.body.meta_description || req.body.title,
      markdown: req.body.markdown,
      published: !!req.body.published,
      featured: !!req.body.featured
    };

    Post.forge({id: opts.id, user_id: opts.user_id})
    .fetch()
    .then(function (post) {
      
      // specify explicitly if you want to update tags
      post.save(opts, {updateTags: processTags(req.body.tags)})
      .then(function() {
        req.flash('success', { msg: 'Post successfully updated.' });
        res.redirect('/account/blog');
      })
      .otherwise(function (error) {
        req.flash('error', {msg: 'Post could not be updated.'});
        console.log(error);
        res.redirect('/account/blog');
      });
    })
    .otherwise(function (error) {
      req.flash('error', {msg: 'You do not have access to that post.'});
      console.log(error);
      res.redirect('/account/blog');
    });
  },



  /**
   * POST /blog/delete
   * Edit user account.
  */
  getDelete: function(req, res, next) {
    Post.forge({id: req.params.id, user_id: req.user.get('id')})
    .fetch({withRelated: ['tags']})
    .then(function (post) {
      post.related('tags')
      .detach()
      .then(function () {
        post.destroy()
        .then(function () {
          req.flash('success', {msg: 'Post successfully deleted.'});
          res.redirect('back');
        });
      });
    })
    .otherwise(function () {
      req.flash('error', {msg: 'You do not have access to that post.'});
      res.redirect('back');
    });
  },



  /**
   * Get /blog/edit
   * Edit user account.
  */
  getPublish: function(req, res, next) {
    Post.forge({id: req.params.id, user_id: req.user.get('id')})
    .fetch({withRelated: ['tags']})
    .then(function (post) {
      var published = post.get('published') ? false : true;
      var msg = published ? 'published' : 'unpublished';
      var opts = {};

      opts.published = published;

      if(published && !post.get('published_at')) {
        opts.published_at = new Date();
      }

      post.save(opts, {patch: true})
      .then(function () {
        req.flash('success', {msg: 'Post successfully ' + msg});
        res.redirect('back');
      });
    })
    .otherwise(function () {
      req.flash('error', {msg: 'You do not have access to that post.'});
      res.redirect('back');
    });
  }
};

