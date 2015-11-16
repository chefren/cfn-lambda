
var path = require('path');
var assert = require('assert');

var SDKAlias = require(path.resolve(__dirname, '..', 'index')).SDKAlias;

function noop() {};

describe('SDKAlias', function() {

  describe('Sanity', function() {
    it('should throw an exception when called with incorrect signature', function(done) {
      var Alias = SDKAlias({});
      var expectedErrorMessage = 'Could not determine cfn-lambda ' +
        'SDKAlias method signature at runtime.';
      var actualErrorMessage;
      try {
        Alias('too', 'many', 'runtime', 'arguments', 'silly');
      } catch (err) {
        actualErrorMessage = err.message;
      }
      assert(actualErrorMessage === expectedErrorMessage);
      done();
    });
    it('should not fail when there are no Properties parameters', function(done) {
      var Alias = SDKAlias({
        api: {
          test: function(finalParams, fakeReply) {
            assert(!Object.keys(finalParams).length);
            done();
          }
        },
        method: 'test'
      });

      Alias(undefined, noop);
    });
  });

  describe('Param Manipulation', function() {
    it('should map the physical ID when physicalIdAs is provided', function(done) {
      var providedPhyscialId = 'foobar';
      var Alias = SDKAlias({
        physicalIdAs: 'newNameForId',
        api: {
          test: function(finalParams, fakeReply) {
            assert(finalParams.newNameForId === providedPhyscialId);
            done();
          }
        },
        method: 'test'
      });

      Alias(providedPhyscialId, {}, noop);

    });

    it('should include only passed keyset', function(done) {
      var providedPhyscialId = 'foobar';
      var Alias = SDKAlias({
        physicalIdAs: 'newNameForId',
        keys: ['Passed'],
        api: {
          test: function(finalParams, fakeReply) {
            assert(Object.keys(finalParams).length === 1);
            assert(finalParams.Passed === 'key');
            done();
          }
        },
        method: 'test'
      });

      Alias(providedPhyscialId, {
        Has: 'many',
        Passed: 'key'
      }, noop);

    });

    it('should downcase first letter in keys when downcase === true', function(done) {
      var providedPhyscialId = 'foobar';
      var Alias = SDKAlias({
        physicalIdAs: 'newNameForId',
        keys: ['Passed'],
        downcase: true,
        api: {
          test: function(finalParams, fakeReply) {
            assert(Object.keys(finalParams).length === 1);
            assert(finalParams.passed === 'key');
            done();
          }
        },
        method: 'test'
      });

      Alias(providedPhyscialId, {
        Has: 'many',
        Passed: 'key'
      },
      {
        Plus: 'some',
        Old: 'params'
      }, noop);
    });

    it('should map across keys with mapKeys hash', function(done) {
      var providedPhyscialId = 'foobar';
      var Alias = SDKAlias({
        mapKeys: {
          Has: 'Mapped'
        },
        downcase: true,
        api: {
          test: function(finalParams, fakeReply) {
            assert(Object.keys(finalParams).length === 2, 'Wrong key count, found: ' + JSON.stringify(finalParams));
            assert(finalParams.passed === 'key', 'Bad downcase, found: ' + finalParams.passed);
            assert(finalParams.mapped === 'many', 'Bad mapping, found: ' + finalParams.mapped);
            done();
          }
        },
        method: 'test'
      });

      Alias(providedPhyscialId, {
        Has: 'many',
        Passed: 'key'
      },
      {
        Plus: 'some',
        Old: 'params'
      }, noop);
    });
  });

  describe('Attribute Post-Processing', function() {
    it('should not yield any attributes with no returnAttrs defined', function(done) {
      var Alias = SDKAlias({
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply(null, {
              Big: 'hunk',
              Of: 'attributes'
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(actualAttrHash === undefined);
        done();
      });

    });

    it('should yield any attributes within returnAttrs', function(done) {
      var Alias = SDKAlias({
        returnAttrs: ['Id', 'Big'],
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply(null, {
              Big: 'hunk',
              Of: 'attributes',
              Id: 'foobar'
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(Object.keys(actualAttrHash).length === 2);
        assert(actualAttrHash.Id === 'foobar');
        assert(actualAttrHash.Big === 'hunk');
        done();
      });

    });

    it('should properly yield attrs with custom returnAttrs', function(done) {
      var expectedAttributeHashTestValue = 'working custom attributes';
      var Alias = SDKAlias({
        returnAttrs: function(data) {
          return {
            Test: ['working', 'custom', data.Of].join(' ')
          };
        },
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply(null, {
              Big: 'hunk',
              Of: 'attributes',
              Id: 'foobar'
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(Object.keys(actualAttrHash).length === 1);
        assert(actualAttrHash.Test === expectedAttributeHashTestValue);
        done();
      });

    });
  });

  describe('Aliased Service Error Handling', function() {
    it('should pass forward errors when not suppressing codes', function(done) {
      var expectedErrorMessage = 'Something bad happened within AWS.';
      var Alias = SDKAlias({
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply({
              statusCode: 400,
              message: expectedErrorMessage
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(physicalId === undefined, 'physicalId should be undefined');
        assert(actualAttrHash === undefined, 'returned attrs should be undefined');
        assert(err === expectedErrorMessage, 'error message mismatch');
        done();
      });
    });

    it('should pass suppress errors within ignoreErrorCodes', function(done) {
      var Alias = SDKAlias({
        ignoreErrorCodes: [404],
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply({
              statusCode: 404,
              message: 'This should be suppressed.'
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(physicalId === undefined, 'physicalId should be undefined');
        assert(actualAttrHash === undefined, 'returned attrs should be undefined');
        assert(err == null, 'error message should be null, found: ' + err);
        done();
      });
    });
  });

  describe('Physical ID Generation', function() {
    it('should work with string mappable physicalId', function(done) {
      var expectedPhysicalId = 'Should be this value';
      var expectedIncludedAttrValue = 'foobar';
      var Alias = SDKAlias({
        returnAttrs: ['IncludeInAttrs'],
        returnPhysicalId: 'UseMeAsId',
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply(null, {
              UseMeAsId: expectedPhysicalId,
              IncludeInAttrs: expectedIncludedAttrValue
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(physicalId === expectedPhysicalId, 'physicalId was wrong: ' + physicalId);
        assert(Object.keys(actualAttrHash).length === 1, 'returned attrs were wrong.');
        assert(actualAttrHash.IncludeInAttrs === expectedIncludedAttrValue,
          'returned attrs were wrong.');
        assert(err == null, 'error message should be null, found: ' + err);
        done();
      });
    });

    it('should work with string mappable physicalId with no returned values', function(done) {
      var Alias = SDKAlias({
        ignoreErrorCodes: [404],
        returnPhysicalId: 'UseMeAsId',
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply({
              statusCode: 404,
              message: 'Valid case for having no hash to pull physicalId from'
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(physicalId === undefined, 'physicalId was wrong: ' + physicalId);
        assert(actualAttrHash === undefined, 'returned attrs were wrong.');
        assert(err == null, 'error message should be null, found: ' + err);
        done();
      });
    });

    it('should work with custom function physicalId', function(done) {
      var physicalIdFragment = 'Should be this value';
      var expectedIncludedAttrValue = 'foobar';
      var expectedPhysicalId = [physicalIdFragment, expectedIncludedAttrValue].join(':');
      var Alias = SDKAlias({
        returnAttrs: ['IncludeInAttrs'],
        returnPhysicalId: function(data) {
          return data.UseMeInId + ':' + data.IncludeInAttrs;
        },
        api: {
          test: function(finalParams, fakeReply) {
            // Pretending AWS-SDK replies with this to the node cb.
            fakeReply(null, {
              UseMeInId: physicalIdFragment,
              IncludeInAttrs: expectedIncludedAttrValue
            });
          }
        },
        method: 'test'
      });

      Alias({
        Has: 'many',
        Passed: 'key'
      }, function(err, physicalId, actualAttrHash) {
        assert(physicalId === expectedPhysicalId, 'physicalId was wrong: ' + physicalId);
        assert(Object.keys(actualAttrHash).length === 1, 'returned attrs were wrong.');
        assert(actualAttrHash.IncludeInAttrs === expectedIncludedAttrValue,
          'returned attrs were wrong.');
        assert(err == null, 'error message should be null, found: ' + err);
        done();
      });
    });
  });

});