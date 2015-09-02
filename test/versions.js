var assert = require('assert');
var _ = require('lodash');
var async = require('async');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      _permissions: {
        admin: true
      }
    }
  });
}


describe('Versions', function() {
	//////
  // EXISTENCE
  //////
  it('should should be a module', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7950
        },
        // Create a custom schema for test-person so we can
        // play with comparing versions
        'test-person-pages': {
          extend: 'apostrophe-custom-pages',
          addFields: [
            {
              label: 'Alive',
              type: 'boolean',
              name: 'alive'
            },
            {
              label: 'Nicknames',
              type: 'array',
              name: 'nicknames',
              schema: [
                {
                  type: 'string',
                  name: 'nickname',
                  label: 'Nickname'
                }
              ]
            },
            {
              label: 'Poems',
              type: 'joinByArray',
              name: '_poems',
              withType: 'poem',
              idsField: 'poemIds'
            },
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.versions);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });
  it('should have a db property', function() {
    assert(apos.versions.db);
  });


  //////
  // Versioning
  //////

  it('inserting a doc should result in a version', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'test-person',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(adminReq(), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object._id);
      var docId = object._id;
      //did the versions module kick-in?
      apos.versions.db.find({ docId: docId }).toArray(function(err, versions) {
        assert(!err);
        // we should have a document
        assert(versions);
        // there should be only one document in our results
        assert(versions.length === 1);
        //does it have a property match?
        assert(versions[0].doc.age === 15);
        done();
      });
    });
  });

  it('should be able to update', function(done) {
    var cursor = apos.docs.find(adminReq(), { slug: 'one' }).toArray(function(err,docs){
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want update the alive property
      object.alive = false

      apos.docs.update(adminReq(), object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);

        //did the versions module kick-in?
	      apos.versions.db.find({ docId: object._id }).sort({createdAt: -1}).toArray(function(err,versions){
		    	assert(!err);
		      // we should have a document
		      assert(versions);
		      // there should be two documents now in our results
		      assert(versions.length === 2);
		      // the property should have been updated
		      assert(versions[0].doc.alive === false);
		      assert(versions[1].doc.alive === true);
		      done();
		    });
      });
    });
  });

  it('should be able to revert to a previous version', function(done){
    apos.docs.find(adminReq(), { slug: 'one' }).toObject(function(err,doc) {
      apos.versions.db.find({ docId: doc._id }).sort({createdAt: -1}).toArray(function(err, versions) {
        assert(versions.length === 2);
        apos.versions.revert(adminReq(), doc, versions[1], function(err) {
          assert(!err);
          // make sure the change propagated to the database
          apos.docs.find(adminReq(), { slug: 'one' }).toObject(function(err,doc) {
            assert(!err);
            assert(doc);
            assert(doc.alive === true);
            done();
          });
        });
      });
    });
  });

  it('should be able to fetch all versions in proper order', function(done){
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      apos.versions.find(req, { docId: doc._id }, {}, function(err, versions) {
        assert(!err);
        assert(versions.length === 3);
        assert(versions[0].createdAt > versions[1].createdAt);
        assert(versions[1].createdAt > versions[2].createdAt);
        done();
      });
    });
  });

  it('should be able to compare versions and spot a simple field change', function(done){
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      apos.versions.find(req, { docId: doc._id }, {}, function(err, versions) {
        assert(!err);
        assert(versions.length === 3);
        return apos.versions.compare(doc, versions[1], versions[0], function(err, changes) {
          assert(!err);
          assert(changes.length === 1);
          assert(changes[0].action === 'change');
          assert(changes[0].old === false);
          assert(changes[0].current === true);
          assert(changes[0].field);
          assert(changes[0].field.label === 'Alive');
          done();
        });
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget addition', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              }
            ]
          }
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'add');
        assert(change.current);
        assert(change.current._id === 'woo2');
        done();
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget removal', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'remove');
        assert(change.old);
        assert(change.old._id === 'woo2');
        done();
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget change', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So wimpy'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'change');
        assert(change.old);
        assert(change.old._id === 'woo2');
        assert(change.old.content === 'So amazing');
        assert(change.current);
        assert(change.current._id === 'woo2');
        assert(change.current.content === 'So wimpy');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an addition', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            }
          ]
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'add');
        assert(change.current);
        assert(change.current._id === 'a2');
        assert(change.current.nickname === 'jane');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an item removal', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {

        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'remove');
        assert(change.old);
        assert(change.old._id === 'a1');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an item change', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'sarah',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'change');
        assert(change.old);
        assert(change.old._id === 'a1');
        assert(change.old.nickname === 'joe');
        assert(change.current);
        assert(change.current._id === 'a1');
        assert(change.current.nickname === 'sarah');
        done();
      });
    });
  });

  it('should be able to compare versions with joinByArray and spot an id change', function(done) {
    var req = adminReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err,doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          poemIds: [ 'abc', 'def' ]
        },
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          poemIds: [ 'abc', 'qed' ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'poemIds');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 2);
        var change0 = changes[0].changes[0];
        var change1 = changes[0].changes[1];
        assert(change0.action === 'remove');
        assert(change0.old);
        assert(change0.old === 'def');
        assert(change1.action === 'add');
        assert(change1.current);
        assert(change1.current === 'qed');
        done();
      });
    });
  });

  //////
  // When disabled the module does not create versions,
  // and docs can still be inserted
  //////
  // it('should not version pages if not set to enabled', function(done) {
  //   apos = require('../index.js')({
  //     root: module,
  //     shortName: 'test',
  //     hostName: 'test.com',
  //     modules: {
  //       'apostrophe-express': {
  //         secret: 'xxx',
  //         port: 7949
  //       },
  //       'apostrophe-versions':{
  //       	enabled: false
  //       }
  //     },
  //     afterInit: function(callback) {
  //       apos.argv._ = [];
  //       assert(!apos.versions.db);
  //       return callback(null);
  //     }
  //   });
  // });
});
