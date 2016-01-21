[![Build Status](https://travis-ci.org/punkave/apostrophe.svg?branch=master)](https://travis-ci.org/punkave/apostrophe)

# How to make a website with Apostrophe 0.6 unstable

We'll assume our project's short, filename-friendly name is `straw-man`.

Check out Apostrophe 0.6 unstable:

```
mkdir -p ~/src
cd ~/src
git clone -b unstable https://github.com/punkave/apostrophe apostrophe-06
cd apostrophe-06
npm install
```

Now create your project and manually add a symbolic link to Apostrophe 0.6 unstable:

```
cd ~/Sites
mkdir straw-man
cd straw-man
git init
npm init
mkdir -p node_modules
cd node_modules
ln -s ~/src/apostrophe-06 apostrophe
```

Next we'll create `app.js`. We need to initialize Apostrophe and let it know our short name, which will be the name of the mongodb database as well:

```javascript
var apos = require('apostrophe')({
  shortName: 'straw-man'
});
```

Now create a folder to store our page templates:

```
mkdir -p lib/modules/apostrophe-pages/views/pages
```

Next, create the home page template, `lib/modules/apostrophe-pages/views/pages/home.html`. We'll incorporate an editable area that allows slideshows and rich text:

```html
{% extends data.outerLayout %}
{% block title %}Home{% endblock %}
{% block main %}

<h2>Welcome to Straw Man, Inc.</h2>

{{
  apos.area(data.page, 'body', {
    widgets: {
      'apostrophe-rich-text': {
        toolbar: [ 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
      },
      'apostrophe-images': { size: 'one-half' }
    }
  })
}}

{% endblock %}
```

Note that we're extending a layout template here, which saves us from reimplementing shared elements in every page template. We'll look at that later.

Now we need to create the database, which will automatically populate the site with a home page. To list the command line tasks we type:

`node app help`

Which reveals:

```
The following tasks are available:

apostrophe-db:reset
apostrophe:generation
apostrophe-pages:unpark
apostrophe-users:add
```

Let's reset the database. (*Never do this to a site with existing content you want to keep.*)

```
node app apostrophe-db:reset
```

At this point we can launch the site and view the home page:

```
node app
```

Now visit `http://localhost:3000/` to see the site.

But we can't log in yet because there is no admin user yet. Users get their permissions via "groups," which make it easy to configure a lot of users with the same permissions. So hit control-C and let's expand `app.js` to configure some groups:

```javascript
var apos = require('apostrophe')({
  shortName: 'straw-man',
  modules: {
    'apostrophe-users': {
      groups: [
        {
          title: 'Guest',
          permissions: [ ]
        },
        {
          title: 'Editor',
          permissions: [ 'edit' ]
        },
        {
          title: 'Admin',
          permissions: [ 'admin' ]
        }
      ]
    }
  }
});
```

*From now on I won't show all of `app.js` every time I show you something to add to it.*

Now we can add an admin user:

```
node app apostrophe-users:add admin Admin
```

You'll be prompted for a password.

Now start the site again:

```
node app
```

*From now on I'll assume you know how to restart the site. Press control-C to stop the site.*

Let's log in:

`http://localhost:3000/login`

After logging in the home page appears again, this time with an editing interface. Try adding rich text items and slideshows. Whoa, the controls are all on top of what we're trying to do! We'll be improving that, but for now let's use it as an example of how to add CSS to our project.

## Stylesheets

We need some styles. By default the interface buttons are very much on top of our work. A good time to show how to add a stylesheet of your own.

Configure the `apostrophe-assets` module in `app.js` (add it inside the `modules` property):

```javascript
apostrophe-assets: {
  stylesheets: [
    {
      name: 'site'
    }
  ]
}
```

Now create a folder for the LESS CSS files:

`mkdir -p lib/modules/apostrophe-assets/public/css`

And populate `site.less` in that folder:

```css
.apos-refreshable {
  margin-top: 150px;
}

.apos-rich-text {
  padding-top: 120px;
}
```

Restart the site and refresh the page. Now you can see what you're doing!

Similarly, we can push javascript files via the `scripts` key and the `public/js` folder in the `apostrophe-assets` module.

## Adding pages

We want to be able to have more than one page on our site. The "New Page" option on the "Page Menu" doesn't work yet because we haven't configured any page types. Each type corresponds to a template, such as our `home` template.

Let's configure the `apostrophe-pages` module:

```javascript
'apostrophe-pages': {
  types: [
    {
      name: 'default',
      label: 'Default'
    },
    {
      name: 'home',
      label: 'Home'
    }
  ]
},
```

And create a template for `default` pages in `lib/modules/apostrophe-pages/views/pages/default.html`:

```html
{% extends data.outerLayout %}
{% block title %}{{ data.page.title }}{% endblock %}
{% block main %}

<h2>{{ data.page.title }}</h2>

{{
  apos.area(data.page, 'body', {
    widgets: {
      'apostrophe-rich-text': {
        toolbar: [ 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
      },
      'apostrophe-images': { size: 'one-half' }
    }
  })
}}

{% endblock %}
```

It's similar to the home page, but displays the title of this particular page.

Now you can access "New Page" from the "Pages Menu."

## Editing the layout and adding navigation

Now that we have subpages on the site, we need a way to navigate to them. Let's add a breadcrumb trail and a subnav of child pages to every page.

We'll want these things to be in the shared layout template that all page templates extend. That's called `outerLayout.html`. By default it's an empty template that just extends `outerLayoutBase.html` and outputs whatever is in your page template. `outerLayoutBase.html` does the really gnarly work of outputting `link` and `script` tags and the Apostrophe admin bar. In some projects you may never touch that one.

To override it for your project, create `lib/modules/apostrophe-templates/views/outerLayout.html` in your project. First make the folder:

```
mkdir -p lib/modules/apostrophe-templates/views
```

*You can override any template that is part of an Apostrophe module by creating a corresponding `views` folder in your project. Apostrophe's modules live in the `lib/modules` folder of the `apostrophe` npm module. If you recreate the same folder structure in your project, you can override individual template files by copying and modifying them there. Never edit the templates in `node_modules/apostrophe` itself to do project-specific work.*

Here's an example of an `outerLayout.html` that includes "tabs" (children of the home page), a breadcrumb trail (links to ancestor pages), and subnavigation with links to child pages. With these links we can explore the whole site and come back again.

We'll also open a `<main>` element to contain the content from the page template.

```html
{% extends "outerLayoutBase.html" %}
{% block beforeMain %}

  <nav class="tabs">
    {# If we have ancestors, the first one is the home page. Otherwise, we are the home page #}
    {% set home = data.page._ancestors[0] or data.page %}
    {% for page in home._children %}
      {# If this tab is the current page or its second ancestor, it's the current tab #}
      {% set current = (data.page._id == page._id) or (data.page._ancestors[1]._id == page._id) %}
      <a href="{{ page._url }}" class="{% if current %}current{% endif %}">{{ page.title }}</a>
    {% endfor %}
  </nav>

  <nav class="breadcrumb">
    {% for page in data.page._ancestors %}
      <a href="{{ page._url }}">{{ page.title }}</a> &raquo;
    {% endfor %}
    <a class="self" href="{{ data.page.url }}">{{ data.page.title }}</a>
  </nav>

  <nav class="children">
    {% for page in data.page._children %}
      <a href="{{ page._url }}">{{ page.title }}</a>
    {% endfor %}
  </nav>
  <main>
{% endblock %}

{% block afterMain %}
  </main>
{% endblock %}
```

*The `beforeMain` and `afterMain` blocks defined in `outerLayoutBase.html` are useful for doing things before and after the main content from the page template. You can also override `outerLayoutBase.html` completely if you don't like this structure.*

*"What's with all the underscores?"* Properties like `_children` and `_ancestors` are loaded dynamically, depending on what pages this page is currently related to. Apostrophe uses the `_` notation to indicate that they should not be redundantly stored back to the database.

Here are some additional styles for `site.less` to make the site a little more recognizable in structure once you've added some pages and subpages and so on:

```css
/* quick and dirty LESS CSS for navigation */

nav.tabs {
  margin-left: 220px;
  a {
    display: inline-block;
    padding: 10px;
    border: 1px solid gray;
    &.current {
      border-bottom: 1px solid white;
    }
  }
}

nav.breadcrumb {
  margin-left: 220px;
  margin-top: 20px;
  a {
    display: inline-block;
  }
  padding-bottom: 40px;
  .self {
    font-weight: bold;
  }
}

nav.children {
  margin-top: 20px;
  float: left;
  width: 200px;
  padding-right: 20px;
  a {
    display: block;
  }
}

main {
  margin-left: 220px;
  width: 1000px;
}
```
