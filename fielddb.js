;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* globals window, XDomainRequest, XMLHttpRequest */

var Q = require("q");

var CORS = {
  fieldDBtype: "CORS",
  debugMode: false,
  debug: function(a, b, c) {
    if (this.debugMode) {
      console.log(a, b, c);
    }
  },
  warn: function(message) {
    console.warn("CORS-WARN: " + message);
    // throw message;
  },
  bug: function(message) {
    console.warn("CORS-BUG: " + message);
  },
  render: function() {
    this.debug("Render requested but this object has no render defined.");
  }
};

/*
 * Helper function which handles IE
 */
CORS.supportCORSandIE = function(method, url) {
  var xhrCors;
  try {
    xhrCors = new XMLHttpRequest();
  } catch (e) {
    this.warn("XMLHttpRequest is not defined, nothign will happen.", e);
    xhrCors = {};
  }
  if ("withCredentials" in xhrCors) {
    // XHR for Chrome/Firefox/Opera/Safari.
    xhrCors.open(method, url, true);
    // https://mathiasbynens.be/notes/xhr-responsetype-json
    // xhrCors.responseType = "json";
  } else if (typeof XDomainRequest !== "undefined") {
    // XDomainRequest for IE.
    xhrCors = new XDomainRequest();
    xhrCors.open(method, url);
  } else {
    // CORS not supported.
    xhrCors = null;
  }
  return xhrCors;
};

/*
 * Functions for well formed CORS requests
 */
CORS.makeCORSRequest = function(options) {
  var self = this,
    deferred = Q.defer(),
    xhr;

  // this.debugMode = true;
  if (!options.method) {
    options.method = options.type || "GET";
  }
  if (!options.url) {
    this.bug("There was an error. Please report this.");
  }
  if (!options.data) {
    options.data = "";
  }
  if (options.method === "GET" && options.data) {
    options.dataToSend = JSON.stringify(options.data).replace(/,/g, "&").replace(/:/g, "=").replace(/"/g, "").replace(/[}{]/g, "");
    options.url = options.url + "?" + options.dataToSend;
  }

  xhr = this.supportCORSandIE(options.method, options.url);
  if (!xhr) {
    this.bug("CORS not supported, your browser is unable to contact the database.");
    Q.nextTick(function() {
      deferred.reject("CORS not supported, your browser is unable to contact the database.");
    });
    return deferred.promise;
  }

  //  if(options.method === "POST"){
  //xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
  xhr.setRequestHeader("Content-type", "application/json");
  if (options.withCredentials !== false) {
    xhr.withCredentials = true;
  }
  //  }

  xhr.onload = function(e, f, g) {
    var response = xhr.responseJSON || xhr.responseText || xhr.response;
    self.debug("Response from CORS request to " + options.url + ": " + response);
    if (xhr.status >= 400) {
      self.warn("The request was unsuccesful " + xhr.statusText);
      deferred.reject(response);
      return;
    }
    if (response) {
      try {
        response = JSON.parse(response);
      } catch (e) {
        self.debug("Response was already json.", e);
      }
      deferred.resolve(response);
    } else {
      self.bug("There was no content in the server's response text. Please report this.");
      self.warn(e, f, g);
      deferred.reject(e);
    }
    // self.debugMode = false;
  };

  xhr.onerror = function(e, f, g) {
    self.debug(e, f, g);
    self.bug("There was an error making the CORS request to " + options.url + " from " + window.location.href + " the app will not function normally. Please report this.");
    deferred.reject(e);
  };
  if (options.data) {
    xhr.send(JSON.stringify(options.data));
  } else {
    xhr.send();
  }

  return deferred.promise;
};

exports.CORS = CORS;

},{"q":76}],2:[function(require,module,exports){
var Diacritics = require("diacritic");
var FieldDBObject = require("./FieldDBObject").FieldDBObject;

var regExpEscape = function(s) {
  return String(s).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1").
  replace(/\x08/g, "\\x08");
};


/**
 * @class An array backed collection that can look up elements loosely based on id or label.
 *
 * @param {Object} options Optional json initialization object
 * @property {String} primaryKey This is the optional attribute to look in the objects when doing a get or find
 * @property {Boolean} inverted This is the optional parameter for whether the collection should be inserted from the bottom or the top of the collection

 * @extends Object
 * @tutorial tests/CollectionTest.js
 */
var Collection = function Collection(json) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Collection";
  }
  this.debug("Constructing a collection");
  if (!json) {
    json = {};
  }
  /* accepts just an array in construction */
  if (Object.prototype.toString.call(json) === "[object Array]") {
    json = {
      collection: json
    };
  }

  for (var member in json) {
    if (!json.hasOwnProperty(member) || member === "collection" /* set collection after all else has been set */ ) {
      continue;
    }
    this[member] = json[member];
  }
  if (!this.primaryKey) {
    var defaultKey = "id"; /*TODO try finding the key that exists in all objects if id doesnt exist? */
    this.debug("  Using default primary key of " + defaultKey);
    this.primaryKey = defaultKey;
  }
  if (json.collection) {
    this.collection = json.collection;
  }
  this.debug("  array of length " + this.collection.length);
  Object.apply(this, arguments);
};

/** @lends Collection.prototype */
Collection.prototype = Object.create(Object.prototype, {
  constructor: {
    value: Collection
  },

  fieldDBtype: {
    get: function() {
      return this._fieldDBtype;
    },
    set: function(value) {
      if (value !== this.fieldDBtype) {
        this.warn("Using type " + this.fieldDBtype + " when the incoming object was " + value);
      }
    }
  },

  /**
   * Can be set to true to debug all collections, or false to debug no collections and true only on the instances of objects which
   * you want to debug.
   *
   * @type {Boolean}
   */
  debugMode: {
    get: function() {
      if (this.perObjectDebugMode === undefined) {
        return false;
      } else {
        return this.perObjectDebugMode;
      }
    },
    set: function(value) {
      if (value === this.perObjectDebugMode) {
        return;
      }
      if (value === null || value === undefined) {
        delete this.perObjectDebugMode;
        return;
      }
      this.perObjectDebugMode = value;
    }
  },
  debug: {
    value: function() {
      return FieldDBObject.prototype.debug.apply(this, arguments);
    }
  },
  verboseMode: {
    get: function() {
      if (this.perObjectVerboseMode === undefined) {
        return false;
      } else {
        return this.perObjectVerboseMode;
      }
    },
    set: function(value) {
      if (value === this.perObjectVerboseMode) {
        return;
      }
      if (value === null || value === undefined) {
        delete this.perObjectVerboseMode;
        return;
      }
      this.perObjectVerboseMode = value;
    }
  },
  verbose: {
    value: function() {
      return FieldDBObject.prototype.verbose.apply(this, arguments);
    }
  },

  bug: {
    value: function() {
      return FieldDBObject.prototype.bug.apply(this, arguments);
    }
  },
  confirm: {
    value: function() {
      return FieldDBObject.prototype.confirm.apply(this, arguments);
    }
  },
  warn: {
    value: function() {
      return FieldDBObject.prototype.warn.apply(this, arguments);
    }
  },
  todo: {
    value: function() {
      return FieldDBObject.prototype.todo.apply(this, arguments);
    }
  },

  collection: {
    get: function() {
      if (!this._collection) {
        this._collection = [];
      }
      return this._collection;
    },
    set: function(value) {
      if (value === this._collection) {
        return;
      }
      if (!value) {
        value = [];
      }
      for (var index in value) {
        if (!value.hasOwnProperty(index)) {
          continue;
        }
        /* parse internal models as a model if specified */
        if (!value[index]) {
          this.warn(index + " is undefined on this member of the collection", value);
        }
        this.add(value[index]);
      }
      return this._collection;
    }
  },

  getKeys: {
    value: function() {
      var self = this;

      return this.collection.map(function(item) {
        return self.getSanitizedDotNotationKey(item);
      });
    }
  },

  /**
   * Loops through the collection (inefficiently, from start to end) to find
   * something which matches.
   *
   *
   * @param  {String} arg1  If run with only one argument, this is the string to look for in the primary keys.
   * @param  {String} arg2  If run with two arguments, this is the string to look for in the first argument
   * @param  {Boolean} fuzzy If run with a truthy value, will do a somewhat fuzzy search for the string anywhere in the key TODO use a real fuzzy search library if available.
   * @return {Array}       An array of found items [] if none are found TODO decide if we want to return null instead of [] when there were no results.
   */
  find: {
    value: function(arg1, arg2, fuzzy) {
      var results = [],
        searchingFor,
        optionalKeyToIdentifyItem,
        sanitzedSearchingFor;

      if (arg1 && arg2) {
        searchingFor = arg2;
        optionalKeyToIdentifyItem = arg1;
      } else if (arg1 && !arg2) {
        searchingFor = arg1;
      }

      optionalKeyToIdentifyItem = optionalKeyToIdentifyItem || this.primaryKey || "id";
      this.debug("find is searchingFor", searchingFor);
      if (!searchingFor) {
        return results;
      }

      if (Object.prototype.toString.call(searchingFor) === "[object Array]") {
        this.bug("User is using find on an array... ths is best re-coded to use search or something else.", searchingFor);
        this.todo("User is using find on an array... ths is best re-coded to use search or something else. Instead running find only on the first item in the array.");
        searchingFor = searchingFor[0];
      }

      if (typeof searchingFor === "object" && !(searchingFor instanceof RegExp)) {
        // this.debug("find is searchingFor an object", searchingFor);
        if (Object.keys(searchingFor).length === 0) {
          return results;
        }

        var key = searchingFor[this.primaryKey];
        if (!key && this.INTERNAL_MODELS && this.INTERNAL_MODELS.item && typeof this.INTERNAL_MODELS.item === "function" && !(searchingFor instanceof this.INTERNAL_MODELS.item)) {
          searchingFor = new this.INTERNAL_MODELS.item(searchingFor);
        } else if (!key && !(searchingFor instanceof FieldDBObject)) {
          searchingFor = new FieldDBObject(searchingFor);
        } else if (!key) {
          this.bug("This searchingFor is a object, and has no key. this is a problem. ", searchingFor);
        }
        key = searchingFor[this.primaryKey];
        searchingFor = key;
        // this.debug("find is searchingFor an object whose key is ", searchingFor);
      }

      if (this[searchingFor]) {
        results.push(this[searchingFor]);
      }
      if (fuzzy) {
        searchingFor = new RegExp(".*" + searchingFor + ".*", "i");
        sanitzedSearchingFor = new RegExp(".*" + this.sanitizeStringForPrimaryKey(searchingFor) + ".*", "i");
        this.debug("fuzzy ", searchingFor, sanitzedSearchingFor);
      }
      // this.debug("searching for somethign with indexOf", searchingFor);
      if (!searchingFor || !searchingFor.test || typeof searchingFor.test !== "function") {
        /* if not a regex, the excape it */
        if (searchingFor && searchingFor.indexOf && searchingFor.indexOf("/") !== 0) {
          searchingFor = regExpEscape(searchingFor);
        }
        searchingFor = new RegExp("^" + searchingFor + "$");
      }
      this.debug("searchingFor", searchingFor);
      for (var index in this.collection) {
        if (!this.collection.hasOwnProperty(index)) {
          continue;
        }
        if (searchingFor.test(this.collection[index][optionalKeyToIdentifyItem])) {
          results.push(this.collection[index]);
        } else if (fuzzy && sanitzedSearchingFor.test(this.collection[index][optionalKeyToIdentifyItem])) {
          results.push(this.collection[index]);
        }
      }

      return results;
    }
  },

  fuzzyFind: {
    value: function(searchingFor, optionalKeyToIdentifyItem) {

      return this.find(searchingFor, optionalKeyToIdentifyItem, true);
    }
  },

  set: {
    value: function(searchingFor, value, optionalKeyToIdentifyItem, optionalInverted) {
      optionalKeyToIdentifyItem = optionalKeyToIdentifyItem || this.primaryKey || "id";

      if (optionalInverted === null || optionalInverted === undefined) {
        optionalInverted = this.inverted;
      }

      if (value && this[searchingFor] && (value === this[searchingFor] || (typeof this[searchingFor].equals === "function" && this[searchingFor].equals(value)))) {
        this.debug("Not setting " + searchingFor + ", it  was already the same in the collection");
        return this[searchingFor];
      }

      if (value === null || value === undefined) {
        this.remove(searchingFor, optionalKeyToIdentifyItem);
      }

      for (var index in this.collection) {
        if (!this.collection.hasOwnProperty(index)) {
          continue;
        }
        if (this.collection[index][optionalKeyToIdentifyItem] === searchingFor) {
          this.debug("found a match in the _collection, ", this.collection[index].equals);
          // this.collection[index].debugMode = true;
          // value.debugMode = true;
          if (this.collection[index] !== value ||
            (typeof this.collection[index].equals === "function" && !this.collection[index].equals(value))
          ) {
            this.warn("Overwriting an existing _collection member " + searchingFor + " at index " + index + " (they have the same key but are not equal, nor the same object) ");
            this.warn("Overwriting ", this.collection[index], "->", value);
            this.collection[index] = value;
          }
          return value;
        }
      }
      /* if not a reserved attribute, set on object for dot notation access */
      if (["collection", "primaryKey", "find", "set", "add", "inverted", "toJSON", "length", "encrypted", "confidential", "decryptedMode"].indexOf(searchingFor) === -1) {
        this[searchingFor] = value;
        /* also provide a case insensitive cleaned version if the key can be lower cased */
        if (typeof searchingFor.toLowerCase === "function") {
          this[searchingFor.toLowerCase().replace(/_/g, "")] = value;
        }

      } else {
        this.warn("An item was added to the collection which has a reserved word for its key... dot notation will not work to retreive this object, but find() will work. ", value);
      }

      if (optionalInverted) {
        this.collection.unshift(value);
      } else {
        this.collection.push(value);
      }
      return value;
    }
  },

  length: {
    get: function() {
      if (this.collection) {
        return this.collection.length;
      } else {
        return 0;
      }
    }
  },

  /**
   * This function should be used when trying to access a member using its id
   *
   * Originally we used this for import to create datum field labels: .replace(/[-""+=?./\[\]{}() ]/g,"")
   *
   * @param  {Object} member An object of the type of objects in this collection
   * @return {String}        The value of the primary key which is save to use as dot notation
   */
  getSanitizedDotNotationKey: {
    value: function(member) {
      if (!this.primaryKey) {
        this.warn("The primary key is undefined, nothing can be added!", this);
        throw "The primary key is undefined, nothing can be added!";
      }
      var value = member[this.primaryKey];
      if (!value) {
        this.warn("This object is missing a value for the prmary key " + this.primaryKey + "... it will be hard to find in the collection.", member);
        return;
      }
      if (typeof value.trim === "function") {
        value = value.trim();
      }
      var oldValue = value;
      value = this.sanitizeStringForPrimaryKey(value);
      if (value !== oldValue) {
        this.warn("The sanitized the dot notation key of this object is not the same as its primaryKey: " + oldValue + " -> " + value);
      }
      return value;
    }
  },

  add: {
    value: function(value) {
      if (this.INTERNAL_MODELS && this.INTERNAL_MODELS.item && value && value.constructor !== this.INTERNAL_MODELS.item) {
        // console.log("adding a internamodel ", value);
        if (!this.INTERNAL_MODELS.item.fieldDBtype || this.INTERNAL_MODELS.item.fieldDBtype !== "Document") {
          this.debug("casting an item to match the internal model", this.INTERNAL_MODELS.item, value);
          value = new this.INTERNAL_MODELS.item(value);
        } else {
          if (value.constructor === "object") {
            this.warn("this is going to be a FieldDBObject, even though its supposed to be a Document.", value);
            value = new FieldDBObject(value);
          } else {
            this.debug("this is " + value[this.primaryKey] + " already some sort of an object.", value.fieldDBtype);
          }
        }
      }
      var dotNotationKey = this.getSanitizedDotNotationKey(value);
      if (!dotNotationKey) {
        this.warn("The primary key " + this.primaryKey + " is undefined on this object, it cannot be added! ", value);
        throw "The primary key is undefined on this object, it cannot be added! " + value;
      }
      this.debug("adding " + dotNotationKey);
      this.set(dotNotationKey, value);
      return this[dotNotationKey];
    }
  },

  push: {
    value: function(value) {
      // self.debug(this.collection);
      this.set(this.getSanitizedDotNotationKey(value), value, null, false);
      // self.debug(this.collection);
    }
  },

  unshift: {
    value: function(value) {
      this.set(this.getSanitizedDotNotationKey(value), value, null, true);
    }
  },

  remove: {
    value: function(requestedRemoveFor, optionalKeyToIdentifyItem) {
      if (optionalKeyToIdentifyItem) {
        this.todo("remove optionalKeyToIdentifyItem " + optionalKeyToIdentifyItem);
      }
      var removed = [],
        itemIndex,
        key,
        searchingFor = [],
        self = this;

      if (Object.prototype.toString.call(requestedRemoveFor) !== "[object Array]") {
        requestedRemoveFor = [requestedRemoveFor];
      }
      // Look for the real item(s) in the collection
      requestedRemoveFor.map(function(requestedRemoveItem) {
        searchingFor = searchingFor.concat(self.find(requestedRemoveItem));
      });

      this.debug("requested remove of ", searchingFor);
      if (searchingFor.length === 0) {
        this.warn("Didn't remove object(s) which were not in the collection.", searchingFor);
        return removed;
      }
      /*
       * For every item, delete the dot reference to it
       */
      for (itemIndex = 0; itemIndex < searchingFor.length; itemIndex++) {
        if (!searchingFor[itemIndex] || searchingFor[itemIndex] === {}) {
          this.debug("skipping ", searchingFor[itemIndex]);
          continue;
        }
        key = this.getSanitizedDotNotationKey(searchingFor[itemIndex]);
        if (!key) {
          this.warn("This item had no primary key, it will only be removed from the collection. ", searchingFor[itemIndex]);
        }

        if (this[key]) {
          this.debug("removed dot notation for ", key);
          delete this[key];
        }

        if (this[key.toLowerCase().replace(/_/g, "")]) {
          this.debug("removed dot notation for ", key.toLowerCase().replace(/_/g, ""));
          delete this[key.toLowerCase().replace(/_/g, "")];
        }

      }

      /*
       * For every item in the collection, if it matches, remove it from the collection
       */
      for (itemIndex = this.collection.length - 1; itemIndex >= 0; itemIndex--) {
        if (searchingFor.indexOf(this.collection[itemIndex]) > -1 && removed.indexOf(this.collection[itemIndex]) === -1) {
          var thisremoved = this.collection.splice(itemIndex, 1);
          removed = removed.concat(thisremoved);
          // Find out if each removed item was requested
          for (var removedIndex = 0; removedIndex < thisremoved.length; removedIndex++) {
            if (typeof requestedRemoveFor[0] === "object" && typeof thisremoved[removedIndex].equals === "function") {
              var itMatches = false;
              for (var requestedIndex = 0; requestedIndex < requestedRemoveFor.length; requestedIndex++) {
                if (thisremoved[removedIndex].equals(requestedRemoveFor[requestedIndex])) {
                  itMatches = true;
                }
              }
              if (!itMatches) {
                this.warn("One of the requested removal items dont match what was removed ");
                this.debug("One of the requested removal items dont match what was removed ", requestedRemoveFor, "-> ", thisremoved[removedIndex]);
              }
            }
          }
        }
      }

      if (removed.length === 0) {
        this.warn("Didn't remove object(s) which were not in the collection.", searchingFor);
      }
      this.removedCollection = this.removedCollection || [];
      this.removedCollection = this.removedCollection.concat(removed);
      return removed;
    }
  },

  indexOf: {
    value: function(doc) {
      if (!this._collection || this.collection.length === 0) {
        return -1;
      }
      for (var docIndex = 0; docIndex < this._collection.length; docIndex++) {
        var key = doc[this.primaryKey];
        if (!key) {
          doc = this.find(doc);
          if (doc && doc.length > 0) {
            doc = doc[0];
          } else {
            return -1;
          }
          key = doc[this.primaryKey];
        }
        if (this._collection[docIndex][this.primaryKey] === key) {
          return docIndex;
        }

      }
      return -1;
    }
  },

  reorder: {
    value: function(old_index, new_index) {
      if (typeof old_index === "object") {
        old_index = this.indexOf(old_index);
      }
      if (new_index >= this._collection.length) {
        var k = new_index - this._collection.length;
        while ((k--) + 1) {
          this._collection.push(undefined);
        }
      }
      this._collection.splice(new_index, 0, this._collection.splice(old_index, 1)[0]);
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      if (removeEmptyAttributes) {
        this.todo("removeEmptyAttributes is not implemented: " + removeEmptyAttributes);
      }
      var self = this;

      var json = this._collection.map(function(item) {
        if (typeof item.toJSON === "function") {
          self.debug("This item has a toJSON, which we will call instead");
          return item.toJSON();
        } else {
          return item;
        }
      });

      return json;
    }
  },

  /**
   * Creates a deep copy of the object (not a reference)
   * @return {Object} a near-clone of the objcet
   */
  clone: {
    value: function(includeEvenEmptyAttributes) {
      if (includeEvenEmptyAttributes) {
        this.todo("includeEvenEmptyAttributes is not implemented: " + includeEvenEmptyAttributes);
      }
      var json = JSON.parse(JSON.stringify(this.toJSON()));

      return json;
    }
  },

  map: {
    get: function() {
      if (this._collection && typeof this._collection.map === "function") {
        var self = this;
        return function(callback) {
          return this._collection.map.apply(self._collection, [callback]);
        };
      } else {
        return undefined;
      }
    }
  },

  /**
   *  Cleans a value to become a primary key on an object (replaces punctuation and symbols with underscore)
   *  formerly: item.replace(/[-\""+=?.*&^%,\/\[\]{}() ]/g, "")
   *
   * @param  String value the potential primary key to be cleaned
   * @return String       the value cleaned and safe as a primary key
   */
  sanitizeStringForPrimaryKey: {
    value: function(value) {
      this.debug("sanitizeStringForPrimaryKey " + value);
      if (!value) {
        return null;
      }
      if (value.trim) {
        value = Diacritics.clean(value);
        value = value.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_/, "").replace(/_$/, "");
        return this.camelCased(value);
      } else if (typeof value === "number") {
        return parseInt(value, 10);
      } else {
        return null;
      }
    }
  },
  capitalizeFirstCharacterOfPrimaryKeys: {
    value: {
      get: function() {
        if (this._capitalizeFirstCharacterOfPrimaryKeys === undefined) {
          return false;
        }
        return this._capitalizeFirstCharacterOfPrimaryKeys;
      },
      set: function(value) {
        this._capitalizeFirstCharacterOfPrimaryKeys = value;
      }
    }
  },
  camelCased: {
    value: function(value) {
      if (!value) {
        return null;
      }
      if (value.replace) {
        value = value.replace(/_([a-zA-Z])/g, function(word) {
          return word[1].toUpperCase();
        });
        if (this.capitalizeFirstCharacterOfPrimaryKeys) {
          value = value[0].toUpperCase() + value.substring(1, value.length);
        } else {
          value = value[0].toLowerCase() + value.substring(1, value.length);
        }
      }
      return value;
    }
  },

  merge: {
    value: function(callOnSelf, anotherCollection, optionalOverwriteOrAsk) {
      var aCollection,
        resultCollection,
        overwrite,
        localCallOnSelf,
        self = this;

      if (callOnSelf === "self") {
        this.debug("Merging into myself. ");
        aCollection = this;
      } else {
        aCollection = callOnSelf;
      }
      resultCollection = this;
      if (!optionalOverwriteOrAsk) {
        optionalOverwriteOrAsk = "";
      }

      if (!anotherCollection || anotherCollection.length === 0) {
        this.debug("The new collection was empty, not merging.", anotherCollection);
        return resultCollection;
      }

      aCollection._collection.map(function(anItem) {
        var idToMatch = anItem[aCollection.primaryKey].toLowerCase();
        var anotherItem = anotherCollection[idToMatch];
        var resultItem = resultCollection[idToMatch];
        if (!resultItem && typeof anItem.constructor === "function") {
          var json = anItem.toJSON ? anItem.toJSON() : anItem;
          resultItem = new anItem.constructor(json);
          var existingInCollection = resultCollection.find(resultItem);
          if (existingInCollection.length === 0) {
            resultCollection.add(resultItem);
          } else {
            resultItem = existingInCollection[0];
            self.debug("resultItem was already in the resultCollection  ", existingInCollection, resultItem);
          }
        }

        if (anItem !== aCollection[idToMatch]) {
          self.bug(" Looking at an anItem that doesnt match the aCollection's member of " + idToMatch);
        }

        if (anotherItem === undefined) {
          // no op, the new one isn't set
          self.debug(idToMatch + " was missing in new collection");
          resultCollection[idToMatch] = anItem;

        } else if (anItem === anotherItem || (typeof anItem.equals === "function" && anItem.equals(anotherItem))) {
          // no op, they are equal enough
          self.debug(idToMatch + " were equal.", anItem, anotherItem);
          if (resultItem !== anItem) {
            resultCollection[idToMatch] = anItem;
          }
        } else if (!anItem || anItem === [] || anItem.length === 0 || anItem === {}) {
          self.debug(idToMatch + " was previously empty, taking the new value");
          resultCollection[idToMatch] = anotherItem;
        } else {
          //  if two arrays: concat
          if (Object.prototype.toString.call(anItem) === "[object Array]" && Object.prototype.toString.call(anotherItem) === "[object Array]") {
            self.debug(idToMatch + " was an array, concatinating with the new value", anItem, " ->", anotherItem);
            resultItem = anItem.concat(anotherItem);

            //TODO unique it?
            self.debug("  ", resultItem);
          } else {
            // if two fielddbObjects: recursively merge
            if (typeof resultItem.merge === "function") {
              if (callOnSelf === "self") {
                localCallOnSelf = callOnSelf;
              } else {
                localCallOnSelf = anItem;
              }
              self.debug("Requesting merge of internal property " + idToMatch + " using method: " + localCallOnSelf);
              var result = resultItem.merge(localCallOnSelf, anotherItem, optionalOverwriteOrAsk);
              self.debug("after internal merge ", result);
              // resultCollection[idToMatch] = resultItem;
              self.debug("after internal merge ", resultItem);

            } else {
              overwrite = optionalOverwriteOrAsk;
              if (optionalOverwriteOrAsk.indexOf("overwrite") === -1) {
                // overwrite = self.confirm("Do you want to overwrite " + idToMatch);
                self.confirm("I found a conflict for " + idToMatch + ", Do you want to overwrite it from " + JSON.stringify(anItem) + " -> " + JSON.stringify(anotherItem))
                  .then(function() {
                    self.warn("IM HERE HERE");
                    self.warn("Overwriting contents of " + idToMatch + " (this may cause disconnection in listeners)");
                    self.debug("Overwriting  ", anItem, " ->", anotherItem);
                    resultCollection[idToMatch] = anotherItem;
                  }, function() {
                    self.debug("Not Overwriting  ", anItem, " ->", anotherItem);
                    resultCollection[idToMatch] = anItem;
                  });
              } else {
                self.warn("Overwriting contents of " + idToMatch + " (this may cause disconnection in listeners)");
                self.debug("Overwriting  ", anItem, " ->", anotherItem);
                resultCollection[idToMatch] = anotherItem;
              }
            }
          }
        }
      });
      anotherCollection._collection.map(function(anotherItem) {
        var idToMatch = anotherItem[aCollection.primaryKey];
        var anItem = aCollection[idToMatch];
        // var resultItem = resultCollection[idToMatch];

        if (anotherItem !== anotherCollection[idToMatch]) {
          self.bug(" Looking at an anItem that doesnt match the anotherCollection's member of " + idToMatch);
        }

        if (anItem === undefined) {
          self.debug(idToMatch + " was missing in target, adding it");
          var existingInCollection = resultCollection.find(anotherItem);
          if (existingInCollection.length === 0) {
            resultCollection.add(anotherItem);
          } else {
            anotherItem = existingInCollection[0];
            self.debug("anotherItem was already in the resultCollection ", existingInCollection, anotherItem);
          }

        } else if (anotherItem === undefined) {
          // no op, the new one isn't set
          self.debug(idToMatch + " was oddly undefined");
          resultCollection[idToMatch] = anItem;
        } else if (anItem === anotherItem || (typeof anItem.equals === "function" && anItem.equals(anotherItem))) {
          // no op, they are equal enough
          // self.debug(idToMatch + " were equal.", anItem, anotherItem);
          resultCollection[idToMatch] = anItem;
        } else if (!anotherItem || anotherItem === [] || anotherItem.length === 0 || anotherItem === {}) {
          self.warn(idToMatch + " was empty in the new collection, so it was replaced with an empty anItem.");
          resultCollection[idToMatch] = anotherItem;
        } else {
          // both exist and are not equal, and so have already been merged above.
          self.debug(idToMatch + " existed in both and are not equal, and so have already been merged above.");
        }
      });

      return resultCollection;
    }
  },

  encrypted: {
    get: function() {
      return;
    },
    set: function(value) {
      if (this._collection) {
        if (this._collection.map === undefined) {
          this.warn("This collection isn't an array, this is odd", this);
        }
        this._collection.map(function(item) {
          item.encrypted = value;
        });
      }
    }
  },

  confidential: {
    get: function() {
      return;
    },
    set: function(value) {
      if (this._collection) {
        if (this._collection.map === undefined) {
          this.warn("This collection isn't an array, this is odd", this);
        }
        this._collection.map(function(item) {
          item.confidential = value;
        });
      }
    }
  },

  decryptedMode: {
    get: function() {
      return;
    },
    set: function(value) {
      if (this._collection) {
        if (this._collection.map === undefined) {
          this.warn("This collection isn't an array, this is odd", this);
        }
        this._collection.map(function(item) {
          item.decryptedMode = value;
        });
      }
    }
  },

  dbname: {
    get: function() {
      return;
    },
    set: function(value) {
      if (this._collection) {
        if (this._collection.map === undefined) {
          this.warn("This collection isn't an array, this is odd", this);
        }
        this._collection.map(function(item) {
          item.dbname = value;
        });
      }
    }
  }



});

exports.Collection = Collection;

},{"./FieldDBObject":4,"diacritic":75}],3:[function(require,module,exports){
var Q = require("q");
var CORS = require("./CORS").CORS;

var FieldDBConnection = FieldDBConnection || {};
FieldDBConnection.CORS = CORS;

FieldDBConnection.setXMLHttpRequestLocal = function(injectedCORS) {
  FieldDBConnection.CORS = injectedCORS;
};

FieldDBConnection.connection = {
  localCouch: {
    connected: false,
    url: "https://localhost:6984",
    couchUser: null
  },
  centralAPI: {
    connected: false,
    url: "https://localhost:3181/v2",
    fieldDBUser: null
  }
};

FieldDBConnection.connect = function() {
  var deferred = Q.defer();

  if (this.timestamp && this.connection.couchUser && this.connection.fieldDBUser && Date.now() - this.timestamp < 1000) {
    console.log("connection information is not old.");
    Q.nextTick(function() {
      deferred.resolve(this.connection);
    });
    return deferred.promise;
  }

  var deferredLocal = Q.defer(),
    deferredCentral = Q.defer(),
    promises = [deferredLocal.promise, deferredCentral.promise],
    self = this;

  // Find out if this user is able to work offline with a couchdb
  FieldDBConnection.CORS.makeCORSRequest({
    method: "GET",
    dataType: "json",
    url: self.connection.localCouch.url + "/_session"
  }).then(function(response) {
    this.timestamp = Date.now();
    console.log(response);

    if (!response || !response.userCtx) {
      self.connection.localCouch.connected = false;
      self.connection.localCouch.timestamp = Date.now();
      deferredLocal.reject({
        eror: "Recieved an odd response from the local couch. Can\"t contact the local couchdb, it might be off or it might not be installed. This device can work online only."
      });
      return;
    }

    self.connection.localCouch.connected = true;
    self.connection.localCouch.timestamp = Date.now();
    self.connection.localCouch.couchUser = response.userCtx;
    if (!response.userCtx.name) {
      FieldDBConnection.CORS.makeCORSRequest({
        method: "POST",
        dataType: "json",
        data: {
          name: "public",
          password: "none"
        },
        url: self.connection.localCouch.url + "/_session"
      }).then(function() {
        console.log("Logged the user in as the public user so they can only see public info.");
        deferredLocal.resolve(response);

      }).fail(function(reason) {
        console.log("The public user doesnt exist on this couch...", reason);
        deferredLocal.reject(reason);
      });
    }

  }).fail(function(reason) {
    this.timestamp = Date.now();
    console.log(reason);
    self.connection.localCouch.connected = false;
    self.connection.localCouch.timestamp = Date.now();
    deferredLocal.reject(reason);
  });

  // Find out if this user is able to work online with the central api
  FieldDBConnection.CORS.makeCORSRequest({
    method: "GET",
    dataType: "json",
    url: self.connection.centralAPI.url + "/users"
  }).then(function(response) {
    this.timestamp = Date.now();
    console.log("FieldDBConnection", response);

    if (!response || !response.user) {
      self.connection.centralAPI.connected = false;
      self.connection.centralAPI.timestamp = Date.now();
      deferredCentral.reject({
        eror: "Received an odd response from the api. Can\"t contact the api server. This is a bug which must be reported."
      });
      return;
    }

    self.connection.centralAPI.connected = true;
    self.connection.centralAPI.timestamp = Date.now();
    self.connection.localCouch.user = response.user;
    if (!response.user.username) {
      FieldDBConnection.CORS.makeCORSRequest({
        method: "POST",
        dataType: "json",
        data: {
          username: "public",
          password: "none"
        },
        url: self.connection.centralAPI.url + "/users"
      }).then(function() {
        console.log("Logged the user in as the public user so they can only see public info.");
        deferredCentral.resolve(response);

      }).fail(function(reason) {
        console.log("The public user doesn\"t exist on this couch...", reason);
        deferredCentral.reject(reason);
      });
    }

  }).fail(function(reason) {
    this.timestamp = Date.now();
    console.log(reason);
    self.connection.centralAPI.connected = false;
    self.connection.centralAPI.timestamp = Date.now();
    deferredCentral.reject(reason);
  });

  Q.allSettled(promises).then(function(results) {
    console.log(results);
    deferred.resolve(this.connection);
  });

  return deferred.promise;

};


if (exports) {
  exports.FieldDBConnection = FieldDBConnection;
}

},{"./CORS":1,"q":76}],4:[function(require,module,exports){
var process=require("__browserify_process");/* globals alert, confirm, navigator, Android */
var CORS = require("./CORS").CORS;
var Diacritics = require("diacritic");
var Q = require("q");
var package;
try {
  package = require("./../package.json");
} catch (e) {
  console.log("failed to load package.json", e);
  package = {
    version: "2.2.0"
  };
}
// var FieldDBDate = function FieldDBDate(options) {
//   // this.debug("In FieldDBDate ", options);
//   Object.apply(this, arguments);
//   if (options) {
//     this.timestamp = options;
//   }
// };

// FieldDBDate.prototype = Object.create(Object.prototype, /** @lends FieldDBDate.prototype */ {
//   constructor: {
//     value: FieldDBDate
//   },

//   timestamp: {
//     get: function() {
//       return this._timestamp || 0;
//     },
//     set: function(value) {
//       if (value === this._timestamp) {
//         return;
//       }
//       if (!value) {
//         delete this._timestamp;
//         return;
//       }
//       if (value.replace) {
//         try {
//           value = value.replace(/["\\]/g, "");
//           value = new Date(value);
//           /* Use date modified as a timestamp if it isnt one already */
//           value = value.getTime();
//         } catch (e) {
//           this.warn("Upgraded timestamp" + value);
//         }
//       }
//       this._timestamp = value;
//     }
//   },

//   toJSON: {
//     value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
//       var result = this._timestamp;

//       if (includeEvenEmptyAttributes) {
//         result = this._timestamp || 0;
//       }

//       if (removeEmptyAttributes && !this._timestamp) {
//         result = 0;
//       }
//       return result;
//     }
//   }
// });

/**
 * @class An extendable object which can recieve new parameters on creation.
 *
 * @param {Object} options Optional json initialization object
 * @property {String} dbname This is the identifier of the corpus, it is set when
 *           a corpus is created. It must be a file save name, and be a permitted
 *           name in CouchDB which means it is [a-z] with no uppercase letters or
 *           symbols, by convention it cannot contain -, but _ is acceptable.

 * @extends Object
 * @tutorial tests/FieldDBObjectTest.js
 */
var FieldDBObject = function FieldDBObject(json) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "FieldDBObject";
  }
  this.verbose("In parent an json", json);
  // Set the confidential first, so the rest of the fields can be encrypted
  if (json && json.confidential && this.INTERNAL_MODELS["confidential"]) {
    this.confidential = new this.INTERNAL_MODELS["confidential"](json.confidential);
  }
  if (this.INTERNAL_MODELS) {
    this.debug("parsing with ", this.INTERNAL_MODELS);
  }
  var simpleModels = [];
  for (var member in json) {
    if (!json.hasOwnProperty(member)) {
      continue;
    }
    this.debug("JSON: " + member);
    if (json[member] && this.INTERNAL_MODELS && this.INTERNAL_MODELS[member] && typeof this.INTERNAL_MODELS[member] === "function" && json[member].constructor !== this.INTERNAL_MODELS[member]) {
      if (typeof json[member] === "string" && this.INTERNAL_MODELS[member].constructor && this.INTERNAL_MODELS[member].prototype.fieldDBtype === "ContextualizableObject") {
        this.warn("this member " + member + " is supposed to be a ContextualizableObject but it is a string, not converting it into a ContextualizableObject", json[member]);
        simpleModels.push(member);
      } else {
        this.debug("Parsing model: " + member);
        json[member] = new this.INTERNAL_MODELS[member](json[member]);
      }

    } else {
      simpleModels.push(member);
    }
    this[member] = json[member];
  }
  if (simpleModels.length > 0) {
    this.debug("simpleModels", simpleModels.join(", "));
  }
  Object.apply(this, arguments);
  // if (!this._rev) {
  if (!this.id) {
    this.dateCreated = Date.now();
  }

  if (!this.render) {
    this.render = function(options) {
      this.warn("Rendering, but the render was not injected for this " + this.fieldDBtype, options);
    };
  }
};

FieldDBObject.software = {};
FieldDBObject.hardware = {};

FieldDBObject.DEFAULT_STRING = "";
FieldDBObject.DEFAULT_OBJECT = {};
FieldDBObject.DEFAULT_ARRAY = [];
FieldDBObject.DEFAULT_COLLECTION = [];
FieldDBObject.DEFAULT_VERSION = "v" + package.version;
FieldDBObject.DEFAULT_DATE = 0;

FieldDBObject.bug = function(message) {
  try {
    alert(message);
  } catch (e) {
    console.warn(this.fieldDBtype.toUpperCase() + " BUG: " + message);
  }
};

FieldDBObject.warn = function(message, message2, message3, message4) {
  console.warn(this.fieldDBtype.toUpperCase() + " WARN: " + message);
  if (message2) {
    console.warn(message2);
  }
  if (message3) {
    console.warn(message3);
  }
  if (message4) {
    console.warn(message4);
  }
};

FieldDBObject.confirm = function(message, optionalLocale) {
  var deferred = Q.defer(),
    self = this;

  Q.nextTick(function() {
    var response;

    if (self.alwaysConfirmOkay) {
      console.warn(self.fieldDBtype.toUpperCase() + " NOT ASKING USER: " + message + " \nThe code decided that they would probably yes and it wasnt worth asking.");
      response = self.alwaysConfirmOkay;
    }

    try {
      response = confirm(message);
    } catch (e) {
      console.warn(self.fieldDBtype.toUpperCase() + " ASKING USER: " + message + " pretending they said " + self.alwaysConfirmOkay);
      response = self.alwaysConfirmOkay;
    }

    if (response) {
      deferred.resolve({
        message: message,
        optionalLocale: optionalLocale,
        response: response
      });
    } else {
      deferred.reject({
        message: message,
        optionalLocale: optionalLocale,
        response: response
      });
    }

  });
  return deferred.promise;
};
/* set the application if you want global state (ie for checking if a user is authorized) */
// FieldDBObject.application = {}

/**
 * The uuid generator uses a "GUID" like generation to create a unique string.
 *
 * @returns {String} a string which is likely unique, in the format of a
 *          Globally Unique ID (GUID)
 */
FieldDBObject.uuidGenerator = function() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return Date.now() + (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4());
};
FieldDBObject.getHumanReadableTimestamp = function() {
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth() + 1;
  var day = today.getDate();
  var hour = today.getHours();
  var minute = today.getMinutes();

  if (month < 10) {
    month = "0" + month;
  }
  if (day < 10) {
    day = "0" + day;
  }
  if (hour < 10) {
    hour = "0" + hour;
  }
  if (minute < 10) {
    minute = "0" + minute;
  }

  return year + "-" + month + "-" + day + "_" + hour + "." + minute;
};

/** @lends FieldDBObject.prototype */
FieldDBObject.prototype = Object.create(Object.prototype, {
  constructor: {
    value: FieldDBObject
  },

  fieldDBtype: {
    configurable: true,
    get: function() {
      return this._fieldDBtype;
    },
    set: function(value) {
      if (value !== this.fieldDBtype) {
        this.debug("Using type " + this.fieldDBtype + " when the incoming object was " + value);
      }
    }
  },

  /**
   * Can be set to true to debug all objects, or false to debug no objects and true only on the instances of objects which
   * you want to debug.
   *
   * @type {Boolean}
   */
  debugMode: {
    get: function() {
      if (this.perObjectDebugMode === undefined) {
        return false;
      } else {
        return this.perObjectDebugMode;
      }
    },
    set: function(value) {
      if (value === this.perObjectDebugMode) {
        return;
      }
      if (value === null || value === undefined) {
        delete this.perObjectDebugMode;
        return;
      }
      this.perObjectDebugMode = value;
    }
  },
  debug: {
    value: function(message, message2, message3, message4) {
      try {
        if (navigator && navigator.appName === "Microsoft Internet Explorer") {
          return;
        }
      } catch (e) {
        //do nothing, we are in node or some non-friendly browser.
      }
      if (this.debugMode) {
        console.log(this.fieldDBtype.toUpperCase() + " DEBUG: " + message);

        if (message2) {
          console.log(message2);
        }
        if (message3) {
          console.log(message3);
        }
        if (message4) {
          console.log(message4);
        }
      }
    }
  },
  verboseMode: {
    get: function() {
      if (this.perObjectVerboseMode === undefined) {
        return false;
      } else {
        return this.perObjectVerboseMode;
      }
    },
    set: function(value) {
      if (value === this.perObjectVerboseMode) {
        return;
      }
      if (value === null || value === undefined) {
        delete this.perObjectVerboseMode;
        return;
      }
      this.perObjectVerboseMode = value;
    }
  },
  verbose: {
    value: function(message, message2, message3, message4) {
      if (this.verboseMode) {
        this.debug(message, message2, message3, message4);
      }
    }
  },
  bug: {
    value: function(message) {
      if (this.bugMessage) {
        if (this.bugMessage.indexOf(message) > -1) {
          this.warn("Not repeating bug message: " + message);
          return;
        }
        this.bugMessage += ";;; ";
      } else {
        this.bugMessage = "";
      }

      this.bugMessage = this.bugMessage + message;
      FieldDBObject.bug.apply(this, arguments);
    }
  },
  alwaysConfirmOkay: {
    get: function() {
      if (this.perObjectAlwaysConfirmOkay === undefined) {
        return false;
      } else {
        return this.perObjectAlwaysConfirmOkay;
      }
    },
    set: function(value) {
      if (value === this.perObjectAlwaysConfirmOkay) {
        return;
      }
      if (value === null || value === undefined) {
        delete this.perObjectAlwaysConfirmOkay;
        return;
      }
      this.perObjectAlwaysConfirmOkay = value;
    }
  },
  confirm: {
    value: function(message) {
      if (this.confirmMessage) {
        this.confirmMessage += "\n";
      } else {
        this.confirmMessage = "";
      }
      this.confirmMessage = this.confirmMessage + message;

      return FieldDBObject.confirm.apply(this, arguments);
    }
  },
  warn: {
    value: function(message) {
      if (this.warnMessage) {
        this.warnMessage += ";;; ";
      } else {
        this.warnMessage = "";
      }
      this.warnMessage = this.warnMessage + message;
      FieldDBObject.warn.apply(this, arguments);
    }
  },
  todo: {
    value: function(message, message2, message3, message4) {
      console.warn(this.fieldDBtype.toUpperCase() + " TODO: " + message);
      if (message2) {
        console.warn(message2);
      }
      if (message3) {
        console.warn(message3);
      }
      if (message4) {
        console.warn(message4);
      }
    }
  },

  save: {
    value: function(optionalUserWhoSaved) {
      var deferred = Q.defer(),
        self = this;

      if (this.fetching) {
        self.warn("Fetching is in process, can't save right now...");
        return;
      }
      if (this.saving) {
        self.warn("Save was already in process...");
        return;
      }
      this.saving = true;

      //update to this version
      this.version = FieldDBObject.DEFAULT_VERSION;

      try {
        FieldDBObject.software = FieldDBObject.software || {};
        FieldDBObject.software.appCodeName = navigator.appCodeName;
        FieldDBObject.software.appName = navigator.appName;
        FieldDBObject.software.appVersion = navigator.appVersion;
        FieldDBObject.software.cookieEnabled = navigator.cookieEnabled;
        FieldDBObject.software.doNotTrack = navigator.doNotTrack;
        FieldDBObject.software.hardwareConcurrency = navigator.hardwareConcurrency;
        FieldDBObject.software.language = navigator.language;
        FieldDBObject.software.languages = navigator.languages;
        FieldDBObject.software.maxTouchPoints = navigator.maxTouchPoints;
        FieldDBObject.software.onLine = navigator.onLine;
        FieldDBObject.software.platform = navigator.platform;
        FieldDBObject.software.product = navigator.product;
        FieldDBObject.software.productSub = navigator.productSub;
        FieldDBObject.software.userAgent = navigator.userAgent;
        FieldDBObject.software.vendor = navigator.vendor;
        FieldDBObject.software.vendorSub = navigator.vendorSub;
        if (navigator && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === "function") {
          navigator.geolocation.getCurrentPosition(function(position) {
            self.debug("recieved position information");
            FieldDBObject.software.location = position.coords;
          });
        }
      } catch (e) {
        this.debug("Error loading software ", e);
        FieldDBObject.software = FieldDBObject.software || {};
        FieldDBObject.software.version = process.version;
        FieldDBObject.software.appVersion = "PhantomJS unknown";

        try {
          var avoidmontagerequire = require;
          var os = avoidmontagerequire("os");
          FieldDBObject.hardware = FieldDBObject.hardware || {};
          FieldDBObject.hardware.endianness = os.endianness();
          FieldDBObject.hardware.platform = os.platform();
          FieldDBObject.hardware.hostname = os.hostname();
          FieldDBObject.hardware.type = os.type();
          FieldDBObject.hardware.arch = os.arch();
          FieldDBObject.hardware.release = os.release();
          FieldDBObject.hardware.totalmem = os.totalmem();
          FieldDBObject.hardware.cpus = os.cpus().length;
        } catch (e) {
          this.debug(" hardware is unknown.", e);
          FieldDBObject.hardware = FieldDBObject.hardware || {};
          FieldDBObject.software.appVersion = "Device unknown";
        }
      }
      if (!optionalUserWhoSaved) {
        optionalUserWhoSaved = {
          name: "",
          username: "unknown"
        };
        try {
          if (FieldDBObject.application && FieldDBObject.application.corpus && FieldDBObject.application.corpus.connectionInfo) {
            var connectionInfo = FieldDBObject.application.corpus.connectionInfo;
            optionalUserWhoSaved.username = connectionInfo.userCtx.name;
          }
        } catch (e) {
          this.warn("Can't get the corpus connection info to guess who saved this.", e);
        }
      }
      // optionalUserWhoSaved._name = optionalUserWhoSaved.name || optionalUserWhoSaved.username || optionalUserWhoSaved.browserVersion;
      if (typeof optionalUserWhoSaved.toJSON === "function") {
        var asJson = optionalUserWhoSaved.toJSON();
        asJson.name = optionalUserWhoSaved.name;
        optionalUserWhoSaved = asJson;
      } else {
        optionalUserWhoSaved.name = optionalUserWhoSaved.name;
      }
      // optionalUserWhoSaved.browser = browser;

      if (!this._rev) {
        this._dateCreated = Date.now();
        var enteredByUser = this.enteredByUser || {};
        if (this.fields && this.fields.enteredbyuser) {
          enteredByUser = this.fields.enteredbyuser;
        } else if (!this.enteredByUser) {
          this.enteredByUser = enteredByUser;
        }
        enteredByUser.value = optionalUserWhoSaved.name || optionalUserWhoSaved.username;
        enteredByUser.json = enteredByUser.json || {};
        enteredByUser.json.user = optionalUserWhoSaved;
        enteredByUser.json.software = FieldDBObject.software;
        try {
          enteredByUser.json.hardware = Android ? Android.deviceDetails : FieldDBObject.hardware;
        } catch (e) {
          this.debug("Cannot detect the hardware used for this save.", e);
          enteredByUser.json.hardware = FieldDBObject.hardware;
        }

      } else {
        this._dateModified = Date.now();

        var modifiedByUser = this.modifiedByUser || {};
        if (this.fields && this.fields.modifiedbyuser) {
          modifiedByUser = this.fields.modifiedbyuser;
        } else if (!this.modifiedByUser) {
          this.modifiedByUser = modifiedByUser;
        }
        if (this.modifiedByUsers) {
          modifiedByUser = {
            json: {
              users: this.modifiedByUsers
            }
          };
          delete this.modifiedByUsers;
        }

        modifiedByUser.value = modifiedByUser.value ? modifiedByUser.value + ", " : "";
        modifiedByUser.value += optionalUserWhoSaved.name || optionalUserWhoSaved.username;
        modifiedByUser.json = modifiedByUser.json || {};
        if (modifiedByUser.users) {
          modifiedByUser.json.users = modifiedByUser.users;
          delete modifiedByUser.users;
        }
        modifiedByUser.json.users = modifiedByUser.json.users || [];
        optionalUserWhoSaved.software = FieldDBObject.software;
        optionalUserWhoSaved.hardware = FieldDBObject.hardware;
        modifiedByUser.json.users.push(optionalUserWhoSaved);
      }

      if (FieldDBObject.software && FieldDBObject.software.location) {
        var location;
        if (this.location) {
          location = this.location;
        } else if (this.fields && this.fields.location) {
          location = this.fields.location;
        }
        if (location) {
          location.json = location.json || {};
          location.json.previousLocations = location.json.previousLocations || [];
          if (location.json && location.json.location && location.json.location.latitude) {
            location.json.previousLocations.push(location.json.location);
          }
          this.debug("overwriting location ", location);
          location.json.location = FieldDBObject.software.location;
          location.value = location.json.location.latitude + "," + location.json.location.longitude;
        }
      }

      this.debug("saving   ", this);

      var url = this.id ? "/" + this.id : "";
      url = this.url + url;
      var data = this.toJSON();
      CORS.makeCORSRequest({
        type: this.id ? "PUT" : "POST",
        dataType: "json",
        url: url,
        data: data
      }).then(function(result) {
          self.debug("saved ", result);
          self.saving = false;
          if (result.id) {
            self.id = result.id;
            self.rev = result.rev;
            deferred.resolve(self);
          } else {
            deferred.reject(result);
          }
        },
        function(reason) {
          self.debug(reason);
          self.saving = false;
          deferred.reject(reason);
        })
        .catch(function(reason) {
          self.debug(reason);
          self.saving = false;
          deferred.reject(reason);
        });

      return deferred.promise;
    }
  },

  delete: {
    value: function(reason) {
      return this.trash(reason);
    }
  },

  trash: {
    value: function(reason) {
      this.trashed = "deleted";
      if (reason) {
        this.trashedReason = reason;
      }
      this.todo("consider using a confirm to ask for a reason for deleting the item");
      return this.save();
    }
  },

  undelete: {
    value: function(reason) {
      this.trashed = "restored";
      if (reason) {
        this.untrashedReason = reason;
      }
      this.todo("consider using a confirm to ask for a reason for undeleting the item");
      return this.save();
    }
  },

  saveToGit: {
    value: function(commit) {
      var deferred = Q.defer(),
        self = this;
      Q.nextTick(function() {
        self.todo("If in nodejs, write to file and do a git commit with optional user's email who modified the file and push ot a branch with that user's username");
        self.debug("Commit to be used: ", commit);
        deferred.resolve(self);
      });
      return deferred.promise;
    }
  },

  equals: {
    value: function(anotherObject) {
      for (var aproperty in this) {
        if (!this.hasOwnProperty(aproperty) || typeof this[aproperty] === "function") {
          this.debug("skipping equality of " + aproperty);
          continue;
        }
        if /* use fielddb equality function first */ (this[aproperty] && typeof this[aproperty].equals === "function") {
          if (!this[aproperty].equals(anotherObject[aproperty])) {
            this.debug("  " + aproperty + ": ", this[aproperty], " not equal ", anotherObject[aproperty]);
            return false;
          }
        } /* then try normal equality */
        else if (this[aproperty] === anotherObject[aproperty]) {
          this.debug(aproperty + ": " + this[aproperty] + " equals " + anotherObject[aproperty]);
          // return true;
        } /* then try stringification */
        else if (JSON.stringify(this[aproperty]) === JSON.stringify(anotherObject[aproperty])) {
          this.debug(aproperty + ": " + this[aproperty] + " equals " + anotherObject[aproperty]);
          // return true;
        } else if (anotherObject[aproperty] === undefined) {
          this.debug(aproperty + ": " + this[aproperty] + " not equal " + anotherObject[aproperty]);
          return false;
        } else {
          if (aproperty !== "_dateCreated" && aproperty !== "perObjectDebugMode") {
            this.debug(aproperty + ": ", this[aproperty], " not equal ", anotherObject[aproperty]);
            return false;
          }
        }
      }
      if (typeof anotherObject.equals === "function") {
        if (this.dontRecurse === undefined) {
          this.dontRecurse = true;
          anotherObject.dontRecurse = true;
          if (!anotherObject.equals(this)) {
            return false;
          }
        }
      }
      delete this.dontRecurse;
      delete anotherObject.dontRecurse;
      return true;
    }
  },

  merge: {
    value: function(callOnSelf, anotherObject, optionalOverwriteOrAsk) {
      var anObject,
        resultObject,
        aproperty,
        targetPropertyIsEmpty,
        overwrite,
        localCallOnSelf;

      if (callOnSelf === "self") {
        this.debug("Merging properties into myself. ");
        anObject = this;
      } else {
        anObject = callOnSelf;
      }
      resultObject = this;
      if (!optionalOverwriteOrAsk) {
        optionalOverwriteOrAsk = "";
      }

      if (anObject.id && anotherObject.id && anObject.id !== anotherObject.id) {
        this.warn("Refusing to merge these objects, they have different ids: " + anObject.id + "  and " + anotherObject.id);
        this.debug("Refusing to merge" + anObject.id + "  and " + anotherObject.id, anObject, anotherObject);
        return null;
      }
      if (anObject.dbname && anotherObject.dbname && anObject.dbname !== anotherObject.dbname) {
        if (optionalOverwriteOrAsk.indexOf("keepDBname") > -1) {
          this.warn("Permitting a merge of objects from different databases: " + anObject.dbname + "  and " + anotherObject.dbname);
          this.debug("Merging ", anObject, anotherObject);
        } else if (optionalOverwriteOrAsk.indexOf("changeDBname") === -1) {
          this.warn("Refusing to merge these objects, they come from different databases: " + anObject.dbname + "  and " + anotherObject.dbname);
          this.debug("Refusing to merge" + anObject.dbname + "  and " + anotherObject.dbname, anObject, anotherObject);
          return null;
        }
      }

      var handleAsyncConfirmMerge = function(self, apropertylocal) {
        self.confirm("I found a conflict for " + apropertylocal + ", Do you want to overwrite it from " + JSON.stringify(anObject[apropertylocal]) + " -> " + JSON.stringify(anotherObject[apropertylocal]))
          .then(function() {
            if (apropertylocal === "_dbname" && optionalOverwriteOrAsk.indexOf("keepDBname") > -1) {
              // resultObject._dbname = self.dbname;
              self.warn(" Keeping _dbname of " + resultObject.dbname);
            } else {
              self.warn("Async Overwriting contents of " + apropertylocal + " (this may cause disconnection in listeners)");
              self.debug("Async Overwriting  ", anObject[apropertylocal], " ->", anotherObject[apropertylocal]);

              resultObject[apropertylocal] = anotherObject[apropertylocal];
            }
          }, function() {
            resultObject[apropertylocal] = anObject[apropertylocal];
          });
      };

      for (aproperty in anotherObject) {
        if (!anotherObject.hasOwnProperty(aproperty) || typeof anObject[aproperty] === "function" || aproperty === "dateCreated") {
          this.debug("  merge: ignoring " + aproperty);
          continue;
        }

        if (anotherObject[aproperty] === undefined) {
          // no op, the new one isn't set
          this.debug(aproperty + " was missing in new object");
          resultObject[aproperty] = anObject[aproperty];
        } else if (anObject[aproperty] === anotherObject[aproperty]) {
          // no op, they are equal enough
          this.debug(aproperty + " were equal.");
          resultObject[aproperty] = anObject[aproperty];
        } else if (!anObject[aproperty] || anObject[aproperty] === [] || anObject[aproperty].length === 0 || anObject[aproperty] === {}) {
          targetPropertyIsEmpty = true;
          this.debug(aproperty + " was previously empty, taking the new value");
          resultObject[aproperty] = anotherObject[aproperty];
        } else {
          //  if two arrays: concat
          if (Object.prototype.toString.call(anObject[aproperty]) === "[object Array]" && Object.prototype.toString.call(anotherObject[aproperty]) === "[object Array]") {
            this.debug(aproperty + " was an array, concatinating with the new value", anObject[aproperty], " ->", anotherObject[aproperty]);
            resultObject[aproperty] = anObject[aproperty].concat(anotherObject[aproperty]);

            //TODO unique it?
            this.debug("  ", resultObject[aproperty]);
          } else {
            // if the result is missing the property, clone it from anObject
            if (!resultObject[aproperty] && typeof anObject[aproperty].constructor === "function") {
              var json = anObject[aproperty].toJSON ? anObject[aproperty].toJSON() : anObject[aproperty];
              resultObject[aproperty] = new anObject[aproperty].constructor(json);
            }
            // if two objects: recursively merge
            if (resultObject[aproperty] && typeof resultObject[aproperty].merge === "function") {
              if (callOnSelf === "self") {
                localCallOnSelf = callOnSelf;
              } else {
                localCallOnSelf = anObject[aproperty];
              }
              this.debug("Requesting merge of internal property " + aproperty + " using method: " + localCallOnSelf);
              var result = resultObject[aproperty].merge(localCallOnSelf, anotherObject[aproperty], optionalOverwriteOrAsk);
              this.debug("after internal merge ", result);
              this.debug("after internal merge ", resultObject[aproperty]);
            } else {
              overwrite = optionalOverwriteOrAsk;
              this.debug("Requested with " + optionalOverwriteOrAsk + " " + optionalOverwriteOrAsk.indexOf("overwrite"));
              if (optionalOverwriteOrAsk.indexOf("overwrite") === -1) {
                handleAsyncConfirmMerge(this, aproperty);
              }
              if (overwrite) {
                if (aproperty === "_dbname" && optionalOverwriteOrAsk.indexOf("keepDBname") > -1) {
                  // resultObject._dbname = this.dbname;
                  this.warn(" Keeping _dbname of " + resultObject.dbname);
                } else {
                  this.warn("Overwriting contents of " + aproperty + " (this may cause disconnection in listeners)");
                  this.debug("Overwriting  ", anObject[aproperty], " ->", anotherObject[aproperty]);

                  resultObject[aproperty] = anotherObject[aproperty];
                }
              } else {
                resultObject[aproperty] = anObject[aproperty];
              }
            }
          }
        }
      }

      // for (aproperty in anObject) {
      //   if (!anObject.hasOwnProperty(aproperty)) {
      //     continue;
      //   }
      //   this.debug("todo merge this property " + aproperty + " backwards too");
      // }

      return resultObject;
    }
  },

  fetch: {
    value: function(optionalBaseUrl) {
      var deferred = Q.defer(),
        id,
        self = this;

      id = this.id;
      if (!id) {
        Q.nextTick(function() {
          deferred.reject({
            error: "Cannot fetch if there is no id"
          });
        });
        return deferred.promise;
      }

      this.fetching = true;
      CORS.makeCORSRequest({
        type: "GET",
        dataType: "json",
        url: optionalBaseUrl + "/" + self.dbname + "/" + id
      }).then(function(result) {
          self.fetching = false;
          self.loaded = true;
          self.merge("self", result, "overwrite");
          deferred.resolve(self);
        },
        function(reason) {
          self.fetching = false;
          self.debug(reason);
          deferred.reject(reason);
        });

      return deferred.promise;
    }
  },

  INTERNAL_MODELS: {
    value: {
      _id: FieldDBObject.DEFAULT_STRING,
      _rev: FieldDBObject.DEFAULT_STRING,
      dbname: FieldDBObject.DEFAULT_STRING,
      version: FieldDBObject.DEFAULT_STRING,
      dateCreated: FieldDBObject.DEFAULT_DATE,
      dateModified: FieldDBObject.DEFAULT_DATE,
      comments: FieldDBObject.DEFAULT_COLLECTION
    }
  },

  application: {
    get: function() {
      return FieldDBObject.application;
    }
  },

  id: {
    get: function() {
      return this._id || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._id) {
        return;
      }
      if (!value) {
        delete this._id;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      // var originalValue = value + "";
      // value = this.sanitizeStringForPrimaryKey(value); /*TODO dont do this on all objects */
      // if (value === null) {
      //   this.bug("Invalid id, not using " + originalValue + " id remains as " + this._id);
      //   return;
      // }
      this._id = value;
    }
  },

  rev: {
    get: function() {
      return this._rev || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._rev) {
        return;
      }
      if (!value) {
        delete this._rev;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._rev = value;
    }
  },

  dbname: {
    get: function() {
      return this._dbname || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._dbname) {
        return;
      }
      if (this._dbname) {
        throw "This is the " + this._dbname + ". You cannot change the dbname of a corpus, you must create a new object first.";
      }
      if (!value) {
        delete this._dbname;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._dbname = value;
    }
  },

  pouchname: {
    get: function() {
      this.debug("pouchname is deprecated, use dbname instead.");
      return this.dbname;
    },
    set: function(value) {
      this.debug("Pouchname is deprecated, please use dbname instead.");
      this.dbname = value;
    }
  },

  version: {
    get: function() {
      return this._version || FieldDBObject.DEFAULT_VERSION;
    },
    set: function(value) {
      if (value === this._version) {
        return;
      }
      if (!value) {
        value = FieldDBObject.DEFAULT_VERSION;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._version = value;
    }
  },

  dateCreated: {
    get: function() {
      return this._dateCreated || FieldDBObject.DEFAULT_DATE;
    },
    set: function(value) {
      if (value === this._dateCreated) {
        return;
      }
      if (!value) {
        delete this._dateCreated;
        return;
      }
      if (value.replace) {
        try {
          value = value.replace(/["\\]/g, "");
          value = new Date(value);
          /* Use date modified as a timestamp if it isnt one already */
          value = value.getTime();
        } catch (e) {
          this.warn("Upgraded dateCreated" + value);
        }
      }
      this._dateCreated = value;
    }
  },

  dateModified: {
    get: function() {
      return this._dateModified || FieldDBObject.DEFAULT_DATE;
    },
    set: function(value) {
      if (value === this._dateModified) {
        return;
      }
      if (!value) {
        delete this._dateModified;
        return;
      }
      if (value.replace) {
        try {
          value = value.replace(/["\\]/g, "");
          value = new Date(value);
          /* Use date modified as a timestamp if it isnt one already */
          value = value.getTime();
        } catch (e) {
          this.warn("Upgraded dateModified" + value);
        }
      }
      this._dateModified = value;
    }
  },

  comments: {
    get: function() {
      return this._comments || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._comments) {
        return;
      }
      if (!value) {
        delete this._comments;
        return;
      } else {
        if (typeof this.INTERNAL_MODELS["comments"] === "function" && Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["comments"](value);
        }
      }
      this._comments = value;
    }
  },

  isEmpty: {
    value: function(aproperty) {
      var empty = !this[aproperty] || this[aproperty] === FieldDBObject.DEFAULT_COLLECTION || this[aproperty] === FieldDBObject.DEFAULT_ARRAY || this[aproperty] === FieldDBObject.DEFAULT_OBJECT || this[aproperty] === FieldDBObject.DEFAULT_STRING || this[aproperty] === FieldDBObject.DEFAULT_DATE || (this[aproperty].length !== undefined && this[aproperty].length === 0) || this[aproperty] === {};
      /* TODO also return empty if it matches a default of any version of the model? */
      return empty;
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      var json = {
          fieldDBtype: this.fieldDBtype
        },
        aproperty,
        underscorelessProperty;

      if (this.fetching) {
        throw "Cannot get json while object is fetching itself";
      }
      /* this object has been updated to this version */
      this.version = this.version;
      /* force id to be set if possible */
      // this.id = this.id;

      for (aproperty in this) {
        if (this.hasOwnProperty(aproperty) && typeof this[aproperty] !== "function") {
          underscorelessProperty = aproperty.replace(/^_/, "");
          if (underscorelessProperty === "id" || underscorelessProperty === "rev") {
            underscorelessProperty = "_" + underscorelessProperty;
          }
          if (!removeEmptyAttributes || (removeEmptyAttributes && !this.isEmpty(aproperty))) {
            if (this[aproperty] && typeof this[aproperty].toJSON === "function") {
              json[underscorelessProperty] = this[aproperty].toJSON(includeEvenEmptyAttributes, removeEmptyAttributes);
            } else {
              json[underscorelessProperty] = this[aproperty];
            }
          }
        }
      }

      /* if the caller requests a complete object include the default for all defauls by calling get on them */
      if (includeEvenEmptyAttributes) {
        for (aproperty in this.INTERNAL_MODELS) {
          if (!json[aproperty] && this.INTERNAL_MODELS) {
            if (this.INTERNAL_MODELS[aproperty] && typeof this.INTERNAL_MODELS[aproperty] === "function" && typeof new this.INTERNAL_MODELS[aproperty]().toJSON === "function") {
              json[aproperty] = new this.INTERNAL_MODELS[aproperty]().toJSON(includeEvenEmptyAttributes, removeEmptyAttributes);
            } else {
              json[aproperty] = this.INTERNAL_MODELS[aproperty];
            }
          }
        }
      }

      if (!json._id) {
        delete json._id;
      }
      if (!json._rev) {
        delete json._rev;
      }
      if (json.dbname) {
        json.pouchname = json.dbname;
        this.debug("Serializing pouchname for backward compatability until prototype can handle dbname");
      }

      delete json.saving;
      delete json.fetching;
      delete json.loaded;
      delete json.decryptedMode;
      delete json.bugMessage;
      delete json.warnMessage;
      delete json.perObjectDebugMode;
      delete json.perObjectAlwaysConfirmOkay;
      delete json.application;
      delete json.contextualizer;
      if (this._collection !== "private_corpuses") {
        delete json.confidential;
        delete json.confidentialEncrypter;
      } else {
        this.warn("serializing confidential in this object " + this._collection);
      }
      if (this.api) {
        json.api = this.api;
      }

      return json;
    }
  },


  /**
   * Creates a deep copy of the object (not a reference)
   * @return {Object} a near-clone of the objcet
   */
  clone: {
    value: function(includeEvenEmptyAttributes) {
      if (includeEvenEmptyAttributes) {
        this.warn(includeEvenEmptyAttributes + " TODO includeEvenEmptyAttributes is not used ");
      }
      var json = JSON.parse(JSON.stringify(this.toJSON()));

      var relatedData;
      if (json.datumFields && json.datumFields.relatedData) {
        relatedData = json.datumFields.relatedData.json.relatedData || [];
      } else if (json.relatedData) {
        relatedData = json.relatedData;
      } else {
        json.relatedData = relatedData = [];
      }
      var source = json._id;
      if (json._rev) {
        source = source + "?rev=" + json._rev;
      }
      relatedData.push({
        URI: source,
        relation: "clonedFrom"
      });

      /* Clear the current object's info which we shouldnt clone */
      delete json._id;
      delete json._rev;

      return json;
    }
  },

  contextualizer: {
    get: function() {
      if (this.application && this.application.contextualizer) {
        return this.application.contextualizer;
      }
    }
  },

  /**
   *  Cleans a value to become a primary key on an object (replaces punctuation and symbols with underscore)
   *  formerly: item.replace(/[-\""+=?.*&^%,\/\[\]{}() ]/g, "")
   *
   * @param  String value the potential primary key to be cleaned
   * @return String       the value cleaned and safe as a primary key
   */
  sanitizeStringForFileSystem: {
    value: function(value, optionalReplacementCharacter) {
      this.debug("sanitizeStringForPrimaryKey " + value);
      if (!value) {
        return null;
      }
      if (optionalReplacementCharacter === undefined || optionalReplacementCharacter === "-") {
        optionalReplacementCharacter = "_";
      }
      if (value.trim) {
        value = Diacritics.clean(value);
        this.debug("sanitizeStringForPrimaryKey " + value);

        value = value.trim().replace(/[^-a-zA-Z0-9]+/g, optionalReplacementCharacter).replace(/^_/, "").replace(/_$/, "");
        this.debug("sanitizeStringForPrimaryKey " + value);
        return value;
      } else if (typeof value === "number") {
        return parseInt(value, 10);
      } else {
        return null;
      }
    }
  },

  sanitizeStringForPrimaryKey: {
    value: function(value, optionalReplacementCharacter) {
      this.debug("sanitizeStringForPrimaryKey " + value);
      if (!value) {
        return null;
      }
      if (value.replace) {
        value = value.replace(/-/g, "_");
      }
      value = this.sanitizeStringForFileSystem(value, optionalReplacementCharacter);
      if (value && typeof value !== "number") {
        return this.camelCased(value);
      }
    }
  },

  camelCased: {
    value: function(value) {
      if (!value) {
        return null;
      }
      if (value.replace) {
        value = value.replace(/_([a-zA-Z])/g, function(word) {
          return word[1].toUpperCase();
        });
        value = value[0].toLowerCase() + value.substring(1, value.length);
      }
      return value;
    }
  }

});

exports.FieldDBObject = FieldDBObject;

},{"./../package.json":79,"./CORS":1,"__browserify_process":64,"diacritic":75,"q":76}],5:[function(require,module,exports){
var Router = Router || {};

Router.routes = Router.routes || [];
Router.routes.push({
  path: "/:team/:corpusid/import/:importType",
  angularRoute: {
    templateUrl: "views/import-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/import",
  angularRoute: {
     redirectTo: "/:team/:corpusid/import/data"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/reports/:reportType",
  angularRoute: {
    templateUrl: "views/reports-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/speakers/:speakerType",
  angularRoute: {
    templateUrl: "views/speakers-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/participants",
  angularRoute: {
    templateUrl: "views/participants-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/consultants",
  angularRoute: {
    templateUrl: "views/consultants-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/sessions",
  angularRoute: {
    templateUrl: "views/sessions-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/datalists",
  angularRoute: {
    templateUrl: "views/datalists-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/data",
  angularRoute: {
    templateUrl: "views/all-data-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/search/:searchQuery",
  angularRoute: {
    templateUrl: "views/search-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid/:docid",
  angularRoute: {
    templateUrl: "views/data-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team/:corpusid",
  angularRoute: {
    templateUrl: "views/corpus-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.routes.push({
  path: "/:team",
  angularRoute: {
    templateUrl: "views/team-page.html",
    controller: "OverrideYourControllerHere"
  }
});
Router.otherwise = {
  redirectTo: "/"
};

if (exports) {
  exports.Router = Router;
}

},{}],6:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
/**
 * @class The Activity is a record of the user's activity during one
 *        session, i.e. it might say "Edward LingLlama added 30 datums in Na
 *        Dene Corpus" This is so that users can see their history and teams
 *        can view teammate"s contributions.
 *
 * @name  Activity
 * @extends FieldDBObject
 * @constructs
 */
var Activity = function Activity(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Activity";
  }
  this.debug("Constructing Activity ", options);
  FieldDBObject.apply(this, arguments);
  if (!this.timestamp) {
    this.timestamp = Date.now();
  }
  if (!this.verbicon) {
    this.verbicon = this.verbicon;
  }
};
Activity.uuidGenerator = FieldDBObject.uuidGenerator;

Activity.prototype = Object.create(FieldDBObject.prototype, /** @lends Activity.prototype */ {

  constructor: {
    value: Activity
  },

  build: {
    value: function(usermask) {
      this.timestamp = Date.now();
      this.user = {
        gravatar: usermask.gravatar,
        username: usermask.username
      };
    }
  },

  api: {
    value: "/activities"
  },

  defaults: {
    value: {
      verb: {
        create: {
          verb: "added",
          verbmask: "did something",
          verbicon: "icon-plus",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        record: {
          verb: "recorded",
          verbmask: "did something",
          verbicon: "icon-microphone",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        video: {
          verb: "videoed",
          verbmask: "did something",
          verbicon: "icon-video-camera",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        photo: {
          verb: "photographed",
          verbmask: "did something",
          verbicon: "icon-camera",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        requestedRecognition: {
          verb: "used speech recognier",
          verbmask: "did something",
          verbicon: "icon-microphone",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        recievedRecognition: {
          verb: "recieved an ASR result",
          verbmask: "did something",
          verbicon: "icon-refresh",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        share: {
          verb: "added",
          verbmask: "added",
          verbicon: "icon-key",
          directobject: "someone",
          directobjecturl: "",
          directobjectmask: "someone",
          directobjecticon: "icon-user",
          indirectobject: "as a role",
          indirectobjecturl: "#team",
          indirectobjectmask: "as a role",
          indirectobjecticon: "icon-cloud"
        },
        import: {
          verb: "imported",
          verbmask: "did something",
          verbicon: "icon-folder-open",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        view: {
          verb: "viewed",
          verbmask: "did something",
          verbicon: "icon-eye",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        download: {
          verb: "downloaded",
          verbmask: "did something",
          verbicon: "icon-download",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        modify: {
          verb: "modified",
          verbmask: "did something",
          verbRevisionBefore: "itemrevbefore",
          verbRevisionAfter: "itemrevafter",
          verbicon: "icon-pencil",
          directobject: "something",
          directobjectId: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjectId: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        remove: {
          verb: "removed",
          verbmask: "did something",
          verbicon: "icon-times-circle",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        delete: {
          verb: "deleted",
          verbmask: "did something",
          verbicon: "icon-plus",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        },
        login: {
          verb: "logged in",
          verbmask: "did something",
          verbicon: "icon-check",
          directobject: "something",
          indirectobject: "to something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-cloud"
        }
      },
      context: {
        prototype: "via Offline App",
        spreadsheet: "via Spreadsheet App",
        learnx: "via LearnX App",
        speechrecognitiontrainer: "via Kartuli Speech Recognizer",
        bot: "via Futon Bot"
      }
    }
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      // user: UserMask
    }
  },

  getDefaultForVerb: {
    value: function(value) {
      if (value.replace) {
        value.replace(/ed$/, "");
      }
      if (this.defaults.verb[value]) {
        return this.defaults.verb[value];

      } else if (value.indexOf("log") > -1 && value.indexOf("in") > -1) {
        return this.defaults.verb.login;

      } else if (value.indexOf("dele") > -1) {
        return this.defaults.verb.delete;

      } else if (value.indexOf("remov") > -1) {
        return this.defaults.verb.remove;

      } else if (value.indexOf("modif") > -1) {
        return this.defaults.verb.modify;

      } else if (value.indexOf("downloa") > -1) {
        return this.defaults.verb.download;

      } else if (value.indexOf("view") > -1) {
        return this.defaults.verb.view;

      } else if (value.indexOf("import") > -1) {
        return this.defaults.verb.import;

      } else if (value.indexOf("shar") > -1) {
        return this.defaults.verb.share;

      } else if (value.indexOf("ASR result") > -1) {
        return this.defaults.verb.recievedRecognition;

      } else if (value.indexOf("used speech recognier") > -1) {
        return this.defaults.verb.requestedRecognition;

      } else if (value.indexOf("phot") > -1) {
        return this.defaults.verb.photo;

      } else if (value.indexOf("video") > -1) {
        return this.defaults.verb.video;

      } else if (value.indexOf("recor") > -1) {
        return this.defaults.verb.record;

      } else if (value.indexOf("add") > -1 && value.indexOf("creat") > -1) {
        return this.defaults.verb.create;
      } else {

        return {
          verb: "did something",
          verbmask: "did something",
          verbicon: "icon-bell",
          directobject: "something",
          directobjecturl: "",
          directobjectmask: "to something",
          directobjecticon: "icon-circle-o",
          indirectobject: "in something",
          indirectobjecturl: "",
          indirectobjectmask: "in something",
          indirectobjecticon: "icon-square-o"
        };
      }

    }
  },

  verb: {
    get: function() {
      return this._verb;
    },
    set: function(value) {
      if (value === this._verb) {
        return;
      }
      value = this.makeLinksOpenNewWindows(value);
      if (value) {
        this._verb = value;
      }
    }
  },

  verbicon: {
    get: function() {
      if (this._verbicon) {
        return this._verbicon;
      } else {
        return this.getDefaultForVerb(this.verb).verbicon;
      }
    },
    set: function(value) {
      if (value === this._verbicon) {
        return;
      }
      value = this.makeLinksOpenNewWindows(value);
      if (value) {
        this._verbicon = value;
      }
    }
  },

  directobject: {
    get: function() {
      return this._directobject;
    },
    set: function(value) {
      if (value === this._directobject) {
        return;
      }
      value = this.makeLinksOpenNewWindows(value);
      if (value) {
        this._directobject = value;
      }
    }
  },

  indirectobject: {
    get: function() {
      return this._indirectobject;
    },
    set: function(value) {
      if (value === this._indirectobject) {
        return;
      }
      value = this.makeLinksOpenNewWindows(value);
      if (value) {
        this._indirectobject = value;
      }
    }
  },

  context: {
    get: function() {
      return this._context;
    },
    set: function(value) {
      if (value === this._context) {
        return;
      }
      value = this.makeLinksOpenNewWindows(value);
      if (value) {
        this._context = value;
      }
    }
  },

  makeLinksOpenNewWindows: {
    value: function(value) {
      if (value.replace) {
        value = value.replace("href=", "target='_blank' href=");
      }
      return value;
    }
  },

  timestamp: {
    get: function() {
      return this._timestamp;
    },
    set: function(value) {
      if (value === this._timestamp) {
        return;
      }
      if (!value) {
        delete this._timestamp;
        return;
      }
      if (("" + value).indexOf("Z") > -1) {
        value = (new Date(value)).getTime();
      }

      this._timestamp = value;
    }
  },

  save: {
    value: function() {
      this.debug("Customizing activity save ");

      return FieldDBObject.prototype.save.apply(this, arguments);
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing activity toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);

      this.verb = this.verb;
      this.directobject = this.directobject;
      this.indirectobject = this.indirectobject;
      this.context = this.context;

      var json = FieldDBObject.prototype.toJSON.apply(this, arguments);
      this.debug(json);
      return json;
    }
  }

});

exports.Activity = Activity;

},{"./../FieldDBObject":4}],7:[function(require,module,exports){
/* globals window, localStorage, Android, navigator */
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Activity = require("./../activity/Activity").Activity;
var Authentication = require("./../FieldDBObject").FieldDBObject;
var Corpus = require("./../corpus/Corpus").Corpus;
var DataList = require("./../data_list/DataList").DataList;
var Import = require("./../import/Import").Import;
var Search = require("./../search/Search").Search;
var Session = require("./../FieldDBObject").FieldDBObject;
var Router = require("./../Router").Router;
var User = require("./../user/User").User;
var UserMask = require("./../user/UserMask").UserMask;
var Team = require("./../user/Team").Team;
var Contextualizer = require("./../locales/Contextualizer").Contextualizer;
var Q = require("q");

/**
 * @class The App handles the reinitialization and loading of the app
 *        depending on which platform (Android, Chrome, web) the app is
 *        running, who is logged in etc.
 *
 * The App should be serializable to save state to local storage for the
 * next run.
 *
 * @name App
 *
 * @property {Authentication} authentication The auth member variable is an
 *           Authentication object permits access to the login and logout
 *           functions, and the database of users depending on whether the
 *           app is online or not. The authentication is the primary way to access the current user.
 *
 * @property {Corpus} corpus The corpus is a Corpus object which will permit
 *           access to the datum, the data lists and the sessions. The corpus feeds the
 *           search object with indexes and fields for advanced search, the
 *           corpus has datalists, has teams with permissions, has a
 *           confidentiality_encryption key, it's datum have sessions, its
 *           datalists and datum have export.
 *
 * @property {Search} search The current search details.
 *
 * @property {Session} currentSession The session that is currently open.
 *
 * @property {DataList} currentDataList The datalist that is currently open.
 * @extends FieldDBObject
 * @tutorial tests/app/AppTest.js
 * @constructs
 */
var App = function App(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "App";
  }

  this.debug("Constructing App ", options);
  FieldDBObject.apply(this, arguments);
  if (FieldDBObject.application) {
    this.warn("You shouldn't declare two apps at one time. Overwriting previous app.");
    this.debug("previous app", FieldDBObject.application);
  }
  FieldDBObject.application = this;

  this.speakersList = this.speakersList || new DataList({
    title: {
      default: "locale_All_Speakers"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "speakers"
  });
  this.consultantsList = this.consultantsList || new DataList({
    title: {
      default: "locale_All_Language_Consultants"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "consultants"
  });
  this.participantsList = this.participantsList || new DataList({
    title: {
      default: "locale_All_Participants"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "participants"
  });
  this.usersList = this.usersList || new DataList({
    title: {
      default: "locale_All_Users"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "users"
  });

  this.sessionsList = this.sessionsList || new DataList({
    title: {
      default: "locale_All_Elicitation_Sessions"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "sessions"
  });
  this.datalistsList = this.datalistsList || new DataList({
    title: {
      default: "locale_All_Datalists"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "datalists"
  });
  this.datumsList = this.datumsList || new DataList({
    title: {
      default: "locale_All_Data"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    // debugMode:true,
    api: "datums"
  });
  this.commentsList = this.commentsList || new DataList({
    title: {
      default: "All Comments"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "comments"
  });

  this.responsesList = this.responsesList || new DataList({
    title: {
      default: "List of Responses"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "responses"
  });
  this.experimentsList = this.experimentsList || new DataList({
    title: {
      default: "List of Experiment Results"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "experiments"
  });
  this.reportsList = this.reportsList || new DataList({
    title: {
      default: "List of Reports"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "reports"
  });

  this.importer = this.importer || null;
  this.search = this.search || null;
  this.currentDoc = this.currentDoc || null;
  this.team = this.team || null;
  this.corpus = this.corpus || null;
  this.thisyear = (new Date()).getFullYear();

  var self = this;
  Q.nextTick(function() {
    self.warn("An app of type " + self.fieldDBtype + " has become automagically available to all fielddb objects");
  });

};

App.prototype = Object.create(FieldDBObject.prototype, /** @lends App.prototype */ {
  constructor: {
    value: App
  },

  authentication: {
    get: function() {
      return this._authentication || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      if (value === this._authentication) {
        return;
      }
      if (!value) {
        delete this._authentication;
        return;
      } else {
        if (value && this.INTERNAL_MODELS && this.INTERNAL_MODELS["authentication"] && typeof this.INTERNAL_MODELS["authentication"] === "function" && value.constructor !== this.INTERNAL_MODELS["authentication"]) {
          this.debug("Parsing model: " + value);
          value = new this.INTERNAL_MODELS["authentication"](value);
        }
      }
      this._authentication = value;
    }
  },

  contextualizer: {
    get: function() {
      return this._contextualizer;
    },
    set: function(value) {
      if (value === this._contextualizer) {
        return;
      }
      if (!value) {
        delete this._contextualizer;
        return;
      } else {
        if (value && this.INTERNAL_MODELS && this.INTERNAL_MODELS["contextualizer"] && typeof this.INTERNAL_MODELS["contextualizer"] === "function" && value.constructor !== this.INTERNAL_MODELS["contextualizer"]) {
          this.debug("Parsing model: ", value);
          value = new this.INTERNAL_MODELS["contextualizer"](value);
          value.loadDefaults();
        }
      }
      this._contextualizer = value;
    }
  },

  contextualize: {
    value: function(value) {
      if (this._contextualizer) {
        return this._contextualizer.contextualize(value);
      } else {
        if (typeof value === "object" || value.default) {
          return value.default;
        }
        return value;
      }
    }
  },

  prefs: {
    get: function() {
      if (this.corpus && this.corpus.prefs) {
        return this.corpus.prefs;
      }
      if (this.authentication && this.authentication.user && this.authentication.user.prefs) {
        return this.authentication.user.prefs;
      }
    }
  },

  enterDecryptedMode: {
    value: function(loginDetails) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {
        if (this.corpus && typeof this.corpus.login === "function") {
          this.corpus.login(loginDetails).then(function() {

            self.decryptedMode = true;
            deferred.resolve(true);

          }, function(error) {
            deferred.reject(error);
          });
        } else {
          deferred.reject("User is not authenticated. Please log in.");
        }
      });
      return deferred.promise;
    }
  },

  load: {
    value: this.fetch
  },

  fetch: {
    value: function() {
      var self = this;

      /*
       * Load the user
       */
      if (!this.loadTheAppForTheFirstTime) {
        self.debug("Loading encrypted user");
        self.status = "Loading encrypted user...";
        var u = localStorage.getItem("encryptedUser");
        self.authentication.loadEncryptedUser(u, function(success, errors) {
          self.debug("loadEncryptedUser", success, errors);

          self.status = "Turning on continuous sync with your team server...";
          self.replicateContinuouslyWithCouch(function() {
            /*
             * Load the backbone objects
             */
            self.debug("Creating backbone objects");
            self.status = "Building dashboard objects...";
            self.createAppFieldDBObjects(self.couchConnection.pouchname, function() {

              /*
               * If you know the user, load their most recent
               * dashboard
               */
              self.debug("Loading the backbone objects");
              self.status = "Loading dashboard objects...";
              self.loadFieldDBObjectsByIdAndSetAsCurrentDashboard(
                self.authentication.userPrivate.mostRecentIds, function() {

                  self.debug("Starting the app");
                  self.startApp(function() {
                    self.showHelpOrNot();
                    self.stopSpinner();
                    self.router.renderDashboardOrNot(true);

                  });
                });
            });

          });

        });
      }

      try {
        window.onbeforeunload = this.warnUserAboutSavedSyncedStateBeforeUserLeaves;
      } catch (e) {
        this.warn("Cannot prevent the user from exiting if there are unsaved changes.");
      }
    }
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      corpus: Corpus,
      contextualizer: Contextualizer,
      authentication: Authentication,
      currentSession: Session,
      currentDataList: DataList,
      search: Search
    }
  },
  /*
   * This will be the only time the app should open the pouch.
   */
  changePouch: {
    value: function(couchConnection, callback) {
      if (!couchConnection || couchConnection === undefined) {
        this.debug("App.changePouch couchConnection must be supplied.");
        return;
      } else {
        this.debug("App.changePouch setting couchConnection: ", couchConnection);
        this.set("couchConnection", couchConnection);
      }
      //      self.bug("TODO set/validate that the the backone couchdb connection is the same as what user is asking for here");
      FieldDBObject.couch.urlPrefix = this.getCouchUrl(this.couchConnection, "");

      if (this.isChromeApp) {
        FieldDBObject.couch_connector.config.base_url = this.getCouchUrl(couchConnection, "");
        FieldDBObject.couch_connector.config.db_name = couchConnection.pouchname;
      } else {
        /* If the user is not in a chrome extension, the user MUST be on a url that corresponds with their corpus */
        try {
          var pieces = window.location.pathname.replace(/^\//, "").split("/");
          var pouchName = pieces[0];
          //Handle McGill server which runs out of a virtual directory
          if (pouchName === "corpus") {
            pouchName = pieces[1];
          }
          FieldDBObject.couch_connector.config.db_name = pouchName;
        } catch (e) {
          this.bug("Couldn't set the databse name off of the url, please report this.");
        }
      }

      if (typeof callback === "function") {
        callback();
      }
      return;



      // self.bug("TODO set/validate that the the pouch connection");
      // if (this.pouch === undefined) {
      //   // this.pouch = FieldDBObject.sync.pouch("https://localhost:6984/"
      //   // + couchConnection.pouchname);
      //   this.pouch = FieldDBObject.sync
      //     .pouch(OPrime.isAndroidApp() ? OPrime.touchUrl + couchConnection.pouchname : OPrime.pouchUrl + couchConnection.pouchname);
      // }
      // if (typeof callback === "function") {
      //   callback();
      // }
    }
  },
  /**
   * This function creates the backbone objects, and links them up so that
   * they are ready to be used in the views. This function should be called on
   * app load, either by main, or by welcome new user. This function should
   * not be called at any later time as it will break the connection between
   * the views and the models. To load different models into the app after it
   * has first loaded, use the loadFieldDBObjectsById function below.
   *
   * @param callback
   */
  createAppFieldDBObjects: {
    value: function(optionalpouchname, callback) {
      if (optionalpouchname === null) {
        optionalpouchname = "default";
      }

      if (FieldDBObject.couch_connector.config.db_name === "default") {
        this.bug("The app doesn't know which database its in. This is a problem.");
      }

      if (this.authentication.userPublic === undefined) {
        this.authentication.set("userPublic", new UserMask({
          pouchname: optionalpouchname
        }));
      }
      if (this.authentication.userPrivate === undefined) {
        this.authentication.set("userPrivate", new User());
      }
      var c = new Corpus({
        pouchname: optionalpouchname
      });
      this.set("corpus", c);

      this.set("currentSession", new Session({
        pouchname: optionalpouchname,
      }));

      this.set("currentDataList", new DataList({
        pouchname: optionalpouchname
      }));

      this.set("search", new Search({
        pouchname: optionalpouchname
      }));


      if (typeof callback === "function") {
        callback();
      }
    }
  },

  startApp: {
    value: function(callback) {
      /* Tell the app to render everything */
      this.render();

      if (typeof this.router === "function") {
        /* Tell the router to render the home screen divs */
        this.router = new Router();
        this.router.renderDashboardOrNot(true);

        FieldDBObject.history.start();
        if (typeof callback === "function") {
          this.debug("Calling back the startApps callback");
          callback();
        }
      }

    }
  },

  loading: {
    get: function() {
      return this._loading || this.fetching || false;
    },
    set: function(value) {
      if (value === this._loading) {
        return;
      }
      value = !!value;
      if (value === true) {
        this.status = "Loading dashboard";
      }
      this.loading = value;
    }
  },

  stopSpinner: {
    value: function() {
      this.loading = false;
    }
  },
  backUpUser: {
    value: function(callback) {
      var self = this;
      /* don't back up the public user, its not necessary the server doesn't modifications anyway. */
      if (self.authentication.userPrivate.username === "public" || self.authentication.userPrivate.username === "lingllama") {
        if (typeof callback === "function") {
          callback();
        }
      }
      this.saveAndInterConnectInApp(function() {
        //syncUserWithServer will prompt for password, then run the corpus replication.
        self.authentication.syncUserWithServer(function() {
          if (self.view) {
            self.toastUser("Backed up your user preferences with your authentication server, if you log into another device, your preferences will load.", "alert-info", "Backed-up:");
          }
          if (typeof callback === "function") {
            callback();
          }
        });
      });
    }
  },

  /**
   * Log the user into their corpus server automatically using cookies and post so that they can replicate later.
   * "http://localhost:5984/_session";
   *
   * References:
   * http://guide.couchdb.org/draft/security.html
   *
   * @param username this can come from a username field in a login, or from the User model.
   * @param password this comes either from the UserWelcomeView when the user logs in, or in the quick authentication view.
   * @param callback A function to call upon success, it receives the data back from the post request.
   */
  logUserIntoTheirCorpusServer: {
    value: function(couchConnection, username, password, succescallback, failurecallback) {
      var self = this;

      if (couchConnection === null || couchConnection === undefined) {
        couchConnection = this.couchConnection;
      }
      if (couchConnection === null || couchConnection === undefined) {
        this.bug("Bug: i couldnt log you into your couch database.");
      }

      /* if on android, turn on replication and don't get a session token */
      if (this.isTouchDBApp()) {
        Android.setCredentialsAndReplicate(couchConnection.pouchname,
          username, password, couchConnection.domain);
        this.debug("Not getting a session token from the users corpus server " + "since this is touchdb on android which has no idea of tokens.");
        if (typeof succescallback === "function") {
          succescallback();
        }
        return;
      }

      var couchurl = this.getCouchUrl(couchConnection, "/_session");
      var corpusloginparams = {};
      corpusloginparams.name = username;
      corpusloginparams.password = password;
      this.debug("Contacting your corpus server ", couchConnection, couchurl);

      this.couch.login({
        name: username,
        password: password,
        success: function(serverResults) {
          if (!serverResults) {
            self.bug("There was a problem logging you into your backup database, please report this.");
          }
          if (self.view) {
            self.toastUser(
              "I logged you into your team server automatically, your syncs will be successful.",
              "alert-info", "Online Mode:");
          }


          /* if in chrome extension, or offline, turn on replication */
          if (self.isChromeApp) {
            //TODO turn on pouch and start replicating and then redirect user to their user page(?)
            //            appself.replicateContinuouslyWithCouch();
          }

          if (typeof succescallback === "function") {
            succescallback(serverResults);
          }
        },
        error: function(serverResults) {
          self.debug("serverResults", serverResults);
          self.timeout(
            function() {
              //try one more time 5 seconds later
              FieldDBObject.couch.login({
                name: username,
                password: password,
                success: function(serverResults) {
                  if (self.view) {
                    self.toastUser(
                      "I logged you into your team server automatically, your syncs will be successful.",
                      "alert-info", "Online Mode:");
                  }
                  /* if in chrome extension, or offline, turn on replication */
                  if (self.isChromeApp) {
                    //TODO turn on pouch and start replicating and then redirect user to their user page(?)
                    //                      appself.replicateContinuouslyWithCouch();
                  }

                  if (typeof succescallback === "function") {
                    succescallback(serverResults);
                  }
                },
                error: function(serverResults) {
                  if (self.view) {
                    self.toastUser(
                      "I couldn't log you into your corpus. What does this mean? " + "This means you can't upload data to train an auto-glosser or visualize your morphemes. " + "You also can't share your data with team members. If your computer is online and you are" + " using the Chrome Store app, then this probably the side effect of a bug that we might not know about... please report it to us :) " + self.contextualizer.contactUs + " If you're offline you can ignore this warning, and sync later when you're online. ",
                      "alert-danger",
                      "Offline Mode:");
                  }
                  if (typeof failurecallback === "function") {
                    failurecallback("I couldn't log you into your corpus.");
                  }
                  self.debug(serverResults);
                  self.authentication.set(
                    "staleAuthentication", true);
                }
              });
            }, 5000);
        }
      });
    }
  },
  getCouchUrl: {
    value: function(couchConnection, couchdbcommand) {
      if (!couchConnection) {
        couchConnection = this.couchConnection;
        this.debug("Using the apps ccouchConnection", couchConnection);
      } else {
        this.debug("Using the couchConnection passed in,", couchConnection, this.couchConnection);
      }
      if (!couchConnection) {
        this.bug("The couch url cannot be guessed. It must be provided by the App. Please report this bug.");
      }
      return this.getCouchUrl(couchConnection, couchdbcommand);
    },
    /**
     * Synchronize to server and from database.
     */
    replicateContinuouslyWithCouch: function(successcallback,
      failurecallback) {
      var self = this;
      if (!self.pouch) {
        self.debug("Not replicating, no pouch ready.");
        if (typeof successcallback === "function") {
          successcallback();
        }
        return;
      }
      self.pouch(function(err, db) {
        var couchurl = self.getCouchUrl();
        if (err) {
          self.debug("Opening db error", err);
          if (typeof failurecallback === "function") {
            failurecallback();
          } else {
            this.bug("Opening DB error" + JSON.stringify(err));
            self.debug("Opening DB error" + JSON.stringify(err));
          }
        } else {
          self.debug("Opening db success", db);
          self.bug("TODO check to see if  needs a slash if replicating with pouch on " + couchurl);
          self.replicateFromCorpus(db, couchurl, function() {
            //turn on to regardless of fail or succeed
            self.replicateToCorpus(db, couchurl);
          }, function() {
            //turn on to regardless of fail or succeed
            self.replicateToCorpus(db, couchurl);
          });

          if (typeof successcallback === "function") {
            successcallback();
          }

        }
      });

    }
  },
  /**
   * Pull down corpus to offline pouch, if its there.
   */
  replicateOnlyFromCorpus: {
    value: function(couchConnection, successcallback, failurecallback) {
      var self = this;

      if (!self.pouch) {
        self.debug("Not replicating, no pouch ready.");
        if (typeof successcallback === "function") {
          successcallback();
        }
        return;
      }

      self.pouch(function(err, db) {
        var couchurl = self.getCouchUrl();
        if (err) {
          self.debug("Opening db error", err);
          if (typeof failurecallback === "function") {
            failurecallback();
          } else {
            self.bug("Opening DB error" + JSON.stringify(err));
            self.debug("Opening DB error" + JSON.stringify(err));
          }
        } else {
          db.replicate.from(couchurl, {
            continuous: false
          }, function(err, response) {
            self.debug("Replicate from " + couchurl, response, err);
            if (err) {
              if (typeof failurecallback === "function") {
                failurecallback();
              } else {
                self.bug("Corpus replicate from error" + JSON.stringify(err));
                self.debug("Corpus replicate from error" + JSON.stringify(err));
              }
            } else {
              self.debug("Corpus replicate from success", response);
              if (typeof successcallback === "function") {
                successcallback();
              }
            }
          });
        }
      });
    }
  },
  replicateToCorpus: {
    value: function(db, couchurl, success, failure) {
      var self = this;

      db.replicate.to(couchurl, {
        continuous: true
      }, function(err, response) {
        self.debug("Replicated to " + couchurl);
        self.debug(response);
        self.debug(err);
        if (err) {
          self.debug("replicate to db  error", err);
          if (typeof failure === "function") {
            failure();
          } else {
            self.bug("Database replicate to error" + JSON.stringify(err));
            self.debug("Database replicate to error" + JSON.stringify(err));
          }
        } else {
          self.debug("Database replicate to success", response);
          if (typeof success === "function") {
            success();
          } else {
            self.debug("Database replicating" + JSON.stringify(self.couchConnection));
          }

        }
      });
    }
  },
  replicateFromCorpus: {
    value: function(db, couchurl, succes, fail) {
      var self = this;

      db.replicate.from(couchurl, {
          continuous: true
        },
        function(err, response) {
          self.debug("Replicated from " + couchurl);
          self.debug(response);
          self.debug(err);
          if (err) {
            self.debug("replicate from db  error", err);
            if (typeof fail === "function") {
              fail();
            } else {
              self.bug("Database replicate from error" + JSON.stringify(err));
              self.debug("Database replicate from error" + JSON.stringify(err));
            }
          } else {
            self.debug("Database replicate from success",
              response);
            if (typeof succes === "function") {
              succes();
            } else {
              self.debug("Database replicating" + JSON.stringify(self.couchConnection));
            }

          }
        });
    }
  },

  processRouteParams: {
    value: function(routeParams) {
      var self = this;

      if (!routeParams) {
        this.warn("Route params are undefined, not loading anything");
        return;
      }
      this.routeParams = routeParams;

      /*
       * Handle precise routes
       */
      if (routeParams.importType) {
        self.debug("Creating an importer");
        this.importer = this.importer || new Import({
          importType: routeParams.importType
          // corpus: this.corpus
        });
      } else if (routeParams.reportType) {
        this.reportsList.filter = function(report) {
          if (routeParams.reportType.match(report.fieldDBtype.toLowerCase())) {
            return true;
          } else {
            return false;
          }
        };
      } else if (routeParams.speakerType) {
        this.speakersList.filter = function(speaker) {
          if (routeParams.speakerType.match(speaker.fieldDBtype.toLowerCase())) {
            return true;
          } else {
            return false;
          }
        };
      } else if (routeParams.searchQuery) {
        this.search = this.search || new Search({
          searchKeywords: routeParams.searchQuery
        });
      } else if (routeParams.docid) {
        if (this.doc && this.doc.save) {
          this.doc.bug("Switching to another document without saving...");
        }
        this.doc = new FieldDBObject({
          id: routeParams.docid
        });
      }

      /*
       * Letting the url determine which team is loaded
       */
      if (routeParams.team) {
        if (this.team && this.team.save) {
          this.team.bug("Switching to another team without saving...");
        }
        this.team = new Team({
          username: routeParams.team
        });

        /*
         * Letting the url determine which corpus is loaded
         */
        if (routeParams.corpusid) {
          this.currentCorpusDashboard = this.team.validateUsername(routeParams.team).username + "/" + this.team.sanitizeStringForFileSystem(routeParams.corpusid).toLowerCase();
          this.currentCorpusDashboardDBname = this.team.validateUsername(routeParams.team).username + "-" + this.team.sanitizeStringForFileSystem(routeParams.corpusid).toLowerCase();
          if (this.currentCorpusDashboardDBname.split("-").length < 2) {
            this.status = "Please try another url of the form teamname/corpusname " + this.currentCorpusDashboardDBname + " is not valid.";
            return;
          }

          this.team.dbname = this.currentCorpusDashboardDBname;
          if (this.corpus && this.corpus.save) {
            this.corpus.bug("Switching to another corpus without saving...");
          }
          if (!this.corpus || this.currentCorpusDashboardDBname !== this.corpus.dbname) {
            this.corpus = new Corpus({
              dbname: this.currentCorpusDashboardDBname
            });
          }
        }
      }

      /*
       * Fetching models if they are not complete
       */

      // FieldDBConnection.connect().done(function(userroles) {
      // self.application.authentication.userroles = userroles;
      if (this.team && !this.team.gravatar) {
        this.team.status = "Loading team details.";
        this.team.fetch(Corpus.prototype.BASE_DB_URL).then(function(result) {
          self.debug("Suceeded to download team\"s public details.", result);
          self.status = self.team.status = "Loaded team details.";
          self.render();
        }, function(result) {
          self.debug("Failed to download team details.", result);
          self.status = self.team.status = "Failed to download team details.";
          self.render();
        });
      }

      if (this.corpus && !this.corpus.title) {
        this.corpus.status = "Loading corpus details.";
        this.corpus.loadOrCreateCorpusByPouchName(this.corpus.dbname).then(function(result) {
          self.debug("Suceeded to download corpus details.", result);
          self.status = self.corpus.status = "Loaded corpus details.";
          if (self.application.importer) {
            self.application.importer.corpus = self.corpus;
          }
          self.render();
        }, function(result) {
          self.debug("Failed to download corpus details.", result);

          self.status = self.corpus.status = "Failed to download corpus details. Are you sure this is the corpus you wanted to see: " + self.corpus.dbname;
          self.loginDetails.username = self.team.username;
          self.render();
        }).catch(function(error) {
          self.warn("catch error", error);
        });
      }
    }
  },

  router: {
    value: Router
  },

  showHelpOrNot: {
    value: function() {
      var self = this;

      var username = this.authentication.userPrivate.username;
      if (username === "public") {
        //Dont show the help screen for the public user
        return;
      }
      var helpShownCount = localStorage.getItem(username + "helpShownCount") || 0;
      var helpShownTimestamp = localStorage.getItem(username + "helpShownTimestamp") || 0;

      /*
       * dont show the guide immediately if they are truely a new
       * user, let them see the dashboard before they wonder how
       * to use it. 60 seconds later, show the help.
       */
      if (helpShownTimestamp === 0) {
        self.helpCountReason = "Just in case you were wondering what all those buttons are for, check out Gretchen's Illustrated Guide to your dashboard! ";

        self.helpCount = 3 - helpShownCount;
        localStorage.setItem(username + "helpShownCount", ++helpShownCount);
        localStorage.setItem(username + "helpShownTimestamp", Date.now());
        self.timeout(function() {
          self.router.navigate("help/illustratedguide", {
            trigger: true
          });
        }, 60000);
        return;
      }

      /*
       * If this is not a brand new user:
       */
      var milisecondsSinceLastHelp = Date.now() - helpShownTimestamp;

      /* if its been more than 5 days, reset the help shown count to trigger the illustrated guide */
      if (milisecondsSinceLastHelp > 432000000 && helpShownTimestamp !== 0) {
        helpShownCount = 0;
        self.helpCountReason = "Welcome back! It's been more than 5 days since you opened the app. ";
      }
      if (helpShownCount > 3) {
        // do nothing
      } else {
        self.helpCount = 3 - helpShownCount;
        localStorage.setItem(username + "helpShownCount", ++helpShownCount);
        localStorage.setItem(username + "helpShownTimestamp", Date.now());
        self.router.navigate("help/illustratedguide", {
          trigger: true
        });
      }
    }
  },

  /**
     * This function is used to save the entire app state that is needed to load when the app is re-opened.
     * http://stackoverflow.com/questions/7794301/window-onunload-is-not-working-properly-in-chrome-browser-can-any-one-help-me
     *
     * $(window).on("beforeunload", function() {
        return "Your own message goes here...";
      });
     */
  warnUserAboutSavedSyncedStateBeforeUserLeaves: {
    value: function(e) {
      this.debug("warnUserAboutSavedSyncedStateBeforeUserLeaves", e);
      var returntext = "";
      if (this.view) {
        if (this.view.totalUnsaved.length >= 1) {
          returntext = "You have unsaved changes, click cancel to save them. \n\n";
        }
        if (this.view.totalUnsaved.length >= 1) {
          returntext = returntext + "You have unsynced changes, click cancel and then click the sync button to sync them. This is only important if you want to back up your data or if you are sharing your data with a team. \n\n";
        }
      }
      if (returntext === "") {
        return; //don't show a pop up
      } else {
        return "Either you haven't been using the app and Chrome wants some of its memory back, or you want to leave the app.\n\n" + returntext;
      }
    }
  },
  /**
   * Saves a json file via REST to a couchdb, must be online.
   *
   * @param bareActivityObject
   */
  addActivity: {
    value: function(bareActivityObject) {
      var self = this;

      bareActivityObject.verb = bareActivityObject.verb.replace("href=", "target='_blank' href=");
      bareActivityObject.directobject = bareActivityObject.directobject.replace("href=", "target='_blank' href=");
      bareActivityObject.indirectobject = bareActivityObject.indirectobject.replace("href=", "target='_blank' href=");
      bareActivityObject.context = bareActivityObject.context.replace("href=", "target='_blank' href=");

      self.debug("Saving activity: ", bareActivityObject);
      var backboneActivity = new Activity(bareActivityObject);

      var couchConnection = this.couchConnection;
      var activitydb = couchConnection.pouchname + "-activity_feed";
      if (bareActivityObject.teamOrPersonal !== "team") {
        activitydb = this.authentication.userPrivate.username + "-activity_feed";
        backboneActivity.attributes.user.set("gravatar", this.authentication.userPrivate.gravatar);
      }

      if (bareActivityObject.teamOrPersonal === "team") {
        self.currentCorpusTeamActivityFeed.addActivity(bareActivityObject);
      } else {
        self.currentUserActivityFeed.addActivity(bareActivityObject);
      }
    }
  },

  /**
   * This function sequentially saves first the session, datalist and then corpus. Its success callback is called if all saves succeed, its fail is called if any fail.
   * @param successcallback
   * @param failurecallback
   */
  saveAndInterConnectInApp: {
    value: function(successcallback, failurecallback) {
      var self = this;
      if (!failurecallback) {
        failurecallback = function() {
          self.bug("There was a bug/problem in the saveAndInterConnectInApp in App.js, somewhere along the save call. The Session is saved first, if it succeeds, then the datalist, then the corpus. The failure is somewhere along there.");
        };
      }
      self.currentSession.saveAndInterConnectInApp(function() {
        self.currentDataList.saveAndInterConnectInApp(function() {
          self.corpus.saveAndInterConnectInApp(function() {
            self.authentication.saveAndInterConnectInApp(function() {

              self.authentication.staleAuthentication = true;
              //              localStorage.setItem("mostRecentDashboard", JSON.stringify(self.authentication.userPrivate.mostRecentIds));
              if (self.view) {
                self.toastUser("Your dashboard has been saved, you can exit the app at anytime and return to this state.", "alert-success", "Exit at anytime:");
              }


              //appSelf.router.showDashboard();
              if (typeof successcallback === "function") {
                successcallback();
              }

            }, failurecallback);
          }, failurecallback);
        }, failurecallback);
      }, failurecallback);
    }
  },

  subscribers: {
    value: {
      any: []
    }
  },

  subscribe: {
    value: function(type, fn, context) {
      type = type || "any";
      fn = typeof fn === "function" ? fn : context[fn];

      if (typeof this.subscribers[type] === "undefined") {
        this.subscribers[type] = [];
      }
      this.subscribers[type].push({
        fn: fn,
        context: context || this
      });
    }
  },

  unsubscribe: {
    value: function(type, fn, context) {
      this.visitSubscribers("unsubscribe", type, fn, context);
    }
  },

  publish: {
    value: function(type, publication) {
      this.visitSubscribers("publish", type, publication);
    }
  },

  visitSubscribers: {
    value: function(action, type, arg, context) {
      var pubtype = type || "any";
      var subscribers = this.subscribers[pubtype];
      if (!subscribers || subscribers.length === 0) {
        this.debug(pubtype + ": There were no subscribers.");
        return;
      }
      var i;
      var maxUnsubscribe = subscribers ? subscribers.length - 1 : 0;
      var maxPublish = subscribers ? subscribers.length : 0;

      if (action === "publish") {
        // count up so that older subscribers get the message first
        for (i = 0; i < maxPublish; i++) {
          if (subscribers[i]) {
            // TODO there is a bug with the subscribers they are getting lost, and
            // it is trying to call fn of undefiend. this is a workaround until we
            // figure out why subscribers are getting lost. Update: i changed the
            // loop to count down and remove subscribers from the ends, now the
            // size of subscribers isnt changing such that the subscriber at index
            // i doesnt exist.
            subscribers[i].fn.call(subscribers[i].context, arg);
          }
        }
        this.debug("Visited " + subscribers.length + " subscribers.");

      } else {

        // count down so that subscribers index exists when we remove them
        for (i = maxUnsubscribe; i >= 0; i--) {
          try {
            if (!subscribers[i].context) {
              this.debug("This subscriber has no context. should we remove it? " + i);
            }
            if (subscribers[i].context === context) {
              var removed = subscribers.splice(i, 1);
              this.debug("Removed subscriber " + i + " from " + type, removed);
            } else {
              this.debug(type + " keeping subscriber " + i, subscribers[i].context);
            }
          } catch (e) {
            this.debug("problem visiting Subscriber " + i, subscribers);
          }
        }
      }
    }
  },

  isAndroidApp: {
    get: function() {

      // Development tablet navigator.userAgent:
      // Mozilla/5.0 (Linux; U; Android 3.0.1; en-us; gTablet Build/HRI66)
      // AppleWebKit/534.13 (KHTML, like Gecko) Version/4.0 Safari/534.13
      // this.debug("The user agent is " + navigator.userAgent);
      try {
        return navigator.userAgent.indexOf("OfflineAndroidApp") > -1;
      } catch (e) {
        this.warn("Cant determine app type isAndroidApp, " + e);
        return false;
      }
    }
  },

  isAndroid4: {
    get: function() {
      try {
        return navigator.userAgent.indexOf("Android 4") > -1;
      } catch (e) {
        this.warn("Cant determine app type isAndroid4, " + e);
        return false;
      }
    }
  },

  isChromeApp: {
    get: function() {
      try {
        return window.location.href.indexOf("chrome-extension") > -1;
      } catch (e) {
        this.warn("Cant determine app type isChromeApp, " + e);
        return false;
      }
    }
  },

  isCouchApp: {
    get: function() {
      try {
        return window.location.href.indexOf("_design/pages") > -1;
      } catch (e) {
        this.warn("Cant determine app type isCouchApp, " + e);
        return false;
      }
    }
  },

  isTouchDBApp: {
    get: function() {
      try {
        return window.location.href.indexOf("localhost:8128") > -1;
      } catch (e) {
        this.warn("Cant determine app type isTouchDBApp, " + e);
        return false;
      }
    }
  },

  isNodeJSApp: {
    get: function() {
      try {
        return window.location.href !== undefined;
      } catch (e) {
        // this.debug("Cant access window, app type isNodeJSApp, ", e);
        return true;
      }
    }
  },

  isBackboneCouchDBApp: {
    get: function() {
      return false;
    }
  },

  /**
   * If not running offline on an android or in a chrome extension, assume we are
   * online.
   *
   * @returns {Boolean} true if not on offline Android or on a Chrome Extension
   */
  isOnlineOnly: {
    get: function() {
      return !this.isAndroidApp && !this.isChromeApp;
    }
  }


});
exports.App = App;

},{"./../FieldDBObject":4,"./../Router":5,"./../activity/Activity":6,"./../corpus/Corpus":16,"./../data_list/DataList":22,"./../import/Import":41,"./../locales/Contextualizer":43,"./../search/Search":48,"./../user/Team":54,"./../user/User":55,"./../user/UserMask":56,"q":76}],8:[function(require,module,exports){
var App = require("./App").App;

/**
 * @class The PsycholinguisticsApp is a minimal extension of the App with the preferences
 *  set to default to a psycholinguistics terminology and look and feel.
 *
 * @name  PsycholinguisticsApp
 * @extends App
 * @constructs
 */
var PsycholinguisticsApp = function PsycholinguisticsApp(options) {
  if(!this._fieldDBtype){
		this._fieldDBtype = "PsycholinguisticsApp";
	}
  this.debug("Constructing PsycholinguisticsApp ", options);
  App.apply(this, arguments);
};

PsycholinguisticsApp.prototype = Object.create(App.prototype, /** @lends PsycholinguisticsApp.prototype */ {
  constructor: {
    value: PsycholinguisticsApp
  },

  hasParticipants:{
    get: function() {
      if (!this.participantsList || !this.participantsList.docs || !this.participantsList.docs.length) {
        return false;
      }
      return this.participantsList.docs.length > 0;
    }
  }

});
exports.PsycholinguisticsApp = PsycholinguisticsApp;

},{"./App":7}],9:[function(require,module,exports){
/* globals document, Media */

var HTML5Audio = require("./HTML5Audio").HTML5Audio,
  CordovaAudio = require("./HTML5Audio").HTML5Audio;

/**
 * @class AudioPlayer is a minimal customization of the HTML5 media controller
 *
 * @name AudioPlayer
 *
 * @extends Object
 * @constructs
 */
var AudioPlayer = function AudioPlayer(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "AudioPlayer";
  }
  if (this.options) {
    console.log("AudioPlayer was created with options but it doesnt accept options", options);
  }
  console.log(HTML5Audio);
  console.log(CordovaAudio.play);
  this.mediaController = new HTML5Audio();

  Object.apply(this, arguments);
};

AudioPlayer.prototype = Object.create(Object.prototype, /** @lends AudioPlayer.prototype */ {
  constructor: {
    value: AudioPlayer
  },

  isPlaying: {
    configurable: true,
    get: function() {
      return this.mediaController.isPlaying;
    }
  },

  isPaused: {
    configurable: true,
    get: function() {
      return this.mediaController.isPaused;
    }
  },

  audioPlayStartTime: {
    configurable: true,
    get: function() {
      if (this.mediaController.audioPlayStarted) {
        return this.mediaController.audioPlayStarted;
      } else {
        return 0;
      }
    }
  },

  isCordova: {
    configurable: true,
    get: function() {
      // return false;
      try {
        if (!Media) {
          console.log("We are most likely in Cordova, using Cordova instead of HTML5 audio");
        }
        return true;
      } catch (e) {
        console.log("We are most likely not in Cordova, using HTML5 audio");
        return false;
      }
    }
  },

  getDuration: {
    configurable: true,
    value: function(src) {
      if (src && this.src.indexOf(src) > -1 && this.mediaController.src.indexOf(src) > -1) {
        return this.mediaController.duration || 0;
      } else {
        console.log("Duration wasn't clear, so returning 0");
        return 0;
      }
    }
  },

  src: {
    configurable: true,
    get: function() {
      return this._src;
    },
    set: function(value) {
      if (value && value.trim() && value.trim() === this._src) {
        return;
      }
      console.log("Changed audio source: " + value);
      if (this.isCordova && this.mediaController.library !== "Cordova") {
        this._src = value;
        this.mediaController = CordovaAudio;
      } else {
        if (!value.match(/^[^:]+:\/\//)) {
          this._src = document.location.href.replace(document.location.pathname, "/" + value);
        } else {
          this._src = value;
        }
        if (!this.mediaController._audioElement) {
          //Try to use the full path to the audio file if its a relative path
          if (document.getElementById(this._src)) {
            this.mediaController._audioElement = document.getElementById(this._src);
          } else {
            var audio = document.createElement("audio");
            audio.setAttribute("id", this._src);
            //todo set hidden?
            document.body.appendChild(audio);
            this.mediaController._audioElement = audio;
          }
        }
      }

      this.mediaController.src = this._src;
      console.log("Set the src in core/audio-player " + this._src);
    }
  },

  play: {
    configurable: true,
    value: function(optionalSource, optionalDelay) {
      if (optionalSource) {
        this.src = optionalSource;
      }
      if (this.mediaController) {
        console.log("this.mediaController.play " + this._src);
        this.mediaController.play(this._src, optionalDelay);
      } else {
        console.log("couldnt play " + this._src);
      }
    }
  },

  pause: {
    configurable: true,

    value: function() {
      if (this.mediaController) {
        this.mediaController.pause();
      }
    }
  },

  togglePause: {
    configurable: true,
    value: function() {
      console.log("togglePause");
      if (this.mediaController) {
        if (this.mediaController.isPaused) {
          console.log("   playing");
          this.mediaController.play();
        } else {
          console.log("   paused");
          this.mediaController.pause();
        }
      }
    }
  },

  stop: {
    configurable: true,
    value: function() {
      if (this.mediaController) {
        this.mediaController.stop();
      }
    }
  },

  addEvent: {
    configurable: true,
    value: function(message, startTime, endTime) {
      if (this.mediaController) {
        this.mediaController.addAudioEventAtTimePeriod(message, startTime, endTime);
      }
    }
  }
});

exports.AudioPlayer = AudioPlayer;

},{"./HTML5Audio":12}],10:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var AudioPlayer = require("./AudioPlayer").AudioPlayer;

/**
 * @class The AudioVideo is a type of FieldDBObject with any additional fields or
 * metadata that a team might use to ground/tag their primary data.
 *
 *
 * @name  AudioVideo
 * @extends FieldDBObject
 * @constructs
 */
var AudioVideo = function AudioVideo(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "AudioVideo";
  }
  this.debug("Constructing AudioVideo length: ", options);
  FieldDBObject.apply(this, arguments);
};

var DEFAULT_BASE_SPEECH_URL = "https://localhost:6984";
AudioVideo.prototype = Object.create(FieldDBObject.prototype, /** @lends AudioVideo.prototype */ {
  constructor: {
    value: AudioVideo
  },

  BASE_SPEECH_URL: {
    get: function() {
      return DEFAULT_BASE_SPEECH_URL;
    },
    set: function(value) {
      DEFAULT_BASE_SPEECH_URL = value;
    }
  },

  api: {
    value: "speech"
  },

  id: {
    get: function() {
      return this._URL || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._URL) {
        return;
      }
      if (!value) {
        delete this._URL;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._URL = value;
    }
  },

  URL: {
    get: function() {
      if (!this._URL && this.filename) {
        var baseUrl = this.url ? this.url : this.BASE_SPEECH_URL;
        return baseUrl + "/" + this.dbname + "/" + this.filename;
      }
      return this._URL || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._URL) {
        return;
      }
      if (!value) {
        delete this._URL;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._URL = value;
      if (this.audioPlayer) {
        this.audioPlayer.src = value;
      }
    }
  },

  play: {
    value: function(optionalStartTime, optionalEndTime, optionalDuration) {
      console.log("playing", this, optionalStartTime, optionalEndTime, optionalDuration);
      this.audioPlayer = this.audioPlayer || new AudioPlayer();
      this.audioPlayer.play(this.URL);
    }
  },

  type: {
    get: function() {
      if (!this._type && this.filename) {
        this._type = "audio/" + this.filename.split(".").pop();
      }
      return this._type || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._type) {
        return;
      }
      this.warn("type cannot be set, it is automatically determined from the filename. Not using: " + value);
      if (this.filename) {
        value = "audio/" + this.filename.split(".").pop();
        this._type = value;
      }
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);
      var json = FieldDBObject.prototype.toJSON.apply(this, arguments);
      delete json.audioPlayer;

      return json;
    }
  }


});
exports.AudioVideo = AudioVideo;

},{"./../FieldDBObject":4,"./AudioPlayer":9}],11:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var AudioVideo = require("./AudioVideo").AudioVideo;

/**
 * @class AudioVideos is a minimal customization of the Collection
 * to add an internal model of AudioVideo.
 *
 * @name  AudioVideos
 *
 * @extends Collection
 * @constructs
 */
var AudioVideos = function AudioVideos(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "AudioVideos";
  }
  this.debug("Constructing AudioVideos length: ", options);
  Collection.apply(this, arguments);
};

AudioVideos.prototype = Object.create(Collection.prototype, /** @lends AudioVideos.prototype */ {
  constructor: {
    value: AudioVideos
  },

  primaryKey: {
    value: "URL"
  },

  INTERNAL_MODELS: {
    value: {
      item: AudioVideo
    }
  },

  play: {
    value: function(optionalIndexToPlay) {
      console.log("playing");
      if (!optionalIndexToPlay) {
        optionalIndexToPlay = 0;
      }
      if (this._collection && this._collection[optionalIndexToPlay]) {
        this._collection[optionalIndexToPlay].play();
      }
    }
  }

});
exports.AudioVideos = AudioVideos;

},{"./../Collection":2,"./AudioVideo":10}],12:[function(require,module,exports){
/* globals window */

/**
 * @class HTML5Audio is a minimal customization of the HTML5 media controller
 *
 * @name  HTML5Audio
 *
 * @extends Object
 * @constructs
 */
var HTML5Audio = function HTML5Audio(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "HTML5Audio";
  }
  if (this.options) {
    console.log("HTML5Audio was created with options but it doesnt accept options", options);
  }

  Object.apply(this, arguments);
};

HTML5Audio.prototype = Object.create(Object.prototype, /** @lends HTML5Audio.prototype */ {
  constructor: {
    value: HTML5Audio
  },


  /**
   * @type {string}
   * @default null
   */
  src: {
    configurable: true,
    get: function() {
      return this._src;
    },
    set: function(value) {
      if (value && value.trim() && value.trim() === this._src) {
        return;
      }
      this._src = value;
      console.log("Changed audio source" + value);
      // this.endAudioEvents = [];
      // this.audioEvents = [];
    }
  },

  matchesSource: {
    value: function(value) {
      return this._src.indexOf(value) > -1;
    }
  },

  handleSrcChange: {
    value: function(oldValue, newValue) {
      console.log("Handle audio source change ", oldValue, newValue);
    }
  },

  duration: {
    configurable: true,
    get: function() {
      if (this._audioElement && this._audioElement.duration) {
        return this._audioElement.duration;
      } else {
        return 0;
      }
    }
  },

  play: {
    value: function(optionalSource, delay) {
      if (optionalSource) {
        this.src = optionalSource;
      }
      console.log("Requesting play of audio file " + optionalSource);

      if (this._audioElement) {
        var sourceElement;
        if (this._audioElement.children && this._audioElement.children[0] && this._audioElement.children[0].src) {
          sourceElement = this._audioElement.children[0];
        } else {
          sourceElement = this._audioElement;
        }
        if (sourceElement.src === this.src && this.isPaused) {
          this._audioElement.play();
          this.isPaused = false;
          this.isPlaying = true;
          return;
        }
        if (!sourceElement.src || sourceElement.src !== this.src) {
          sourceElement.src = this.src;
        }

        var self = this,
          startTime = Date.now(),
          audioElementToPlay = this._audioElement;

        audioElementToPlay.removeEventListener("ended", window.audioEndListener);
        audioElementToPlay.removeEventListener("canplaythrough", window.actuallyPlayAudio);

        var audiourl = this.src;
        window.audioEndListener = function() {
          audioElementToPlay.removeEventListener("ended", window.audioEndListener);
          console.log("audiourl is done " + audiourl);
          // if (self._audioElement) {
          //   self._audioElement.currentTime = 0;
          // }
          self.isPlaying = false;
          self.isPaused = false;
          for (var i = 0; i < self.endAudioEvents.length; i++) {
            // self.endAudioEvents[i].whatShouldHappen.call();
            var eventName = self.endAudioEvents[i].whatShouldHappen;
            if (self.matchesSource(self.endAudioEvents[i].audioFile)) {
              console.log("Dispatching " + eventName);
              // self.application.dispatchEventNamed(eventName, true, false);
            }
          }
        };

        window.actuallyPlayAudio = function() {
          audioElementToPlay.removeEventListener("canplaythrough", window.actuallyPlayAudio);

          if (!delay) {
            self._audioElement.play();
            self.isPlaying = true;
            self.isPaused = false;
            self.audioPlayStarted = Date.now();
          } else {
            var timeToPrepareAudio = Date.now() - startTime;
            var newDelay = delay - timeToPrepareAudio;
            if (newDelay > 0) {
              window.setTimeout(function() {
                self._audioElement.play();
                self.isPlaying = true;
                self.isPaused = false;
                self.audioPlayStarted = Date.now();
              }, newDelay);
            } else {
              console.warn("Audio was " + newDelay + " late.");
              self._audioElement.play();
              self.isPlaying = true;
              self.isPaused = false;
              self.audioPlayStarted = Date.now();
            }
          }
        };
        console.log("Requested play of audio file when canplaythrough " + sourceElement);
        audioElementToPlay.addEventListener("ended", window.audioEndListener);
        audioElementToPlay.addEventListener("canplaythrough", window.actuallyPlayAudio);
        // call play if the audio is ready
        if (audioElementToPlay.readyState === 4) {
          window.actuallyPlayAudio.apply(audioElementToPlay, []);
        }

      } else {
        console.warn("there was no audio element to play");
      }
    }
  },

  pause: {
    value: function() {
      if (this._audioElement) {
        this._audioElement.pause();
        this.isPaused = true;
      }
    }
  },

  stop: {
    value: function() {
      if (this._audioElement) {
        this._audioElement.pause();
        this._audioElement.currentTime = 0;
      }
    }
  },

  audioEvents: {
    configurable: true,
    value: []
  },
  endAudioEvents: {
    configurable: true,
    value: []
  },

  audioTimeUpdateFunction: {
    configurable: true,
    value: function() {
      console.log(this.currentTime);
      if (!this.audioEvents) {
        return;
      }
      for (var i = 0; i < this.audioEvents.length; i++) {
        if (this.currentTime > this.audioEvents[i].startTime - 0.15 && this.currentTime < this.audioEvents[i].endTime) {
          this.audioEvents[i].whatShouldHappen.call();
        }
      }
    }
  },

  addAudioEventAtTimePeriod: {
    value: function(whatShouldHappen, startTime, endTime) {
      if (this._audioElement) {
        this._audioElement.removeEventListener("timeupdate", this.audioTimeUpdateFunction);
      }

      if (!endTime) {
        endTime = startTime + 1000;
      }
      var audioFile = whatShouldHappen.substring(whatShouldHappen.indexOf(":::")).replace(":::", "");
      whatShouldHappen = whatShouldHappen.replace(":::" + audioFile, "");
      if (startTime === "end") {
        this.endAudioEvents.push({
          whatShouldHappen: whatShouldHappen,
          audioFile: audioFile
        });
      } else {
        this.audioEvents.push({
          startTime: startTime,
          endTime: endTime,
          whatShouldHappen: whatShouldHappen,
          audioFile: audioFile
        });
      }

      if (this._audioElement) {
        this._audioElement.addEventListener("timeupdate", this.audioTimeUpdateFunction);
      }
    }
  }
});

exports.HTML5Audio = HTML5Audio;

},{}],13:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class Comments allow users to collaborate between each other and take
 *        note of important things, issues to be fixed, etc. These can
 *        appear on datum, sessions corpora, and dataLists. Comments can
 *        also be edited and removed.
 *
 * @property {String} text Describe text here.
 * @property {Number} username Describe username here.
 * @property {Date} timestamp Describe timestamp here.
 *
 * @name  Comment
 * @extends FieldDBObject
 * @constructs
 */
var Comment = function Comment(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Comment";
  }
  this.debug("Constructing Comment ", options);
  FieldDBObject.apply(this, arguments);
};

Comment.prototype = Object.create(FieldDBObject.prototype, /** @lends Comment.prototype */ {

  constructor: {
    value: Comment
  },

  build: {
    value: function(usermask) {
      this.timestamp = Date.now();
      this.gravatar = usermask.gravatar;
      this.username = usermask.username;
    }
  },

  timestamp: {
    get: function() {
      return this._timestamp;
    },
    set: function(value) {
      if (value === this._timestamp) {
        return;
      }
      if (!value) {
        delete this._timestamp;
        return;
      }
      if (("" + value).indexOf("Z") > -1) {
        value = (new Date(value)).getTime();
      }

      this._timestamp = value;
    }
  },

  /**
   * The edit function allows users to edit a comment.
   *
   * @param {String}  newtext Takes new text and replaces old one.
   */
  edit: {
    value: function(newtext) {
      this.text = newtext;
      this.timestampModified = Date.now();
    }
  },

  commentCreatedActivity: {
    value: function(indirectObjectString) {
      var commentstring = this.text;
      return [{
          verb: "commented",
          verbicon: "icon-comment",
          directobjecticon: "",
          directobject: "'" + commentstring + "'",
          indirectobject: indirectObjectString,
          teamOrPersonal: "team",
          context: " via Offline App."
        },

        {
          verb: "commented",
          verbicon: "icon-comment",
          directobjecticon: "",
          directobject: "'" + commentstring + "'",
          indirectobject: indirectObjectString,
          teamOrPersonal: "personal",
          context: " via Offline App."
        }
      ];
    }
  }

});

exports.Comment = Comment;

},{"./../FieldDBObject":4}],14:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var Comment = require("./Comment").Comment;

/**
 * @class

 * @name  Comments
 * @description The Comments is a minimal customization of the Collection
 * to add an internal model of Comment.
 *
 * @extends Collection
 * @constructs
 */
var Comments = function Comments(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Comments";
  }
  this.debug("Constructing Comments ", options);
  Collection.apply(this, arguments);
};

Comments.prototype = Object.create(Collection.prototype, /** @lends Comments.prototype */ {
  constructor: {
    value: Comments
  },

  primaryKey: {
    value: "timestamp"
  },

  INTERNAL_MODELS: {
    value: {
      item: Comment
    }
  },

  insertNewCommentFromObject: {
    value: function(commentObject) {
      commentObject.timestamp = Date.now();
      this.add(new Comment(commentObject));
    }
  }


});
exports.Comments = Comments;

},{"./../Collection":2,"./Comment":13}],15:[function(require,module,exports){
/* globals window */
var AES = require("crypto-js/aes");
var CryptoEncoding = require("crypto-js/enc-utf8");
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

try {
  if (!window.atob) {
    console.log("ATOB is not defined, loading from npm");
  }
} catch (e) {
  console.log(e);
  /*jshint -W020 */
  window = {};
  window.atob = require("atob");
  window.btoa = require("btoa");
}

/**
 * @class Confidential
 * @name Confidential
 *
 * @description makes it possible to generate pass phrases (one per
 *        corpus) to encrypt and decrypt confidential data points. The
 *        confidential data is stored encrypted, and can only be decrypted
 *        if one has the corpus" secret key, or if one is logged into the
 *        system with their user name and password. This allows the corpus
 *        to be shared with anyone, with out worrying about confidential
 *        data or consultant stories being publically accessible. We are
 *        using the AES cipher algorithm.
 *
 * The Advanced Encryption Standard (AES) is a U.S. Federal Information
 * Processing Standard (FIPS). It was selected after a 5-year process where
 * 15 competing designs were evaluated.
 *
 * <a href="http://code.google.com/p/crypto-js/">More information on
 * CryptoJS</a>
 *
 * @extends Object
 *
 * @constructs
 *
 */
var Confidential = function Confidential(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Confidential";
  }
  this.debug("Constructing Confidential: ", options);
  if (options && options.filledWithDefaults) {
    this.fillWithDefaults();
    delete options.filledWithDefaults;
  }
  FieldDBObject.apply(this, arguments);
};

/**
 * The secretkeygenerator uses a "GUID" like generation to create a string
 * for the secret key.
 *
 * @returns {String} a string which is likely unique, in the format of a
 *          Globally Unique ID (GUID)
 */
Confidential.secretKeyGenerator = FieldDBObject.uuidGenerator;

Confidential.prototype = Object.create(FieldDBObject.prototype, /** @lends Confidential.prototype */ {
  constructor: {
    value: Confidential
  },

  decryptedMode: {
    value: false
  },

  /**
   * Encrypt accepts a string (UTF8) and returns a CryptoJS object, in base64
   * encoding so that it looks like a string, and can be saved as a string in
   * the corpus.
   *
   * @param message
   *          A UTF8 string
   * @returns Returns a base64 string prefixed with "confidential" so that the
   *          views can choose to not display the entire string for the user.
   */
  encrypt: {
    value: function(value) {
      if (typeof value === "object") {
        value = JSON.stringify(value);
        this.debug("Converted object to string before encryption");
      }
      var result = AES.encrypt(value, this.secretkey);
      this.verbose(this.secretkey, result.toString(), window.btoa(result.toString()));
      // return the base64 version to save it as a string in the corpus
      return "confidential:" + window.btoa(result.toString());
    }
  },

  /**
   * Decrypt uses this object's secret key to decode its parameter using the
   * AES algorithm.
   *
   * @param encrypted
   *          A base64 string prefixed (or not) with the word "confidential"
   * @returns Returns the encrypted result as a UTF8 string.
   */
  decrypt: {
    value: function(encrypted) {
      var result = encrypted;
      if (this.decryptedMode === undefined) {
        var self = this;
        this.turnOnDecryptedMode(function() {
          encrypted = encrypted.replace("confidential:", "");
          // decode base64
          encrypted = window.atob(encrypted);
          self.verbose("Decrypting after turning on decrypted mode " + encrypted, self.secretkey);
          result = AES.decrypt(encrypted, self.secretkey).toString(CryptoEncoding);
          try {
            if ((result.indexOf("{") === 0 && result.indexOf("}") === result.length - 1) || (result.indexOf("[") === 0 && result.indexOf("]") === result.length - 1)) {
              result = JSON.parse(result);
              self.debug("Decrypting an object");
            }
          } catch (e) {
            self.verbose("Decrypting a non-object");
          }
          return result;
        });
      } else {
        encrypted = encrypted.replace("confidential:", "");
        // decode base64
        encrypted = window.atob(encrypted);
        this.verbose("Decrypting " + encrypted, this.secretkey);
        result = AES.decrypt(encrypted, this.secretkey).toString(CryptoEncoding);
        try {
          if ((result[0] === "{" && result[result.length - 1] === "}") || (result[0] === "[" && result[result.length - 1] === "]")) {
            result = JSON.parse(result);
            this.debug("Decrypting an object");
          }
        } catch (e) {
          this.verbose("Decrypting a non-object");
        }
        return result;
      }
    }
  },

  secretkey: {
    get: function() {
      if (!this._secretkey) {
        this._secretkey = "";
      }
      return this._secretkey;
    },
    set: function(value) {
      if (value === this._secretkey) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._secretkey = value.trim();
    }
  },

  fillWithDefaults: {
    value: function() {
      if (this.secretkey === "This should be replaced with a top secret pass phrase.") {
        this.secretkey = this.secretKeyGenerator();
      }
    }
  },

  turnOnDecryptedMode: {
    value: function(callback) {
      this.decryptedMode = false;
      if (callback) {
        callback();
      }
    }
  }


});

exports.Confidential = Confidential;

},{"./../FieldDBObject":4,"atob":62,"btoa":65,"crypto-js/aes":66,"crypto-js/enc-utf8":70}],16:[function(require,module,exports){
/* global window, OPrime */
var CorpusMask = require("./CorpusMask").CorpusMask;
var Datum = require("./../datum/Datum").Datum;
var DatumFields = require("./../datum/DatumFields").DatumFields;
var Session = require("./../FieldDBObject").FieldDBObject;
var Speaker = require("./../user/Speaker").Speaker;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Permissions = require("./../Collection").Collection;
var Q = require("q");


var DEFAULT_CORPUS_MODEL = require("./corpus.json");
var DEFAULT_PSYCHOLINGUISTICS_CORPUS_MODEL = require("./psycholinguistics-corpus.json");

/**
 * @class A corpus is like a git repository, it has a remote, a title
 *        a description and perhaps a readme When the user hits sync
 *        their "branch" of the corpus will be pushed to the central
 *        remote, and we will show them a "diff" of what has
 *        changed.
 *
 * The Corpus may or may not be a git repository, so this class is
 * to abstract the functions we would expect the corpus to have,
 * regardless of how it is really stored on the disk.
 *
 *
 * @property {String} title This is used to refer to the corpus, and
 *           what appears in the url on the main website eg
 *           http://fieldlinguist.com/LingLlama/SampleFieldLinguisticsCorpus
 * @property {String} description This is a short description that
 *           appears on the corpus details page
 * @property {String} remote The git url of the remote eg:
 *           git@fieldlinguist.com:LingLlama/SampleFieldLinguisticsCorpus.git
 *
 * @property {Consultants} consultants Collection of consultants who contributed to the corpus
 * @property {DatumStates} datumstates Collection of datum states used to describe the state of datums in the corpus
 * @property {DatumFields} datumFields Collection of datum fields used in the corpus
 * @property {ConversationFields} conversationfields Collection of conversation-based datum fields used in the corpus
 * @property {Sessions} sessions Collection of sessions that belong to the corpus
 * @property {DataLists} datalists Collection of data lists created under the corpus
 * @property {Permissions} permissions Collection of permissions groups associated to the corpus
 *
 *
 * @property {Glosser} glosser The glosser listens to
 *           orthography/utterence lines and attempts to guess the
 *           gloss.
 * @property {Lexicon} lexicon The lexicon is a list of morphemes,
 *           allomorphs and glosses which are used to index datum, and
 *           also to gloss datum.
 *
 * @description The initialize function probably checks to see if
 *              the corpus is new or existing and brings it down to
 *              the user's client.
 *
 * @extends CorpusMask
 * @tutorial tests/corpus/CorpusTest.js
 */


var Corpus = function Corpus(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Corpus";
  }
  this.debug("Constructing corpus", options);
  CorpusMask.apply(this, arguments);
};

Corpus.prototype = Object.create(CorpusMask.prototype, /** @lends Corpus.prototype */ {
  constructor: {
    value: Corpus
  },

  id: {
    get: function() {
      return this._id || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._id) {
        return;
      }
      if (!value) {
        delete this._id;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._id = value;
    }
  },

  couchConnection: {
    get: function() {
      this.debug("couchConnection is deprecated");
    },
    set: function() {
      this.debug("couchConnection is deprecated");
    }
  },

  replicatedCorpusUrls: {
    get: function() {
      return this._replicatedCorpusUrls || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._replicatedCorpusUrls) {
        return;
      }
      if (!value) {
        delete this._replicatedCorpusUrls;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["sessionFields"](value);
        }
      }
      this._replicatedCorpusUrls = value;
    }
  },

  olacExportConnections: {
    get: function() {
      return this._olacExportConnections || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._olacExportConnections) {
        return;
      }
      if (!value) {
        delete this._olacExportConnections;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["sessionFields"](value);
        }
      }
      this._olacExportConnections = value;
    }
  },

  termsOfUse: {
    get: function() {
      return this._termsOfUse || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      if (value === this._termsOfUse) {
        return;
      }
      if (!value) {
        delete this._termsOfUse;
        return;
      }
      this._termsOfUse = value;
    }
  },

  license: {
    get: function() {
      return this._license || {};
    },
    set: function(value) {
      if (value === this._license) {
        return;
      }
      if (!value) {
        delete this._license;
        return;
      }
      this._license = value;
    }
  },

  copyright: {
    get: function() {
      return this._copyright || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._copyright) {
        return;
      }
      if (!value) {
        delete this._copyright;
        return;
      }
      this._copyright = value.trim();
    }
  },

  unserializedSessions: {
    value: null
  },
  sessions: {
    get: function() {
      return this.unserializedSessions || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this.unserializedSessions) {
        return;
      }
      if (!value) {
        delete this.unserializedSessions;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["sessionFields"](value);
        }
      }
      this.unserializedSessions = value;
    }
  },

  dateOfLastDatumModifiedToCheckForOldSession: {
    get: function() {
      var timestamp = 0;
      if (this.sessions && this.sessions.length > 0) {
        var mostRecentSession = this.sessions[this.sessions.length - 1];
        if (mostRecentSession.dateModified) {
          timestamp = mostRecentSession.dateModified;
        }
      }
      return new Date(timestamp);
    }
  },

  confidential: {
    get: function() {
      return this._confidential || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      if (value === this._confidential) {
        return;
      }
      if (!value) {
        delete this._confidential;
        return;
      } else {
        if (value && this.INTERNAL_MODELS && this.INTERNAL_MODELS["confidential"] && typeof this.INTERNAL_MODELS["confidential"] === "function" && value.constructor !== this.INTERNAL_MODELS["confidential"]) {
          this.debug("Parsing model: " + value);
          value = new this.INTERNAL_MODELS["confidential"](value);
        }
      }
      this._confidential = value;
    }
  },

  publicCorpus: {
    get: function() {
      return this._publicCorpus || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._publicCorpus) {
        return;
      }
      if (!value) {
        delete this._publicCorpus;
        return;
      }
      if (value !== "Public" && value !== "Private") {
        this.warn("Corpora can be either Public or Private");
        value = "Private";
      }
      this._publicCorpus = value;
    }
  },

  teamExternalObject: {
    value: null
  },
  team: {
    get: function() {
      return this.teamExternalObject;
    },
    set: function(value) {
      if (value === this.teamExternalObject) {
        return;
      }
      this.teamExternalObject = value;
    }
  },

  publicSelfExternalObject: {
    value: null
  },
  publicSelf: {
    get: function() {
      return this.publicSelfExternalObject;
    },
    set: function(value) {
      if (value === this.publicSelfExternalObject) {
        return;
      }
      this.publicSelfExternalObject = value;
    }
  },

  validationStati: {
    get: function() {
      return this._validationStati || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._validationStati) {
        return;
      }
      if (!value) {
        delete this._validationStati;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["datumStates"](value);
        }
      }
      this._validationStati = value;
    }
  },

  tags: {
    get: function() {
      return this._tags || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._tags) {
        return;
      }
      if (!value) {
        delete this._tags;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["tags"](value);
        }
      }
      this._tags = value;
    }
  },

  datumFields: {
    get: function() {
      return this._datumFields || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._datumFields) {
        return;
      }
      if (!value) {
        delete this._datumFields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["datumFields"](value);
        }
      }
      this._datumFields = value;
    }
  },

  participantFields: {
    get: function() {
      if (!this._participantFields) {
        this._participantFields = new this.INTERNAL_MODELS["participantFields"](Corpus.prototype.defaults_psycholinguistics.participantFields);
      }
      return this._participantFields;
    },
    set: function(value) {
      if (value === this._participantFields) {
        return;
      }
      if (!value) {
        delete this._participantFields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["participantFields"](value);
        }
      }
      this._participantFields = value;
    }
  },

  conversationFields: {
    get: function() {
      return this._conversationFields || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._conversationFields) {
        return;
      }
      if (!value) {
        delete this._conversationFields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["conversationFields"](value);
        }
      }
      this._conversationFields = value;
    }
  },

  sessionFields: {
    get: function() {
      return this._sessionFields || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._sessionFields) {
        return;
      }
      if (!value) {
        delete this._sessionFields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["sessionFields"](value);
        }
      }
      this._sessionFields = value;
    }
  },

  loadOrCreateCorpusByPouchName: {
    value: function(dbname) {
      if (!dbname) {
        throw "Cannot load corpus, its dbname was undefined";
      }
      var deferred = this.loadOrCreateCorpusByPouchNameDeferred || Q.defer(),
        self = this,
        baseUrl = this.url;

      dbname = dbname.trim();
      this.dbname = dbname;

      Q.nextTick(function() {

        if (!baseUrl) {
          baseUrl = self.BASE_DB_URL;
        }
        var tryAgainInCaseThereWasALag = function(reason) {
          self.debug(reason);
          if (self.runningloadOrCreateCorpusByPouchName) {
            deferred.reject(reason);
            return;
          }
          self.runningloadOrCreateCorpusByPouchName = true;
          self.loadOrCreateCorpusByPouchNameDeferred = deferred;
          window.setTimeout(function() {
            self.loadOrCreateCorpusByPouchName(dbname);
          }, 1000);
        };

        self.fetchCollection(self.api).then(function(corpora) {
          self.debug(corpora);
          if (corpora.length > 0) {
            self.runningloadOrCreateCorpusByPouchName = false;
            delete self.loadOrCreateCorpusByPouchNameDeferred;
            self.id = corpora[0]._id;
            self.fetch(baseUrl).then(function(result) {
              self.debug("Finished fetch of corpus ", result);
              deferred.resolve(result);
            }, function(reason) {
              deferred.reject(reason);
            });
          } else {
            tryAgainInCaseThereWasALag(corpora);
          }
        }, function(reason) {
          tryAgainInCaseThereWasALag(reason);
          // deferred.reject(reason);

        });

      });

      return deferred.promise;
    }
  },

  fetchPublicSelf: {
    value: function() {
      this.todo("test fetchPublicSelf");
      if (!this.dbname) {
        throw "Cannot load corpus's public self, its dbname was undefined";
      }
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {

        if (self.publicSelf && self.publicSelf.rev) {
          deferred.resolve(self.publicSelf);
          return;
        }

        self.publicSelf = new CorpusMask({
          dbname: self.dbname
        });

        self.publicSelf.fetch()
          .then(deferred.resolve, deferred.reject);

      });
      return deferred.promise;
    }
  },

  /**
   * backbone-couchdb adaptor set up
   */

  // The couchdb-connector is capable of mapping the url scheme
  // proposed by the authors of Backbone to documents in your database,
  // so that you don't have to change existing apps when you switch the sync-strategy
  api: {
    value: "private_corpuses"
  },

  loadPermissions: {
    value: function() {
      this.todo("test loadPermissions");
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {

        if (!self.permissions) {
          self.permissions = new Permissions();
        }
        if (!self.permissions.dbname) {
          self.permissions.dbname = self.dbname;
        }
        self.permissions.fetch()
          .then(deferred.resolve, deferred.reject);

      });
      return deferred.promise;
    }
  },

  defaults: {
    get: function() {
      return JSON.parse(JSON.stringify(DEFAULT_CORPUS_MODEL));
    }
  },

  defaults_psycholinguistics: {
    get: function() {
      var doc = this.defaults;

      if (DEFAULT_PSYCHOLINGUISTICS_CORPUS_MODEL) {
        for (var property in DEFAULT_PSYCHOLINGUISTICS_CORPUS_MODEL) {
          if (DEFAULT_PSYCHOLINGUISTICS_CORPUS_MODEL.hasOwnProperty(property)) {
            doc[property] = DEFAULT_PSYCHOLINGUISTICS_CORPUS_MODEL[property];
          }
        }
        doc.participantFields = this.defaults.speakerFields.concat(doc.participantFields);
      }

      return JSON.parse(JSON.stringify(doc));
    }
  },

  /**
   * Make the  model marked as Deleted, mapreduce function will
   * ignore the deleted models so that it does not show in the app,
   * but deleted model remains in the database until the admin empties
   * the trash.
   *
   * Also remove it from the view so the user cant see it.
   *
   */
  putInTrash: {
    value: function() {
      OPrime.bug("Sorry deleting corpora is not available right now. Too risky... ");
      if (true) {
        return;
      }
      /* TODO contact server to delte the corpus, if the success comes back, then do this */
      this.trashed = "deleted" + Date.now();
      this.save();
    }
  },

  /**
   *  This the function called by the add button, it adds a new comment state both to the collection and the model
   * @type {Object}
   */
  newComment: {
    value: function(commentstring) {
      var m = {
        "text": commentstring,
      };

      this.comments.add(m);
      this.unsavedChanges = true;

      window.app.addActivity({
        verb: "commented",
        verbicon: "icon-comment",
        directobjecticon: "",
        directobject: "'" + commentstring + "'",
        indirectobject: "on <i class='icon-cloud'></i><a href='#corpus/" + this.id + "'>this corpus</a>",
        teamOrPersonal: "team",
        context: " via Offline App."
      });

      window.app.addActivity({
        verb: "commented",
        verbicon: "icon-comment",
        directobjecticon: "",
        directobject: "'" + commentstring + "'",
        indirectobject: "on <i class='icon-cloud'></i><a href='#corpus/" + this.id + "'>" + this.get("title") + "</a>",
        teamOrPersonal: "personal",
        context: " via Offline App."
      });

      return m;
    }
  },

  /**
   * Builds a new session in this corpus, copying the current session's fields (if available) or the corpus' session fields.
   * @return {Session} a new session for this corpus
   */
  newSession: {
    value: function() {
      var sessionFields;
      if (this.currentSession && this.currentSession.sessionFields) {
        sessionFields = this.currentSession.sessionFields.clone();
      } else {
        sessionFields = this.sessionFields.clone();
      }
      var session = new Session({
        dbname: this.dbname,
        sessionFields: sessionFields
      });
      return session;
    }
  },

  newDatum: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {

        self.debug("Creating a datum for this corpus");
        if (!self.datumFields || !self.datumFields.clone) {
          throw "This corpus has no default datum fields... It is unable to create a datum.";
        }
        var datum = new Datum({
          datumFields: new DatumFields(self.datumFields.clone()),
        });
        for (var field in options) {
          if (!options.hasOwnProperty(field)) {
            continue;
          }
          if (datum.datumFields[field]) {
            self.debug("  this option appears to be a datumField " + field);
            datum.datumFields[field].value = options[field];
          } else {
            datum[field] = options[field];
          }
        }
        deferred.resolve(datum);
      });
      return deferred.promise;
    }
  },

  newSpeaker: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {

        self.debug("Creating a datum for this corpus");
        if (!self.speakerFields || !self.speakerFields.clone) {
          throw "This corpus has no default datum fields... It is unable to create a datum.";
        }
        var datum = new Speaker({
          speakerFields: new DatumFields(self.speakerFields.clone()),
        });
        for (var field in options) {
          if (!options.hasOwnProperty(field)) {
            continue;
          }
          if (datum.speakerFields[field]) {
            self.debug("  this option appears to be a datumField " + field);
            datum.speakerFields[field].value = options[field];
          } else {
            datum[field] = options[field];
          }
        }
        deferred.resolve(datum);
      });
      return deferred.promise;
    }
  },

  updateDatumToCorpusFields: {
    value: function(datum) {
      if (!this.datumFields) {
        return datum;
      }
      if (!datum.fields) {
        datum.fields = this.datumFields.clone();
        return datum;
      }
      datum.fields = new DatumFields().merge(this.datumFields, datum.fields);
      return datum;
    }
  },

  updateSpeakerToCorpusFields: {
    value: function(speaker) {
      if (!this.speakerFields) {
        return speaker;
      }
      if (!speaker.fields) {
        speaker.fields = this.speakerFields.clone();
        return speaker;
      }
      speaker.fields = new DatumFields().merge(this.speakerFields, speaker.fields);
      return speaker;
    }
  },

  updateParticipantToCorpusFields: {
    value: function(participant) {
      if (!this.participantFields) {
        return participant;
      }
      if (!participant.fields) {
        participant.fields = this.participantFields.clone();
        return participant;
      }
      participant.fields = new DatumFields().merge(this.participantFields, participant.fields, "overwrite");
      return participant;
    }
  },
  /**
   * Builds a new corpus based on this one (if this is not the team's practice corpus)
   * @return {Corpus} a new corpus based on this one
   */
  newCorpus: {
    value: function() {
      var newCorpusJson = this.clone();

      newCorpusJson.title = newCorpusJson.title + " copy";
      newCorpusJson.titleAsUrl = newCorpusJson.titleAsUrl + "Copy";
      newCorpusJson.description = "Copy of: " + newCorpusJson.description;

      newCorpusJson.dbname = newCorpusJson.dbname + "copy";
      newCorpusJson.replicatedCorpusUrls = newCorpusJson.replicatedCorpusUrls.map(function(remote) {
        return remote.replace(new RegExp(this.dbname, "g"), newCorpusJson.dbname);
      });

      newCorpusJson.comments = [];

      /* use default datum fields if this is going to based on teh users' first practice corpus */
      if (this.dbname.indexOf("firstcorpus") > -1) {
        newCorpusJson.datumFields = DEFAULT_CORPUS_MODEL.datumFields;
        newCorpusJson.conversationFields = DEFAULT_CORPUS_MODEL.conversationFields;
        newCorpusJson.sessionFields = DEFAULT_CORPUS_MODEL.sessionFields;
      }
      var x;
      //clear out search terms from the new corpus's datum fields
      for (x in newCorpusJson.datumFields) {
        newCorpusJson.datumFields[x].mask = "";
        newCorpusJson.datumFields[x].value = "";
      }
      if (newCorpusJson.participantFields) {
        for (x in newCorpusJson.participantFields) {
          newCorpusJson.participantFields[x].mask = "";
          newCorpusJson.participantFields[x].value = "";
        }
      }
      //clear out search terms from the new corpus's conversation fields
      for (x in newCorpusJson.conversationFields) {
        newCorpusJson.conversationFields[x].mask = "";
        newCorpusJson.conversationFields[x].value = "";
      }
      //clear out search terms from the new corpus's session fields
      for (x in newCorpusJson.sessionFields) {
        newCorpusJson.sessionFields[x].mask = "";
        newCorpusJson.sessionFields[x].value = "";
      }

      return new Corpus(newCorpusJson);
    }
  },

  /**
   * DO NOT store in attributes when saving to pouch (too big)
   * @type {FieldDBGlosser}
   */
  glosser: {
    get: function() {
      return this.glosserExternalObject;
    },
    set: function(value) {
      if (value === this.glosserExternalObject) {
        return;
      }
      this.glosserExternalObject = value;
    }
  },

  lexicon: {
    get: function() {
      return this.lexiconExternalObject;
    },
    set: function(value) {
      if (value === this.lexiconExternalObject) {
        return;
      }
      this.lexiconExternalObject = value;
    }
  },

  find: {
    value: function(uri) {
      var deferred = Q.defer();

      if (!uri) {
        throw "Uri must be specified ";
      }

      Q.nextTick(function() {
        deferred.resolve([]); /* TODO try fetching this uri */
      });

      return deferred.promise;
    }
  },

  prepareANewOfflinePouch: {
    value: function() {
      throw "I dont know how to prepareANewOfflinePouch";
    }
  },

  /**
   * Accepts two functions to call back when save is successful or
   * fails. If the fail callback is not overridden it will alert
   * failure to the user.
   *
   * - Adds the corpus to the corpus if it is in the right corpus, and wasn't already there
   * - Adds the corpus to the user if it wasn't already there
   * - Adds an activity to the logged in user with diff in what the user changed.
   * @return {Promise} promise for the saved corpus
   */
  saveCorpus: {
    value: function() {
      var deferred = Q.defer(),
        self = this;

      var newModel = false;
      if (!this.id) {
        self.debug("New corpus");
        newModel = true;
      } else {
        self.debug("Existing corpus");
      }
      var oldrev = this.get("_rev");

      this.timestamp = Date.now();

      self.unsavedChanges = false;
      self.save().then(function(model) {
        var title = model.title;
        var differences = "#diff/oldrev/" + oldrev + "/newrev/" + model._rev;
        var verb = "modified";
        var verbicon = "icon-pencil";
        if (newModel) {
          verb = "added";
          verbicon = "icon-plus";
        }
        var teamid = self.dbname.split("-")[0];
        window.app.addActivity({
          verb: "<a href='" + differences + "'>" + verb + "</a> ",
          verbmask: verb,
          verbicon: verbicon,
          directobject: "<a href='#corpus/" + model.id + "'>" + title + "</a>",
          directobjectmask: "a corpus",
          directobjecticon: "icon-cloud",
          indirectobject: "created by <a href='#user/" + teamid + "'>" + teamid + "</a>",
          context: " via Offline App.",
          contextmask: "",
          teamOrPersonal: "personal"
        });
        window.app.addActivity({
          verb: "<a href='" + differences + "'>" + verb + "</a> ",
          verbmask: verb,
          verbicon: verbicon,
          directobject: "<a href='#corpus/" + model.id + "'>" + title + "</a>",
          directobjectmask: "a corpus",
          directobjecticon: "icon-cloud",
          indirectobject: "created by <a href='#user/" + teamid + "'>this team</a>",
          context: " via Offline App.",
          contextmask: "",
          teamOrPersonal: "team"
        });
        deferred.resolve(self);
      }, deferred.reject);

      return deferred.promise;
    }
  },

  /**
   * If more views are added to corpora, add them here
   * @returns {} an object containing valid map reduce functions
   * TODO: add conversation search to the get_datum_fields function
   */
  validDBQueries: {
    value: function() {
      return {
        // activities: {
        //   url: "/_design/pages/_view/activities",
        //   map: requireoff("./../../couchapp_dev/views/activities/map")
        // },
        // add_synctactic_category: {
        //   url: "/_design/pages/_view/add_synctactic_category",
        //   map: requireoff("./../../couchapp_dev/views/add_synctactic_category/map")
        // },
        // audioIntervals: {
        //   url: "/_design/pages/_view/audioIntervals",
        //   map: requireoff("./../../couchapp_dev/views/audioIntervals/map")
        // },
        // byCollection: {
        //   url: "/_design/pages/_view/byCollection",
        //   map: requireoff("./../../couchapp_dev/views/byCollection/map")
        // },
        // by_date: {
        //   url: "/_design/pages/_view/by_date",
        //   map: requireoff("./../../couchapp_dev/views/by_date/map")
        // },
        // by_rhyming: {
        //   url: "/_design/pages/_view/by_rhyming",
        //   map: requireoff("./../../couchapp_dev/views/by_rhyming/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/by_rhyming/reduce")
        // },
        // cleaning_example: {
        //   url: "/_design/pages/_view/cleaning_example",
        //   map: requireoff("./../../couchapp_dev/views/cleaning_example/map")
        // },
        // corpuses: {
        //   url: "/_design/pages/_view/corpuses",
        //   map: requireoff("./../../couchapp_dev/views/corpuses/map")
        // },
        // datalists: {
        //   url: "/_design/pages/_view/datalists",
        //   map: requireoff("./../../couchapp_dev/views/datalists/map")
        // },
        // datums: {
        //   url: "/_design/pages/_view/datums",
        //   map: requireoff("./../../couchapp_dev/views/datums/map")
        // },
        // datums_by_user: {
        //   url: "/_design/pages/_view/datums_by_user",
        //   map: requireoff("./../../couchapp_dev/views/datums_by_user/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/datums_by_user/reduce")
        // },
        // datums_chronological: {
        //   url: "/_design/pages/_view/datums_chronological",
        //   map: requireoff("./../../couchapp_dev/views/datums_chronological/map")
        // },
        // deleted: {
        //   url: "/_design/pages/_view/deleted",
        //   map: requireoff("./../../couchapp_dev/views/deleted/map")
        // },
        // export_eopas_xml: {
        //   url: "/_design/pages/_view/export_eopas_xml",
        //   map: requireoff("./../../couchapp_dev/views/export_eopas_xml/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/export_eopas_xml/reduce")
        // },
        // get_corpus_datum_tags: {
        //   url: "/_design/pages/_view/get_corpus_datum_tags",
        //   map: requireoff("./../../couchapp_dev/views/get_corpus_datum_tags/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/get_corpus_datum_tags/reduce")
        // },
        // get_corpus_fields: {
        //   url: "/_design/pages/_view/get_corpus_fields",
        //   map: requireoff("./../../couchapp_dev/views/get_corpus_fields/map")
        // },
        // get_corpus_validationStati: {
        //   url: "/_design/pages/_view/get_corpus_validationStati",
        //   map: requireoff("./../../couchapp_dev/views/get_corpus_validationStati/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/get_corpus_validationStati/reduce")
        // },
        // get_datum_fields: {
        //   url: "/_design/pages/_view/get_datum_fields",
        //   map: requireoff("./../../couchapp_dev/views/get_datum_fields/map")
        // },
        // get_datums_by_session_id: {
        //   url: "/_design/pages/_view/get_datums_by_session_id",
        //   map: requireoff("./../../couchapp_dev/views/get_datums_by_session_id/map")
        // },
        // get_frequent_fields: {
        //   url: "/_design/pages/_view/get_frequent_fields",
        //   map: requireoff("./../../couchapp_dev/views/get_frequent_fields/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/get_frequent_fields/reduce")
        // },
        // get_search_fields_chronological: {
        //   url: "/_design/pages/_view/get_search_fields_chronological",
        //   map: requireoff("./../../couchapp_dev/views/get_search_fields_chronological/map")
        // },
        // glosses_in_utterance: {
        //   url: "/_design/pages/_view/glosses_in_utterance",
        //   map: requireoff("./../../couchapp_dev/views/glosses_in_utterance/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/glosses_in_utterance/reduce")
        // },
        // lexicon_create_tuples: {
        //   url: "/_design/pages/_view/lexicon_create_tuples",
        //   map: requireoff("./../../couchapp_dev/views/lexicon_create_tuples/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/lexicon_create_tuples/reduce")
        // },
        // morpheme_neighbors: {
        //   url: "/_design/pages/_view/morpheme_neighbors",
        //   map: requireoff("./../../couchapp_dev/views/morpheme_neighbors/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/morpheme_neighbors/reduce")
        // },
        // morphemes_in_gloss: {
        //   url: "/_design/pages/_view/morphemes_in_gloss",
        //   map: requireoff("./../../couchapp_dev/views/morphemes_in_gloss/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/morphemes_in_gloss/reduce")
        // },
        // recent_comments: {
        //   url: "/_design/pages/_view/recent_comments",
        //   map: requireoff("./../../couchapp_dev/views/recent_comments/map")
        // },
        // sessions: {
        //   url: "/_design/pages/_view/sessions",
        //   map: requireoff("./../../couchapp_dev/views/sessions/map")
        // },
        // users: {
        //   url: "/_design/pages/_view/users",
        //   map: requireoff("./../../couchapp_dev/views/users/map")
        // },
        // word_list: {
        //   url: "/_design/pages/_view/word_list",
        //   map: requireoff("./../../couchapp_dev/views/word_list/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/word_list/reduce")
        // },
        // couchapp_dev_word_list_rdf: {
        //   url: "/_design/pages/_view/couchapp_dev_word_list_rdf",
        //   map: requireoff("./../../couchapp_dev/views/word_list_rdf/map"),
        //   reduce: requireoff("./../../couchapp_dev/views/word_list_rdf/reduce")
        // }
      };
    }
  },

  validate: {
    value: function(attrs) {
      attrs = attrs || this;
      if (attrs.publicCorpus) {
        if (attrs.publicCorpus !== "Public") {
          if (attrs.publicCorpus !== "Private") {
            return "Corpus must be either Public or Private"; //TODO test this.
          }
        }
      }
    }
  },

  /**
   * This function takes in a dbname, which could be different
   * from the current corpus in case there is a master corpus with
   * more/better monolingual data.
   *
   * @param dbname
   * @param callback
   */
  buildMorphologicalAnalyzerFromTeamServer: {
    value: function(dbname, callback) {
      if (!dbname) {
        dbname = this.dbname;
      }
      this.glosser.downloadPrecedenceRules(dbname, this.glosserURL, callback);
    }
  },
  /**
   * This function takes in a dbname, which could be different
   * from the current corpus incase there is a master corpus wiht
   * more/better monolingual data.
   *
   * @param dbname
   * @param callback
   */
  buildLexiconFromTeamServer: {
    value: function(dbname, callback) {
      if (!dbname) {
        dbname = this.dbname;
      }
      this.lexicon.buildLexiconFromCouch(dbname, callback);
    }
  },

  /**
   * This function takes in a dbname, which could be different
   * from the current corpus incase there is a master corpus wiht
   * more representative datum
   * example : https://corpusdev.lingsync.org/lingllama-cherokee/_design/pages/_view/get_frequent_fields?group=true
   *
   * It takes the values stored in the corpus, if set, otherwise it will take the values from this corpus since the window was last refreshed
   *
   * If a url is passed, it contacts the server for fresh info.
   *
   * @param dbname
   * @param callback
   */
  getFrequentDatumFields: {
    value: function() {
      return this.getFrequentValues("fields", ["judgement", "utterance", "morphemes", "gloss", "translation"]);
    }
  },

  /**
   * This function takes in a dbname, which could be different
   * from the current corpus incase there is a master corpus wiht
   * more representative datum
   * example : https://corpusdev.lingsync.org/lingllama-cherokee/_design/pages/_view/get_corpus_validationStati?group=true
   *
   * It takes the values stored in the corpus, if set, otherwise it will take the values from this corpus since the window was last refreshed
   *
   * If a url is passed, it contacts the server for fresh info.
   *
   * @param dbname
   * @param callback
   */
  getFrequentDatumValidationStates: {
    value: function() {
      return this.getFrequentValues("validationStatus", ["Checked", "Deleted", "ToBeCheckedByAnna", "ToBeCheckedByBill", "ToBeCheckedByClaude"]);
    }
  },

  getCorpusSpecificLocalizations: {
    value: function(optionalLocaleCode) {
      var self = this;

      if (optionalLocaleCode) {
        this.todo("Test the loading of an optionalLocaleCode");
        this.get(optionalLocaleCode + "/messages.json").then(function(locale) {
          if (!locale) {
            self.warn("the requested locale was empty.");
            return;
          }
          self.application.contextualizer.addMessagesToContextualizedStrings("null", locale);
        }, function(error) {
          self.warn("The requested locale wasn't loaded");
          self.debug("locale loading error", error);
        });
      } else {
        this.fetchCollection("locales").then(function(locales) {
          for (var localeIndex = 0; localeIndex < locales.length; localeIndex++) {
            if (!locales[localeIndex]) {
              self.warn("the requested locale was empty.");
              continue;
            }
            self.application.contextualizer.addMessagesToContextualizedStrings(null, locales[localeIndex]);
          }
        }, function(error) {
          self.warn("The locales didn't loaded");
          self.debug("locale loading error", error);
        });
      }

      return this;
    }
  },

  getFrequentValues: {
    value: function(fieldname, defaults) {
      var deferred = Q.defer(),
        self;

      if (!defaults) {
        defaults = self["defaultFrequentDatum" + fieldname];
      }

      /* if we have already asked the server in this page load, return */
      if (self["frequentDatum" + fieldname]) {
        Q.nextTick(function() {
          deferred.resolve(self["frequentDatum" + fieldname]);
        });
        return deferred.promise;
      }

      // var jsonUrl = self.validDBQueries["get_corpus_" + fieldname].url + "?group=true&limit=100";
      this.fetchCollection("frequentDatum" + fieldname, 0, 0, 100, true).then(function(frequentValues) {
        /*
         * TODO Hide optionally specified values
         */
        self["frequentDatum" + fieldname] = frequentValues;
        deferred.resolve(frequentValues);
      }, function(response) {
        self.debug("resolving defaults for frequentDatum" + fieldname, response);
        deferred.resolve(defaults);
      });

      return deferred.promise;
    }
  },
  /**
   * This function takes in a dbname, which could be different
   * from the current corpus incase there is a master corpus wiht
   * more representative datum
   * example : https://corpusdev.lingsync.org/lingllama-cherokee/_design/pages/_view/get_corpus_validationStati?group=true
   *
   * It takes the values stored in the corpus, if set, otherwise it will take the values from this corpus since the window was last refreshed
   *
   * If a url is passed, it contacts the server for fresh info.
   *
   * @param dbname
   * @param callback
   */
  getFrequentDatumTags: {
    value: function() {
      return this.getFrequentValues("tags", ["Passive", "WH", "Indefinte", "Generic", "Agent-y", "Causative", "Pro-drop", "Ambigous"]);
    }
  },
  changeCorpusPublicPrivate: {
    value: function() {
      //      alert("TODO contact server to change the public private of the corpus");
      throw " I dont know how change this corpus' public/private setting ";
    }
  }
});

exports.Corpus = Corpus;
exports.FieldDatabase = Corpus;

},{"./../Collection":2,"./../FieldDBObject":4,"./../datum/Datum":24,"./../datum/DatumFields":26,"./../user/Speaker":53,"./CorpusMask":17,"./corpus.json":20,"./psycholinguistics-corpus.json":21,"q":76}],17:[function(require,module,exports){
var Confidential = require("./../confidentiality_encryption/Confidential").Confidential;
var Database = require("./Database").Database;
var DatumFields = require("./../datum/DatumFields").DatumFields;
var DatumStates = require("./../datum/DatumStates").DatumStates;
var DatumTags = require("./../datum/DatumTags").DatumTags;
var Comments = require("./../comment/Comments").Comments;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Sessions = require("./../Collection").Collection;
var DataLists = require("./../Collection").Collection;
var TeamPreference = require("./../user/UserPreference").UserPreference;


var DEFAULT_CORPUS_MODEL = require("./corpus.json");
/**
 * @class The CorpusMask is saved as corpus in the Couch repository,
 *        it is the publicly visible version of a corpus. By default it just says "This
 *        corpus is private," when users decide to make some aspects of their corpsu
 *        public they can customize the fields in their "corpus" object to display
 *        only certain sorts of data, even though the corpus is publicly discoverable.
 *
 * @property {String} title This is the title of the corpus, as set by the corpus
 *           team. It can contain any UTF-8 character.
 * @property {String} titleAsUrl This is what appears in the url on the main website.
 *           It is based on the title of the corpus and can be changed and looks
 *           nicer than the dbname which cannot be changed. eg
 *           http://fieldlinguist.com/LingLlama/SampleFieldLinguisticsCorpus
 * @property {String} description This is a short description that
 *           appears on the corpus details page
 * @property {Object} termsOfUse Terms of use set by the corpus team, includes
 *           a field for humanReadable terms which are displayed on the corpus
 *           and included in corpus exports.
 * @property {Object} license License set by the corpus team, includes a field
 *           for humanReadable terms which are displayed on the corpus and
 *           included in corpus exports, as well as a link to the license, imageUrl
 *           for the image/logo of the license for easy recognition and
 *           title of the license.
 * @property {Object} copyright Who owns the copyright to the corpus,
 *           by default it is set to the corpus team"s name but teams can customize
 *           it for example to make the corpus copyright of the language community
 *           or speakers who contributed to the corpus.
 * @property {Object} location GPS location of the corpus (longitude, latitude and accuracy)
 *           The corpus can be plotted on a map using the accuracy as a radius
 *           of roughly where the data is from.
 * @property {String} remote The url of the remote eg:
 *           git@fieldlinguist.com:LingLlama/SampleFieldLinguisticsCorpus.git
 * @property {Array} couchConnections The url of couch remote(s) where the
 *           corpus is replicated or backed up.
 * @property {Array} olacConnections The url of OLAC remote(s) where the corpus
 *           is archived or published.
 *
 * @property {Array} members Collection of public browsable/search engine
 *           discoverable members associated to the corpus
 * @property {Array} datumstates Collection of datum states for which data are
 *           will be public browsable/search engine discoverable in the corpus. This
 *           can be used to only show polished data or "checked" data on the public
 *           page for example.
 * @property {Array} datumfields Collection of datum fields which will be
 *           public browsable/search engine discoverable  on public datum in the corpus
 * @property {Array} sessions Collection of public browsable/search engine
 *           discoverable sessions that belong to the corpus
 * @property {Array} datalists Collection of public browsable/search engine
 *           discoverable data lists created under the corpus
 *
 * @extends Database
 * @tutorial tests/CorpusMaskTest.js
 */
var CorpusMask = function CorpusMask(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "CorpusMask";
  }
  this.debug(options);
  Database.apply(this, arguments);
};

CorpusMask.prototype = Object.create(Database.prototype, /** @lends CorpusMask.prototype */ {
  constructor: {
    value: CorpusMask
  },

  id: {
    get: function() {
      return "corpus";
    },
    set: function(value) {
      if (value === this._id) {
        return;
      }
      this.warn("CorpusMask id cannot be set, it is \"corpus\" by default." + value);
      value = "corpus";
      this._id = value;
    }
  },

  api: {
    value: "corpora"
  },

  defaults: {
    get: function() {
      var filteredCorpus = JSON.parse(JSON.stringify(DEFAULT_CORPUS_MODEL));
      filteredCorpus.title = "Private Corpus";
      filteredCorpus.description = "The details of this corpus are not public.";
      filteredCorpus.location = {
        latitude: 0,
        longitude: 0,
        accuracy: 0
      };

      var publicStates = [];
      filteredCorpus.validationStati.map(function(state) {
        if (state.validationStatus === "Checked*") {
          publicStates.push(state);
        } else if (state.validationStatus === "Published*") {
          publicStates.push(state);
        } else if (state.validationStatus === "ApprovedLanguageLearningContent*") {
          publicStates.push(state);
        }
      });
      filteredCorpus.validationStati = publicStates;

      var publicableTags = [];
      filteredCorpus.tags.map(function() {
        // none
      });
      filteredCorpus.tags = publicableTags;

      var publicableDatumFields = [];
      filteredCorpus.datumFields.map(function(field) {
        if (field.id === "judgement") {
          publicableDatumFields.push(field);
        } else if (field.id === "orthography") {
          publicableDatumFields.push(field);
        } else if (field.id === "utterance") {
          publicableDatumFields.push(field);
        } else if (field.id === "morphemes") {
          publicableDatumFields.push(field);
        } else if (field.id === "gloss") {
          publicableDatumFields.push(field);
        } else if (field.id === "translation") {
          publicableDatumFields.push(field);
        }
      });
      filteredCorpus.datumFields = publicableDatumFields;

      var publicableSessionFields = [];
      filteredCorpus.sessionFields.map(function(field) {
        if (field.id === "dialect") {
          publicableSessionFields.push(field);
        } else if (field.id === "register") {
          publicableSessionFields.push(field);
        } else if (field.id === "language") {
          publicableSessionFields.push(field);
        } else if (field.id === "location") {
          publicableSessionFields.push(field);
        }
      });
      filteredCorpus.sessionFields = publicableSessionFields;

      var publicableSpeakerFields = [];
      filteredCorpus.speakerFields.map(function(field) {
        if (field.id === "anonymousCode") {
          publicableSpeakerFields.push(field);
        }
      });
      filteredCorpus.speakerFields = publicableSpeakerFields;


      return filteredCorpus;
    }
  },

  INTERNAL_MODELS: {
    value: {
      _id: FieldDBObject.DEFAULT_STRING,
      _rev: FieldDBObject.DEFAULT_STRING,
      dbname: FieldDBObject.DEFAULT_STRING,
      version: FieldDBObject.DEFAULT_STRING,
      dateCreated: FieldDBObject.DEFAULT_DATE,
      dateModified: FieldDBObject.DEFAULT_DATE,
      comments: Comments,
      sessions: Sessions,
      datalists: DataLists,

      title: FieldDBObject.DEFAULT_STRING,
      titleAsUrl: FieldDBObject.DEFAULT_STRING,
      description: FieldDBObject.DEFAULT_STRING,
      termsOfUse: FieldDBObject.DEFAULT_OBJECT,
      license: FieldDBObject.DEFAULT_OBJECT,
      copyright: FieldDBObject.DEFAULT_STRING,
      replicatedCorpusUrls: FieldDBObject.DEFAULT_ARRAY,
      olacExportConnections: FieldDBObject.DEFAULT_ARRAY,
      publicCorpus: FieldDBObject.DEFAULT_STRING,
      confidential: Confidential,

      validationStati: DatumStates,
      tags: DatumTags,

      datumFields: DatumFields,
      speakerFields: DatumFields,
      participantFields: DatumFields,
      conversationFields: DatumFields,
      sessionFields: DatumFields,

      prefs: TeamPreference
    }
  },

  titleAsUrl: {
    get: function() {
      if (!this._titleAsUrl && this.title) {
        this._titleAsUrl = this.sanitizeStringForFileSystem(this._title, "_").toLowerCase();
      }
      return this._titleAsUrl;
    },
    set: function(value) {
      if (value === this._titleAsUrl) {
        return;
      }
      // If an app is explicity trying to overwrite a titleAsUrl, complain.
      if (this._titleAsUrl) {
        this.warn("titleAsUrl cannot be set directly, setting the title will cause it to be set.");
      }
    }
  },

  title: {
    get: function() {
      return this._title || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._title) {
        return;
      }
      if (!value) {
        delete this._title;
        return;
      }
      this._title = value.trim();
      this._titleAsUrl = this.sanitizeStringForFileSystem(this._title, "_").toLowerCase(); //this makes the accented char unnecessarily unreadable: encodeURIComponent(attributes.title.replace(/ /g,"_"));
    }
  },

  description: {
    get: function() {
      return this._description || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._description) {
        return;
      }
      if (!value) {
        delete this._description;
        return;
      }
      this._description = value.trim();
    }
  },

  prefs: {
    get: function() {
      return this._prefs;
    },
    set: function(value) {
      if (value === this._prefs) {
        return;
      }
      if (!value) {
        delete this._prefs;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Object]") {
          value = new this.INTERNAL_MODELS["prefs"](value);
        }
      }
      this._prefs = value;
    }
  },

  preferredDatumTemplate: {
    get: function() {
      if (this.prefs && this.prefs.preferredDatumTemplate) {
        return this.prefs.preferredDatumTemplate;
      }
    },
    set: function(value) {
      if (this.prefs && this.prefs.preferredDatumTemplate && value === this.prefs.preferredDatumTemplate) {
        return;
      }
      if (!value || value === "default") {
        if (this.prefs && this.prefs.preferredDatumTemplate) {
          delete this.prefs.preferredDatumTemplate;
        }
        return;
      }
      this.prefs = this.prefs || new this.INTERNAL_MODELS["prefs"]();
      this.prefs.preferredDatumTemplate = value.trim();
    }
  },

  preferredLocale: {
    get: function() {
      if (this.prefs && this.prefs.preferredLocale) {
        return this.prefs.preferredLocale;
      }
    },
    set: function(value) {
      if (this.prefs && this.prefs.preferredLocale && value === this.prefs.preferredLocale) {
        return;
      }
      if (!value || value === "default") {
        if (this.prefs && this.prefs.preferredLocale) {
          delete this.prefs.preferredLocale;
        }
        return;
      }
      this.prefs = this.prefs || new this.INTERNAL_MODELS["prefs"]();
      this.prefs.preferredLocale = value.trim();
    }
  },

  preferredDashboardLayout: {
    get: function() {
      if (this.prefs && this.prefs.preferredDashboardLayout) {
        return this.prefs.preferredDashboardLayout;
      }
    },
    set: function(value) {
      if (this.prefs && this.prefs.preferredDashboardLayout && value === this.prefs.preferredDashboardLayout) {
        return;
      }
      if (!value || value === "default") {
        if (this.prefs && this.prefs.preferredDashboardLayout) {
          delete this.prefs.preferredDashboardLayout;
        }
        return;
      }
      this.prefs = this.prefs || new this.INTERNAL_MODELS["prefs"]();
      this.prefs.preferredDashboardLayout = value.trim();
    }
  },

  preferredTemplate: {
    get: function() {
      this.warn("preferredTemplate is deprecated, use dbname instead.");
      return this.preferredDatumTemplate;
    },
    set: function(value) {
      this.warn("preferredTemplate is deprecated, please use dbname instead.");
      this.preferredDatumTemplate = value;
    }
  }

});
exports.CorpusMask = CorpusMask;

},{"./../Collection":2,"./../FieldDBObject":4,"./../comment/Comments":14,"./../confidentiality_encryption/Confidential":15,"./../datum/DatumFields":26,"./../datum/DatumStates":28,"./../datum/DatumTags":30,"./../user/UserPreference":57,"./Database":18,"./corpus.json":20}],18:[function(require,module,exports){
/* globals localStorage */

var Q = require("q");
var CORS = require("../CORS").CORS;
var FieldDBObject = require("../FieldDBObject").FieldDBObject;
var Confidential = require("./../confidentiality_encryption/Confidential").Confidential;

var Database = function Database(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Database";
  }
  this.debug("In Database ", options);
  FieldDBObject.apply(this, arguments);
};

var DEFAULT_COLLECTION_MAPREDUCE = "_design/pages/_view/COLLECTION?descending=true";
var DEFAULT_BASE_AUTH_URL = "https://localhost:3181";
var DEFAULT_BASE_DB_URL = "https://localhost:6984";
Database.prototype = Object.create(FieldDBObject.prototype, /** @lends Database.prototype */ {
  constructor: {
    value: Database
  },

  DEFAULT_COLLECTION_MAPREDUCE: {
    value: DEFAULT_COLLECTION_MAPREDUCE
  },

  BASE_AUTH_URL: {
    get: function() {
      return DEFAULT_BASE_AUTH_URL;
    },
    set: function(value) {
      DEFAULT_BASE_AUTH_URL = value;
    }
  },

  BASE_DB_URL: {
    get: function() {
      return DEFAULT_BASE_DB_URL;
    },
    set: function(value) {
      DEFAULT_BASE_DB_URL = value;
    }
  },

  get: {
    value: function(id) {
      if (!this.dbname) {
        this.bug("Cannot get something if the dbname is not defined ", id);
        throw "Cannot get something if the dbname is not defined ";
      }
      var baseUrl = this.url;
      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }
      return CORS.makeCORSRequest({
        method: "GET",
        url: baseUrl + "/" + this.dbname + "/" + id
      });
    }
  },

  set: {
    value: function(arg1, arg2) {
      if (!this.dbname) {
        this.bug("Cannot get something if the dbname is not defined ", arg1, arg2);
        throw "Cannot get something if the dbname is not defined ";
      }
      var deferred = Q.defer(),
        baseUrl = this.url,
        self = this,
        key,
        value;

      if (!arg2) {
        value = arg1;
      } else {
        key = arg1;
        value = arg2;
        value.id = key;
      }
      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }
      CORS.makeCORSRequest({
        method: "POST",
        data: value,
        url: baseUrl + "/" + this.dbname
      }).then(function(result) {
        if (result._rev) {
          value._rev = result._rev;
          value.rev = result._rev;
        }
        if (!value._id) {
          value._id = result._id;
          value.id = result._id;
        }
        deferred.resolve(value);
      }, function(error) {
        self.warn("error saving " + error);
        deferred.reject(error);
      });
      return deferred.promise;
    }
  },

  delete: {
    value: function(options) {
      return this.remove(options);
    }
  },

  remove: {
    value: function(options) {
      this.bug("Deleting data is not permitted.", options);
      throw "Deleting data is not permitted.";
    }
  },

  fetchAllDocuments: {
    value: function() {
      return this.fetchCollection("datums");
    }
  },

  fetchCollection: {
    value: function(collectionType, start, end, limit, reduce, key) {
      this.todo("Provide pagination ", start, end, limit, reduce);
      var deferred = Q.defer(),
        self = this,
        baseUrl = this.url;

      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
        // Q.nextTick(function() {
        //   deferred.reject("Cannot fetch data with out a url");
        // });
        // return deferred.promise;
      }

      if (!collectionType) {
        Q.nextTick(function() {
          deferred.reject("Cannot fetch data with out a collectionType (eg consultants, sessions, datalists)");
        });
        return deferred.promise;
      }
      if (key) {
        key = "&key=\"" + key + "\"";
      } else {
        key = "";
      }

      var cantLogIn = function(reason) {
        self.debug(reason);
        deferred.reject(reason);
        // self.register().then(function() {
        //   self.fetchCollection(collectionType).then(function(documents) {
        //     deferred.resolve(documents);
        //   }, function(reason) {
        //     deferred.reject(reason);
        //   });
        // });
      };

      // CORS.makeCORSRequest({
      //   type: "POST",
      //   dataType: "json",
      //   url: self.url + "/_session",
      //   data: {
      //     name: self.dbname.split("-")[0],
      //     password: "testtest"
      //   }
      // }).then(function(session) {

      if (Object.prototype.toString.call(collectionType) === "[object Array]") {
        var promises = [];
        collectionType.map(function(id) {
          promises.push(CORS.makeCORSRequest({
            type: "GET",
            dataType: "json",
            url: baseUrl + "/" + self.dbname + "/" + id
          }));
        });

        Q.allSettled(promises).then(function(results) {
          self.debug(results);
          if (results.length) {
            deferred.resolve(results.map(function(result) {
              if (result.state === "fulfilled") {
                return result.value;
              } else {
                return {};
              }
            }));
          } else {
            deferred.resolve([]);
          }
        }, cantLogIn);

      } else {
        CORS.makeCORSRequest({
          type: "GET",
          dataType: "json",
          url: baseUrl + "/" + self.dbname + "/" + self.DEFAULT_COLLECTION_MAPREDUCE.replace("COLLECTION", collectionType) + key
        }).then(function(result) {
          if (result.rows && result.rows.length) {
            deferred.resolve(result.rows.map(function(doc) {
              return doc.value;
            }));
          } else {
            deferred.resolve([]);
          }
        }, cantLogIn);
      }



      // }, cantLogIn);
      return deferred.promise;
    }
  },

  resumeAuthenticationSession: {
    value: function() {
      var deferred = Q.defer(),
        baseUrl = this.url,
        self = this;

      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }

      CORS.makeCORSRequest({
        type: "GET",
        dataType: "json",
        url: baseUrl + "/_session"
      }).then(function(sessionInfo) {
        self.debug(sessionInfo);
        self.connectionInfo = sessionInfo;
        deferred.resolve(sessionInfo);
      }, function(reason) {
        deferred.reject(reason);
      });

      return deferred.promise;
    }
  },

  connectionInfo: {
    get: function() {
      var connectionInfo;
      try {
        connectionInfo = localStorage.getItem("_connectionInfo");
      } catch (e) {
        this.warn("Localstorage is not available, using the object there will be no persistance across loads", e, this._connectionInfo);
        connectionInfo = this._connectionInfo;
      }
      if (!connectionInfo) {
        return;
      }
      try {
        connectionInfo = new Confidential({
          secretkey: "connectionInfo"
        }).decrypt(connectionInfo);
      } catch (e) {
        this.warn("unable to read the connectionInfo info, ", e, this._connectionInfo);
        connectionInfo = undefined;
      }
      return connectionInfo;
    },
    set: function(value) {
      if (value) {
        try {
          localStorage.setItem("_connectionInfo", new Confidential({
            secretkey: "connectionInfo"
          }).encrypt(value));
        } catch (e) {
          this._connectionInfo = new Confidential({
            secretkey: "connectionInfo"
          }).encrypt(value);
          this.debug("Localstorage is not available, using the object there will be no persistance across loads", e, this._connectionInfo);
        }
      } else {
        try {
          localStorage.removeItem("_connectionInfo");
        } catch (e) {
          this.debug("Localstorage is not available, using the object there will be no persistance across loads", e, this._connectionInfo);
          delete this._connectionInfo;
        }
      }
    }
  },

  login: {
    value: function(loginDetails) {
      var deferred = Q.defer(),
        self = this,
        baseUrl = this.url,
        authUrl = this.authUrl;

      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }

      if (!authUrl) {
        authUrl = this.BASE_AUTH_URL;
      }

      CORS.makeCORSRequest({
        type: "POST",
        dataType: "json",
        url: authUrl + "/login",
        data: loginDetails
      }).then(function(result) {
          if (result.user) {
            CORS.makeCORSRequest({
              type: "POST",
              dataType: "json",
              url: baseUrl + "/_session",
              data: {
                name: result.user.username,
                password: loginDetails.password
              }
            }).then(function(sessionInfo) {
              // self.debug(sessionInfo);
              result.user.roles = sessionInfo.roles;
              deferred.resolve(result.user);
            }, function() {
              self.debug("Failed to login ");
              deferred.reject("Something is wrong.");
            });
          } else {
            deferred.reject(result.userFriendlyErrors.join(" "));
          }
        },
        function(reason) {
          self.debug(reason);
          deferred.reject(reason);
        }).fail(function(reason) {
        self.debug(reason);
        deferred.reject(reason);
      });
      return deferred.promise;
    }
  },

  logout: {
    value: function() {
      var deferred = Q.defer(),
        baseUrl = this.url,
        self = this;

      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }

      CORS.makeCORSRequest({
        type: "DELETE",
        dataType: "json",
        url: baseUrl + "/_session"
      }).then(function(result) {
          if (result.ok) {
            self.connectionInfo = null;
            deferred.resolve(result);
          } else {
            deferred.reject(result);
          }
        },
        function(reason) {
          this.debug(reason);
          deferred.reject(reason);

        });
      return deferred.promise;
    }
  },

  register: {
    value: function(registerDetails) {
      var deferred = Q.defer(),
        self = this,
        baseUrl = this.url,
        authUrl = this.authUrl;

      if (!baseUrl) {
        baseUrl = this.BASE_DB_URL;
      }

      if (!authUrl) {
        authUrl = this.BASE_AUTH_URL;
      }

      if (!registerDetails) {
        registerDetails = {
          username: this.dbname.split("-")[0],
          password: "testtest"
        };
      }

      CORS.makeCORSRequest({
        type: "POST",
        dataType: "json",
        url: authUrl + "/register",
        data: registerDetails
      }).then(function(result) {
          if (result.user) {
            CORS.makeCORSRequest({
              type: "POST",
              dataType: "json",
              url: baseUrl + "/_session",
              data: {
                name: result.user.username,
                password: registerDetails.password
              }
            }).then(function(session) {
              self.debug(session);
              deferred.resolve(result.user);
            }, function() {
              self.debug("Failed to login ");
              deferred.reject();
            });
          } else {
            deferred.reject();
          }
        },
        function(reason) {
          self.debug(reason);
          deferred.reject(reason);
        }).fail(function(reason) {
        self.debug(reason);
        deferred.reject(reason);
      });
      return deferred.promise;
    }
  }
});

exports.Database = Database;

},{"../CORS":1,"../FieldDBObject":4,"./../confidentiality_encryption/Confidential":15,"q":76}],19:[function(require,module,exports){
var FieldDBDatabase = require("./Database").Database;

var PsycholinguisticsDatabase = function PsycholinguisticsDatabase(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "PsycholinguisticsDatabase";
  }
  this.debug("In PsycholinguisticsDatabase ", options);
  FieldDBDatabase.apply(this, arguments);
};
var DEFAULT_COLLECTION_MAPREDUCE = "_design/psycholinguistics/_view/COLLECTION?descending=true";

PsycholinguisticsDatabase.prototype = Object.create(FieldDBDatabase.prototype, /** @lends PsycholinguisticsDatabase.prototype */ {
  constructor: {
    value: PsycholinguisticsDatabase
  },

  DEFAULT_COLLECTION_MAPREDUCE: {
    value: DEFAULT_COLLECTION_MAPREDUCE
  }
});

exports.PsycholinguisticsDatabase = PsycholinguisticsDatabase;

},{"./Database":18}],20:[function(require,module,exports){
module.exports={
  "title": "",
  "titleAsUrl": "",
  "description": "This is probably your first Corpus, you can use it to play with the app... When you want to make a real corpus, click New : Corpus",
  "couchConnection": {},
  "replicatedCorpusUrls": [],
  "olacExportConnections": [],
  "termsOfUse": {
    "humanReadable": "Sample: The materials included in this corpus are available for research and educational use. If you want to use the materials for commercial purposes, please notify the author(s) of the corpus (myemail@myemail.org) prior to the use of the materials. Users of this corpus can copy and redistribute the materials included in this corpus, under the condition that the materials copied/redistributed are properly attributed.  Modification of the data in any copied/redistributed work is not allowed unless the data source is properly cited and the details of the modification is clearly mentioned in the work. Some of the items included in this corpus may be subject to further access conditions specified by the owners of the data and/or the authors of the corpus."
  },
  "license": {
    "title": "Default: Creative Commons Attribution-ShareAlike (CC BY-SA).",
    "humanReadable": "This license lets others remix, tweak, and build upon your work even for commercial purposes, as long as they credit you and license their new creations under the identical terms. This license is often compared to “copyleft” free and open source software licenses. All new works based on yours will carry the same license, so any derivatives will also allow commercial use. This is the license used by Wikipedia, and is recommended for materials that would benefit from incorporating content from Wikipedia and similarly licensed projects.",
    "imageUrl": "https://i.creativecommons.org/l/by/4.0/88x31.png",
    "link": "http://creativecommons.org/licenses/by-sa/3.0/"
  },
  "copyright": "Default: Add names of the copyright holders of the corpus.",
  "dbname": "",
  "dateOfLastDatumModifiedToCheckForOldSession": "",
  "confidential": {
    "secretkey": ""
  },
  "publicCorpus": "Private",
  "api": "private_corpuses",
  "comments": [],
  "validationStati": [{
    "validationStatus": "Checked*",
    "color": "green",
    "default": true
  }, {
    "validationStatus": "Published*",
    "color": "blue"
  }, {
    "validationStatus": "ToBeChecked*",
    "color": "orange"
  }, {
    "validationStatus": "ApprovedLanguageLearningContent*",
    "color": "green",
    "showInLanguageLearnignApps": true
  }, {
    "validationStatus": "ContributedLanguageLearningContent*",
    "color": "orange"
  }, {
    "validationStatus": "Deleted*",
    "color": "red",
    "showInSearchResults": false,
    "showInLanguageLearnignApps": false
  }, {
    "validationStatus": "Duplicate*",
    "color": "red",
    "showInSearchResults": false,
    "showInLanguageLearnignApps": false
  }],
  "tags": [{
    "tag": "SampleData",
    "color": "green"
  }, {
    "tag": "Food",
    "color": "green"
  }, {
    "tag": "Winter",
    "color": "white"
  }, {
    "tag": "Sports",
    "color": "teal"
  }, {
    "tag": "News",
    "color": "black"
  }, {
    "tag": "Family",
    "color": "blue"
  }, {
    "tag": "Friends",
    "color": "orange"
  }, {
    "tag": "Moving",
    "color": "red"
  }, {
    "tag": "Vulgar",
    "color": "black",
    "showInLanguageLearnignApps": false
  }],
  "datumFields": [{
    "id": "judgement",
    "labelFieldLinguists": "Gramaticality Judgement",
    "labelExperimenters": "Naturalness",
    "labelNonLinguists": "Not-a-normal-thing-to-say",
    "labelTranslators": "Grammatical/How-normal-Is-This-Example",
    "size": "3",
    "shouldBeEncrypted": false,
    "showToUserTypes": "linguist",
    "defaultfield": true,
    "help": "Acceptablity judgement (*,#,?  mean this sentence is strange)",
    "helpLinguists": "Grammaticality/acceptability judgement (*,#,?,1-3 etc). Leaving it blank usually means grammatical/acceptable, or your team can choose any symbol for this meaning."
  }, {
    "id": "orthography",
    "labelFieldLinguists": "Orthography",
    "labelNonLinguists": "Written",
    "labelTranslators": "Orthography",
    "type": "IGT, parallelText",
    "shouldBeEncrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "writingSystem": {
        "id": "",
        "referenceLink": ""
      }
    },
    "help": "What was said/written using the alphabet/writing system of the language.",
    "helpLinguists": "Many teams will only use the utterance line. However if your team needs to distinguish between utterance and orthography this is the unparsed word/sentence/dialog/paragraph/document in the language, in its native orthography. If there are more than one orthography an additional field can be added to the corpus. This is Line 0 in your LaTeXed examples for handouts (if you distinguish the orthography from the utterance line and you choose to display the orthography for your language consultants and/or native speaker linguists). Sample entry: amigas"
  }, {
    "id": "utterance",
    "labelFieldLinguists": "Utterance",
    "labelNonLinguists": "International Phonetic Alphabet (IPA)",
    "labelTranslators": "Transliteration",
    "type": "IGT, parallelText",
    "shouldBeEncrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "writingSystem": {
        "id": "",
        "referenceLink": ""
      }
    },
    "help": "What was said/written in an alphabet the team is comfortable using.",
    "helpLinguists": "Unparsed utterance in the language, in orthography or transcription. Line 1 in your LaTeXed examples for handouts. Sample entry: amigas"
  }, {
    "id": "allomorphs",
    "labelFieldLinguists": "Allomorphs",
    "labelNonLinguists": "",
    "labelTranslators": "Prefixe-s-root-suffixe-s",
    "type": "IGT",
    "shouldBeEncrypted": true,
    "showToUserTypes": "linguist",
    "defaultfield": true,
    "json": {
      "alternates": []
    },
    "help": "Words divided into prefixes, root and suffixes which match the spelling of the word (not necessarily the actual dictionary entry of the word) using a - between each eg: prefix-prefix-root-suffix-suffix-suffix",
    "helpLinguists": "Surface realizations of the morpheme-segmented utterance in the language. Used by the system to help generate glosses (below). Usually does not appear in your LaTeX examples unless you are working on morpho-phonology. Sample entry: amig-a-s"
  }, {
    "id": "morphemes",
    "labelFieldLinguists": "Morphemes",
    "labelNonLinguists": "Segmentation",
    "labelTranslators": "Prefix-z-root-suffix-z",
    "type": "IGT",
    "shouldBeEncrypted": true,
    "showToUserTypes": "linguist",
    "defaultfield": true,
    "json": {
      "alternates": []
    },
    "help": "Words divided into prefixes, root and suffixes using a - between each eg: prefix-prefix-root-suffix-suffix-suffix",
    "helpLinguists": "Morpheme-segmented utterance in the language. Used by the system to help generate glosses (below). Can optionally appear below (or instead of) the first line in your LaTeXed examples. Sample entry: amig-a-s"
  }, {
    "id": "gloss",
    "labelFieldLinguists": "Gloss",
    "labelNonLinguists": "Word-for-word Translation",
    "labelTranslators": "Word-for-word Translation",
    "type": "IGT",
    "shouldBeEncrypted": true,
    "showToUserTypes": "linguist",
    "defaultfield": true,
    "json": {
      "language": "",
      "alternates": [],
      "conventions": {
        "id": "",
        "tagSet": [],
        "referenceLink": ""
      }
    },
    "help": "Translation for each prefix, root and suffix in the words",
    "helpLinguists": "Metalanguage glosses of each individual morpheme (above). Used by the system to help gloss, in combination with morphemes (above). It is Line 2 in your LaTeXed examples. We recommend Leipzig conventions (. for fusional morphemes, - for morpheme boundaries etc)  Sample entry: friend-fem-pl"
  }, {
    "id": "syntacticCategory",
    "labelFieldLinguists": "Morpho-Syntactic Category",
    "labelNonLinguists": "",
    "labelTranslators": "Part of Speech",
    "type": "IGT",
    "shouldBeEncrypted": true,
    "showToUserTypes": "machine, linguist",
    "defaultfield": true,
    "json": {
      "alternates": [],
      "conventions": {
        "id": "",
        "tagSet": [],
        "referenceLink": ""
      }
    },
    "help": "This optional field is used by the machine to help with search and data cleaning, in combination with morphemes and gloss (above). If you want to use it, you can choose to use any sort of syntactic category tagging you wish. It could be very theoretical like Distributed Morphology (Sample entry: √-GEN-NUM), or very a-theroretical like the Penn Tree Bank Tag Set. (Sample entry: NNS) http://www.ims.uni-stuttgart.de/projekte/CorpusWorkbench/CQP-HTMLDemo/PennTreebankTS.html",
    "helpLinguists": "This optional field is used by the machine to help with search and data cleaning, in combination with morphemes and gloss (above). If you want to use it, you can choose to use any sort of syntactic category tagging you wish. It could be very theoretical like Distributed Morphology (Sample entry: √-GEN-NUM), or very a-theroretical like the Penn Tree Bank Tag Set. (Sample entry: NNS) http://www.ims.uni-stuttgart.de/projekte/CorpusWorkbench/CQP-HTMLDemo/PennTreebankTS.html"
  }, {
    "id": "translation",
    "labelFieldLinguists": "Translation",
    "labelNonLinguists": "English",
    "labelTranslators": "English",
    "type": "IGT, parallelText",
    "shouldBeEncrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "Translation into English/Spanish/Russian, or simply a language the team is comfortable with. There may also be additional languages in the other fields.",
    "language": "",
    "helpLinguists": "The team's primary translation. It might not be English, just a language the team is comfortable with (in which case you should change the lable to the language you are using). There may also be additional translations in the other fields."
  }, {
    "id": "context",
    "labelFieldLinguists": "Context",
    "labelNonLinguists": "Context",
    "labelTranslators": "Context",
    "type": "wiki",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "tags": []
    },
    "help": "Tags for constructions or other info that you might want to use to categorize your data.",
    "helpLinguists": "Tags for constructions or other info that you might want to use to categorize your data."
  }, {
    "id": "documentation",
    "labelFieldLinguists": "Discussion for Handouts",
    "labelNonLinguists": "Additional Documentation",
    "labelTranslators": "Documentation",
    "type": "wiki, LaTeX",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "wiki": "",
      "latex": ""
    },
    "help": "Additional discussion of this example (for handouts or for documentation). Wiki or LaTeX formatable.",
    "helpLinguists": "Additional discussion of this example (for handouts or for documentation). Wiki or LaTeX formatable."
  }, {
    "id": "relatedData",
    "labelFieldLinguists": "Related Data",
    "labelNonLinguists": "Linked to",
    "labelTranslators": "Linked to",
    "labelComputationalLinguists": "Linked Data",
    "type": "relatedData",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "relatedData": []
    },
    "help": "Related data in the database, or at any web url.",
    "helpLinguists": "Related data in the database, or at any web url.",
    "helpDevelopers": "Related data in the database, or at any web url."
  }, {
    "id": "tags",
    "labelFieldLinguists": "Tags",
    "labelNonLinguists": "Tags",
    "labelTranslators": "Tags",
    "type": "tags",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "tags": []
    },
    "help": "Tags for constructions or other info that you might want to use to categorize your data.",
    "helpLinguists": "Tags for constructions or other info that you might want to use to categorize your data."
  }, {
    "id": "validationStatus",
    "labelFieldLinguists": "Data validity/verification Status",
    "labelNonLinguists": "Data validity/verification Status",
    "labelTranslators": "Data validity/verification Status",
    "type": "tags",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "tags": []
    },
    "help": "Any number of tags of data validity (replaces DatumStates). For example: ToBeCheckedBySeberina, CheckedByRicardo, Deleted etc...",
    "helpLinguists": "Any number of tags of data validity (replaces DatumStates). For example: ToBeCheckedBySeberina, CheckedByRicardo, Deleted etc..."
  }, {
    "id": "enteredByUser",
    "labelFieldLinguists": "Imported/Entered By",
    "labelNonLinguists": "Entered By",
    "labelTranslators": "Imported/Entered By",
    "type": "users",
    "shouldBeEncrypted": "",
    "showToUserTypes": "all",
    "readonly": true,
    "defaultfield": true,
    "json": {
      "user": {},
      "hardware": {},
      "software": {}
    },
    "help": "The user who originally entered the datum",
    "helpLinguists": "The user who originally entered the datum"
  }, {
    "id": "modifiedByUser",
    "labelFieldLinguists": "Modified By",
    "labelNonLinguists": "Modified By",
    "labelTranslators": "Modified By",
    "type": "users",
    "shouldBeEncrypted": "",
    "showToUserTypes": "all",
    "readonly": true,
    "defaultfield": true,
    "json": {
      "users": []
    },
    "help": "An array of users who modified the datum",
    "helpLinguists": "An array of users who modified the datum, this can optionally introduce a 'CheckedByUsername' into the datum's validation status if your team chooses."
  }, {
    "id": "syntacticTreeLatex",
    "labelFieldLinguists": "Syntactic Tree/Constituency (LaTeX)",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "type": "LaTeX",
    "shouldBeEncrypted": true,
    "showToUserTypes": "machine",
    "defaultfield": true,
    "json": {
      "alternates": []
    },
    "help": "This optional field is used by the machine to make LaTeX trees and help with search and data cleaning, in combination with morphemes and gloss (above). If you want to use it, you can choose to use any sort of LaTeX Tree package (we use QTree by default) Sample entry: \\Tree [.S NP VP ]",
    "helpLinguists": "This optional field is used by the machine to make LaTeX trees and help with search and data cleaning, in combination with morphemes and gloss (above). If you want to use it, you can choose to use any sort of LaTeX Tree package (we use QTree by default) Sample entry: \\Tree [.S NP VP ]"
  }],
  "conversationFields": [{
    "id": "speakers",
    "labelFieldLinguists": "Speakers",
    "labelNonLinguists": "Speakers",
    "labelTranslators": "Speakers",
    "type": "users",
    "shouldBeEncrypted": true,
    "defaultfield": true,
    "json": {
      "users": []
    },
    "help": "Use this field to keep track of who your speaker is. You can use names, initials, or whatever your consultants prefer.",
    "helpLinguists": "Use this field to keep track of who your speaker is. You can use names, initials, or whatever your consultants prefer."
  }, {
    "id": "modality",
    "labelFieldLinguists": "Modality",
    "labelNonLinguists": "Modality",
    "labelTranslators": "Modality",
    "type": "tags",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "tags": []
    },
    "help": "Use this field to indicate if this is a voice or gesture tier, or a tier for another modality.",
    "helpLinguists": "Use this field to indicate if this is a voice or gesture tier, or a tier for another modality."
  }],
  "sessionFields": [{
    "id": "goal",
    "labelFieldLinguists": "Goal",
    "labelNonLinguists": "Goal",
    "labelTranslators": "Goal",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "help": "The goals of the elicitation session. Why did you get together today, was it the second day of field methods class, or you wanted to collect some stories from you grandmother, or was it to check on some data you found in the literature...",
    "helpLinguists": "The goals of the elicitation session. Why did you get together today, was it the second day of field methods class, or you wanted to collect some stories from you grandmother, or was it to check on some data you found in the literature..."
  }, {
    "id": "source",
    "labelFieldLinguists": "Language Speakers/Publication/Source",
    "labelNonLinguists": "By",
    "labelTranslators": "Language Speakers/Publication/Source",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "users": []
    },
    "help": "This is a comma seperated field of all the consultants/publications/sources who were were the source/present for this elicitation session.",
    "helpLinguists": "This is a comma seperated field of all the consultants/publications/sources who  were were the source/present for this elicitation session.",
    "helpDevelopers": "This is a comma seperated field of all the consultants (usernames, or anonymouse codes, or publication uri's) who were present for this elicitation session. This field also contains a (hidden) array of consultant/source masks if they are actual users of the system. "
  }, {
    "id": "dialect",
    "type": "language",
    "labelFieldLinguists": "Dialect",
    "labelNonLinguists": "Dialect",
    "labelTranslators": "Dialect",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "help": "Dialect of this example (city, village, region etc)",
    "helpLinguists": "This dialect may precise as the team chooses (province, region, city, village or any other measure of dialect)"
  }, {
    "id": "register",
    "type": "language",
    "labelFieldLinguists": "Social Register",
    "labelNonLinguists": "Social Register",
    "labelTranslators": "Social Register",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "help": "Social register of this example (friends, children speaking with children, formal, religious, ceremonial etc)",
    "helpLinguists": "This is an optional field which indicates the social register of the example (friends, children speaking with children, formal, religious, ceremonial etc)"
  }, {
    "id": "language",
    "type": "language",
    "labelFieldLinguists": "Language Name",
    "labelNonLinguists": "Language Name",
    "labelTranslators": "Language Name (Ethnologue)",
    "labelComputationalLinguists": "Language Name (ISO 639-3)",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "language": {
        "ethnologueUrl": "",
        "wikipediaUrl": "",
        "iso": "",
        "locale": "",
        "englishName": "",
        "nativeName": "",
        "alternateNames": ""
      }
    },
    "help": "This is the langauge name (or language family), it is optionally tied to an Ethnologue language code (ISO 639-3).",
    "helpLinguists": "This is the langauge (or language family), there is optional extra information fields if your team wants to tie it to an Ethnologe three letter language code (ISO 639-3)."
  }, {
    "id": "location",
    "type": "location",
    "labelFieldLinguists": "Location",
    "labelNonLinguists": "Location",
    "labelTranslators": "Location",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "defaultfield": true,
    "json": {
      "location": {
        "latitude": 0,
        "longitude": 0,
        "accuracy": 0
      }
    },
    "help": "This is the GPS location of the elicitation session (if available)",
    "helpLinguists": "This is the GPS location of the elicitation session (if available)"
  }, {
    "id": "dateElicited",
    "type": "date",
    "labelFieldLinguists": "Original Date Elicited",
    "labelNonLinguists": "OriginalDate Spoken",
    "labelTranslators": "Original Date Spoken/Published",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "timestamp": {
        "start": null,
        "end": null,
        "accuracy": null
      }
    },
    "help": "The date when the elicitation session took place, or when the datum was spoken/published.",
    "helpLinguists": "The date when the elicitation session took place, or when the datum was spoken/published."
  }, {
    "id": "participants",
    "labelFieldLinguists": "Eliciation Session Participants",
    "labelNonLinguists": "Session Participants",
    "labelTranslators": "Participants",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "users": []
    },
    "help": "This is a comma seperated field of all the people who were present for this elicitation session, or authors/reviewers of the publication.",
    "helpLinguists": "This is a comma seperated field of all the people who were present for this elicitation session, or authors/reviewers of the publication.",
    "helpDevelopers": "This is a comma seperated field of all the people who were present for this elicitation session. This field also contains a (hidden) array of user masks with more details about the people present, if they are not anonymous or are actual users of the system. "
  }, {
    "id": "DateSessionEntered",
    "type": "date",
    "labelFieldLinguists": "Date Entered",
    "labelNonLinguists": "Date Entered",
    "labelTranslators": "Date Entered",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "timestamp": {
        "start": null,
        "end": null,
        "accuracy": null
      }
    },
    "help": "The date when the elicitation session data was actually entered in the computer (could be different from the dateElicited, especailly if you usually elicit data with an audio recorder and/or a note book).",
    "helpLinguists": "The date when the elicitation session data was actually entered in the computer (could be different from the dateElicited, especailly if you usually elicit data with an audio recorder and/or a note book)."
  }, {
    "id": "device",
    "type": "device",
    "labelFieldLinguists": "Device Hardware",
    "labelNonLinguists": "Device Hardware",
    "labelTranslators": "Device Hardware",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "device": {}
    },
    "help": "The optional device details of the equipment used to record the elicitation session. This can be useful for measuring phonetic quality of the recording etc. eg: Nexus 7 Android 4.1",
    "helpLinguists": "The optional device details of the equipment used to record the elicitation session. This can be useful for measuring phonetic quality of the recording etc. eg: Nexus 7 Android 4.1",
    "helpDevelopers": "Your app can save optional anonymous device details of the equipment/software which used to record the elicitation session. This can be useful for measuring phonetic quality of the recording etc. eg: Nexus 7 Android 4.1"
  }],
  "speakerFields": [{
    "id": "anonymousCode",
    "labelFieldLinguists": "Anonymous Code",
    "labelNonLinguists": "Anonymous Code",
    "labelTranslators": "Anonymous Code",
    "shouldBeEncrypted": false,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "A field to anonymously identify language speakers/participants.",
    "helpLinguists": "A field to anonymously identify language consultants/informants/experiment participants (by default it can be a timestamp, or a combination of experimenter initials, speaker/participant initials etc)."
  }, {
    "id": "firstname",
    "labelFieldLinguists": "First Name",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "The first name of the speaker/participant (optional, encrypted if speaker is anonymous)",
    "helpLinguists": "The first name of the speaker/participant (optional, should be encrypted if speaker should remain anonymous)"
  }, {
    "id": "lastname",
    "labelFieldLinguists": "Last Name",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "The last name of the speaker/participant (encrypted)",
    "helpLinguists": "The last name of the speaker/participant (optional, encrypted if speaker should remain anonymous)"
  }, {
    "id": "username",
    "labelFieldLinguists": "Username",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "Optional username of the speaker/participant, if the speaker/participant is registered in the system (encrypted).",
    "helpLinguists": "Optional username of the speaker/participant, if the speaker/participant is registered in the system (encrypted)."
  }, {
    "id": "dateOfBirth",
    "type": "date",
    "labelFieldLinguists": "Date of Birth",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "timestamp": {
        "start": null,
        "end": null,
        "accuracy": null
      }
    },
    "help": "Optional date of birth of the speaker/participant, if used by the experimental analysis (ie speaker/participants of 20 months performed differently from speaker/participants of 22 months).",
    "helpLinguists": "Optional date of birth of the speaker/participant, if used by the experimental analysis (ie speaker/participants of 20 months performed differently from speaker/participants of 22 months)."
  }, {
    "id": "gender",
    "labelFieldLinguists": "Gender",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "choices": ["Female", "Male", "Unknown"],
      "children": ["Girl", "Boy", "Unknown"],
      "adult": ["Woman", "Man", "Unknown"]
    },
    "help": "Optional gender or biological sex of the speaker/participant, if used by the speaker/participants result reports or experimental analysis.",
    "helpLinguists": "Optional gender or biological sex of the speaker/participant, if used by the speaker/participants result reports or experimental analysis."
  }, {
    "id": "languages",
    "type": "language collection",
    "labelFieldLinguists": "Language(s) Spoken/Understood",
    "labelNonLinguists": "Language(s) Spoken/Understood",
    "labelTranslators": "Language(s) Spoken/Understood (Ethnologue)",
    "labelComputationalLinguists": "Language(s) Spoken/Understood (ISO 639-3)",
    "shouldBeEncrypted": false,
    "defaultfield": true,
    "json": {
      "languages": [{
        "language": {
          "ethnologueUrl": "",
          "wikipediaUrl": "",
          "iso": "",
          "locale": "",
          "englishName": "",
          "nativeName": "",
          "alternateNames": ""
        },
        "fluency": {
          "comprehensionFluency": "",
          "speakingFluency": "",
          "readingFluency": "",
          "writingFluency": ""
        },
        "dates": {
          "start": "",
          "end": "",
          "proportionOfUse": ""
        }
      }]
    },
    "help": "This is the langauge name (or language family), it is optionally tied to an Ethnologue language code (ISO 639-3).",
    "helpLinguists": "This is the langauge (or language family), there is optional extra information fields if your team wants to tie it to an Ethnologe three letter language code (ISO 639-3)."
  }, {
    "id": "confidentiality",
    "labelFieldLinguists": "Confidentiality Setting",
    "labelNonLinguists": "Confidentiality Setting",
    "labelTranslators": "Confidentiality Setting",
    "shouldBeEncrypted": false,
    "value": "anonymous",
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "choices": ["generalize", "team", "anonymous", "public"]
    },
    "help": "Confidentiality setting of this speaker. By default the speaker is anonymous which means data can be associated to one speaker, but the speaker cannot be identified) hidden means data will be associated to the entire speaker population of the corpus, team means that team members can see the consultant's identity, but the outsiders of the team can only see an anonymous user, public means the speaker has signed a consent form and has asked that his/her data to be associated his/her user account or identity.",
    "helpLinguists": "Confidentiality setting of this speaker. By default the speaker is anonymous which means data can be associated to the speaker, but the speaker cannot be identified) hidden means data will be associated to the entire speaker population of the corpus, team means that team members can see the consultant's identity, but the outsiders of the team can only see an anonymous user, public means the speaker has signed a consent form and has asked that his/her data to be associated his/her user account or identity."
  }]
}

},{}],21:[function(require,module,exports){
module.exports={
  "description": "This is first database which contains the results of your experiment, you can use it to play with the app... When you want to make a real database, click New : Database/Corpus",
  "participantFields": [ {
    "id": "courseNumber",
    "labelExperimenter": "Course/Class/Section Number",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "encrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "help": "Optional course or section number, if used by the participants result reports or experimental conditions.",
    "helpLinguists": "Optional course or section number, if used by the participants result reports or experimental conditions."
  }, {
    "id": "hemisphericDominance",
    "labelExperimenter": "Hemispheric dominance (handedness)",
    "labelNonLinguists": "",
    "labelTranslators": "",
    "shouldBeEncrypted": true,
    "showToUserTypes": "all",
    "defaultfield": true,
    "json": {
      "choices": ["Right", "Left", "Unknown"]
    },
    "help": "Optional right or left handedness or hemispheric dominante of the participant, if used by the participants result reports or experimental conditions.",
    "helpLinguists": "Optional right or left handedness or hemispheric dominante of the participant, if used by the participants result reports or experimental conditions."
  }]
}

},{}],22:[function(require,module,exports){
/* globals FieldDB */
var Datum = require("./../datum/Datum").Datum;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Document = require("./../datum/Document").Document;
var DocumentCollection = require("./../datum/DocumentCollection").DocumentCollection;
var Comments = require("./../comment/Comments").Comments;
var ContextualizableObject = require("./../locales/ContextualizableObject").ContextualizableObject;
var Q = require("q");

/**
 * @class The Data List widget is used for import search, to prepare handouts and to share data on the web.
 *  @name  DataList
 *
 * @description The Data List widget is used for import search, to prepare handouts and to share data on the web.
 *
 * @property {String} title The title of the Data List.
 * @property {String} description The description of the Data List.
 * @property {Array<String>} datumIds Deprecated: An ordered list of the datum IDs of the
 *   Datums in the Data List.
 * @property {Array<String>} docIds An ordered list of the doc IDs of the
 *   Datums in the Data List.
 * @property {Array<String>} docs An ordered collection of the doc IDs of the
 *   Datums in the Data List (not serialized in the DataList)
 *
 * @extends FieldDBObject
 * @constructs
 */
var DataList = function DataList(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DataList";
  }
  this.debug("Constructing DataList ", options);
  if (options && options.comments) {
    // console.log("DataList comments", options.comments);
    // console.log("DataList comments", options.comments);
  }
  FieldDBObject.apply(this, arguments);
};

DataList.prototype = Object.create(FieldDBObject.prototype, /** @lends DataList.prototype */ {
  constructor: {
    value: DataList
  },

  api: {
    get: function() {
      return this._api || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._api) {
        return;
      }
      if (!value) {
        delete this._api;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._api = value;
    }
  },

  defaults: {
    get: function() {
      return {
        title: "Untitled Data List",
        description: "",
        datumIds: FieldDBObject.DEFAULT_ARRAY,
        docs: FieldDBObject.DEFAULT_COLLECTION
      };
    }
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      comments: Comments,
      docs: DocumentCollection,
      title: ContextualizableObject,
      description: ContextualizableObject
    }
  },

  title: {
    get: function() {
      return this._title || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._title) {
        return;
      }
      if (!value) {
        delete this._title;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._title = value;
    }
  },

  description: {
    get: function() {
      return this._description || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._description) {
        return;
      }
      if (!value) {
        delete this._description;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._description = value;
    }
  },

  docs: {
    get: function() {
      return this._docs;
    },
    set: function(value) {
      if (value === this._docs) {
        return;
      }
      if (!value) {
        delete this._docs;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]" && typeof this.INTERNAL_MODELS["docs"] === "function") {
          value = new this.INTERNAL_MODELS["docs"](value);
        }
      }
      this._docs = value;
    }
  },

  add: {
    value: function(value) {
      if (!this.docs) {
        this.docs = [];
      }
      this.docs.add(value);
    }
  },

  populate: {
    value: function(results) {
      var self = this;

      this.docs = this.docs || [];
      results.map(function(doc) {
        try {
          // prevent recursion a bit
          if (self.api !== "datalists") {
            doc.api = self.api;
          }
          doc.confidential = self.confidential;
          var guessedType = doc.fieldDBtype;
          if (!guessedType) {
            self.debug(" requesting guess type ");
            guessedType = Document.prototype.guessType(doc);
            self.debug("request complete");
          }
          self.debug("Converting doc into type " + guessedType);

          if (guessedType === "Datum") {
            doc = new Datum(doc);
          } else if (guessedType === "Document") {
            doc._type = guessedType;
            doc = new Document(doc);
          } else if (guessedType === "FieldDBObject") {
            doc = new FieldDBObject(doc);
          } else if (FieldDB && FieldDB[guessedType]) {
            self.warn("Converting doc into guessed type " + guessedType);
            doc = new FieldDB[guessedType](doc);
          } else {
            self.warn("This doc does not have a type than can be used, it might display oddly ", doc);
            doc = new FieldDBObject(doc);
          }

        } catch (e) {
          self.warn("error converting this doc: " + JSON.stringify(doc) + e);
          doc.confidential = self.confidential;
          doc = new FieldDBObject(doc);
        }
        self.debug("adding doc", doc);
        self.docs.add(doc);
        if (doc.fieldDBtype === "Datum") {
          self.showDocPosition = true;
          self.showDocCheckboxes = true;
          self.docsAreReorderable = true;
        }
      });
    }
  },

  docIds: {
    get: function() {
      var self = this;

      if ((!this._docIds || this._docIds.length === 0) && (this.docs && this.docs.length > 0)) {
        this._docIds = this.docs.map(function(doc) {
          self.debug("geting doc id of this doc ", doc);
          return doc.id;
        });
      }
      return this._docIds || FieldDBObject.DEFAULT_ARRAY;
    },
    set: function(value) {
      if (value === this._docIds) {
        return;
      }
      if (!value) {
        delete this._docIds;
        return;
      }
      this._docIds = value;
    }
  },

  datumIds: {
    get: function() {
      this.warn("datumIds is deprecated, please use docIds instead.");
      return this.docIds;
    },
    set: function(value) {
      this.warn("datumIds is deprecated, please use docIds instead.");
      this.docIds = value;
    }
  },

  decryptedMode: {
    get: function() {
      return this.decryptedMode;
    },
    set: function(value) {
      this.decryptedMode = value;
      this.docs.decryptedMode = value;
    }
  },

  icon: {
    get: function() {
      return "thumb-tack";
    }
  },

  getAllAudioAndVideoFiles: {
    value: function(datumIdsToGetAudioVideo) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {

        if (!datumIdsToGetAudioVideo) {
          datumIdsToGetAudioVideo = self.docIds;
        }
        if (datumIdsToGetAudioVideo.length === 0) {
          datumIdsToGetAudioVideo = self.docIds;
        }
        var audioVideoFiles = [];
        self.debug("DATA LIST datumIdsToGetAudioVideo " + JSON.stringify(datumIdsToGetAudioVideo));
        datumIdsToGetAudioVideo.map(function(id) {
          var doc = self.docs[id];
          if (doc) {
            if (doc.audioVideo) {
              doc.audioVideo.map(function(audioVideoFile) {
                audioVideoFiles.push(audioVideoFile.URL);
              });
            }
          } else {
            var obj = new Datum({
              pouchname: self.dbname,
              id: id
            });
            obj.fetch().then(function(results) {
              this.debug("Fetched datum to get audio file", results);
              if (doc.audioVideo) {

                obj.audioVideo.map(function(audioVideoFile) {
                  audioVideoFiles.push(audioVideoFile.URL);
                });
              }
            });
          }
        });
        deferred.resolve(audioVideoFiles);

      });
      return deferred.promise;
    }
  },

  applyFunctionToAllIds: {
    value: function(datumIdsToApplyFunction, functionToApply, functionArguments) {
      if (!datumIdsToApplyFunction) {
        datumIdsToApplyFunction = this.docIds;
      }
      if (datumIdsToApplyFunction.length === 0) {
        datumIdsToApplyFunction = this.docIds;
      }
      if (!functionToApply) {
        functionToApply = "latexitDataList";
      }
      if (!functionArguments) {
        //        functionArguments = true; //leave it null so that the defualts will apply in the Datum call
      }

      var self = this;
      this.debug("DATA LIST datumIdsToApplyFunction " + JSON.stringify(datumIdsToApplyFunction));
      datumIdsToApplyFunction.map(function(id) {
        var doc = self.docs[id];
        if (doc) {
          doc[functionToApply].apply(doc, functionArguments);
          return id;
        } else {
          self.warn(" Doc has not been fetched, cant apply the function to it.");
          return id;
        }
      });
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);
      // Force docIds to be set to current docs
      if (this.docs && this.docs.length > 0) {
        this.docIds = null;
        this.docIds = this.docIds;
      }
      var json = FieldDBObject.prototype.toJSON.apply(this, arguments);
      delete json.docs;
      this.todo("Adding datumIds for backward compatability until prototype can handle docIds");
      json.datumIds = this.docIds;

      this.debug(json);
      return json;
    }
  }

});

exports.DataList = DataList;

},{"./../FieldDBObject":4,"./../comment/Comments":14,"./../datum/Datum":24,"./../datum/Document":31,"./../datum/DocumentCollection":32,"./../locales/ContextualizableObject":42,"q":76}],23:[function(require,module,exports){
var DataList = require("./DataList").DataList;
var DocumentCollection = require("./../datum/DocumentCollection").DocumentCollection;
var Comments = require("./../comment/Comments").Comments;
var ContextualizableObject = require("./../locales/ContextualizableObject").ContextualizableObject;

/**
 * @class The SubExperimentDataList allows the user to add additional information
 *  which can be used for experiments using the datum in the datalist.
 *
 * @name  SubExperimentDataList
 * @extends DataList
 * @constructs
 */
var SubExperimentDataList = function SubExperimentDataList(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "SubExperimentDataList";
  }
  this.debug("Constructing SubExperimentDataList ", options);
  DataList.apply(this, arguments);
};

SubExperimentDataList.prototype = Object.create(DataList.prototype, /** @lends SubExperimentDataList.prototype */ {
  constructor: {
    value: SubExperimentDataList
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      comments: Comments,
      docs: DocumentCollection,
      title: ContextualizableObject,
      description: ContextualizableObject,
      instructions: ContextualizableObject
    }
  },

  subexperiments: {
    get: function() {
      if (this.docs && this.docs.length > 0) {
        return this.docs;
      }
      return this.docIds;
    },
    set: function(value) {
      if ((value && value[0] && typeof value[0] === "object") || value.constructor === DocumentCollection) {
        this.docs = value;
      } else {
        this.docIds = value;
        this._subexperiments = value;
      }
    }
  },

  trials: {
    get: function() {
      if (this.docs && this.docs.length > 0) {
        return this.docs;
      }
      return this.docIds;
    },
    set: function(value) {
      if ((value && value[0] && typeof value[0] === "object") || value.constructor === DocumentCollection) {
        this.docs = value;
      } else {
        this.docIds = value;
        this._trials = value;
      }
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);
      // Force docIds to be set to current docs
      // this._subexperiments = this.docIds;
      // this._trials = this.docIds;
      var json = DataList.prototype.toJSON.apply(this, arguments);
      this.debug(json);
      if (this.docs && this.docs.toJSON) {
        this.todo("only save trials/subexperiments if there are responses in the trials, or if the experiment started or somethign. ");
        json.results = this.docs.toJSON();
      }
      return json;
    }
  }

});
exports.SubExperimentDataList = SubExperimentDataList;

},{"./../comment/Comments":14,"./../datum/DocumentCollection":32,"./../locales/ContextualizableObject":42,"./DataList":22}],24:[function(require,module,exports){
/* globals window, $, _ , OPrime*/
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var AudioVideos = require("./../audio_video/AudioVideos").AudioVideos;
var Comments = require("./../comment/Comments").Comments;
var Datums = require("./../Collection").Collection;
var DatumField = require("./DatumField").DatumField;
var DatumFields = require("./DatumFields").DatumFields;
// var DatumState = require("./../FieldDBObject").FieldDBObject;
var DatumStates = require("./DatumStates").DatumStates;
// var DatumTag = require("./../FieldDBObject").FieldDBObject;
var DatumTags = require("./DatumTags").DatumTags;
var Images = require("./../image/Images").Images;
var Session = require("./../FieldDBObject").FieldDBObject;

/**
 * @class The Datum widget is the place where all linguistic data is
 *        entered; one at a time.
 *
 * @property {DatumField} utterance The utterance field generally
 *           corresponds to the first line in linguistic examples that can
 *           either be written in the language's orthography or a
 *           romanization of the language. An additional field can be added
 *           if the language has a non-roman script.
 * @property {DatumField} gloss The gloss field corresponds to the gloss
 *           line in linguistic examples where the morphological details of
 *           the words are displayed.
 * @property {DatumField} translation The translation field corresponds to
 *           the third line in linguistic examples where in general an
 *           English translation. An additional field can be added if
 *           translations into other languages is needed.
 * @property {DatumField} judgement The judgement is the grammaticality
 *           judgement associated with the datum, so grammatical,
 *           ungrammatical, felicitous, unfelicitous etc.
 * @property {AudioVisual} audioVideo Datums can be associated with an audio or video
 *           file.
 * @property {Session} session The session provides details about the set of
 *           data elicited. The session will contain details such as date,
 *           language, consultant etc.
 * @property {Comments} comments The comments is a collection of comments
 *           associated with the datum, this is meant for comments like on a
 *           blog, not necessarily notes, which can be encoded in a
 *           field.(Use Case: team discussing a particular datum)
 * @property {DatumTags} datumtags The datum tags are a collection of tags
 *           associated with the datum. These are made completely by the
 *           user.They are like blog tags, a way for the user to make
 *           categories without make a hierarchical structure, and make
 *           datum easier for search.
 * @property {Date} dateEntered The date the Datum was first saved.
 * @property {Date} dateModified The date the Datum was last saved.
 *
 * @description The initialize function brings up the datum widget in small
 *              view with one set of datum fields. However, the datum widget
 *              can contain more than datum field set and can also be viewed
 *              in full screen mode.
 *
 * @name  Datum
 * @extends FieldDBObject
 * @constructs
 */
var Datum = function Datum(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Datum";
  }
  this.debug("Constructing Datum: ", options);
  FieldDBObject.apply(this, arguments);
};

Datum.prototype = Object.create(FieldDBObject.prototype, /** @lends Datum.prototype */ {
  constructor: {
    value: Datum
  },

  fields: {
    get: function() {
      return this._fields || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._fields) {
        return;
      }
      if (!value) {
        delete this._fields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]" && typeof this.INTERNAL_MODELS["fields"] === "function") {
          value = new this.INTERNAL_MODELS["fields"](value);
        }
      }
      this._fields = value;
    }
  },

  datumFields: {
    get: function() {
      this.debug("datumFields is depreacted, just use fields instead");
      return this.fields;
    },
    set: function(value) {
      this.debug("datumFields is depreacted, just use fields instead");
      return this.fields = value;
    }
  },

  audioVideo: {
    get: function() {
      if (this._audioVideo && this._audioVideo.fieldDBtype === "AudioVideos") {
        this._audioVideo.dbname = this.dbname;
      }
      return this._audioVideo || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._audioVideo) {
        return;
      }
      if (!value) {
        delete this._audioVideo;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]" && typeof this.INTERNAL_MODELS["audioVideo"] === "function") {
          value = new this.INTERNAL_MODELS["audioVideo"](value);
        }
      }
      this._audioVideo = value;
    }
  },

  play: {
    value: function(optionalIndex) {
      this.debug("optionalIndex", optionalIndex);
      if (this._audioVideo && typeof this._audioVideo.play === "function") {
        this._audioVideo.play(0);
      }
    }
  },

  images: {
    get: function() {
      if (this._images && this._images.fieldDBtype === "Images") {
        this._images.dbname = this.dbname;
      }
      return this._images || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._images) {
        return;
      }
      if (!value) {
        delete this._images;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]" && typeof this.INTERNAL_MODELS["images"] === "function") {
          value = new this.INTERNAL_MODELS["images"](value);
        }
      }
      this._images = value;
    }
  },

  // The couchdb-connector is capable of mapping the url scheme
  // proposed by the authors of Backbone to documents in your database,
  // so that you don't have to change existing apps when you switch the sync-strategy
  api: {
    value: "datums"
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      fields: DatumFields,
      audioVideo: AudioVideos,
      session: Session,
      comments: Comments,
      datumStates: DatumStates,
      datumTags: DatumTags,
      images: Images
    }
  },

  /**
   * Gets all the DatumIds in the current Corpus sorted by their date.
   *
   * @param {Function} callback A function that expects a single parameter. That
   * parameter is the result of calling "pages/datums". So it is an array
   * of objects. Each object has a 'key' and a 'value' attribute. The 'key'
   * attribute contains the Datum's dateModified and the 'value' attribute contains
   * the Datum itself.
   */
  getMostRecentIdsByDate: {
    value: function(howmany, callback) {
      var self = this;

      if (OPrime.isBackboneCouchDBApp()) {
        //        self.bug("TODO check  getMostRecentIdsByDate");
        //TODO this might be producing the error on line  815 in backbone.js       model = new this.model(attrs, options);
        var tempDatums = new Datums();
        tempDatums.model = Datum;
        tempDatums.fetch({
          descending: true,
          limit: howmany,
          error: function(model, xhr, options) {
            OPrime.bug("There was an error loading your datums.", xhr, options);
            if (typeof callback === "function") {
              callback([]);
            }
          },
          success: function(model, response) {
            self.debug(model);
            //            if (response.length >= 1) {
            //              callback([response[0]._id], [response[1]._id]);
            callback(response);
            //            }
          }
        });
        return;
      }


      try {
        self.pouch(function(err, db) {
          db.query("pages/datums", {
            reduce: false
          }, function(err, response) {

            if (err) {
              if (window.toldSearchtomakebydateviews) {
                self.debug("Told pouch to make by date views once, apparently it didnt work. Stopping it from looping.");
                return;
              }
              /*
               * Its possible that the pouch has no by date views, create them and then try searching again.
               */
              window.toldSearchtomakebydateviews = true;
              window.app.get("corpus").createPouchView("pages/datums", function() {
                window.appView.toastUser("Initializing your corpus' sort items by date functions for the first time.", "alert-success", "Sort:");
                self.getMostRecentIdsByDate(howmany, callback);
              });
              return;
            }

            if ((!err) && (typeof callback === "function")) {
              self.debug("Callback with: ", response.rows);
              callback(response.rows);
            }
          });
        });

      } catch (e) {
        //        appView.datumsEditView.newDatum();
        window.appView.datumsEditView.render();
        self.bug("Couldnt show the most recent datums " + JSON.stringify(e));

      }
    }
  },
  fillWithCorpusFieldsIfMissing: {
    value: function() {
      if (!this.get("fields")) {
        return;
      }
      /* Update the datum to show all fields which are currently in the corpus, they are only added if saved. */
      var corpusFields = window.app.get("corpus").get("fields").models;
      for (var field in corpusFields) {
        var label = corpusFields[field].get("label");
        this.debug("Label " + label);
        var correspondingFieldInThisDatum = this.get("fields").where({
          label: label
        });
        if (correspondingFieldInThisDatum.length === 0) {
          this.get("fields").push(corpusFields[field]);
        }
      }
    }
  },
  searchByQueryString: {
    value: function(queryString, callback) {
      var self = this;
      try {
        //http://support.google.com/analytics/bin/answer.py?hl=en&answer=1012264
        window.pageTracker._trackPageview("/search_results.php?q=" + queryString);
      } catch (e) {
        self.debug("Search Analytics not working.");
      }

      // Process the given query string into tokens
      var queryTokens = self.processQueryString(queryString);
      var doGrossKeywordMatch = false;
      if (queryString.indexOf(":") === -1) {
        doGrossKeywordMatch = true;
        queryString = queryString.toLowerCase().replace(/\s/g, "");
      }

      if (OPrime.isBackboneCouchDBApp()) {

        // run a custom map reduce
        //        var mapFunction = function(doc) {
        //          if(doc.collection !== "datums"){
        //            return;
        //          }
        //          var fields  = doc.fields;
        //          var result = {};
        //          for(var f in fields){
        //            if(fields[f].label === "gloss"){
        //              result.gloss = fields[f].value;
        //            }else if(fields[f].label === "morphemes"){
        //              result.morphemes = fields[f].value;
        //            }else if(fields[f].label === "judgement"){
        //              result.judgement = fields[f].value;
        //            }
        //          }
        //          emit( result,  doc._id );
        //        };
        //        $.couch.db(this.get("pouchname")).query(mapFunction, "_count", "javascript", {
        //use the get_datum_fields view
        //        self.bug("TODO test search in chrome extension");
        $.couch.db(self.get("pouchname")).view("pages/get_datum_fields", {
          success: function(response) {
            self.debug("Got " + response.length + "datums to check for the search query locally client side.");
            var matchIds = [];
            //            console.log(response);
            for (var i in response.rows) {
              var thisDatumIsIn = self.isThisMapReduceResultInTheSearchResults(response.rows[i], queryString, doGrossKeywordMatch, queryTokens);
              // If the row's datum matches the given query string
              if (thisDatumIsIn) {
                // Keep its datum's ID, which is the value
                matchIds.push(response.rows[i].value);
              }
            }

            if (typeof callback === "function") {
              //callback with the unique members of the array
              callback(_.unique(matchIds));
              //              callback(matchIds); //loosing my this in SearchEditView
            }
          },
          error: function(status) {
            console.log("Error quering datum", status);
          },
          reduce: false
        });

        return;
      }



      try {
        self.pouch(function(err, db) {
          db.query("pages/get_datum_fields", {
            reduce: false
          }, function(err, response) {
            var matchIds = [];

            if (!err) {

              // Go through all the rows of results
              for (var i in response.rows) {
                var thisDatumIsIn = self.isThisMapReduceResultInTheSearchResults(response.rows[i], queryString, doGrossKeywordMatch, queryTokens);
                // If the row's datum matches the given query string
                if (thisDatumIsIn) {
                  // Keep its datum's ID, which is the value
                  matchIds.push(response.rows[i].value);
                }
              }
            } else {
              if (window.toldSearchtomakeviews) {
                self.debug("Told search to make views once, apparently it didnt work. Stopping it from looping.");
                return;
              }
              /*
               * Its possible that the corpus has no search views, create them and then try searching again.
               */
              window.appView.toastUser("Initializing your search functions for the first time." +
                " Search in LingSync is pretty powerful, " +
                " in fact if you're the power user type you can write your " +
                "own data extracting/filtering/visualization queries using " +
                " <a href='http://www.kchodorow.com/blog/2010/03/15/mapreduce-the-fanfiction/' target='_blank'>MapReduce.</a>", "alert-success", "Search:");
              window.toldSearchtomakeviews = true;
              var previousquery = queryString;
              window.app.get("corpus").createPouchView("pages/get_datum_fields", function() {
                window.appView.searchEditView.search(previousquery);
              });
            }
            if (typeof callback === "function") {
              //callback with the unique members of the array
              callback(_.unique(matchIds));
              //                callback(matchIds); //loosing my this in SearchEditView
            }
          });
        });
      } catch (e) {
        self.bug("Couldnt search the data, if you sync with the server you might get the most recent search index.");
      }
    }
  },
  isThisMapReduceResultInTheSearchResults: {
    value: function(keyValuePair, queryString, doGrossKeywordMatch, queryTokens) {


      var thisDatumIsIn = false;
      // If the query string is null, include all datumIds
      if (queryString.trim() === "") {
        thisDatumIsIn = true;
      } else if (doGrossKeywordMatch) {
        if (JSON.stringify(keyValuePair.key).toLowerCase().replace(/\s/g, "").search(queryString) > -1) {
          thisDatumIsIn = true;
        }
      } else {

        // Determine if this datum matches the first search criteria
        thisDatumIsIn = this.matchesSingleCriteria(keyValuePair.key, queryTokens[0]);

        // Progressively determine whether the datum still matches based on
        // subsequent search criteria
        for (var j = 1; j < queryTokens.length; j += 2) {
          if (queryTokens[j] === "AND") {
            // Short circuit: if it's already false then it continues to be false
            if (!thisDatumIsIn) {
              break;
            }

            // Do an intersection
            thisDatumIsIn = thisDatumIsIn && this.matchesSingleCriteria(keyValuePair.key, queryTokens[j + 1]);
          } else {
            // Do a union
            thisDatumIsIn = thisDatumIsIn || this.matchesSingleCriteria(keyValuePair.key, queryTokens[j + 1]);
          }
        }
      }
      return thisDatumIsIn;
    }
  },
  /**
   * Determines whether the given object to search through matches the given
   * search criteria.
   *
   * @param {Object} objectToSearchThrough An object representing a datum that
   * contains (key, value) pairs where the key is the datum field label and the
   * value is the datum field value of that attribute.
   * @param {String} criteria The single search criteria in the form of a string
   * made up of a label followed by a colon followed by the value that we wish
   * to match.
   *
   * @return {Boolean} True if the given object matches the given criteria.
   * False otherwise.
   */
  matchesSingleCriteria: {
    value: function(objectToSearchThrough, criteria) {
      var delimiterIndex = criteria.indexOf(":");
      var label = criteria.substring(0, delimiterIndex);
      var negate = false;
      if (label.indexOf("!") === 0) {
        label = label.replace(/^!/, "");
        negate = true;
      }
      var value = criteria.substring(delimiterIndex + 1);
      /* handle the fact that "" means grammatical, so if user asks for  specifically, give only the ones wiht empty judgemnt */
      if (label === "judgement" && value.toLowerCase() === "grammatical") {
        if (!objectToSearchThrough[label]) {
          return true;
        }
      }
      //      if(!label || !value){
      //        return false;
      //      }

      var searchResult = objectToSearchThrough[label] && (objectToSearchThrough[label].toLowerCase().search(value.toLowerCase()) >= 0);


      if (negate) {
        searchResult = !searchResult;
      }


      return searchResult;
    }
  },

  /**
   * Process the given string into an array of tokens where each token is
   * either a search criteria or an operator (AND or OR). Also makes each
   * search criteria token lowercase, so that searches will be case-
   * insensitive.
   *
   * @param {String} queryString The string to tokenize.
   *
   * @return {String} The tokenized string
   */
  processQueryString: {
    value: function(queryString) {
      // Split on spaces
      var queryArray = queryString.split(" ");

      // Create an array of tokens out of the query string where each token is
      // either a search criteria or an operator (AND or OR).
      var queryTokens = [];
      var currentString = "";
      for (var i in queryArray) {
        var currentItem = queryArray[i].trim();
        if (currentItem.length <= 0) {
          break;
        } else if ((currentItem === "AND") || (currentItem === "OR")) {
          queryTokens.push(currentString);
          queryTokens.push(currentItem);
          currentString = "";
        } else if (currentString) {
          /* toLowerCase introduces a bug in search where camel case fields loose their capitals, then cant be matched with fields in the map reduce results */
          currentString = currentString + " " + currentItem; //.toLowerCase();
        } else {
          currentString = currentItem; //.toLowerCase();
        }
      }
      queryTokens.push(currentString);

      return queryTokens;
    }
  },
  getDisplayableFieldForActivitiesEtc: {
    value: function() {
      return this.model.get("fields").where({
        label: "utterance"
      })[0].get("mask");
    }
  },
  /**
   * Clone the current Datum and return the clone. The clone is put in the current
   * Session, regardless of the origin Datum's Session. //TODO it doesn tlook liek this is the case below:
   *
   * @return The clone of the current Datum.
   */
  cloneDeprecated: {
    value: function() {
      // Create a new Datum based on the current Datum
      var datum = new Datum({
        audioVideo: new AudioVideos(this.get("audioVideo").toJSON(), {
          parse: true
        }),
        comments: new Comments(this.get("comments").toJSON(), {
          parse: true
        }),
        dateEntered: this.get("dateEntered"),
        dateModified: this.get("dateModified"),
        fields: new DatumFields(this.get("fields").toJSON(), {
          parse: true
        }),
        datumStates: new DatumStates(this.get("datumStates").toJSON(), {
          parse: true
        }),
        datumTags: new DatumTags(this.get("datumTags").toJSON(), {
          parse: true
        }),
        pouchname: this.get("pouchname"),
        session: this.get("session")
      });

      return datum;
    }
  },

  /**
   * This function is used to get the most prominent datumstate (now called
   * ValidationStatus) eg "CheckedWithSeberina" or "Deleted" or "ToBeChecked"
   *
   * @returns {String} a string which is the first item in the
   *          validationSatuts field
   */
  getValidationStatus: {
    value: function() {
      var validationStatus = "";
      var stati = this.get("fields").where({
        "label": "validationStatus"
      });
      if (stati.length > 0) {
        stati = stati[0].get("mask").split(" ");
        if (stati.length > 0) {
          validationStatus = stati[0];
        }
      }
      /* Handle upgrade from previous corpora look in datum states too */
      if (validationStatus === "") {
        stati = this.get("datumStates").where({
          selected: "selected"
        });
        if (stati.length > 0) {
          validationStatus = stati[0].get("state");
        }
      }
      this.updateDatumState(validationStatus);
      return validationStatus;
    }
  },
  /**
   * This function is used to colour a datum background to make
   * visually salient the validation status of the datum.
   *
   * @param status
   *            This is an optional string which is used to find the
   *            colour for a particular DatumState. If the string is
   *            not provided it gets the first element from the
   *            validation status field.
   * @returns {String} This is the colour using Bootstrap (warning is
   *          Orange, success Green etc.)
   */
  getValidationStatusColor: {
    value: function(status) {
      if (!status) {
        status = this.getValidationStatus();
      }
      /* TODO once the new ValidationStatus pattern is in the corpus proper, dont hard code the colors */
      if (status.toLowerCase().indexOf("deleted") > -1) {
        return "danger";
      }
      if (status.toLowerCase().indexOf("tobechecked") > -1) {
        return "warning";
      }
      if (status.toLowerCase().indexOf("checked") > -1) {
        return "success";
      }
    }
  },


  /**
   * This function is used to set the primary status of the datum,
   * eg. put Deleted as the first item in the validation status.
   *
   * @param selectedValue
   *            This is a string which is the validation status
   *            you want the datum to be
   */
  updateDatumState: {
    value: function(selectedValue) {
      if (!selectedValue) {
        return;
      }
      this.debug("Asking to change the datum state to " + selectedValue);
      /* make sure all the corpus states are availible in this datum */
      var thisdatumStates = this.get("datumStates");
      window.app.get("corpus").get("datumStates").each(function(datumstate) {
        var obj = datumstate.toJSON();
        obj.selected = "";
        thisdatumStates.addIfNew(obj);
      });
      try {
        $.each(this.get("datumStates").where({
          selected: "selected"
        }), function() {
          if (this.get("state") !== selectedValue) {
            this.set("selected", "");
          }
        });
        this.get("datumStates").where({
          state: selectedValue
        })[0].set("selected", "selected");
      } catch (e) {
        this.debug("problem getting color of datum state, probaly none are selected.", e);
      }

      /* prepend this state to the new validationStates as of v1.46.2 */
      var n = this.get("fields").where({
        label: "validationStatus"
      })[0];
      if (n === [] || !n) {
        n = new DatumField({
          label: "validationStatus",
          shouldBeEncrypted: "",
          showToUserTypes: "all",
          userchooseable: "disabled",
          help: "Any number of status of validity (replaces DatumStates). For example: ToBeCheckedWithSeberina, CheckedWithRicardo, Deleted etc..."
        });
        this.get("fields").add(n);
      }
      var validationStatus = n.get("mask") || "";
      validationStatus = selectedValue + " " + validationStatus;
      var uniqueStati = _.unique(validationStatus.trim().split(" "));
      n.set("mask", uniqueStati.join(" "));


      //      this.save();
      //TODO save it
    }
  },

  /**
   * Make the  model marked as Deleted, mapreduce function will
   * ignore the deleted models so that it does not show in the app,
   * but deleted model remains in the database until the admin empties
   * the trash.
   *
   * Also remove it from the view so the user cant see it.
   *
   */
  putInTrash: {
    value: function() {
      this.set("trashed", "deleted" + Date.now());
      this.updateDatumState("Deleted");
      this.saveAndInterConnectInApp(function() {
        /* This actually removes it from the database */
        //thisdatum.destroy();
        if (window.appView) {
          window.appView.datumsEditView.showMostRecentDatum();
        }
      });
    }
  },

  /**
   * The LaTeXiT function automatically mark-ups an example in LaTeX code
   * (\exg. \"a) and then copies it on the export modal so that when the user
   * switches over to their LaTeX file they only need to paste it in.
   *
   * We did a poll on Facebook among EGGers, and other linguists we know and
   * found that Linguex was very popular, and GB4E, so we did the export in
   * GB4E.
   */
  /* jshint ignore:start */

  laTeXiT: {
    value: function(showInExportModal) {
      this.debug(showInExportModal);
      //corpus's most frequent fields
      var frequentFields = window.app.get("corpus").frequentFields;
      //this datum/datalist's datumfields and their names
      var fields = _.pluck(this.get("fields").toJSON(), "mask");
      var fieldLabels = _.pluck(this.get("fields").toJSON(), "label");
      //setting up for IGT case...
      var judgementIndex = -1;
      var judgement = "";
      var utteranceIndex = -1;
      var utterance = "";
      var morphemesIndex = -1;
      var morphemes = "";
      var glossIndex = -1;
      var gloss = "";
      var translationIndex = -1;
      var translation = "";
      var result = "\n \\begin{exe} \n \\ex \[";

      //IGT case:
      if (this.datumIsInterlinearGlossText()) {
        /* get the key pieces of the IGT and delete them from the fields and fieldLabels arrays*/
        judgementIndex = fieldLabels.indexOf("judgement");
        if (judgementIndex >= 0) {
          judgement = fields[judgementIndex];
          fieldLabels.splice(judgementIndex, 1);
          fields.splice(judgementIndex, 1);
        }
        utteranceIndex = fieldLabels.indexOf("utterance");
        if (utteranceIndex >= 0) {
          utterance = fields[utteranceIndex];
          fieldLabels.splice(utteranceIndex, 1);
          fields.splice(utteranceIndex, 1);
        }
        morphemesIndex = fieldLabels.indexOf("morphemes");
        if (morphemesIndex >= 0) {
          morphemes = fields[morphemesIndex];
          fieldLabels.splice(morphemesIndex, 1);
          fields.splice(morphemesIndex, 1);
        }
        glossIndex = fieldLabels.indexOf("gloss");
        if (glossIndex >= 0) {
          gloss = fields[glossIndex];
          fieldLabels.splice(glossIndex, 1);
          fields.splice(glossIndex, 1);
        }
        translationIndex = fieldLabels.indexOf("translation");
        if (translationIndex >= 0) {
          translation = fields[translationIndex];
          fieldLabels.splice(translationIndex, 1);
          fields.splice(translationIndex, 1);
        }
        //print the main IGT, escaping special latex chars
        /* ignore unnecessary escapement */
        result = result + this.escapeLatexChars(judgement) + "\]\{" + this.escapeLatexChars(utterance) + "\n \\gll " + this.escapeLatexChars(morphemes) + "\\\\" + "\n " + this.escapeLatexChars(gloss) + "\\\\" + "\n \\trans " + this.escapeLatexChars(translation) + "\}" +
          "\n\\label\{\}";
      }
      //remove any empty fields from our arrays
      for (var i = fields.length - 1; i >= 0; i--) {
        if (!fields[i]) {
          fields.splice(i, 1);
          fieldLabels.splice(i, 1);
        }

      }
      /*throughout this next section, print frequent fields and infrequent ones differently
    frequent fields get latex'd as items in a description and infrequent ones are the same,
    but commented out.*/
      if (fields && (fields.length > 0)) {
        var numInfrequent = 0;
        for (var field in fields) {
          if (frequentFields.indexOf(fieldLabels[field]) >= 0) {
            break;
          }
          numInfrequent++;
        }
        if (numInfrequent !== fieldLabels.length) {
          result = result + "\n \\begin\{description\}";
        } else {
          result = result + "\n% \\begin\{description\}";
        }
        for (field in fields) {
          if (fields[field] && (frequentFields.indexOf(fieldLabels[field]) >= 0)) {
            result = result + "\n \\item\[\\sc\{" + this.escapeLatexChars(fieldLabels[field]) + "\}\] " + this.escapeLatexChars(fields[field]);
          } else if (fields[field]) {
            /* If as a field that is designed for LaTex dont excape the LaTeX characters */
            if (fieldLabels[field].toLowerCase().indexOf("latex") > -1) {
              result = result + "\n " + fields[field];
            } else {
              result = result + "\n% \\item\[\\sc\{" + this.escapeLatexChars(fieldLabels[field]) + "\}\] " + this.escapeLatexChars(fields[field]);
            }
          }
        }
        if (numInfrequent !== fieldLabels.length) {
          result = result + "\n \\end\{description\}";
        } else {
          result = result + "\n% \\end\{description\}";
        }

      }
      result = result + "\n\\end{exe}\n\n";

      return result;
    }
  },
  /* jshint ignore:end */

  latexitDataList: {
    value: function(showInExportModal) {
      //this version prints new data as well as previously shown latex'd data (best for datalists)
      var result = this.laTeXiT(showInExportModal);
      if (showInExportModal !== null) {
        $("#export-type-description").html(" as <a href='http://latex.informatik.uni-halle.de/latex-online/latex.php?spw=2&id=562739_bL74l6X0OjXf' target='_blank'>LaTeX (GB4E)</a>");
        $("#export-text-area").val($("#export-text-area").val() + result);
      }
      return result;
    }
  },

  latexitDatum: {
    value: function(showInExportModal) {
      //this version prints new data and deletes previously shown latex'd data (best for datums)
      var result = this.laTeXiT(showInExportModal);
      if (showInExportModal !== null) {
        $("#export-type-description").html(" as <a href='http://latex.informatik.uni-halle.de/latex-online/latex.php?spw=2&id=562739_bL74l6X0OjXf' target='_blank'>LaTeX (GB4E)</a>");
        var latexDocument =
          "\\documentclass[12pt]{article} \n" +
          "\\usepackage{fullpage} \n" +
          "\\usepackage{tipa} \n" +
          "\\usepackage{qtree} \n" +
          "\\usepackage{gb4e} \n" +
          "\\begin{document} \n" + result +
          "\\end{document}";
        $("#export-text-area").val(latexDocument);
      }
      return result;
    }
  },

  escapeLatexChars: {
    value: function(input) {
      var result = input;
      //curly braces need to be escaped TO and escaped FROM, so we're using a placeholder
      result = result.replace(/\\/g, "\\textbackslashCURLYBRACES");
      result = result.replace(/\^/g, "\\textasciicircumCURLYBRACES");
      result = result.replace(/\~/g, "\\textasciitildeCURLYBRACES");
      result = result.replace(/#/g, "\\#");
      result = result.replace(/\$/g, "\\$");
      result = result.replace(/%/g, "\\%");
      result = result.replace(/&/g, "\\&");
      result = result.replace(/_/g, "\\_");
      result = result.replace(/{/g, "\\{");
      result = result.replace(/}/g, "\\}");
      result = result.replace(/</g, "\\textless");
      result = result.replace(/>/g, "\\textgreater");

      result = result.replace(/CURLYBRACES/g, "{}");
      return result;
    }
  },

  datumIsInterlinearGlossText: {
    value: function(fieldLabels) {
      if (!fieldLabels) {
        fieldLabels = _.pluck(this.get("fields").toJSON(), "label");
      }
      var utteranceOrMorphemes = false;
      var gloss = false;
      var trans = false;
      for (var fieldLabel in fieldLabels) {
        if (fieldLabels[fieldLabel] === "utterance" || fieldLabels[fieldLabel] === "morphemes") {
          utteranceOrMorphemes = true;
        }
        if (fieldLabels[fieldLabel] === "gloss") {
          gloss = true;
        }
        if (fieldLabels[fieldLabel] === "translation") {
          trans = true;
        }
      }
      if (gloss || utteranceOrMorphemes || trans) {
        return true;
      } else {
        return false;
      }
    }
  },

  /**
   * This function simply takes the utterance gloss and translation and puts
   * them out as plain text so the user can do as they wish.
   */
  exportAsPlainText: {
    value: function(showInExportModal) {
      // var header = _.pluck(this.get("fields").toJSON(), "label") || [];
      var fields = _.pluck(this.get("fields").toJSON(), "mask") || [];
      var result = fields.join("\n");
      if (showInExportModal !== null) {
        $("#export-type-description").html(" as text (Word)");
        $("#export-text-area").val(
          $("#export-text-area").val() + result
        );
      }
      return result;
    }
  },

  /**
   * This takes as an argument the order of fields and then creates a row of csv.
   */
  exportAsCSV: {
    value: function(showInExportModal, orderedFields, printheaderonly) {

      var header = _.pluck(this.get("fields").toJSON(), "label") || [];
      var fields = _.pluck(this.get("fields").toJSON(), "mask") || [];
      var result = fields.join(",") + "\n";

      //      if (orderedFields === null) {
      //        orderedFields = ["judgement","utterance","morphemes","gloss","translation"];
      //      }
      //      judgement = this.get("fields").where({label: "judgement"})[0].get("mask");
      //      morphemes = this.get("fields").where({label: "morphemes"})[0].get("mask");
      //      utterance= this.get("fields").where({label: "utterance"})[0].get("mask");
      //      gloss = this.get("fields").where({label: "gloss"})[0].get("mask");
      //      translation= this.get("fields").where({label: "translation"})[0].get("mask");
      //      var resultarray =  [judgement,utterance,morphemes,gloss,translation];
      //      var result = '"' + resultarray.join('","') + '"\n';
      if (printheaderonly) {
        result = header.join(",") + "\n";
      }
      if (showInExportModal !== null) {
        $("#export-type-description").html(" as CSV (Excel, Filemaker Pro)");
        $("#export-text-area").val(
          $("#export-text-area").val() + result);
      }
      return result;
    }
  },

  /**
   * Encrypts the datum if it is confidential
   *
   * @returns {Boolean}
   */
  encrypt: {
    value: function() {
      this.set("confidential", true);
      this.get("fields").each(function(dIndex) {
        dIndex.set("encrypted", "checked");
      });
      //TODO scrub version history to get rid of all unencrypted versions.
      this.saveAndInterConnectInApp(window.app.router.renderDashboardOrNot, window.app.router.renderDashboardOrNot);
    }
  },

  /**
   * Decrypts the datum if it was encrypted
   */
  decrypt: {
    value: function() {
      this.set("confidential", false);

      this.get("fields").each(function(dIndex) {
        dIndex.set("encrypted", "");
      });
    }
  },
  /**
   * Accepts two functions to call back when save is successful or
   * fails. If the fail callback is not overridden it will alert
   * failure to the user.
   *
   * - Adds the datum to the top of the default data list in the corpus if it is in the right corpus
   * - Adds the datum to the datums container if it wasnt there already
   * - Adds an activity to the logged in user with diff in what the user changed.
   *
   * @param successcallback
   * @param failurecallback
   */
  saveAndInterConnectInApp: {
    value: function(successcallback, failurecallback) {
      this.debug("Saving a Datum");
      var self = this;
      var newModel = true;
      if (this.id) {
        newModel = false;
      } else {
        this.set("dateEntered", JSON.stringify(new Date()));
      }
      //protect against users moving datums from one corpus to another on purpose or accidentially
      if (window.app.get("corpus").get("pouchname") !== this.get("pouchname")) {
        if (typeof failurecallback === "function") {
          failurecallback();
        } else {
          self.bug("Datum save error. I cant save this datum in this corpus, it belongs to another corpus. ");
        }
        return;
      }
      //If it was decrypted, this will save the changes before we go into encryptedMode

      this.get("fields").each(function(dIndex) {
        //Anything can be done here, it is the set function which does all the work.
        dIndex.set("value", dIndex.get("mask"));
      });

      // Store the current Session, the current corpus, and the current date
      // in the Datum
      this.set({
        "pouchname": window.app.get("corpus").get("pouchname"),
        "dateModified": JSON.stringify(new Date()),
        "timestamp": Date.now(),
        "jsonType": "Datum"
      });
      if (!this.get("session")) {
        this.set("session", window.app.get("currentSession"));
        self.debug("Setting the session on this datum to the current one.");
      } else {
        self.debug("Not setting the session on this datum.");
      }
      window.app.get("corpus").set("dateOfLastDatumModifiedToCheckForOldSession", JSON.stringify(new Date()));

      var oldrev = this.get("_rev");
      /*
       * For some reason the corpus is getting an extra state that no one defined in it.
       * this gets rid of it when we save. (if it gets in to a datum)
       */
      try {
        var ds = this.get("datumStates").models;
        for (var s in ds) {
          if (ds[s].get("state") === undefined) {
            this.get("datumStates").remove(ds[s]);
          }
        }
      } catch (e) {
        self.debug("Removing empty states work around failed some thing was wrong.", e);
      }

      self.save(null, {
        success: function(model, response) {
          self.debug("Datum save success");
          var utterance = model.get("fields").where({
            label: "utterance"
          })[0].get("mask");
          var differences = "#diff/oldrev/" + oldrev + "/newrev/" + response._rev;
          //TODO add privacy for datum goals in corpus
          //            if(window.app.get("corpus").get("keepDatumDetailsPrivate")){
          //              utterance = "";
          //              differences = "";
          //            }
          if (window.appView) {
            window.appView.toastUser("Sucessfully saved datum: " + utterance, "alert-success", "Saved!");
            window.appView.addSavedDoc(model.id);
          }
          var verb = "modified";
          var verbicon = "icon-pencil";
          if (newModel) {
            verb = "added";
            verbicon = "icon-plus";
          }
          window.app.addActivity({
            verb: "<a href='" + differences + "'>" + verb + "</a> ",
            verbicon: verbicon,
            directobject: "<a href='#corpus/" + model.get("pouchname") + "/datum/" + model.id + "'>" + utterance + "</a> ",
            directobjecticon: "icon-list",
            indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get("title") + "</a>",
            teamOrPersonal: "team",
            context: " via Offline App."
          });

          window.app.addActivity({
            verb: "<a href='" + differences + "'>" + verb + "</a> ",
            verbicon: verbicon,
            directobject: "<a href='#corpus/" + model.get("pouchname") + "/datum/" + model.id + "'>" + utterance + "</a> ",
            directobjecticon: "icon-list",
            indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get("title") + "</a>",
            teamOrPersonal: "personal",
            context: " via Offline App."
          });
          //            /*
          //             * If the current data list is the default
          //             * list, render the datum there since is the "Active" copy
          //             * that will eventually overwrite the default in the
          //             * corpus if the user saves the current data list
          //             */
          //            var defaultIndex = window.app.get("corpus").datalists.length - 1;
          //            if(window.appView.currentEditDataListView.model.id === window.app.get("corpus").datalists.models[defaultIndex].id){
          //              //Put it into the current data list views
          //              window.appView.currentPaginatedDataListDatumsView.collection.remove(model);//take it out of where it was,
          //              window.appView.currentPaginatedDataListDatumsView.collection.unshift(model); //and put it on the top. this is only in the default data list
          //              //Put it into the ids of the current data list
          //              var positionInCurrentDataList = window.app.get("currentDataList").get("datumIds").indexOf(model.id);
          //              if(positionInCurrentDataList !== -1){
          //                window.app.get("currentDataList").get("datumIds").splice(positionInCurrentDataList, 1);
          //              }
          //              window.app.get("currentDataList").get("datumIds").unshift(model.id);
          //              window.appView.addUnsavedDoc(window.app.get("currentDataList").id);
          //            }else{
          //              /*
          //               * Make sure the datum is at the top of the default data list which is in the corpus,
          //               * this is in case the default data list is not being displayed
          //               */
          //              var positionInDefaultDataList = window.app.get("corpus").datalists.models[defaultIndex].get("datumIds").indexOf(model.id);
          //              if(positionInDefaultDataList !== -1 ){
          //                //We only reorder the default data list datum to be in the order of the most recent modified, other data lists can stay in the order teh usr designed them.
          //                window.app.get("corpus").datalists.models[defaultIndex].get("datumIds").splice(positionInDefaultDataList, 1);
          //              }
          //              window.app.get("corpus").datalists.models[defaultIndex].get("datumIds").unshift(model.id);
          //              window.app.get("corpus").datalists.models[defaultIndex].needsSave  = true;
          //              window.appView.addUnsavedDoc(window.app.get("corpus").id);
          //            }
          /*
           * Also, see if this datum matches the search datalist, and add it to the top of the search list
           */
          if ($("#search_box").val() !== "") {
            //TODO check this
            var datumJson = model.get("fields").toJSON();
            var datumAsDBResponseRow = {};
            for (var x in datumJson) {
              datumAsDBResponseRow[datumJson[x].label] = datumJson[x].mask;
            }
            var queryTokens = self.processQueryString($("#search_box").val());
            var thisDatumIsIn = self.matchesSingleCriteria(datumAsDBResponseRow, queryTokens[0]);

            for (var j = 1; j < queryTokens.length; j += 2) {
              if (queryTokens[j] === "AND") {
                // Short circuit: if it's already false then it continues to be false
                if (!thisDatumIsIn) {
                  break;
                }

                // Do an intersection
                thisDatumIsIn = thisDatumIsIn && model.matchesSingleCriteria(datumAsDBResponseRow, queryTokens[j + 1]);
              } else {
                // Do a union
                thisDatumIsIn = thisDatumIsIn || model.matchesSingleCriteria(datumAsDBResponseRow, queryTokens[j + 1]);
              }
            }
            if (thisDatumIsIn) {
              // Insert the datum at the top of the search datums collection view
              window.appView.searchEditView.searchPaginatedDataListDatumsView.collection.remove(model); //take it out of where it was,
              window.appView.searchEditView.searchPaginatedDataListDatumsView.collection.unshift(model);
              //Do the same to the datumids in the search data list itself
              var positioninsearchresults = window.appView.searchEditView.searchDataListView.model.get("datumIds").indexOf(model.id);
              if (positioninsearchresults !== -1) {
                window.appView.searchEditView.searchDataListView.model.get("datumIds").splice(positioninsearchresults, 1);
              }
              window.appView.searchEditView.searchDataListView.model.get("datumIds").unshift(model.id);
            }
          } //end of if search is open and running for Alan


          //dont need to save the user every time when we change a datum.
          //            window.app.get("authentication").saveAndInterConnectInApp();

          if (typeof successcallback === "function") {
            successcallback();
          }
        },
        error: function(e, f, g) {
          self.debug("Datum save error", e, f, g);
          if (typeof failurecallback === "function") {
            failurecallback();
          } else {
            self.bug("Datum save error: " + f.reason);
          }
        }
      });
    }
  },
  /**
   * Accepts two functions success will be called if sucessfull,
   * otherwise it will attempt to render the current datum views. If
   * the datum isn't in the current corpus it will call the fail
   * callback or it will alert a bug to the user. Override the fail
   * callback if you don't want the alert.
   *
   * @param successcallback
   * @param failurecallback
   * @deprecated
   */
  setAsCurrentDatum: {
    value: function() {
      this.warn("Using deprected method setAsCurrentDatum.");
      //      if( window.app.get("corpus").get("pouchname") !== this.get("pouchname") ){
      //        if (typeof failurecallback === "function") {
      //          failurecallback();
      //        }else{
      //          self.bug("This is a bug, cannot load the datum you asked for, it is not in this corpus.");
      //        }
      //        return;
      //      }else{
      //        if (window.appView.datumsEditView.datumsView.collection.models[0].id !== this.id ) {
      //          window.appView.datumsEditView.datumsView.prependDatum(this);
      //          //TODO might not need to do it on the Read one since it is the same model?
      //        }
      //        if (typeof successcallback === "function") {
      //          successcallback();
      //        }
      //      }
    }
  },

  /* highlight returns text with all instances of stringToHighlight enclosed
   * in a span.  Note that stringToHighlight is treated as a regexp.
   */
  highlight: {
    value: function(text, stringToHighlight, className) {
      className = className || "highlight";
      var re = new RegExp("(" + stringToHighlight + ")", "gi");
      return text.replace(re, "<span class='" + className + "'>$1</span>");
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);

      var json = FieldDBObject.prototype.toJSON.apply(this, arguments);

      this.todo("saving fields as the deprecated datumFields");
      json.datumFields = json.fields;
      delete json.fields;

      this.debug(json);
      return json;
    }
  }


});
exports.Datum = Datum;

},{"./../Collection":2,"./../FieldDBObject":4,"./../audio_video/AudioVideos":11,"./../comment/Comments":14,"./../image/Images":40,"./DatumField":25,"./DatumFields":26,"./DatumStates":28,"./DatumTags":30}],25:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Confidential = require("./../confidentiality_encryption/Confidential").Confidential;

/**
 * @class The datum fields are the fields in the datum and session models.
 *        They can be freely added and should show up in the datum view
 *        according to frequency.
 *  @name  DatumField
 * @property size The size of the datum field refers to the width of the
 *           text area. Some of them, such as the judgment one will be very
 *           short, while others context can be infinitely long.
 * @property label The label that is associated with the field, such as
 *           Utterance, Morphemes, etc.
 * @property value This is what the user will enter when entering data into
 *           the data fields.
 * @property mask This allows users to mask fields for confidentiality.
 * @property shouldBeEncrypted This is whether the field is masked or not.
 * @property help This is a pop up that tells other users how to use the
 *           field the user has created.
 * @extends FieldDBObject
 * @constructs
 */
var DatumField = function DatumField(options) {
  if(!this._fieldDBtype){
		this._fieldDBtype = "DatumField";
	}

  this.debug("Constructing DatumField ", options);
  // Let encryptedValue and value from serialization be set
  if (options && options.encryptedValue) {
    options._encryptedValue = options.encryptedValue;
  }
  if (options && options.value) {
    options._value = options.value;
  }
  FieldDBObject.apply(this, arguments);
};

DatumField.prototype = Object.create(FieldDBObject.prototype, /** @lends DatumField.prototype */ {
  constructor: {
    value: DatumField
  },

  defaults: {
    get: function() {
      return {
        id: Date.now(),
        labelFieldLinguists: "",
        labelPsychoLinguists: "",
        labelExperimenters: "",
        labelNonLinguists: "",
        labelTranslators: "",
        labelComputationalLinguist: "",
        type: "",
        shouldBeEncrypted: false,
        showToUserTypes: "all",
        defaultfield: false,
        value: "",
        mask: "",
        encrypted: "",
        json: {},
        help: "Put your team's data entry conventions here (if any)...",
        helpLinguists: "Put your team's data entry conventions here (if any)...",
        helpNonLinguists: "Put your team's data entry conventions here (if any)...",
        helpTranslators: "Put your team's data entry conventions here (if any)...",
        ComputationalLinguists: "Put your team's data entry conventions here (if any)...",
        helpDevelopers: "Put your team's data entry conventions here (if any)..."
      };
    }
  },

  // Internal models: used by the parse function
  internalModels: {
    value: {} // There are no nested models
  },

  id: {
    get: function() {
      return this._id || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._id) {
        return;
      }
      if (!value) {
        delete this._id;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      var originalValue = value + "";
      value = this.sanitizeStringForPrimaryKey(value); /*TODO dont do this on all objects */
      if (value === null) {
        this.bug("Invalid id, not using " + originalValue + " id remains as " + this._id);
        return;
      }
      this._id = value;
    }
  },

  label: {
    get: function() {
      this.debug("label is deprecated, instead automatically contextualize a label for appropriate user eg labelFieldLinguists, labelNonLinguists, labelTranslators, labelComputationalLinguist");
      return this._labelFieldLinguists || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      this.debug("label is deprecated, instead automatically contextualize a label for appropriate user eg labelFieldLinguists,  labelNonLinguists, labelTranslators, labelComputationalLinguist");
      this.labelFieldLinguists = value;
      this.id = value;
    }
  },

  userchooseable: {
    get: function() {
      this.debug("userchooseable is deprecated, instead use defaultfield");
      return this.defaultfield;
    },
    set: function(value) {
      this.debug("userchooseable is deprecated, instead use defaultfield");
      if (value === "disabled") {
        value = true;
      }
      if (!value) {
        value = false;
      }
      this.defaultfield = value;
    }
  },

  labelFieldLinguists: {
    get: function() {
      return this._labelFieldLinguists || this.label;
    },
    set: function(value) {
      if (value === this._labelFieldLinguists) {
        return;
      }
      if (!value) {
        delete this._labelFieldLinguists;
        return;
      }
      this._labelFieldLinguists = value.trim();
    }
  },

  labelPsychoLinguists: {
    get: function() {
      return this._labelPsychoLinguists || this.labelFieldLinguists;
    },
    set: function(value) {
      if (value === this._labelPsychoLinguists) {
        return;
      }
      if (!value) {
        delete this._labelPsychoLinguists;
        return;
      }
      this._labelPsychoLinguists = value.trim();
    }
  },

  labelExperimenter: {
    get: function() {
      return this._labelExperimenter || this.labelNonLinguists;
    },
    set: function(value) {
      if (value === this._labelExperimenter) {
        return;
      }
      if (!value) {
        delete this._labelExperimenter;
        return;
      }
      this._labelExperimenter = value.trim();
    }
  },

  labelNonLinguists: {
    get: function() {
      return this._labelNonLinguists || this.label;
    },
    set: function(value) {
      if (value === this._labelNonLinguists) {
        return;
      }
      if (!value) {
        delete this._labelNonLinguists;
        return;
      }
      this._labelNonLinguists = value.trim();
    }
  },

  labelTranslators: {
    get: function() {
      return this._labelTranslators || this.labelNonLinguists;
    },
    set: function(value) {
      if (value === this._labelTranslators) {
        return;
      }
      if (!value) {
        delete this._labelTranslators;
        return;
      }
      this._labelTranslators = value.trim();
    }
  },

  labelComputationalLinguist: {
    get: function() {
      return this._labelComputationalLinguist || this.label;
    },
    set: function(value) {
      if (value === this._labelComputationalLinguist) {
        return;
      }
      if (!value) {
        delete this._labelComputationalLinguist;
        return;
      }
      this._labelComputationalLinguist = value.trim();
    }
  },

  type: {
    get: function() {
      return this._type || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._type) {
        return;
      }
      if (!value) {
        delete this._type;
        return;
      }
      this._type = value.trim();
    }
  },

  shouldBeEncrypted: {
    get: function() {
      return this._shouldBeEncrypted || FieldDBObject.DEFAULT_FALSE;
    },
    set: function(value) {
      this.verbose("Setting shouldBeEncrypted " + value, this);

      if (value === this._shouldBeEncrypted) {
        return;
      }
      if (value === "checked") {
        value = true;
      }
      value = !!value;
      this.verbose("Setting shouldBeEncrypted " + value, this);
      if (this._shouldBeEncrypted === true && value === false) {
        this.warn("This field's shouldBeEncrypted cannot be undone. Only a corpus administrator can change shouldBeEncrypted to false if it has been true before.");
        return;
      }
      this._shouldBeEncrypted = value;
    }
  },

  encrypted: {
    get: function() {
      return this._encrypted || FieldDBObject.DEFAULT_FALSE;
    },
    set: function(value) {
      if (value === this._encrypted) {
        return;
      }
      if (!value) {
        delete this._encrypted;
        return;
      }
      if (value === "checked") {
        value = true;
      }
      this._encrypted = !!value;
    }
  },

  showToUserTypes: {
    get: function() {
      return this._showToUserTypes || "all";
    },
    set: function(value) {
      if (value === this._showToUserTypes) {
        return;
      }
      if (!value) {
        delete this._showToUserTypes;
        return;
      }
      this._showToUserTypes = value.trim();
    }
  },

  defaultfield: {
    get: function() {
      return this._defaultfield || FieldDBObject.DEFAULT_FALSE;
    },
    set: function(value) {
      if (value === this._defaultfield) {
        return;
      }
      if (!value) {
        delete this._defaultfield;
        return;
      }
      this._defaultfield = !!value;
    }
  },
  repairMissingEncryption: {
    value: true
  },
  value: {
    configurable: true,
    get: function() {
      if (!this._value) {
        return FieldDBObject.DEFAULT_STRING;
      }
      // If there was a value before, there are extra precautions
      if (!this._shouldBeEncrypted) {
        return this._value.trim();
      } else {
        if (!this.encrypted) {
          return this._value.trim();
        } else {
          if (!this.decryptedMode) {
            this.warn("User is not able to view the value of this item, it is encrypted and the user isn't in decryptedMode."); //" mask: "+ this._mask +" value: " +this._value);
            return this.mask || FieldDBObject.DEFAULT_STRING;
          } else {
            if (!this._encryptedValue || this._encryptedValue.indexOf("confidential:") !== 0) {
              this.warn("The value was supposed to be encrypted but was not encrypted. This should not happen, it might only happen if an app was editing the data and didn't have the encryption implemented. Not overwritting the value.");
              if (this.repairMissingEncryption && this.confidential) {
                var encryptedValue = this.confidential.encrypt(this._value);
                this.warn(" Encrypting the value " + this._value);
                this._encryptedValue = encryptedValue;
                this._mask = this.createMask(this._value);
                this._value = this._mask;
              } else {
                return this._value.trim();
              }
            }
            if (this._encryptedValue.indexOf("confidential:") === 0) {
              // All conditions are satisified, decrypt the value and give it to the user
              if (!this.confidential) {
                this.warn("This field's encrypter hasnt been set. It cannot be decrypted yet.");
                return this.mask;
              }
              var decryptedValue = this.confidential.decrypt(this._encryptedValue);
              this.debug("decryptedValue " + decryptedValue);
              return decryptedValue;
            }
          }
        }
      }
      this.bug("The value wasn't returned, this should never happen and is a bug in the logic.");

    },
    set: function(value) {
      if (value === this._value) {
        return;
      }
      if (!value) {
        var fieldCanBeDeleted = !this._shouldBeEncrypted || (this._shouldBeEncrypted && this.decryptedMode);
        if (fieldCanBeDeleted) {
          delete this._value;
          delete this._mask;
          delete this._encryptedValue;
          return;
        } else {
          this.warn("The value was removed by the user, but they are not able to edit the field currently.");
          return;
        }
      }
      var encryptedValue;
      if (!value.trim) {
        value = value + "";
      }
      value = value.trim();
      if (!this._shouldBeEncrypted) {
        this._encryptedValue = value;
        this._mask = value;
        this._value = this._mask;
        return;
      } else {
        if (!this.encrypted) {
          this._encryptedValue = value;
          this._mask = value;
          this._value = this._mask;
          return;
        } else {
          if (!this._value) {
            // If there was no value before, set the new value

            if (!this.confidential) {
              if (value.indexOf("confidential:") === 0 && !this._encryptedValue) {
                this._encryptedValue = value;
                this._value = this.mask;
                this.debug("This is probably a new field initialization from old data (the value has \"confidential:\" in it, and yet the encryptedValue isn't set");
              } else {
                this.warn("This field's encrypter hasnt been set. It cannot be edited yet.");
              }
              return;
            }
            encryptedValue = this.confidential.encrypt(value);
            this._encryptedValue = encryptedValue;
            this._mask = this.createMask(value);
            this._value = this._mask;

          } else {

            // If there was a value before, there are extra precautions
            if (!this.decryptedMode) {
              this.warn("User is not able to change the value of this item, it is encrypted and the user isn't in decryptedMode.");
              return;
            } else {
              if (!this._encryptedValue || this._encryptedValue.indexOf("confidential:") !== 0) {
                this.warn("The value was changed, and it was supposed to be encrypted but was not encrypted. This should not happen, it might only happen if an app was editing the data and didn't have the encryption implemented.");
                if (this.repairMissingEncryption && this.confidential) {
                  encryptedValue = this.confidential.encrypt(value);
                  this._encryptedValue = encryptedValue;
                  this._mask = this.createMask(value);
                  this._value = this._mask;
                  this.warn(" Overwritting the value.");
                } else {
                  this.warn(" Not overwritting the value.");
                  return;
                }
              }

              // All conditions are satisified, accept the new value.
              if (!this.confidential) {
                this.warn("This field's encrypter hasnt been set. It cannot be edited yet.");
                return;
              }
              encryptedValue = this.confidential.encrypt(value);
              this._encryptedValue = encryptedValue;
              this._mask = this.createMask(value);
              this._value = this._mask;

            }
          }
        }

      }
    }
  },

  mask: {
    get: function() {
      return this._mask || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._mask) {
        return;
      }
      if (!value) {
        delete this._mask;
        return;
      }
      this.debug("Setting datum field mask " + value);
      this._mask = value.trim();
    }
  },


  encryptedValue: {
    get: function() {
      return this._encryptedValue || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._encryptedValue) {
        return;
      }
      this.warn("encryptedValue cannot be changed directly, instead field must be in decryptedMode and then set the value." + value);
    }
  },

  json: {
    get: function() {
      return this._json || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      if (value === this._json) {
        return;
      }
      if (!value) {
        delete this._json;
        return;
      }
      this._json = value;
    }
  },

  help: {
    configurable: true,
    get: function() {
      return this._help || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._help) {
        return;
      }
      if (!value) {
        delete this._help;
        return;
      }
      this._help = value.trim();
    }
  },

  helpLinguists: {
    get: function() {
      return this._helpLinguists || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._helpLinguists) {
        return;
      }
      if (!value) {
        delete this._helpLinguists;
        return;
      }
      this._helpLinguists = value.trim();
    }
  },

  helpNonLinguists: {
    get: function() {
      return this._helpNonLinguists || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._helpNonLinguists) {
        return;
      }
      if (!value) {
        delete this._helpNonLinguists;
        return;
      }
      this._helpNonLinguists = value.trim();
    }
  },

  helpTranslators: {
    get: function() {
      return this._helpTranslators || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._helpTranslators) {
        return;
      }
      if (!value) {
        delete this._helpTranslators;
        return;
      }
      this._helpTranslators = value.trim();
    }
  },

  helpComputationalLinguists: {
    get: function() {
      return this._helpComputationalLinguists || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._helpComputationalLinguists) {
        return;
      }
      if (!value) {
        delete this._helpComputationalLinguists;
        return;
      }
      this._helpComputationalLinguists = value.trim();
    }
  },

  helpDevelopers: {
    get: function() {
      return this._helpDevelopers || "Put your team's data entry conventions here (if any)...";
    },
    set: function(value) {
      if (value === this._helpDevelopers) {
        return;
      }
      if (!value) {
        delete this._helpDevelopers;
        return;
      }
      this._helpDevelopers = value.trim();
    }
  },

  /**
   * Called before set and save, checks the attributes that the
   * user is attempting to set or save. If the user is trying to
   * set a mask on an encrypted datum field that should be encrypted, the only time they can do this is if the data is
   * in tempEncryptedVisible, with decryptedMode on.
   *
   * @param attributes
   */
  validate: {
    value: function(attributes) {
      this.tood("Vaidating is commented out ", attributes);
      //      if(attributes.mask){
      //        if(attributes.shouldBeEncrypted !== "checked" ){
      //          //user can modify the mask, no problem.
      //        }else if(attributes.encrypted !== "checked" ){
      //          //user can modify the mask, no problem.
      //        }else if( attributes.encrypted === "checked" &&
      ////            attributes.tempEncryptedVisible === "checked"  &&
      //            attributes.shouldBeEncrypted === "checked" &&
      //              this.corpus.confidential.decryptedMode ){
      //          //user can modify the mask, no problem.
      //        }else if( attributes.mask !== this.mask ){
      //          return "The datum is presently encrypted, the mask cannot be set by anything other than the model itself.";
      //        }
      //      }
      //      if( attributes.value ){
      //
      //        if(this.value && this.value.indexOf("confidential") === 0){
      //          return "Cannot modify the value of a confidential datum field directly";
      //        }
      //
      //        if(attributes.shouldBeEncrypted !== "checked" ){
      //          //user can modify the value, no problem.
      //        }else if(attributes.encrypted !== "checked" ){
      //          //user can modify the value, no problem.
      //        }else if( attributes.encrypted === "checked" &&
      ////            attributes.tempEncryptedVisible === "checked"  &&
      //            attributes.shouldBeEncrypted === "checked" &&
      //              this.corpus.confidential.decryptedMode ){
      //          //the user/app can modify the value, no problem.
      //        }else if( attributes.value !== this.value ){
      //          return "The value cannot be set by anything other than the model itself, from a mask.";
      //        }
      //      }
    }
  },

  /**
   * In the case of the datumfield, if the datum
   * field is not encrypted, then the mask and value are essentially the same.
   * If however the datum is supposed to be encrypted, the value needs to
   * start with confidential, and the mask should be xxxx representign
   * words/morphemes which are allowed to be shown.
   * http://stackoverflow.com/questions/11315844/what-is-the-correct-way-in-backbone-js-to-listen-and-modify-a-model-property
   *
   * @param key
   * @param value
   * @param options
   * @returns null
   */
  upgrade: {
    value: function(attributes, options) {

      options = options || {};
      // do any other custom property changes here
      /*
       * Copy the mask, value and shouldBeEncrypted and encrypted from the object if it is not being set.
       */
      if (attributes.mask === undefined && this.mask) {
        attributes.mask = this.mask;
      }
      if (attributes.value === undefined && this.value) {
        attributes.value = this.value;
      }
      if (attributes.shouldBeEncrypted === undefined && this.shouldBeEncrypted) {
        attributes.shouldBeEncrypted = this.shouldBeEncrypted;
      }
      if (attributes.encrypted === undefined && this.encrypted) {
        attributes.encrypted = this.encrypted;
      }

      if ((attributes.mask && attributes.mask !== "")) {

        if (attributes.shouldBeEncrypted !== "checked") {
          //Don't do anything special, this field doesnt get encrypted when the data is confidential
          attributes.value = attributes.mask;
        } else if (attributes.encrypted !== "checked") {
          //Don't do anything special, this datum isn't confidential
          attributes.value = attributes.mask;


          /*
           * A, B, C, D: If we are supposed to be encrypted, and we are encrypted, but we want to let the user see the data to change it.
           *
           */
        } else if (this.corpus.confidential.decryptedMode) {

          /*
           * A: If it wasn't encrypted, encrypt the value, and leave the mask as the original value for now,
           * can happen when the user clicks on the lock button for the first time.
           */
          if (attributes.mask.indexOf("confidential:") !== 0) {
            //          attributes.mask = attributes.mask;//leave mask open
            //save the mask encrpyted as the new value, this is triggered when the user modifies the data
            attributes.value = this.corpus.confidential.encrypt(attributes.mask);
            /*
             * B: A strange case which is used by the Datum Save function, to trigger the mask into the xxx version of the current value that it will be saved in the data base with xxx.
             */
          } else if (attributes.mask.indexOf("confidential:") === 0) {
            attributes.mask = this.mask(this.corpus.confidential.decrypt(this.value));
            attributes.value = this.value; //don't let the user modify the value.
          }

          /*
           * C & D: this should never be called since the value is supposed to come from the mask only.
           */

          /*
           * C: If the value wasn't encrypted, encrypt the value, and leave the mask as the original value since we are in decryptedMode
           */
          if (attributes.value && attributes.value.indexOf("confidential") !== 0) {
            //          attributes.mask = attributes.mask;//leave mask open
            attributes.value = this.corpus.confidential.encrypt(attributes.mask);
            /*
             * D: If the value was encrypted, there is some sort of bug, leave the value as it was, decrypt it and put it in to the mask since we are in decryptedMode
             */
          } else if (attributes.value && attributes.value.indexOf("confidential") === 0) {
            // If it was encrypted, turn the mask into the decrypted version of the current value so the user can see it.
            //this might get called at the same time as the first mask if above
            attributes.mask = this.corpus.confidential.decrypt(this.value);
            attributes.value = this.value; //don't let the user modify the value.
          }

          /*
           * E, F, G, H: If we are supposed to be encrypted and we are encrypted, but we are not in decrypted mode.
           */
        } else {

          //Don't let the user take off encryption if they are not in decryptedMode
          if (this.encrypted === "checked") {
            if (true && attributes.encrypted !== "checked" && !this.corpus.confidential.decryptedMode) {
              attributes.encrypted = "checked";
            }
          }

          /*
           * E: A strange case which is used by the Datum Save function, to trigger the mask into the xxx version of the current value that it will be saved in the data base with xxx.
           *  (Same as B above)
           */
          if (attributes.mask && attributes.mask.indexOf("confidential") === 0) {
            attributes.mask = this.mask(this.corpus.confidential.decrypt(this.value));
            attributes.value = this.value; //don't let the user modify the value.
            /*
             * F: If the value is encrypted, then the mask is probably set, don't let the user change anything since they shouldn't be able to see the data anyway.s
             */
          } else {
            //Don't let user change value of confidential or mask: see validate function
            attributes.mask = this.mask;
            attributes.value = this.value;
          }

          /*
           * G: If the data is not encrypted, encrypt it and mask it in the mask. This might be called the first time a user clicks on the lock to first encrypts the value.
           * (Similar to C above, except that we mask the mask)
           */
          if (attributes.value && attributes.value.indexOf("confidential") !== 0) {
            attributes.mask = this.mask(this.value); //use value to make mask
            attributes.value = this.corpus.confidential.encrypt(this.value);
            /*
             * H: If the value is encrypted, then the mask is probably set, don't let the user change anything since they shouldn't be able to see the data anyway.s
             */
          } else {
            //Don't let user change value of confidential or mask: see validate function
            attributes.mask = this.mask;
            attributes.value = this.value;
          }
        }
      } else {
        //        alert("The datum field has no mask, there is a bug somewhere.");
        //        attributes.value ="";
        //        attributes.mask = "";
      }
      return attributes;
    }
  },

  createMask: {
    value: function(stringToMask) {
      return stringToMask.replace(/[^_=., -]/g, "x");
    }
  },

  saveAndInterConnectInApp: {
    value: function(callback) {

      if (typeof callback === "function") {
        callback();
      }
    }
  },

  confidential: {
    get: function() {
      return this.confidentialEncrypter;
    },
    set: function(value) {
      if (value === this.confidentialEncrypter) {
        return;
      }
      if (typeof value.encrypt !== "function" && value.secretkey) {
        value = new Confidential(value);
      }
      this.confidentialEncrypter = value;
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);
      var json = FieldDBObject.prototype.toJSON.apply(this, arguments);
      delete json.dateCreated;
      delete json.dateModified;
      delete json.comments;
      delete json.dbname;

      json.id = json._id;
      delete json._id;

      json.fieldDBtype = this.fieldDBtype;
      delete json._type;

      this.debug(json);
      return json;
    }
  }

});

exports.DatumField = DatumField;

},{"./../FieldDBObject":4,"./../confidentiality_encryption/Confidential":15}],26:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var DatumField = require("./../datum/DatumField").DatumField;

/**
 * @class Collection of Datum Field
 * @name  DatumFields
 * @description The DatumFields is a minimal customization of the Collection
 * to add an internal model of DatumField.
 *
 * @extends Collection
 * @constructs
 */
var DatumFields = function DatumFields(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DatumFields";
  }
  this.debug("Constructing DatumFields length: ", options);
  Collection.apply(this, arguments);
};

DatumFields.prototype = Object.create(Collection.prototype, /** @lends DatumFields.prototype */ {
  constructor: {
    value: DatumFields
  },

  /**
   *  The primary key < v2 was "label" but we changed to use "id" so that
   *  "label" could be used only for a human friendly (and customizable)
   *  label while the id must remain unchanged for glossing and other automation.
   * @type {Object}
   */
  primaryKey: {
    value: "id"
  },

  INTERNAL_MODELS: {
    value: {
      item: DatumField
    }
  },

  capitalizeFirstCharacterOfPrimaryKeys: {
    value: false
  }

});
exports.DatumFields = DatumFields;

},{"./../Collection":2,"./../datum/DatumField":25}],27:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var UserMask = require("./../user/UserMask").UserMask;

/**
 * @class The datum state lets the fieldlinguists assign their own state
 *        categories to data (ie check with consultant, check with x,
 *        checked, checked and wrong, hidden, deleted), whatever state they
 *        decide. They an make each state have a color so that the team can
 *        see quickly if there is something that needs to be done with that
 *        data. We also added an optional field, Consultant that they can use
 *        to say who they want to check with in case they have mulitple
 *        consultants and the consultants have different grammaticality
 *        judgements. When users change the state of the datum, we will add
 *        a note in the datum"s comments field so that the history of its
 *        state is kept in an annotated format.
 *
 * @name  DatumState
 *
 * @extends FieldDBObject
 * @constructs
 */
var DatumState = function DatumState(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DatumState";
  }
  this.debug("Constructing DatumState ", options);
  FieldDBObject.apply(this, arguments);
};

DatumState.prototype = Object.create(FieldDBObject.prototype, /** @lends DatumState.prototype */ {
  constructor: {
    value: DatumState
  },

  defaults: {
    value: {
      state: "Checked",
      color: "",
      consultant: UserMask, //TODO comment out htis line when we confirm that state is working
      showInSearchResults: "checked",
      selected: ""
    }
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      consultant: UserMask
    }
  },

  validationStatus: {
    get: function() {
      if (!this._validationStatus && this.state) {
        this.warn("state is deprecated, use validationStatus instead.");
        this._validationStatus = this.state;
      }
      return this._validationStatus || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      if (value === this._validationStatus) {
        return;
      }
      if (!value) {
        delete this._validationStatus;
        return;
      }
      this._validationStatus = value.trim();
    }
  }

});
exports.DatumState = DatumState;

},{"./../FieldDBObject":4,"./../user/UserMask":56}],28:[function(require,module,exports){
var DatumTags = require("./DatumTags").DatumTags;
var DatumState = require("./DatumState").DatumState;

/**
 * @class DatumStates of Datum validation states
 * @name  DatumStates
 * @description The DatumStates is a minimal customization of the DatumTags
 * to add an internal model of DatumState.
 *
 * @extends DatumTags
 * @constructs
 */
var DatumStates = function DatumStates(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DatumStates";
  }
  this.debug("Constructing DatumStates length: ", options);
  DatumTags.apply(this, arguments);
};

DatumStates.prototype = Object.create(DatumTags.prototype, /** @lends DatumStates.prototype */ {
  constructor: {
    value: DatumStates
  },

  /**
   *  The primary key < v2 was "label" but we changed to use "id" so that
   *  "label" could be used only for a human friendly (and customizable)
   *  label while the id must remain unchanged for glossing and other automation.
   * @type {Object}
   */
  primaryKey: {
    value: "validationStatus"
  },

  INTERNAL_MODELS: {
    value: {
      item: DatumState
    }
  }

});
exports.DatumStates = DatumStates;

},{"./DatumState":27,"./DatumTags":30}],29:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class The DatumTag allows the user to label data with grammatical tags
 *        i.e. passive, causative. This is useful for searches.
 *
 * @name  DatumTag
 * @description The initialize function brings up a field in which the user
 *              can enter tags.@class FieldDBObject of Datum validation states
 * @extends FieldDBObject
 * @constructs
 */
var DatumTag = function DatumTag(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DatumTag";
  }
  this.debug("Constructing DatumTag ", options);
  FieldDBObject.apply(this, arguments);
};

DatumTag.prototype = Object.create(FieldDBObject.prototype, /** @lends DatumTag.prototype */ {
  constructor: {
    value: DatumTag
  }

});
exports.DatumTag = DatumTag;

},{"./../FieldDBObject":4}],30:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var DatumTag = require("./DatumTag").DatumTag;

/**
 * @class Collection of Datum validation states

 * @name  DatumTags
 * @description The DatumTags is a minimal customization of the Collection
 * to add an internal model of DatumTag.
 *
 * @extends Collection
 * @constructs
 */
var DatumTags = function DatumTags(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DatumTags";
  }
  this.debug("Constructing DatumTags ", options);
  Collection.apply(this, arguments);
};

DatumTags.prototype = Object.create(Collection.prototype, /** @lends DatumTags.prototype */ {
  constructor: {
    value: DatumTags
  },

  /**
   *  The primary key < v2 was "label" but we changed to use "id" so that
   *  "label" could be used only for a human friendly (and customizable)
   *  label while the id must remain unchanged for glossing and other automation.
   * @type {Object}
   */
  primaryKey: {
    value: "tag"
  },

  INTERNAL_MODELS: {
    value: {
      item: DatumTag
    }
  }

});
exports.DatumTags = DatumTags;

},{"./../Collection":2,"./DatumTag":29}],31:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

var Document = function Document(options) {
  // if(!this._fieldDBtype){
  // 	this._fieldDBtype = "Document";
  // }
  this.debug("In Document ", options);
  FieldDBObject.apply(this, arguments);
};

Document.fieldDBtype = "Document";
Document.prototype = Object.create(FieldDBObject.prototype, /** @lends Document.prototype */ {
  constructor: {
    value: Document
  },

  fieldDBtype: {
    get: function() {
      this.debug("getting fieldDBtype");
      if (!this._fieldDBtype) {
        // this._fieldDBtype = this.guessType(this);
      }
      return this._fieldDBtype || "";
    },
    set: function(value) {
      this.debug("setting fieldDBtype");
      if (value !== this._fieldDBtype) {
        this.warn("Overriding fieldDBtype " + this._fieldDBtype + " to the incoming " + value);
        this._fieldDBtype = value;
      }
    }
  },

  guessType: {
    value: function(doc) {
      if (!doc || JSON.stringify(doc) === {}) {
        return "FieldDBObject";
      }
      this.debug("Guessing type " + doc._id);
      var guessedType = doc.jsonType || doc.collection || "FieldDBObject";
      if (doc.api && doc.api.length > 0) {
        this.debug("using api" + doc.api);
        guessedType = doc.api[0].toUpperCase() + doc.api.substring(1, doc.api.length);
      }
      guessedType = guessedType.replace(/s$/, "");
      guessedType = guessedType[0].toUpperCase() + guessedType.substring(1, guessedType.length);
      if (guessedType === "Datalist") {
        guessedType = "DataList";
      }
      if (guessedType === "FieldDBObject") {
        if (doc.datumFields && doc.session) {
          guessedType = "Datum";
        } else if (doc.datumFields && doc.sessionFields) {
          guessedType = "Corpus";
        } else if (doc.collections === "sessions" && doc.sessionFields) {
          guessedType = "Session";
        } else if (doc.text && doc.username && doc.timestamp && doc.gravatar) {
          guessedType = "Comment";
        }
      }

      this.warn("Guessed type " + doc._id + " is a " + guessedType);
      return guessedType;
    },

  }

});

exports.Document = Document;

},{"./../FieldDBObject":4}],32:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var Document = require("./Document").Document;

/**
 * @class Collection of CouchDB docs

 * @name  DocumentCollection
 * @description The DocumentCollection is a minimal customization of the Collection
 * to add an internal model of Document and prevent the primary key from being sanitized
 *
 * @extends Collection
 * @constructs
 */
var DocumentCollection = function DocumentCollection(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "DocumentCollection";
  }
  this.debug("Constructing DocumentCollection ", options);
  Collection.apply(this, arguments);
};

DocumentCollection.prototype = Object.create(Collection.prototype, /** @lends DocumentCollection.prototype */ {
  constructor: {
    value: DocumentCollection
  },

  primaryKey: {
    value: "id"
  },

  INTERNAL_MODELS: {
    value: {
      item: Document
    }
  },

  sanitizeStringForPrimaryKey: {
    value: function(value) {
      return value;
    }
  }

});
exports.DocumentCollection = DocumentCollection;

},{"./../Collection":2,"./Document":31}],33:[function(require,module,exports){
var Stimulus = require("./Stimulus").Stimulus,
  Q = require("q");

/**
 * @class The Response is a minimal customization of a Stimulus which allows the user to add additional information
 *  which can be used for experiments.
 *
 * @name  Response
 * @extends Stimulus
 * @constructs
 */
var Response = function Response(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Response";
  }
  this.debug("Constructing Response ", options);
  Stimulus.apply(this, arguments);
};

Response.prototype = Object.create(Stimulus.prototype, /** @lends Response.prototype */ {
  constructor: {
    value: Response
  },

  jsonType: {
    get: function() {
      return this.fieldDBtype;
    }
  },

  collection: {
    get: function() {
      return this.fieldDBtype;
    }
  },

  // responses: {
  //   value: null,
  //   configurable: true
  // },

  pauseAudioWhenConfirmingResponse: {
    value: null,
    configurable: true

  },

  addResponse: {
    value: function(responseEvent, stimulusId) {
      if (!responseEvent) {
        throw "Cannot add response without the x y information found in the touch/click responseEvent";
      }

      var reactionTimeEnd = Date.now();
      var audioDuration = this.application.audioPlayer.getDuration(this.audioFile) || 0;
      if (audioDuration) {
        audioDuration = audioDuration * 1000;
      } else {
        console.log("The audio has no duration.. This is strange.");
      }
      if (this.pauseAudioWhenConfirmingResponse) {
        this.pauseAudio();
      }

      var self = this;
      var continueToNextStimulus = Q.defer();
      if (this.confirmResponseChoiceMessage) {
        this.contextualizer.currentLocale = this.application.interfaceLocale;
        var confirmChoicePrompt = this.contextualizer.localize(this.confirmResponseChoiceMessage);
        var options = {
          iconSrc: self.ownerComponent.iconSrc,
          message: confirmChoicePrompt
        };
        this.confirm(options.message).then(function() {
          continueToNextStimulus.resolve();
        }, function() {
          continueToNextStimulus.reject(new Error("The x prevented the cancel?"));
        });
      } else {
        continueToNextStimulus.resolve();
      }
      continueToNextStimulus.promise.then(function() {
        // self.ownerComponent.templateObjects.reinforcement.next();
        self.stopAudio();
        self.ownerComponent.nextStimulus();
      }, function(reason) {
        console.log("Not continuing to next stimulus", reason);
        if (this.pauseAudioWhenConfirmingResponse) {
          self.playAudio();
        }
      });
      var choice = "";
      if (stimulusId) {
        choice = this[stimulusId].substring(this[stimulusId].lastIndexOf("/") + 1).replace(/\..+$/, "").replace(/\d+_/, "");
        if (choice === this.target.orthographic) {
          choice = this.target;
        } else {
          this.distractors.map(function(distractor) {
            if (choice === distractor.orthographic) {
              choice = distractor;
            }
          });
        }
      }
      var response = {
        "reactionTimeAudioOffset": reactionTimeEnd - this.reactionTimeStart - audioDuration,
        "reactionTimeAudioOnset": reactionTimeEnd - this.reactionTimeStart,
        "x": responseEvent.x,
        "y": responseEvent.y,
        "pageX": responseEvent.pageX,
        "pageY": responseEvent.pageY,
        // "prime": {
        //  phonemic: this.prime.phonemic,
        //  orthographic: this.prime.orthographic,
        //  imageFile: this.prime.imageFile
        // },
        "choice": choice,
        // "target": this.target,
        "score": this.scoreResponse(this.target, choice)
      };
      this.responses.push(response);
      console.log("Recorded response", JSON.stringify(response));
    }
  },

  addOralResponse: {
    value: function(choice, dontAutoAdvance) {
      var reactionTimeEnd = Date.now();
      var audioDuration = this.application.audioPlayer.getDuration(this.audioFile) || 0;
      if (audioDuration) {
        audioDuration = audioDuration * 1000;
      } else {
        console.log("The audio has no duration.. This is strange.");
      }
      if (this.pauseAudioWhenConfirmingResponse) {
        this.pauseAudio();
      }

      var self = this;
      var continueToNextStimulus = Q.defer();
      if (this.confirmResponseChoiceMessage) {
        this.contextualizer.currentLocale = this.application.interfaceLocale;
        var confirmChoicePrompt = this.contextualizer.localize(this.confirmResponseChoiceMessage);
        var options = {
          iconSrc: self.ownerComponent.iconSrc,
          message: confirmChoicePrompt
        };
        this.confirm(options.message).then(function() {
          continueToNextStimulus.resolve();
        }, function() {
          continueToNextStimulus.reject(new Error("The x prevented the cancel?"));
        });
      } else {
        if (!dontAutoAdvance) {
          continueToNextStimulus.resolve();
        }
      }
      continueToNextStimulus.promise.then(function() {
        // self.ownerComponent.templateObjects.reinforcement.next();
        self.stopAudio();
        self.ownerComponent.nextStimulus();
      }, function(reason) {
        console.log("Not continuing to next stimulus", reason);
        if (this.pauseAudioWhenConfirmingResponse) {
          self.playAudio();
        }
      });

      var response = {
        "reactionTimeAudioOffset": reactionTimeEnd - this.reactionTimeStart - audioDuration,
        "reactionTimeAudioOnset": reactionTimeEnd - this.reactionTimeStart,
        "x": 0,
        "y": 0,
        "pageX": 0,
        "pageY": 0,
        "choice": choice,
        "score": choice.score
      };
      this.responses = this.responses || [];
      this.responses.push(response);
      console.log("Recorded response", JSON.stringify(response));
    }
  },

  scoreResponse: {
    value: function(expectedResponse, actualResponse) {
      if (!actualResponse.orthographic) {
        return "error";
      }
      if (actualResponse.orthographic === expectedResponse.orthographic) {
        return 1;
      } else {
        return 0;
      }
    }
  },

  addNonResponse: {
    value: function(responseEvent) {
      if (!responseEvent) {
        throw "Cannot add response without the x y information found in the touch/click responseEvent";
      }
      var reactionTimeEnd = Date.now();
      var response = {
        "reactionTimeAudioOffset": reactionTimeEnd - this.reactionTimeStart,
        "reactionTimeAudioOnset": reactionTimeEnd - this.reactionTimeStart,
        "x": responseEvent.x,
        "y": responseEvent.y,
        "pageX": responseEvent.pageX,
        "pageY": responseEvent.pageY,
        "chosenVisualStimulus": "none",
        "responseScore": -1
      };
      this.responses = this.responses || [];
      this.nonResponses.push(response);
      console.log("Recorded non-response, the user is confused or not playing the game.", JSON.stringify(response));
    }
  },

  /**
   *  TODO try using a media controller later montage/ui/controller/media-controller
   * @type {Object}
   */
  playAudio: {
    value: function(delay) {
      this.application.audioPlayer.play(this.audioFile, delay);
    }
  },

  pauseAudio: {
    value: function() {
      this.application.audioPlayer.pause(this.audioFile);
    }
  },

  stopAudio: {
    value: function() {
      this.application.audioPlayer.stop(this.audioFile);
    }
  },

  load: {
    value: function(details) {
      for (var d in details) {
        if (details.hasOwnProperty(d)) {
          this[d] = details[d];
        }
      }
      if (this.responses === null) {
        this.responses = [];
      }
      if (this.nonResponses === null) {
        this.nonResponses = [];
      }
      this.nonResponses = [];
      this.experimenterId = this.application.experiment.experimenter.id;
      this.participantId = this.application.experiment.participant.id;
      // Not playing audio by default, child must call it.
      // this.playAudio(2000);
    }
  }

});
exports.Response = Response;

},{"./Stimulus":34,"q":76}],34:[function(require,module,exports){
var Datum = require("./Datum").Datum;

/**
 * @class The Stimulus is a minimal customization of a Datum which allows the user to add additional information
 *  which can be used for experiments.
 *
 * @name  Stimulus
 * @extends Datum
 * @constructs
 */
var Stimulus = function Stimulus(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Stimulus";
  }
  this.debug("Constructing Stimulus ", options);
  Datum.apply(this, arguments);
};

Stimulus.prototype = Object.create(Datum.prototype, /** @lends Stimulus.prototype */ {
  constructor: {
    value: Stimulus
  },

  prime: {
    get: function() {
      // if (this._prime) {
      return this._prime;
      // }
      // return {
      //   "imageFile": "x.png",
      //   "utterance": "χχ",
      //   "orthography": "xx",
      //   "audioFile": "prime.mp3"
      // };
    },
    set: function(value) {
      this._prime = value;
    }
  },

  target: {
    get: function() {
      // if (this._target) {
      return this._target;
      // }
      // return {
      //   "imageFile": "x.png",
      //   "utterance": "χχ",
      //   "orthography": "x",
      //   "audioFile": "target.mp3"
      // };
    },
    set: function(value) {
      this._target = value;
    }
  },

  distractors: {
    get: function() {
      // if (this._distractors) {
      return this._distractors;
      // }
      // return [{
      //   "imageFile": "placeholder.jpg",
      //   "utterance": "ʁχχ",
      //   "orthography": "rxx",
      //   "audioFile": "distractor.mp3"
      // }];
    },
    set: function(value) {
      this._distractors = value;
    }
  },

  layout: {
    get: function() {
      // if (this._layout) {
      return this._layout;
      // }
      // return {
      //   randomize: false,
      //   visualChoiceA: this.target,
      //   visualChoiceB: this.distractors[0]
      // };
    },
    set: function(value) {
      this._layout = value;
    }
  }

});
exports.Stimulus = Stimulus;

},{"./Datum":24}],35:[function(require,module,exports){
if ("undefined" === typeof window) {
  var window = {};
}
(function(exports) {

  /** @lends Export.prototype */
  var Export = {
    /**
     * @class The export class helps export a set of selected data into csv, xml
     *        and LaTex file.
     *
     * @property {Collection} datalist This is the data selected for export.
     * @property {String} dataListName This is the name of the data set which
     *           appears as a filename when exported.
     * @property {Array} fields The fields array contains titles of the fields.
     * @property {Event} event The export event (e.g. click "LatexIt").
     *
     * @description The initialize serves to bind export to e.g. LaTexIt event.
     *
     *
     * @extends Backbone.Model
     * @constructs
     */
    initialize: function() {},

    exportCSV: function() {},

    exportXML: function() {},

    exportLaTex: function() {},

  };


  exports.Export = Export;

})(window || exports)

},{}],36:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};/**
 * FieldDB
 * A open ended database for  evolving data collection projects
 *
 * @module          FieldDB
 * @tutorial        tests/FieldDBTest.js
 * @requires        Export
 * @requires        FieldDBObject
 * @requires        CORS
 * @requires        UserMask
 */
(function(exports) {
  "use strict";
  var App = require("./app/App").App;
  var PsycholinguisticsApp = require("./app/PsycholinguisticsApp").PsycholinguisticsApp;
  var Export = require("./export/Export");
  var FieldDBObject = require("./FieldDBObject").FieldDBObject;
  var Document = require("./datum/Document").Document;
  var CORS = require("./CORS").CORS;
  CORS.bug = FieldDBObject.prototype.bug;
  var DataList = require("./data_list/DataList").DataList;
  var SubExperimentDataList = require("./data_list/SubExperimentDataList").SubExperimentDataList;
  var AudioVideo = require("./audio_video/AudioVideo").AudioVideo;
  var Datum = require("./datum/Datum").Datum;
  var Stimulus = require("./datum/Stimulus").Stimulus;
  var Response = require("./datum/Response").Response;
  var Database = require("./corpus/Database").Database;
  var PsycholinguisticsDatabase = require("./corpus/PsycholinguisticsDatabase").PsycholinguisticsDatabase;
  var FieldDBConnection = require("./FieldDBConnection").FieldDBConnection;
  var Router = require("./Router").Router;
  var User = require("./user/User").User;
  var UserMask = require("./user/UserMask").UserMask;
  var Team = require("./user/Team").Team;
  var Speaker = require("./user/Speaker").Speaker;
  var Consultant = require("./user/Consultant").Consultant;
  var Participant = require("./user/Participant").Participant;
  var Contextualizer = require("./locales/Contextualizer").Contextualizer;
  var Corpus = require("./corpus/Corpus").Corpus;
  var FieldDatabase = require("./corpus/Corpus").FieldDatabase;
  var CorpusMask = require("./corpus/CorpusMask").CorpusMask;
  var Import = require("./import/Import").Import;
  var Search = require("./search/Search").Search;
  var Q = require("q");

  var FieldDB = {};

  FieldDB.App = App;
  FieldDB.PsycholinguisticsApp = PsycholinguisticsApp;
  FieldDB.Export = Export;
  FieldDB.FieldDBObject = FieldDBObject;
  FieldDB.Document = Document;
  FieldDB.CORS = CORS;
  FieldDB.DataList = DataList;
  FieldDB.SubExperimentDataList = SubExperimentDataList;
  FieldDB.AudioVideo = AudioVideo;
  FieldDB.Datum = Datum;
  FieldDB.Stimulus = Stimulus;
  FieldDB.Response = Response;
  FieldDB.Database = Database;
  FieldDB.FieldDatabase = FieldDatabase;
  FieldDB.PsycholinguisticsDatabase = PsycholinguisticsDatabase;
  FieldDB.Router = Router;
  FieldDB.User = User;
  FieldDB.UserMask = UserMask;
  FieldDB.Team = Team;
  FieldDB.Speaker = Speaker;
  FieldDB.Consultant = Consultant;
  FieldDB.Participant = Participant;
  FieldDB.Contextualizer = Contextualizer;
  FieldDB.Corpus = Corpus;
  FieldDB.CorpusMask = CorpusMask;
  FieldDB.Import = Import;
  FieldDB.Search = Search;
  FieldDB.Q = Q;
  FieldDB.FieldDBConnection = FieldDBConnection;

  exports.FieldDB = FieldDB;
  global.FieldDB = FieldDB;

  console.log("------------------------------------------------------------------------");
  console.log("------------------------------------------------------------------------");
  console.log("------------------------------------------------------------------------");
  console.log("                     ___ _     _    _ ___  ___ ");
  console.log("                    | __(_)___| |__| |   \\| _ )");
  console.log("                    | _|| / -_) / _` | |) | _ \\");
  console.log("                    |_| |_\\___|_\\__,_|___/|___/");
  console.log("-----------------------------------------------loaded.------------------");
  console.log("------------------------------------------------------------------------");
  console.log("-----------------------Welcome to the power user console! Type----------");
  console.log("--------------------------FieldDB.--------------------------------------");
  // console.log("------------------",FieldDB);
  // FieldDB["Response"] = Response;
  console.log("---------------------------for available models/functionality-----------");
  console.log("------------------------------------------------------------------------");
  console.log("------------------------------------------------------------------------");
}(typeof exports === "object" && exports || this));

},{"./CORS":1,"./FieldDBConnection":3,"./FieldDBObject":4,"./Router":5,"./app/App":7,"./app/PsycholinguisticsApp":8,"./audio_video/AudioVideo":10,"./corpus/Corpus":16,"./corpus/CorpusMask":17,"./corpus/Database":18,"./corpus/PsycholinguisticsDatabase":19,"./data_list/DataList":22,"./data_list/SubExperimentDataList":23,"./datum/Datum":24,"./datum/Document":31,"./datum/Response":33,"./datum/Stimulus":34,"./export/Export":35,"./import/Import":41,"./locales/Contextualizer":43,"./search/Search":48,"./user/Consultant":51,"./user/Participant":52,"./user/Speaker":53,"./user/Team":54,"./user/User":55,"./user/UserMask":56,"q":76}],37:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class A HotKey is a keyboard shortcut that uses one key (or a
 *        combination thereof) which allows users to execute a command
 *        without using a mouse, a menu, etc.
 *
 * @name  HotKey
 * @extends FieldDBObject
 * @constructs
 */
var HotKey = function HotKey(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "HotKey";
  }
  this.debug("Constructing HotKey", options);
  FieldDBObject.apply(this, arguments);
};

HotKey.prototype = Object.create(FieldDBObject.prototype, /** @lends HotKey.prototype */ {
  constructor: {
    value: HotKey
  },

  defaults: {
    value: {
      firstKey: "",
      secondKey: "",
      functiontocall: function() {},
      description: ""
    }
  },

  keySequence: {
    get: function() {
      var value = this.firstKey + "+" + this.secondKey;
      this.debug("Getting keySequence " + value);
      return value;
    }
  }

});
exports.HotKey = HotKey;

},{"./../FieldDBObject":4}],38:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var HotKey = require("./HotKey").HotKey;

/**
 * @class HotKeys is a set of HotKey. A user will be able to have multiple shortcuts.
 * There will be defaults, but users will also be able to select their own HotKeys.
 *
 * IPA This will allow users to easily switch to type in IPA
 * fullscreen This will expand the view
 * nextDatum This will allow users to skip to the next datum entry field
 * previousDatum This will allow users to go back to the previous datum entry field
 * sync This will allow users to easily sync to the server
 *
 * @name  HotKeys
 *
 * @extends Collection
 * @constructs
 */
var HotKeys = function HotKeys(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "HotKeys";
  }
  if (options && options.firstkey === "" && options.secondKey === "" && options.description === "") {
    options = null;
    this.debug("Upgrading pre v2 hotkeys");
  }
  this.debug("Constructing HotKeys ", options);
  Collection.apply(this, arguments);
};

HotKeys.prototype = Object.create(Collection.prototype, /** @lends HotKeys.prototype */ {
  constructor: {
    value: HotKeys
  },

  primaryKey: {
    value: "keySequence"
  },

  INTERNAL_MODELS: {
    value: {
      item: HotKey
    }
  }

});
exports.HotKeys = HotKeys;

},{"./../Collection":2,"./HotKey":37}],39:[function(require,module,exports){
var AudioVideo = require("./../audio_video/AudioVideo").AudioVideo;

/**
 * @class The Image is a type of AudioVideo with any additional fields or
 * metadata that a team might use to visually ground their data.
 *
 * @name  Image
 * @extends AudioVideo
 * @constructs
 */
var Image = function Image(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Image";
  }
  this.debug("Constructing Image length: ", options);
  AudioVideo.apply(this, arguments);
};

Image.prototype = Object.create(AudioVideo.prototype, /** @lends Image.prototype */ {
  constructor: {
    value: Image
  },

  api: {
    value: "images"
  }

});
exports.Image = Image;

},{"./../audio_video/AudioVideo":10}],40:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var Image = require("./Image").Image;

/**
 * @class Images of Datum validation states
 * @name  Images
 * @description The Images is a minimal customization of the Collection
 * to add an internal model of Image.
 *
 * @extends Collection
 * @constructs
 */
var Images = function Images(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Images";
  }
  this.debug("Constructing Images length: ", options);
  Collection.apply(this, arguments);
};

Images.prototype = Object.create(Collection.prototype, /** @lends Images.prototype */ {
  constructor: {
    value: Images
  },

  primaryKey: {
    value: "URL"
  },

  INTERNAL_MODELS: {
    value: {
      item: Image
    }
  }

});
exports.Images = Images;

},{"./../Collection":2,"./Image":39}],41:[function(require,module,exports){
/* globals OPrime, window, escape, $, FileReader */
var AudioVideo = require("./../FieldDBObject").FieldDBObject;
var AudioVideos = require("./../Collection").Collection;
var Collection = require("./../Collection").Collection;
var CORS = require("./../CORS").CORS;
var Corpus = require("./../corpus/Corpus").Corpus;
var DataList = require("./../FieldDBObject").FieldDBObject;
var Participant = require("./../user/Participant").Participant;
var Datum = require("./../datum/Datum").Datum;
var DatumField = require("./../datum/DatumField").DatumField;
var DatumFields = require("./../datum/DatumFields").DatumFields;
var DataList = require("./../data_list/DataList").DataList;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
// var FileReader = {};
var Session = require("./../FieldDBObject").FieldDBObject;
var TextGrid = require("textgrid").TextGrid;
var X2JS = {};
var Q = require("q");
var _ = require("underscore");

/**
 * @class The import class helps import csv, xml and raw text data into a corpus, or create a new corpus.
 *
 * @property {FileList} files These are the file(s) that were dragged in.
 * @property {String} pouchname This is the corpusid wherej the data should be imported
 * @property {DatumFields} fields The fields array contains titles of the data columns.
 * @property {DataList} datalist The datalist imported, to hold the data before it is saved.
 * @property {Event} event The drag/drop event.
 *
 * @description The initialize serves to bind import to all drag and drop events.
 *
 * @extends FieldDBObject
 * @tutorial tests/CorpusTest.js
 */


var getUnique = function(arrayObj) {
  var u = {},
    a = [];
  for (var i = 0, l = arrayObj.length; i < l; ++i) {
    if (u.hasOwnProperty(arrayObj[i])) {
      continue;
    }
    if (arrayObj[i]) {
      a.push(arrayObj[i]);
      u[arrayObj[i]] = 1;
    }
  }
  return a;
};


var Import = function Import(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Import";
  }
  this.debug(" new import ", options);
  FieldDBObject.apply(this, arguments);
};

Import.prototype = Object.create(FieldDBObject.prototype, /** @lends Import.prototype */ {
  constructor: {
    value: Import
  },

  fillWithDefaults: {
    value: function() {
      if (!this.datumFields) {
        this.datumFields = this.corpus.datumFields.clone();
      }
    }
  },

  defaults: {
    value: {
      status: "",
      fileDetails: "",
      pouchname: "",
      datumArray: [],
      //      rawText: "",
      //      asCSV : "", //leave undefined
      //      asXML : "",
      //      asDatumFields : "";
      files: []
    }
  },

  INTERNAL_MODELS: {
    value: {
      datalist: DataList,
      datumFields: DatumFields,
      session: Session,
      corpus: Corpus
    }
  },

  showImportSecondStep: {
    get: function() {
      return this.asCSV && this.asCSV.length > 0;
    }
  },

  showImportThirdStep: {
    get: function() {
      return this.datalist && this.datalist.docs && this.datalist.docs.length > 0;
    }
  },

  addFileUri: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      if (!options) {
        throw "Options must be specified {}";
      }
      if (!options.uri) {
        throw "Uri must be specified in the options in order to import it" + JSON.stringify(options);
      }

      Q.nextTick(function() {
        self.readUri(options)
          .then(self.preprocess)
          .then(self.import)
          .then(function(result) {
            self.debug("Import is finished");
            if (options && typeof options.next === "function" /* enable use as middleware */ ) {
              options.next();
            }
            // self.debug("result.datum", result.datum);
            self.documentCollection.add(result.datum);
            deferred.resolve(result);
          })
          .fail(function(reason) {
            deferred.reject(reason);
          });

      });

      return deferred.promise;
    }
  },

  readUri: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {
        if (!options) {
          throw "Options must be specified {}";
        }

        var pipeline = function(optionsWithADatum) {
          if (optionsWithADatum.readOptions) {
            optionsWithADatum.readOptions.readFileFunction(function(err, data) {
              if (err) {
                deferred.reject(err);
              } else {
                optionsWithADatum.rawText = data;
                deferred.resolve(optionsWithADatum);
              }
            });
          } else {
            self.debug("TODO reading url in browser");
            CORS.makeCORSRequest({
              type: "GET",
              dataType: "json",
              uri: optionsWithADatum.uri
            }).then(function(data) {
                self.debug(data);
                optionsWithADatum.rawText = data;
                deferred.resolve(optionsWithADatum);
              },
              function(reason) {
                self.debug(reason);
                deferred.reject(reason);
              });
          }
        };

        self.corpus.find(options.uri)
          .then(function(similarData) {
            if (similarData.length === 1) {
              options.datum = similarData[0];
              pipeline(options);
            } else {
              // self.debug("readUri corpus", self);
              self.corpus.newDatum().then(function(datum) {
                options.datum = datum;

                pipeline(options);
              });
            }
          })
          .fail(function(reason) {
            deferred.reject(reason);
          });

      });
      return deferred.promise;

    }
  },
  convertTableIntoDataList: {
    value: function() {
      var self = this,
        deferred = Q.defer();

      Q.nextTick(function() {
        if (!self.progress) {
          self.progress = {
            total: 0,
            completed: 0
          };
        }
        self.progress.total = self.progress.total + 1;
        self.datumArray = [];
        self.consultants = [];
        self.datalist = new DataList({
          title: "Import Data",
          docs: []
        });

        var filename = " typing/copy paste into text area";
        var descript = "This is the data list which results from the import of the text typed/pasted in the import text area.";
        try {
          filename = self.files.map(function(file) {
            return file.name;
          }).join(", ");
          descript = "This is the data list which results from the import of these file(s). " + self.fileDetails;
        } catch (e) {
          //do nothing
        }
        self.render();

        if (self.session !== undefined) {
          self.session.setConsultants(self.consultants);
          /* put metadata in the session goals */
          self.session.goal = self.metadataLines.join("\n") + "\n" + self.session.goal;
          self.render("session");
        }
        self.datalist.description = descript;

        var headers = [];
        if (self.importType === "participants") {
          self.importFields = new DatumFields(self.corpus.participantFields.clone());
        } else {
          self.importFields = new DatumFields(self.corpus.datumFields.clone());
        }
        self.extractedHeader.map(function(item) {
          /* TODO look up the header instead) */
          // self.importFields.debugMode = true;
          var correspondingDatumField = self.importFields.find(self.importFields.primaryKey, item, true);
          if (!correspondingDatumField || correspondingDatumField.length === 0) {
            correspondingDatumField = [new DatumField(DatumField.prototype.defaults)];
            correspondingDatumField[0].id = item;
            if (self.importType === "participants") {
              correspondingDatumField[0].labelExperimenters = item;
            } else {
              correspondingDatumField[0].labelFieldLinguists = item;
            }
            correspondingDatumField[0].help = "This field came from file import";
            var lookAgain = self.importFields.find(correspondingDatumField[0].id);
            if (lookAgain.length) {

            }
          }
          self.debug("correspondingDatumField ", correspondingDatumField);
          if (headers.indexOf(correspondingDatumField) >= 0) {
            self.bug("You seem to have some column labels that are duplicated" +
              " (the same label on two columns). This will result in a strange " +
              "import where only the second of the two will be used in the import. " +
              "Is self really what you want?.");
          }
          headers.push(correspondingDatumField[0]);
          return item;
        });
        /*
         * Convert new datum fields into a category, if types of a category
         */
        var fieldToGeneralize;
        for (var f in headers) {
          if (headers[f].id === "" || headers[f].id === undefined) {
            //do nothing
          } else if (headers[f].id.toLowerCase().indexOf("checkedwith") > -1 || headers[f].id.toLowerCase().indexOf("checkedby") > -1 || headers[f].id.toLowerCase().indexOf("publishedin") > -1) {
            fieldToGeneralize = self.importFields.find("validationStatus");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          } else if (headers[f].id.toLowerCase().indexOf("codepermanent") > -1) {
            fieldToGeneralize = self.importFields.find("anonymouscode");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          } else if (headers[f].id.toLowerCase().indexOf("nsection") > -1) {
            fieldToGeneralize = self.importFields.find("courseNumber");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          } else if (headers[f].id.toLowerCase().indexOf("prenom") > -1) {
            fieldToGeneralize = self.importFields.find("firstname");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          } else if (headers[f].id.toLowerCase().indexOf("nomdefamille") > -1) {
            fieldToGeneralize = self.importFields.find("lastname");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          } else if (headers[f].id.toLowerCase().indexOf("datedenaissance") > -1) {
            fieldToGeneralize = self.importFields.find("dateofbirth");
            if (fieldToGeneralize.length > 0) {
              self.debug("This header matches an existing corpus field. ", fieldToGeneralize);
              fieldToGeneralize[0].labelFieldLinguists = headers[f].labelFieldLinguists;
              fieldToGeneralize[0].labelExperimenters = headers[f].labelExperimenters;
              headers[f] = fieldToGeneralize[0];
            }
          }
        }

        /*
         * Cycle through all the rows in table and create a datum with the matching fields.
         */
        self.documentCollection = new Collection({
          primaryKey: "dateCreated"
        });
        //Import from html table that the user might have edited.
        self.asCSV.map(function(row) {
          var docToSave;
          if (self.importType === "participants") {
            docToSave = new Participant({
              confidential: self.corpus.confidential,
              fields: new DatumFields(JSON.parse(JSON.stringify(headers)))
            });
          } else {
            docToSave = new Datum({
              datumFields: new DatumFields(JSON.parse(JSON.stringify(headers)))
            });

          }
          var testForEmptyness = "";
          for (var index = 0; index < row.length; index++) {
            var item = row[index];
            // var newfieldValue = $(item).html().trim();
            /*
             * the import sometimes inserts &nbsp into the data,
             * often when the csv detection didnt work. This might
             * slow import down significantly. i tested it, it looks
             * like self isnt happening to the data anymore so i
             * turned self off, but if we notice &nbsp in the
             * datagain we can turn it back on . for #855
             */
            //            if(newfieldValue.indexOf("&nbsp;") >= 0 ){
            //              self.bug("It seems like the line contiaining : "+newfieldValue+" : was badly recognized in the table import. You might want to take a look at the table and edit the data so it is in columns that you expected.");
            //            }
            if (self.importType === "participants") {
              docToSave.fields[headers[index].id].value = item.trim();
            } else {
              docToSave.datumFields[headers[index].id].value = item.trim();
            }
            self.debug("new doc", docToSave);

            testForEmptyness += item.trim();
          }
          //if the table row has more than 2 non-white space characters, enter it as data
          if (testForEmptyness.replace(/[ \t\n]/g, "").length >= 2) {
            self.documentCollection.add(docToSave);
          } else {
            //dont add blank datum
            if (self.debugMode) {
              self.debug("Didn't add a blank row:" + testForEmptyness + ": ");
            }
          }
        });

        var savePromises = [];
        self.documentCollection._collection.map(function(builtDoc) {
          if (self.importType === "participants") {
            builtDoc.id = builtDoc.anonymousCode || Date.now();
            builtDoc.url = "https://corpusdev.lingsync.org/" + self.corpus.dbname;
            self.debug(" saving", builtDoc.id);
            self.progress.total++;
            self.datalist.docs.add(builtDoc);

            var promise = builtDoc.save();

            promise.then(function(success) {
              self.debug(success);
              self.progress.completed++;
            }, function(error) {
              self.debug(error);
              self.progress.completed++;
            });
            savePromises.push(promise);
          }
        });

        Q.allSettled(savePromises).then(function(results) {
          self.debug(results);
          deferred.resolve(results);
          self.progress.completed++;
        }, function(results) {
          self.debug(results);
          deferred.resolve(results);
          self.progress.completed++;
        });

        self.discoveredHeaders = headers;
        // return headers;

        //   /*
        //    * after building an array of datumobjects, turn them into backbone objects
        //    */
        //   var eachFileDetails = function(fileDetails) {
        //     var details = JSON.parse(JSON.stringify(fileDetails));
        //     delete details.textgrid;
        //     audioFileDescriptionsKeyedByFilename[fileDetails.fileBaseName + ".mp3"] = details;
        //   };

        //   var forEachRow = function(index, value) {
        //     if (index === "" || index === undefined) {
        //       //do nothing
        //     }
        //     /* TODO removing old tag code for */
        //     //          else if (index === "datumTags") {
        //     //            var tags = value.split(" ");
        //     //            for(g in tags){
        //     //              var t = new DatumTag({
        //     //                "tag" : tags[g]
        //     //              });
        //     //              d.get("datumTags").add(t);
        //     //            }
        //     //          }
        //     /* turn the CheckedWithConsultant and ToBeCheckedWithConsultantinto columns into a status, with that string as the person */
        //     else if (index.toLowerCase().indexOf("checkedwithconsultant") > -1) {
        //       var consultants = [];
        //       if (value.indexOf(",") > -1) {
        //         consultants = value.split(",");
        //       } else if (value.indexOf(";") > -1) {
        //         consultants = value.split(";");
        //       } else {
        //         consultants = value.split(" ");
        //       }
        //       var validationStati = [];
        //       for (var g in consultants) {
        //         var consultantusername = consultants[g].toLowerCase();
        //         self.consultants.push(consultantusername);
        //         if (!consultantusername) {
        //           continue;
        //         }
        //         var validationType = "CheckedWith";
        //         var validationColor = "success";
        //         if (index.toLowerCase().indexOf("ToBeChecked") > -1) {
        //           validationType = "ToBeCheckedWith";
        //           validationColor = "warning";
        //         }

        //         var validationString = validationType + consultants[g].replace(/[- _.]/g, "");
        //         validationStati.push(validationString);
        //         var n = fields.where({
        //           label: "validationStatus"
        //         })[0];
        //         /* add to any exisitng validation states */
        //         var validationStatus = n.get("mask") || "";
        //         validationStatus = validationStatus + " ";
        //         validationStatus = validationStatus + validationStati.join(" ");
        //         var uniqueStati = _.unique(validationStatus.trim().split(" "));
        //         n.set("mask", uniqueStati.join(" "));

        //         //              ROUGH DRAFT of adding CONSULTANTS logic TODO do self in the angular app, dont bother with the backbone app
        //         //              /* get the initials from the data */
        //         //              var consultantCode = consultants[g].replace(/[a-z -]/g,"");
        //         //              if(consultantusername.length === 2){
        //         //                consultantCode = consultantusername;
        //         //              }
        //         //              if(consultantCode.length < 2){
        //         //                consultantCode = consultantCode+"C";
        //         //              }
        //         //              var c = new Consultant("username", consultantCode);
        //         //              /* use the value in the cell for the checked with state, but don't keep the spaces */
        //         //              var validationType = "CheckedWith";
        //         //              if(index.toLowerCase().indexOf("ToBeChecked") > -1){
        //         //                validationType = "ToBeCheckedWith";
        //         //              }
        //         //              /*
        //         //               * This function uses the consultant code to create a new validation status
        //         //               */
        //         //              var onceWeGetTheConsultant = function(){
        //         //                var validationString = validationType+consultants[g].replace(/ /g,"");
        //         //                validationStati.push(validationString);
        //         //                var n = fields.where({label: "validationStatus"})[0];
        //         //                if(n !== undefined){
        //         //                  /* add to any exisitng validation states */
        //         //                  var validationStatus = n.get("mask") || "";
        //         //                  validationStatus = validationStatus + " ";
        //         //                  validationStatus = validationStatus + validationStati.join(" ");
        //         //                  var uniqueStati = _.unique(validationStatus.trim().split(" "));
        //         //                  n.set("mask", uniqueStati.join(" "));
        //         //                }
        //         //              };
        //         //              /*
        //         //               * This function creates a consultant code and then calls
        //         //               * onceWeGetTheConsultant to create a new validation status
        //         //               */
        //         //              var callIfItsANewConsultant = function(){
        //         //                var dialect =  "";
        //         //                var language =  "";
        //         //                try{
        //         //                  dialect = fields.where({label: "dialect"})[0] || "";
        //         //                  language = fields.where({label: "language"})[0] || "";
        //         //                }catch(e){
        //         //                  self.debug("Couldn't get self consultant's dialect or language");
        //         //                }
        //         //                c = new Consultant({filledWithDefaults: true});
        //         //                c.set("username", Date.now());
        //         //                if(dialect)
        //         //                  c.set("dialect", dialect);
        //         //                if(dialect)
        //         //                  c.set("language", language);
        //         //
        //         //                onceWeGetTheConsultant();
        //         //              };
        //         //              c.fetch({
        //         //                success : function(model, response, options) {
        //         //                  onceWeGetTheConsultant();
        //         //                },
        //         //                error : function(model, xhr, options) {
        //         //                  callIfItsANewConsultant();
        //         //                }
        //         //              });


        //       }
        //     } else if (index === "validationStatus") {
        //       var eachValidationStatus = fields.where({
        //         label: index
        //       })[0];
        //       if (eachValidationStatus !== undefined) {
        //         /* add to any exisitng validation states */
        //         var selfValidationStatus = eachValidationStatus.get("mask") || "";
        //         selfValidationStatus = selfValidationStatus + " ";
        //         selfValidationStatus = selfValidationStatus + value;
        //         var selfUniqueStati = _.unique(selfValidationStatus.trim().split(" "));
        //         eachValidationStatus.set("mask", selfUniqueStati.join(" "));
        //       }
        //     } else if (index === "audioFileName") {
        //       if (!audioVideo) {
        //         audioVideo = new AudioVideo();
        //       }
        //       audioVideo.set("filename", value);
        //       audioVideo.set("orginalFilename", audioFileDescriptionsKeyedByFilename[value] ? audioFileDescriptionsKeyedByFilename[value].name : "");
        //       audioVideo.set("URL", self.audioUrl + "/" + window.app.get("corpus").pouchname + "/" + value);
        //       audioVideo.set("description", audioFileDescriptionsKeyedByFilename[value] ? audioFileDescriptionsKeyedByFilename[value].description : "");
        //       audioVideo.set("details", audioFileDescriptionsKeyedByFilename[value]);
        //     } else if (index === "startTime") {
        //       if (!audioVideo) {
        //         audioVideo = new AudioVideo();
        //       }
        //       audioVideo.set("startTime", value);
        //     } else if (index === "endTime") {
        //       if (!audioVideo) {
        //         audioVideo = new AudioVideo();
        //       }
        //       audioVideo.set("endTime", value);
        //     } else {
        //       var knownlowercasefields = "utterance,gloss,morphemes,translation".split();
        //       if (knownlowercasefields.indexOf(index.toLowerCase()) > -1) {
        //         index = index.toLowerCase();
        //       }
        //       var igtField = fields.where({
        //         label: index
        //       })[0];
        //       if (igtField !== undefined) {
        //         igtField.set("mask", value);
        //       }
        //     }
        //   };
        //   for (var a in array) {
        //     var d = new Datum({
        //       filledWithDefaults: true,
        //       pouchname: self.dbname
        //     });
        //     //copy the corpus"s datum fields and empty them.
        //     var datumfields = self.importFields.clone();
        //     for (var x in datumfields) {
        //       datumfields[x].mask = "";
        //       datumfields[x].value = "";
        //     }
        //     var fields = new DatumFields(datumfields);
        //     var audioVideo = null;
        //     var audioFileDescriptionsKeyedByFilename = {};
        //     if (self.files && self.files.map) {
        //       self.files.map(eachFileDetails);
        //     }

        //     $.each(array[a], forEachRow);
        //     d.set("datumFields", fields);
        //     if (audioVideo) {
        //       d.audioVideo.add(audioVideo);
        //       if (self.debugMode) {
        //         self.debug(JSON.stringify(audioVideo.toJSON()) + JSON.stringify(fields.toJSON()));
        //       }
        //     }
        //     // var states = window.app.get("corpus").get("datumStates").clone();
        //     // d.set("datumStates", states);
        //     d.set("session", self.get("session"));
        //     //these are temp datums, dont save them until the user saves the data list
        //     self.importPaginatedDataListDatumsView.collection.add(d);
        //     //        self.dataListView.model.get("datumIds").push(d.id); the datum has no id, cannot put in datumIds
        //     d.lookForSimilarDatum();
        //     self.get("datumArray").push(d);
        //   }
        //   self.set("consultants", _.unique(self.consultants).join(","));
        //   self.importPaginatedDataListDatumsView.renderUpdatedPaginationControl();

        //   $(".approve-save").removeAttr("disabled");
        //   $(".approve-save").removeClass("disabled");

      });
      return deferred.promise;
    }
  },
  // savedcount : 0,
  // savedindex : [],
  // savefailedcount : 0,
  // savefailedindex : [],
  // nextsavedatum : 0,

  preprocess: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      this.verbose("In the preprocess", this);
      Q.nextTick(function() {
        self.debug("Preprocessing  ");
        try {

          var failFunction = function(reason) {
            if (options && typeof options.next === "function" /* enable use as middleware */ ) {
              options.next();
            }
            deferred.reject(reason);
          };

          var successFunction = function(optionsWithResults) {
            self.debug("Preprocesing success");
            if (optionsWithResults && typeof optionsWithResults.next === "function" /* enable use as middleware */ ) {
              optionsWithResults.next();
            }
            deferred.resolve(optionsWithResults);
          };

          options.datum.datumFields.orthography.value = options.rawText;
          options.datum.datumFields.utterance.value = options.rawText;
          options.datum.id = options.uri;

          self.debug("running write for preprocessed");
          if (options.preprocessOptions && options.preprocessOptions.writePreprocessedFileFunction) {
            options.preprocessedUrl = options.uri.substring(0, options.uri.lastIndexOf(".")) + "_preprocessed.json";
            var preprocessResult = JSON.stringify(options.datum.toJSON(), null, 2);
            deferred.resolve(options);

            options.preprocessOptions.writePreprocessedFileFunction(options.preprocessedUrl,
              preprocessResult,
              function(err, data) {
                self.debug("Wrote " + options.preprocessedUrl, data);
                if (err) {
                  failFunction(err);
                } else {
                  successFunction(options);
                }
              });
          } else {
            successFunction(options);
          }


        } catch (e) {
          deferred.reject(e);
        }
      });
      return deferred.promise;
    }
  },

  /**
   * Executes the final import if the options indicate that it should be executed, by default it only produces a dry run.
   *
   * @type {Object}
   */
  import: {
    value: function(options) {
      var deferred = Q.defer();
      this.todo("TODO in the import");

      Q.nextTick(function() {
        if (options && typeof options.next === "function" /* enable use as middleware */ ) {
          options.next();
        }
        deferred.resolve(options);
      });
      return deferred.promise;
    }
  },

  /**
   * Holds meta data about the imported data list and references to the datum ids
   *
   * @type {Object}
   */
  datalist: {
    get: function() {
      return this._datalist || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      if (value === this._datalist) {
        return;
      }
      this._datalist = value;
    }
  },

  /**
   * Holds the datum objects themselves while the import is in process
   *
   * @type {Object}
   */
  documentCollection: {
    get: function() {
      this.debug("Getting Datum collection");
      if (!this._documentCollection) {
        this._documentCollection = new Collection({
          inverted: false,
          key: "_id"
        });
      }
      this.debug("Returning a collection");
      return this._documentCollection;
    },
    set: function(value) {
      if (value === this._documentCollection) {
        return;
      }
      this._documentCollection = value;
    }
  },

  /**
   * Saves the import's state to file to be resumed or reviewed later
   *
   * @type {Object}
   */
  pause: {
    value: function(options) {

      if (options && typeof options.next === "function" /* enable use as middleware */ ) {
        options.next();
      }
      return this;
    }
  },

  /**
   * Resumes a previous import from a json object, or a uri containing json
   *
   * @type {Object}
   */
  resume: {
    value: function(options) {

      if (options && typeof options.next === "function" /* enable use as middleware */ ) {
        options.next();
      }
      return this;
    }
  },

  id: {
    get: function() {
      return this.datalist.id;
    },
    set: function(value) {
      return this.datalist.id = value;
    }
  },

  url: {
    value: "/datalists"
  },

  corpus: {
    get: function() {
      if (!this._corpus) {
        // throw "Import\"s corpus is undefined";
        // this.warn("Import\"s corpus is undefined");
        return;
      }
      return this._corpus;
    },
    set: function(value) {
      if (value === this._corpus) {
        return;
      }
      this._corpus = value;
    }
  },

  /**
   * This function tries to guess if you have \n or \r as line endings
   * and then tries to determine if you have "surounding your text".
   *
   * CSV is a common export format for Filemaker, Microsoft Excel and
   * OpenOffice Spreadsheets, and could be a good format to export
   * from these sources and import into FieldDB.
   *
   * @param text to be imported
   */
  importCSV: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      var rows = text.split("\n");
      if (rows.length < 3) {
        rows = text.split("\r");
        this.status = this.status + " Detected a \r line ending.";
      }
      var firstrow = rows[0];
      var hasQuotes = false;
      //If it looks like it already has quotes:
      if (rows[0].split("", "").length > 2 && rows[5].split("", "").length > 2) {
        hasQuotes = true;
        this.status = this.status + " Detected text was already surrounded in quotes.";
      }
      for (var l in rows) {
        if (hasQuotes) {
          rows[l] = rows[l].trim().replace(/^"/, "").replace(/"$/, "").split("", "");
          //          var withoutQuotes = [];
          //          _.each(rows[l],function(d){
          //            withoutQuotes.push(d.replace(/"/g,""));
          //          });
          //          rows[l] = withoutQuotes;
        } else {
          rows[l] = this.parseLineCSV(rows[l]);
          /* This was a fix for alan's data but it breaks other data. */
          //          var rowWithoutQuotes = rows[l].replace(/"/g,"");
          //          rows[l] = this.parseLineCSV(rowWithoutQuotes);
        }
      }
      /* get the first line and set it to be the header by default */
      var header = [];
      if (rows.length > 3) {
        firstrow = firstrow;
        if (hasQuotes) {
          header = firstrow.trim().replace(/^"/, "").replace(/"$/, "").split("", "");
        } else {
          header = this.parseLineCSV(firstrow);
        }
      }
      this.extractedHeader = header;

      this.asCSV = rows;
      if (typeof callback === "function") {
        callback();
      }
    }
  },


  /**
   * http://purbayubudi.wordpress.com/2008/11/09/csv-parser-using-javascript/
   * -- CSV PARSER --
   * author  : Purbayu, 30Sep2008
   * email   : purbayubudi@gmail.com
   *
   * description :
   *  This jscript code describes how to load csv file and parse it into fields.
   *  Additionally, a function to display html table as result is added.
   *
   * disclamer:
   *  To use this code freely, you must put author's name in it.
   */
  parseLineCSV: {
    value: function(lineCSV) {
      // parse csv line by line into array
      var CSV = [];

      // Insert space before character ",". This is to anticipate
      // "split" in IE
      // try this:
      //
      // var a=",,,a,,b,,c,,,,d";
      // a=a.split(/\,/g);
      // document.write(a.length);
      //
      // You will see unexpected result!
      //
      lineCSV = lineCSV.replace(/,/g, " ,");

      lineCSV = lineCSV.split(/,/g);

      // This is continuing of "split" issue in IE
      // remove all trailing space in each field
      var i,
        j;
      for (i = 0; i < lineCSV.length; i++) {
        lineCSV[i] = lineCSV[i].replace(/\s*$/g, "");
      }

      lineCSV[lineCSV.length - 1] = lineCSV[lineCSV.length - 1]
        .replace(/^\s*|\s*$/g, "");
      var fstart = -1;

      for (i = 0; i < lineCSV.length; i++) {
        if (lineCSV[i].match(/"$/)) {
          if (fstart >= 0) {
            for (j = fstart + 1; j <= i; j++) {
              lineCSV[fstart] = lineCSV[fstart] + "," + lineCSV[j];
              lineCSV[j] = "-DELETED-";
            }
            fstart = -1;
          }
        }
        fstart = (lineCSV[i].match(/^"/)) ? i : fstart;
      }

      j = 0;

      for (i = 0; i < lineCSV.length; i++) {
        if (lineCSV[i] !== "-DELETED-") {
          CSV[j] = lineCSV[i];
          CSV[j] = CSV[j].replace(/^\s*|\s*$/g, ""); // remove leading & trailing
          // space
          CSV[j] = CSV[j].replace(/^"|"$/g, ""); // remove " on the beginning
          // and end
          CSV[j] = CSV[j].replace(/""/g, "\""); // replace "" with "
          j++;
        }
      }
      return CSV;
    }
  },
  importXML: {
    value: function() {
      throw "The app thinks this might be a XML file, but we haven't implemented this kind of import yet. You can vote for it in our bug tracker.";
    }
  },
  importElanXML: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      this.todo("import xml parsers to turn xml import back on");
      if (true) {
        return;
      }
      //alert("The app thinks this might be a XML file, but we haven't implemented this kind of import yet. You can vote for it in our bug tracker.");
      var xmlParser = new X2JS();
      window.text = text;
      var jsonObj = xmlParser.xml_str2json(text);

      this.debug(jsonObj);

      //add the header to the session
      //    HEADER can be put in the session and in the datalist
      var annotationDetails = JSON.stringify(jsonObj.ANNOTATION_DOCUMENT.HEADER).replace(/,/g, "\n").replace(/[\[\]{}]/g, "").replace(/:/g, " : ").replace(/"/g, "").replace(/\n/g, "").replace(/file : /g, "file:").replace(/ : \//g, ":/").trim();
      //TODO turn these into session fields
      this.status = this.status + "\n" + annotationDetails;


      var header = [];
      var tierinfo = [];
      //    TIER has tiers of each, create datum  it says who the informant is and who the data entry person is. can turn the objects in the tier into a datum
      //for tier, add rows containing
      //    _ANNOTATOR
      tierinfo.push("_ANNOTATOR");
      //    _DEFAULT_LOCALE
      tierinfo.push("_DEFAULT_LOCALE");
      //    _LINGUISTIC_TYPE_REF
      tierinfo.push("_LINGUISTIC_TYPE_REF");
      //    _PARTICIPANT
      tierinfo.push("_PARTICIPANT");
      //    _TIER_ID
      tierinfo.push("_TIER_ID");
      //    __cnt
      tierinfo.push("__cnt");

      var annotationinfo = [];
      //    ANNOTATION.ALIGNABLE_ANNOTATION.ANNOTATION_VALUE.__cnt
      //      annotationinfo.push({"FieldDBDatumFieldName" : "ANNOTATION.ALIGNABLE_ANNOTATION.ANNOTATION_VALUE", "elanALIGNABLE_ANNOTATION": "ANNOTATION_VALUE"});
      //    ANNOTATION.ALIGNABLE_ANNOTATION._ANNOTATION_ID
      annotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.ALIGNABLE_ANNOTATION._ANNOTATION_ID",
        "elanALIGNABLE_ANNOTATION": "_ANNOTATION_ID"
      });
      //    ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF1
      annotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF1",
        "elanALIGNABLE_ANNOTATION": "_TIME_SLOT_REF1"
      });
      //    ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF2
      annotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF2",
        "elanALIGNABLE_ANNOTATION": "_TIME_SLOT_REF2"
      });
      //
      var refannotationinfo = [];
      //    ANNOTATION.REF_ANNOTATION.ANNOTATION_VALUE
      refannotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.REF_ANNOTATION.ANNOTATION_VALUE",
        "elanREF_ANNOTATION": "ANNOTATION_VALUE"
      });
      //    ANNOTATION.REF_ANNOTATION._ANNOTATION_ID
      refannotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.REF_ANNOTATION._ANNOTATION_ID",
        "elanREF_ANNOTATION": "_ANNOTATION_ID"
      });
      //    ANNOTATION.REF_ANNOTATION._ANNOTATION_REF
      refannotationinfo.push({
        "FieldDBDatumFieldName": "ANNOTATION.REF_ANNOTATION._ANNOTATION_REF",
        "elanREF_ANNOTATION": "_ANNOTATION_REF"
      });


      header.push("_ANNOTATOR");
      header.push("_DEFAULT_LOCALE");
      header.push("_LINGUISTIC_TYPE_REF");
      header.push("_PARTICIPANT");
      header.push("_TIER_ID");
      header.push("__cnt");

      header.push("ANNOTATION.ALIGNABLE_ANNOTATION.ANNOTATION_VALUE");

      header.push("ANNOTATION.ALIGNABLE_ANNOTATION._ANNOTATION_ID");
      header.push("ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF1");
      header.push("ANNOTATION.ALIGNABLE_ANNOTATION._TIME_SLOT_REF2");

      header.push("ANNOTATION.REF_ANNOTATION.ANNOTATION_VALUE");
      header.push("ANNOTATION.REF_ANNOTATION._ANNOTATION_ID");
      header.push("ANNOTATION.REF_ANNOTATION._ANNOTATION_REF");


      //similar to toolbox
      var matrix = [];
      var TIER = jsonObj.ANNOTATION_DOCUMENT.TIER;

      var l,
        annotation,
        cell;
      //there are normally 8ish tiers, with different participants
      for (l in TIER) {
        //in those tiers are various amounts of annotations per participant
        for (annotation in TIER[l].ANNOTATION) {
          matrix[annotation] = [];

          for (cell in tierinfo) {
            matrix[annotation][tierinfo[cell]] = jsonObj.ANNOTATION_DOCUMENT.TIER[l][tierinfo[cell]];
          }

          try {
            matrix[annotation]["ANNOTATION.ALIGNABLE_ANNOTATION.ANNOTATION_VALUE.__cnt"] = TIER[l].ANNOTATION[annotation].ALIGNABLE_ANNOTATION.ANNOTATION_VALUE.__cnt;
            for (cell in annotationinfo) {
              matrix[annotation][annotationinfo[cell].FieldDBDatumFieldName] = TIER[l].ANNOTATION[annotation].ALIGNABLE_ANNOTATION[annotationinfo[cell].elanALIGNABLE_ANNOTATION];
            }
          } catch (e) {
            this.debug("TIER " + l + " doesnt seem to have a ALIGNABLE_ANNOTATION object. We don't really knwo waht the elan file format is, or why some lines ahve ALIGNABLE_ANNOTATION and some dont. So we are just skipping them for this datum.");
          }

          try {
            for (cell in refannotationinfo) {
              matrix[annotation][refannotationinfo[cell].FieldDBDatumFieldName] = TIER[l].ANNOTATION[annotation].REF_ANNOTATION[refannotationinfo[cell].elanREF_ANNOTATION];
            }
          } catch (e) {
            this.debug("TIER " + l + " doesnt seem to have a REF_ANNOTATION object. We don't really knwo waht the elan file format is, or why some lines ahve REF_ANNOTATION and some dont. So we are just skipping them for this datum.");
          }

        }
      }
      var rows = [];
      for (var d in matrix) {
        var cells = [];
        //loop through all the column headings, find the data for that header and put it into a row of cells
        for (var h in header) {
          cell = matrix[d][header[h]];
          if (cell) {
            cells.push(cell);
          } else {
            //fill the cell with a blank if that datum didn't have a header
            cells.push("");
          }
        }
        rows.push(cells);
      }
      if (rows === []) {
        rows.push("");
      }
      this.extractedHeader = header;
      this.asCSV = rows;
      if (typeof callback === "function") {
        callback();
      }
    }
  },
  /**
   * This function accepts text which uses \t tabs between columns. If
   * you have your data in ELAN or in Microsoft Excel or OpenOffice
   * spreadsheets, this will most likely be a good format to export
   * your data, and import into FieldDB. This function is triggered if
   * your file has more than 100 tabs in it, FieldDB guesses that it
   * should try this function.
   *
   * @param text to be imported
   */
  importTabbed: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      var rows = text.split("\n"),
        l;
      if (rows.length < 3) {
        rows = text.split("\r");
        this.status = this.status + " Detected a \n line ending.";
      }
      for (l in rows) {
        rows[l] = rows[l].split("\t");
      }

      this.asCSV = rows;
      if (typeof callback === "function") {
        callback();
      }
    }
  },

  metadataLines: [],

  /**
   * This function takes in a text block, splits it on lines and then
   * takes the first word with a \firstword as the data type/column
   * heading and then walks through the file looking for lines that
   * start with \ge and creates a new datum each time it finds \ge
   * This works for verb lexicons but would be \ref if an interlinear
   * gloss. TODO figure out how Toolbox knows when one data entry
   * stops and another starts. It doesn't appear to be double spaces...
   *
   * @param text
   * @param callback
   */
  importToolbox: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      var lines = text.split("\n");
      var macLineEndings = false;
      if (lines.length < 3) {
        lines = text.split("\r");
        macLineEndings = true;
        this.status = this.status + " Detected a \r line ending.";
      }

      var matrix = [];
      var currentDatum = -1;
      var header = [];
      var columnhead = "";

      var firstToolboxField = "";

      /* Looks for the first line of the toolbox data */
      while (!firstToolboxField && lines.length > 0) {
        var potentialToolBoxFieldMatches = lines[0].match(/^\\[a-zA-Z]+\b/);
        if (potentialToolBoxFieldMatches && potentialToolBoxFieldMatches.length > 0) {
          firstToolboxField = potentialToolBoxFieldMatches[0];
        } else {
          /* remove the line, and put it into the metadata lines */
          this.metadataLines.push(lines.shift());
        }
      }

      for (var l in lines) {
        //Its a new row
        if (lines[l].indexOf(firstToolboxField) === 0) {
          currentDatum += 1;
          matrix[currentDatum] = {};
          matrix[currentDatum][firstToolboxField.replace(/\\/g, "")] = lines[l].replace(firstToolboxField, "").trim();
          header.push(firstToolboxField.replace(/\\/g, ""));
        } else {
          if (currentDatum >= 0) {
            //If the line starts with \ its a column
            if (lines[l].match(/^\\/)) {
              var pieces = lines[l].split(/ +/);
              columnhead = pieces[0].replace("\\", "");
              matrix[currentDatum][columnhead] = lines[l].replace(pieces[0], "");
              header.push(columnhead);
            } else {
              //add it to the current column head in the current datum, its just another line.
              if (lines[1].trim() !== "") {
                matrix[currentDatum][columnhead] += lines[l];
              }
            }
          }
        }
      }
      //only keep the unique headers
      header = getUnique(header);
      var rows = [];
      for (var d in matrix) {
        var cells = [];
        //loop through all the column headings, find the data for that header and put it into a row of cells
        for (var h in header) {
          var cell = matrix[d][header[h]];
          if (cell) {
            cells.push(cell);
          } else {
            //fill the cell with a blank if that datum didn't have a header
            cells.push("");
          }
        }
        rows.push(cells);
      }
      if (rows === []) {
        rows.push("");
      }
      this.extractedHeader = header;
      this.asCSV = rows;
      if (typeof callback === "function") {
        callback();
      }
    }
  },


  downloadTextGrid: {
    value: function(fileDetails) {
      var self = this;
      var textridUrl = OPrime.audioUrl + "/" + this.pouchname + "/" + fileDetails.fileBaseName + ".TextGrid";
      $.ajax({
        url: textridUrl,
        type: "get",
        // dataType: "text",
        success: function(results) {
          if (results) {
            fileDetails.textgrid = results;
            var syllables = "unknown";
            if (fileDetails.syllablesAndUtterances && fileDetails.syllablesAndUtterances.syllableCount) {
              syllables = fileDetails.syllablesAndUtterances.syllableCount;
            }
            var pauses = "unknown";
            if (fileDetails.syllablesAndUtterances && fileDetails.syllablesAndUtterances.pauseCount) {
              pauses = parseInt(fileDetails.syllablesAndUtterances.pauseCount, 10);
            }
            var utteranceCount = 1;
            if (pauses > 0) {
              utteranceCount = pauses + 2;
            }
            var message = " Downloaded Praat TextGrid which contained a count of roughly " + syllables + " syllables and auto detected utterances for " + fileDetails.fileBaseName + " The utterances were not automatically transcribed for you, you can either save the textgrid and transcribe them using Praat, or continue to import them and transcribe them after.";
            fileDetails.description = message;
            self.status = self.status + "<br/>" + message;
            self.fileDetails = self.status + message;
            window.appView.toastUser(message, "alert-info", "Import:");
            self.rawText = self.rawText.trim() + "\n\n\nFile name = " + fileDetails.fileBaseName + ".mp3\n" + results;
            self.importTextGrid(self.rawText, null);
          } else {
            self.debug(results);
            fileDetails.textgrid = "Error result was empty. " + results;
          }
        },
        error: function(response) {
          var reason = {};
          if (response && response.responseJSON) {
            reason = response.responseJSON;
          } else {
            var message = "Error contacting the server. ";
            if (response.status >= 500) {
              message = message + " Please report this error to us at support@lingsync.org ";
            } else {
              message = message + " Are you offline? If you are online and you still recieve this error, please report it to us: ";
            }
            reason = {
              status: response.status,
              userFriendlyErrors: [message + response.status]
            };
          }
          self.debug(reason);
          if (reason && reason.userFriendlyErrors) {
            self.status = fileDetails.fileBaseName + "import error: " + reason.userFriendlyErrors.join(" ");
            window.appView.toastUser(reason.userFriendlyErrors.join(" "), "alert-danger", "Import:");
          }
        }
      });
    }
  },

  addAudioVideoFile: {
    value: function(url) {
      if (!this.audioVideo) {
        this.audioVideo = new AudioVideos();
      }
      this.audioVideo.add(new AudioVideo({
        filename: url.substring(url.lastIndexOf("/") + 1),
        URL: url,
        description: "File from import"
      }));
    }
  },

  importTextGrid: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      // alert("The app thinks this might be a Praat TextGrid file, but we haven't implemented this kind of import yet. You can vote for it in our bug tracker.");
      var textgrid = TextGrid.textgridToIGT(text);
      var audioFileName = "copypastedtextgrid_unknownaudio";
      if (this.files && this.files[0] && this.files[0].name) {
        audioFileName = this.files[0].name;
      }
      audioFileName = audioFileName.replace(/\.textgrid/i, "");
      if (!textgrid || !textgrid.intervalsByXmin) {
        if (typeof callback === "function") {
          callback();
        }
      }
      var matrix = [],
        h,
        itemIndex,
        intervalIndex,
        row,
        interval;
      var header = [];
      var consultants = [];
      if (textgrid.isIGTNestedOrAlignedOrBySpeaker.probablyAligned) {
        for (itemIndex in textgrid.intervalsByXmin) {
          if (!textgrid.intervalsByXmin.hasOwnProperty(itemIndex)) {
            continue;
          }
          if (textgrid.intervalsByXmin[itemIndex]) {
            row = {};
            for (intervalIndex = 0; intervalIndex < textgrid.intervalsByXmin[itemIndex].length; intervalIndex++) {
              interval = textgrid.intervalsByXmin[itemIndex][intervalIndex];
              row.startTime = row.startTime ? row.startTime : interval.xmin;
              row.endTime = row.endTime ? row.endTime : interval.xmax;
              row.utterance = row.utterance ? row.utterance : interval.text.trim();
              row.modality = "spoken";
              row.tier = interval.tierName;
              row.speakers = interval.speaker;
              row.audioFileName = interval.fileName || audioFileName;
              row.CheckedWithConsultant = interval.speaker;
              consultants.push(row.speakers);
              row[interval.tierName] = interval.text;
              header.push(interval.tierName);
            }
            matrix.push(row);
          }
        }
      } else {
        for (itemIndex in textgrid.intervalsByXmin) {
          if (!textgrid.intervalsByXmin.hasOwnProperty(itemIndex)) {
            continue;
          }
          if (textgrid.intervalsByXmin[itemIndex]) {
            for (intervalIndex = 0; intervalIndex < textgrid.intervalsByXmin[itemIndex].length; intervalIndex++) {
              row = {};
              interval = textgrid.intervalsByXmin[itemIndex][intervalIndex];
              row.startTime = row.startTime ? row.startTime : interval.xmin;
              row.endTime = row.endTime ? row.endTime : interval.xmax;
              row.utterance = row.utterance ? row.utterance : interval.text.trim();
              row.modality = "spoken";
              row.tier = interval.tierName;
              row.speakers = interval.speaker;
              row.audioFileName = interval.fileName || audioFileName;
              row.CheckedWithConsultant = interval.speaker;
              consultants.push(row.speakers);
              row[interval.tierName] = interval.text;
              header.push(interval.tierName);
              matrix.push(row);
            }
          }
        }
      }
      header = getUnique(header);
      consultants = getUnique(consultants);
      if (consultants.length > 0) {
        this.consultants = consultants.join(",");
      } else {
        this.consultants = "Unknown";
      }
      header = header.concat(["utterance", "tier", "speakers", "CheckedWithConsultant", "startTime", "endTime", "modality", "audioFileName"]);
      var rows = [];
      for (var d in matrix) {
        var cells = [];
        //loop through all the column headings, find the data for that header and put it into a row of cells
        for (h in header) {
          var cell = matrix[d][header[h]];
          if (cell) {
            cells.push(cell);
          } else {
            //fill the cell with a blank if that datum didn't have a that column
            cells.push("");
          }
        }
        //if the datum has any text, add it to the table
        if (cells.length >= 8 && cells.slice(0, cells.length - 8).join("").replace(/[0-9.]/g, "").length > 0 && cells[cells.length - 8] !== "silent") {
          // cells.push(audioFileName);
          rows.push(cells);
        } else {
          this.debug("This row has only the default columns, not text or anything interesting.", cells);
        }
      }
      if (rows === []) {
        rows.push("");
      }
      // header.push("audioFileName");
      this.extractedHeader = header;
      this.asCSV = rows;

      if (typeof callback === "function") {
        callback();
      }
    }
  },
  importLatex: {
    value: function() {
      throw "The app thinks this might be a LaTeX file, but we haven't implemented this kind of import yet. You can vote for it in our bug tracker.";
      // if (typeof callback === "function") {
      //   callback();
      // }
    }
  },
  /**
   * This function accepts text using double (or triple etc) spaces to indicate
   * separate datum. Each line in the block is treated as a column in
   * the table.
   *
   * If you have your data in Microsoft word or OpenOffice or plain
   * text, then this will be the easiest format for you to import your
   * data in.
   *
   * @param text
   */
  importTextIGT: {
    value: function(text, callback) {
      if (!text) {
        return;
      }
      var rows = text.split(/\n\n+/),
        l;

      var macLineEndings = false;
      if (rows.length < 3) {
        var macrows = text.split("\r\r");
        if (macrows.length > rows.length) {
          this.status = this.status + " Detected a MAC line ending.";
          macLineEndings = true;
          rows = macrows;
        }
      }
      for (l in rows) {
        if (macLineEndings) {
          rows[l] = rows[l].replace(/  +/g, " ").split("\r");
        } else {
          rows[l] = rows[l].replace(/  +/g, " ").split("\n");
        }
      }
      this.asCSV = rows;
      this.extractedHeader = rows[0];
      if (typeof callback === "function") {
        callback();
      }
    }
  },
  /**
   * This function accepts text using double (or triple etc) spaces to indicate
   * separate datum. Each line in the block is treated as a column in
   * the table.
   *
   * If you have your data in Microsoft word or OpenOffice or plain
   * text, then this will be the easiest format for you to import your
   * data in.
   *
   * @param text
   */
  importRawText: {
    value: function(text) {
      if (this.ignoreLineBreaksInRawText) {
        text.replace(/\n+/g, " ").replace(/\r+/g, " ");
      }
      this.documentCollection.add({
        id: "orthography",
        value: text
      });
      this.debug("added a datum to the collection");
    }
  },
  /**
   * Reads the import's array of files using a supplied readOptions or using
   * the readFileIntoRawText function which uses the browsers FileReader API.
   * It can read only part of a file if start and stop are passed in the options.
   *
   * @param  Object options Options can be specified to pass start and stop bytes
   * for the files to be read.
   *
   * @return Promise Returns a promise which will have an array of results
   * for each file which was requested to be read
   */
  readFiles: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this,
        promisses = [];

      options = options || {};
      this.progress = {
        total: 0,
        completed: 0
      };
      Q.nextTick(function() {

        var fileDetails = [];
        var files = self.files;

        self.progress.total = files.length;
        for (var i = 0, file; file = files[i]; i++) {
          var details = [escape(file.name), file.type || "n/a", "-", file.size, "bytes, last modified:", file.lastModifiedDate ? file.lastModifiedDate.toLocaleDateString() : "n/a"].join(" ");
          self.status = self.status + "; " + details;
          fileDetails.push(JSON.parse(JSON.stringify(file)));
          if (options.readOptions) {
            promisses.push(options.readOptions.readFileFunction.apply(self, [{
              file: file.name,
              start: options.start,
              stop: options.stop
            }]));
          } else {
            promisses.push(self.readFileIntoRawText({
              file: file,
              start: options.start,
              stop: options.stop
            }));
          }
        }

        self.fileDetails = fileDetails;

        Q.allSettled(promisses).then(function(results) {
          deferred.resolve(results.map(function(result) {
            self.progress.completed += 1;
            return result.value;
          }));
        }, function(results) {
          self.error = "Error processing files";
          deferred.reject(results);
        }).catch(function(error) {
          self.warn("There was an error when importing these options ", error, options);
        });

      });
      return deferred.promise;
    }
  },
  /**
   * Reads a file using the FileReader API, can read only part of a file if start and stop are passed in the options.
   * @param  Object options Options can be specified to pass start and stop bytes for the file to be read.
   * @return Promise Returns a promise which will have an array of results for each file which was requested to be read
   */
  readFileIntoRawText: {
    value: function(options) {
      var deferred = Q.defer(),
        self = this;

      this.debug("readFileIntoRawText", options);
      Q.nextTick(function() {
        if (!options) {
          options = {
            error: "Options must be defined for readFileIntoRawText"
          };
          deferred.reject(options);
          return;
        }
        if (!options.file) {
          options.error = "Options: file must be defined for readFileIntoRawText";
          deferred.reject(options);
          return;
        }
        options.start = options.start ? parseInt(options.start, 10) : 0;
        options.stop = options.stop ? parseInt(options.stop, 10) : options.file.size - 1;
        var reader = new FileReader();

        // If we use onloadend, we need to check the readyState.
        reader.onloadend = function(evt) {
          if (evt.target.readyState === FileReader.DONE) { // DONE === 2
            options.rawText = evt.target.result;
            self.rawText = self.rawText + options.rawText;
            // self.showImportSecondStep = true;
            deferred.resolve(options);
          }
        };

        var blob = "";
        if (options.file.slice) {
          blob = options.file.slice(options.start, options.stop + 1);
        } else if (options.file.mozSlice) {
          blob = options.file.mozSlice(options.start, options.stop + 1);
        } else if (options.file.webkitSlice) {
          blob = options.file.webkitSlice(options.start, options.stop + 1);
        }
        // reader.readAsBinaryString(blob);
        // reader.readAsText(blob, "UTF-8");
        reader.readAsText(blob);

      });
      return deferred.promise;
    }
  },
  /**
   * This function attempts to guess the format of the file/textarea, and calls the appropriate import handler.
   */
  guessFormatAndPreviewImport: {
    value: function(fileIndex) {
      if (!fileIndex) {
        fileIndex = 0;
      }

      var importTypeConfidenceMeasures = {
        handout: {
          confidence: 0,
          id: "handout",
          importFunction: this.importTextIGT
        },
        csv: {
          confidence: 0,
          id: "csv",
          importFunction: this.importCSV
        },
        tabbed: {
          confidence: 0,
          id: "tabbed",
          importFunction: this.importTabbed
        },
        xml: {
          confidence: 0,
          id: "xml",
          importFunction: this.importXML
        },
        toolbox: {
          confidence: 0,
          id: "toolbox",
          importFunction: this.importToolbox
        },
        elanXML: {
          confidence: 0,
          id: "elanXML",
          importFunction: this.importElanXML
        },
        praatTextgrid: {
          confidence: 0,
          id: "praatTextgrid",
          importFunction: this.importTextGrid
        },
        latex: {
          confidence: 0,
          id: "latex",
          importFunction: this.importLatex
        }

      };

      //if the user is just typing, try raw text
      if (this.files && this.files[fileIndex]) {
        var fileExtension = this.files[fileIndex].name.split(".").pop().toLowerCase();
        if (fileExtension === "csv") {
          importTypeConfidenceMeasures.csv.confidence++;
        } else if (fileExtension === "txt") {
          //If there are more than 20 tabs in the file, try tabbed.
          if (this.rawText.split("\t").length > 20) {
            importTypeConfidenceMeasures.tabbed.confidence++;
          } else {
            importTypeConfidenceMeasures.handout.confidence++;
          }
        } else if (fileExtension === "eaf") {
          importTypeConfidenceMeasures.elanXML.confidence++;
        } else if (fileExtension === "xml") {
          importTypeConfidenceMeasures.xml.confidence++;
        } else if (fileExtension === "sf") {
          importTypeConfidenceMeasures.toolbox.confidence++;
        } else if (fileExtension === "tex") {
          importTypeConfidenceMeasures.latex.confidence++;
        } else if (fileExtension === "textgrid") {
          importTypeConfidenceMeasures.praatTextgrid.confidence++;
        } else if (fileExtension === "mov") {
          importTypeConfidenceMeasures.praatTextgrid.confidence++;
        } else if (fileExtension === "wav") {
          importTypeConfidenceMeasures.praatTextgrid.confidence++;
        } else if (fileExtension === "mp3") {
          importTypeConfidenceMeasures.praatTextgrid.confidence++;
        }
      } else {
        if (this.rawText && this.rawText.length) {
          var textLength = this.rawText.length;
          if (this.rawText.indexOf("\\gll") > -1 || this.rawText.indexOf("\\begin{") > -1 || this.rawText.indexOf("\\ex") > -1) {
            importTypeConfidenceMeasures.latex.confidence = 100;
          } else if (this.rawText.indexOf("mpi.nl/tools/elan/EAF") > -1) {
            importTypeConfidenceMeasures.elanXML.confidence = 100;
          } else if (this.rawText.indexOf("<?xml") > -1) {
            importTypeConfidenceMeasures.xml.confidence = 100;
          } else {
            importTypeConfidenceMeasures.csv.confidence = this.rawText.split(",").length / textLength;
            importTypeConfidenceMeasures.tabbed.confidence = this.rawText.split("\t").length / textLength;
            importTypeConfidenceMeasures.handout.confidence = this.rawText.split(/\n\n+/).length / textLength;
            importTypeConfidenceMeasures.toolbox.confidence = this.rawText.split(/\n\\/).length / textLength;
            importTypeConfidenceMeasures.praatTextgrid.confidence = this.rawText.split("intervals").length / textLength;
          }
        }
      }
      this.importTypeConfidenceMeasures = importTypeConfidenceMeasures;

      var mostLikelyImport = _.max(importTypeConfidenceMeasures, function(obj) {
        return obj.confidence;
      });
      this.importTypeConfidenceMeasures.mostLikely = mostLikelyImport;
      this.status = "";
      mostLikelyImport.importFunction.apply(this, [this.rawText, null]); //no callback
    }
  },
  readBlob: {
    value: function(file, callback, opt_startByte, opt_stopByte) {
      this.warn("Read blob is deprecated", file, callback, opt_startByte, opt_stopByte);
    }
  }
});

exports.Import = Import;

},{"./../CORS":1,"./../Collection":2,"./../FieldDBObject":4,"./../corpus/Corpus":16,"./../data_list/DataList":22,"./../datum/Datum":24,"./../datum/DatumField":25,"./../datum/DatumFields":26,"./../user/Participant":52,"q":76,"textgrid":77,"underscore":78}],42:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject,
  Q = require("q");

/**
 * @class The ContextualizableObject allows the user to label data with grammatical tags
 *        i.e. passive, causative. This is useful for searches.
 *
 * @name  ContextualizableObject
 * @description The initialize function brings up a field in which the user
 *              can enter tags.@class Object of Datum validation states
 * @extends Object
 * @constructs
 */
var ContextualizableObject = function ContextualizableObject(json) {
  // if (!this._fieldDBtype) {
  //   this._fieldDBtype = "Activities";
  // }
  this.debug("Constructing ContextualizableObject ", json);
  if (json && typeof json === "string") {
    if (!ContextualizableObject.updateAllToContextualizableObjects) {
      // Dont localize this, return what you received to be backward compatible
      console.warn("ContextualizableObject: should not converting this deprecated string in to a ContextualizableObject " + json);
      // this.protoype = Object.create(String.prototype);
      String.apply(this, arguments);
      // String.call(json);
      // this.prototype = String.prototype;
      // this.__proto__ = String.call(json);
      // json = new String(json);
      console.warn("string should not be an object: " + this);
      // this.toString = function() {
      //   return json;
      // }
      return;
    }
    var stringAsKey = "locale_" + json.replace(/[^a-zA-Z0-9-]/g, "_");
    var value = json;
    json = {
      default: stringAsKey
    };
    this.originalString = value;
    this.data = this.data || {};
    this.data[stringAsKey] = {
      "message": value
    };
    this.add(stringAsKey, value);

    // if (this.contextualizer && this.contextualizer.contextualize(for_context) === for_context) {
    //   this.contextualizer.updateContextualization(for_context, locale_string)
    //   this.debug("added to contextualizer "+ this.contextualizer.contextualize(for_context));
    // }
  }
  for (var member in json) {
    if (!json.hasOwnProperty(member) || member === "contextualizer") {
      continue;
    }
    this.add(member, json[member]);
  }

  Object.apply(this, arguments);
};

var forcedebug = false;

ContextualizableObject.updateAllToContextualizableObjects = false;
ContextualizableObject.prototype = Object.create(Object.prototype, /** @lends ContextualizableObject.prototype */ {
  constructor: {
    value: ContextualizableObject
  },

  fieldDBtype: {
    value: "ContextualizableObject"
  },

  contextualizer: {
    get: function() {
      return FieldDBObject.prototype.contextualizer;
    }
  },

  debug: {
    value: function(message, message2, message3, message4) {
      if (FieldDBObject.application && FieldDBObject.application.contextualizer) {
        // console.log("using  FieldDBObject.application.contextualizer.debug " +  FieldDBObject.application.contextualizer.debugMode);
        return FieldDBObject.application.contextualizer.debug;
      } else {
        if (forcedebug) {
          console.log(this.fieldDBtype.toUpperCase() + "-DEBUG FORCED: " + message);

          if (message2) {
            console.log(message2);
          }
          if (message3) {
            console.log(message3);
          }
          if (message4) {
            console.log(message4);
          }
        }
      }
    }
  },

  todo: {
    value: function() {
      return FieldDBObject.prototype.todo.apply(this, arguments);
    }
  },

  contextualize: {
    value: function(locale_string) {
      this.debug("requesting contextualization of " + locale_string);
      var contextualizedString;
      if (this.contextualizer) {
        contextualizedString = this.contextualizer.contextualize(locale_string);
      }
      if (!contextualizedString || contextualizedString === locale_string) {
        if (this.data && this.data[locale_string]) {
          contextualizedString = this.data[locale_string].message;
        } else {
          contextualizedString = locale_string;
        }
      }
      this.debug("::" + contextualizedString + "::");
      return contextualizedString;
    }
  },

  updateContextualization: {
    value: function(for_context, locale_string) {
      this.debug("updateContextualization" + for_context);
      var updatePromiseOrSyncrhonousConfirmed,
        self = this;

      if (this.contextualizer) {
        this.debug(this.contextualizer.data);

        updatePromiseOrSyncrhonousConfirmed = this.contextualizer.updateContextualization(for_context, locale_string);
        if (updatePromiseOrSyncrhonousConfirmed !== true) {
          self.todo("Test async updatePromiseOrSyncrhonousConfirmed");
          Q.nextTick(function() {
            var updated = self.contextualizer.contextualize(for_context);
            if ((!updated || updated === for_context) && self.data) {
              self.data[for_context] = self.data[for_context] || {
                message: ""
              };
              self.data[for_context].message = locale_string;
            }
          });
        }
      }
      // this.data = this.data || {};
      // this.data[for_context] = {
      //   message: locale_string
      // };

      if (this._default === for_context) {
        this.originalString = locale_string;
      }
      return updatePromiseOrSyncrhonousConfirmed;
    }
  },

  add: {
    value: function(for_context, locale_string) {
      var underscoreNotation = "_" + for_context;
      this[underscoreNotation] = locale_string;
      this.__defineGetter__(for_context, function() {
        this.debug("overidding getter");
        return this.contextualize(this[underscoreNotation]);
      });
      this.__defineSetter__(for_context, function(value) {
        this.debug("overidding setter " + underscoreNotation, value);
        this.updateContextualization(this[underscoreNotation], value);
      });
      this.debug("adding string to ContextualizableObject's own data " + for_context);
      //if there is no contextualizer, add this to the local data
      this.data = this.data || {};
      this.data[for_context] = {
        "message": locale_string
      };
      if (for_context.indexOf("locale_") === 0 || for_context.indexOf("localized_") === 0) {
        this.debug("intializing the data in this ContextualizableObject");
        this.debug(" for_context " + for_context);
        this.debug(" locale_string " + locale_string);
        // If the contextualizer doesnt have a value for this string, add it to the contextualizations... (this could introduce a lot of data into the localizations)
        if (this.contextualizer) {
          this.debug(" adding to contextualizer: " + for_context + " as " + locale_string);
          this.contextualizer.updateContextualization(for_context, locale_string);
          this.debug("added to contextualizer " + this.contextualizer.contextualize(for_context));
        }
      }
      this.debug("data", this.data);
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      var json = {},
        aproperty,
        underscorelessProperty;

      if (ContextualizableObject.updateAllToContextualizableObjects && this.originalString) {
        return this.originalString;
      }

      for (aproperty in this) {
        if (this.hasOwnProperty(aproperty) && typeof this[aproperty] !== "function" && aproperty !== "contextualizer" && aproperty.indexOf("_") === 0) {
          underscorelessProperty = aproperty.replace(/^_/, "");
          if (!removeEmptyAttributes || (removeEmptyAttributes && !this.isEmpty(aproperty))) {
            if (this[aproperty] && typeof this[aproperty].toJSON === "function") {
              json[underscorelessProperty] = this[aproperty].toJSON(includeEvenEmptyAttributes, removeEmptyAttributes);
            } else {
              json[underscorelessProperty] = this[aproperty];
            }
          }
        }
      }

      /* if the caller requests a complete object include the default for all defauls by calling get on them */
      if (includeEvenEmptyAttributes && this.INTERNAL_MODELS) {
        for (aproperty in this.INTERNAL_MODELS) {
          if (!json[aproperty] && this.INTERNAL_MODELS) {
            if (this.INTERNAL_MODELS[aproperty] && typeof this.INTERNAL_MODELS[aproperty] === "function" && typeof new this.INTERNAL_MODELS[aproperty]().toJSON === "function") {
              json[aproperty] = new this.INTERNAL_MODELS[aproperty]().toJSON(includeEvenEmptyAttributes, removeEmptyAttributes);
            } else {
              json[aproperty] = this.INTERNAL_MODELS[aproperty];
            }
          }
        }
      }
      // Preseve the original string in this mini-contextualizer if it was originally a string
      if (json.default && this.originalString) {
        json[json.default] = this.originalString;
        delete json.originalString;
      }

      return json;
    }
  }


});
exports.ContextualizableObject = ContextualizableObject;

},{"./../FieldDBObject":4,"q":76}],43:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};/* globals window */
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var ELanguages = require("./ELanguages").ELanguages;
var CORS = require("./../CORS").CORS;
var Q = require("q");

var english_texts = require("./en/messages.json");
var spanish_texts = require("./es/messages.json");
var elanguages = require("./elanguages.json");

/**
 * @class The contextualizer can resolves strings depending on context and locale of the user
 *  @name  Contextualizer
 *
 * @property {ELanguage} defaultLocale The language/context to use if a translation/contextualization is missing.
 * @property {ELanguage} currentLocale The current locale to use (often the browsers default locale, or a corpus" default locale).
 *
 * @extends FieldDBObject
 * @constructs
 */
var Contextualizer = function Contextualizer(options) {
  if(!this._fieldDBtype){
		this._fieldDBtype = "Contextualizer";
	}
  this.debug("Constructing Contextualizer ", options);
  // this.debugMode = true;
  var localArguments = arguments;
  if (!options) {
    options = {};
    localArguments = [options];
  }
  if (!options.defaultLocale || !options.defaultLocale.iso) {
    options.defaultLocale = {
      iso: "en"
    };
  }
  // if (!options.currentLocale || !options.currentLocale.iso) {
  //   options.currentLocale = {
  //     iso: "en"
  //   };
  // }
  if (!options.currentContext) {
    options.currentContext = "default";
  }
  if (!options.elanguages) {
    options.elanguages = elanguages;
  }
  FieldDBObject.apply(this, localArguments);
  if (!options || options.alwaysConfirmOkay === undefined) {
    this.warn("By default it will be okay for users to modify global locale strings. IF they are saved this will affect other users.");
    this.alwaysConfirmOkay = true;
  }
  return this;
};

Contextualizer.prototype = Object.create(FieldDBObject.prototype, /** @lends Contextualizer.prototype */ {
  constructor: {
    value: Contextualizer
  },

  INTERNAL_MODELS: {
    value: {
      elanguages: ELanguages
    }
  },

  _require: {
    value: (typeof global !== "undefined") ? global.require : (typeof window !== "undefined") ? window.require : null
  },

  data: {
    get: function() {
      return this._data;
    },
    set: function(value) {
      this._data = value;
    }
  },

  currentLocale: {
    get: function() {
      if (this._currentLocale) {
        return this._currentLocale;
      }
      if (this._mostAvailableLanguage) {
        return this._mostAvailableLanguage;
      }
      return this.defaultLocale;
    },
    set: function(value) {
      if (value === this._currentLocale) {
        return;
      }

      if (value && value.toLowerCase && typeof value === "string") {
        value = value.toLowerCase().replace(/[^a-z-]/g, "");
        if (this.elanguages && this.elanguages[value]) {
          value = this.elanguages[value];
        } else {
          value = {
            iso: value
          };
        }
      }

      this.warn("SETTING LOCALE FROM " + this._currentLocale + " to " + value, this.data);
      this._currentLocale = value;
    }
  },

  availableLanguages: {
    get: function() {
      this.data = this.data || {};
      if (this._availableLanguages && this.data[this._availableLanguages._collection[0].iso] && this._availableLanguages._collection[0].length === this.data[this._availableLanguages._collection[0].iso].length) {
        return this._availableLanguages;
      }
      var availLanguages = new ELanguages(),
        bestAvailabilityCount = 0;

      for (var code in this.data) {
        if (this.data.hasOwnProperty(code)) {
          this.elanguages[code].length = this.data[code].length;
          if (this.elanguages[code].length > bestAvailabilityCount) {
            availLanguages.unshift(this.elanguages[code]);
            bestAvailabilityCount = this.elanguages[code].length;
          } else {
            availLanguages.push(this.elanguages[code]);
          }
        }
      }
      if (bestAvailabilityCount === 0 || availLanguages.length === 0) {
        this.todo("Ensuring that at least english is an available language, not sure if this is a good idea.");
        availLanguages.unshift(this.elanguages.en);
      } else {
        availLanguages._collection.map(function(language) {
          language.percentageOfAvailability = Math.round(language.length / bestAvailabilityCount * 100);
          return language;
        });
      }
      this.todo("test whether setting the currentLocale to the most complete locale has adverse affects.");
      this._mostAvailableLanguage = availLanguages._collection[0];
      this._availableLanguages = availLanguages;
      return availLanguages;
    }
  },

  defaults: {
    get: function() {
      return {
        en: JSON.parse(JSON.stringify(english_texts)),
        es: JSON.parse(JSON.stringify(spanish_texts))
      };
    }
  },

  loadDefaults: {
    value: function() {
      if (this.defaults.en) {
        this.addMessagesToContextualizedStrings("en", this.defaults.en);
      } else {
        this.debug("English Locales did not load.");
      }
      if (this.defaults.es) {
        this.addMessagesToContextualizedStrings("es", this.defaults.es);
      } else {
        this.debug("English Locales did not load.");
      }
      return this;
    }
  },

  localize: {
    value: function(message, optionalLocaleForThisCall) {
      return this.contextualize(message, optionalLocaleForThisCall);
    }
  },

  contextualize: {
    value: function(message, optionalLocaleForThisCall) {
      if (!optionalLocaleForThisCall) {
        optionalLocaleForThisCall = this.currentLocale.iso;
      }
      if (optionalLocaleForThisCall && optionalLocaleForThisCall.iso) {
        optionalLocaleForThisCall = optionalLocaleForThisCall.iso;
      }
      this.debug("Resolving localization in " + optionalLocaleForThisCall);
      var result = message,
        aproperty;

      // Use the current context if the caller is requesting localization of an object
      if (typeof message === "object") {
        var foundAContext = false;
        for (aproperty in message) {
          if (!message.hasOwnProperty(aproperty)) {
            continue;
          }
          if (aproperty.indexOf(this.currentContext) > -1 || ((this.currentContext === "child" || this.currentContext === "game") && aproperty.indexOf("gamified") > -1)) {
            result = message[aproperty];
            foundAContext = true;
            this.debug("Using " + aproperty + " for this contxtualization.");
            break;
          }
        }
        if (!foundAContext && message.default) {
          this.debug("Using default for this contxtualization. ", message);
          result = message.default;
        }
      }

      if (!this.data) {
        this.warn("No localizations available, resolving the key itself: ", result);
        return result;
      }

      var keepTrying = true;
      if (this.data[optionalLocaleForThisCall] && this.data[optionalLocaleForThisCall][result] && this.data[optionalLocaleForThisCall][result].message !== undefined && this.data[optionalLocaleForThisCall][result].message) {
        result = this.data[optionalLocaleForThisCall][result].message;
        this.debug("Resolving localization using requested language: ", result);
        keepTrying = false;
      } else {
        if (typeof message === "object" && message.default) {
          if (this.data[optionalLocaleForThisCall] && this.data[optionalLocaleForThisCall][message.default] && this.data[optionalLocaleForThisCall][message.default].message !== undefined && this.data[optionalLocaleForThisCall][message.default].message) {
            result = this.data[optionalLocaleForThisCall][message.default].message;
            this.warn("Resolving localization using default contextualization: ", message.default);
            keepTrying = false;
          } else if (this.data[this.defaultLocale.iso] && this.data[this.defaultLocale.iso][message.default] && this.data[this.defaultLocale.iso][message.default].message !== undefined && this.data[this.defaultLocale.iso][message.default].message) {
            result = this.data[this.defaultLocale.iso][message.default].message;
            this.warn("Resolving localization using default contextualization and default locale: ", message.default);
            keepTrying = false;
          }
        }
        if (keepTrying && this.data[this.defaultLocale.iso] && this.data[this.defaultLocale.iso][result] && this.data[this.defaultLocale.iso][result].message !== undefined && this.data[this.defaultLocale.iso][result].message) {
          result = this.data[this.defaultLocale.iso][result].message;
          this.warn("Resolving localization using default: ", result);
        }
      }

      if (keepTrying && !this.requestedCorpusSpecificLocalizations && FieldDBObject && FieldDBObject.application && FieldDBObject.application.corpus && FieldDBObject.application.corpus.loaded) {
        FieldDBObject.application.corpus.getCorpusSpecificLocalizations();
        this.requestedCorpusSpecificLocalizations = true;
      }
      return result;
    }
  },

  /**
   *
   * @param  {String} key   A locale to save the message to
   * @param  {String} value a message which should replace the existing localization
   * @return {Promise}       A promise for whether or not the update was confirmed and executed
   */
  updateContextualization: {
    value: function(key, value) {
      this.data[this.currentLocale.iso] = this.data[this.currentLocale.iso] || {};
      if (this.data[this.currentLocale.iso][key] && this.data[this.currentLocale.iso][key].message === value) {
        return value; //no change
      }
      var previousMessage = "";
      var verb = "create ";
      if (this.data[this.currentLocale.iso][key]) {
        previousMessage = this.data[this.currentLocale.iso][key].message;
        verb = "update ";
      }
      var self = this;
      if (!this.testingAsyncConfirm && this.alwaysConfirmOkay /* run synchonosuly whenever possible */ ) {
        this.data[this.currentLocale.iso][key] = this.data[this.currentLocale.iso][key] || {};
        this.data[this.currentLocale.iso][key].message = value;
        var newLocaleItem = {};
        newLocaleItem[key] = {
          message: value
        };
        this.addMessagesToContextualizedStrings(this.currentLocale.iso, newLocaleItem);
      } else {
        this.todo("Test async updateContextualization");

        return this.confirm("Do you also want to " + verb + key + " for other users? \n" + previousMessage + " -> " + value).then(function() {
          self.data[self.currentLocale.iso][key] = self.data[self.currentLocale.iso][key] || {};
          self.data[self.currentLocale.iso][key].message = value;
          var newLocaleItem = {};
          newLocaleItem[key] = {
            message: value
          };
          self.addMessagesToContextualizedStrings(self.currentLocale.iso, newLocaleItem);
        }, function() {
          self.debug("Not updating ");
        });
      }

    }
  },

  audio: {
    value: function(key) {
      this.debug("Resolving localization in " + this.currentLocale.iso);
      var result = {};
      if (!this.data) {
        this.warn("No localizations available, resolving empty audio details");
        return result;
      }

      if (this.data[this.currentLocale.iso] && this.data[this.currentLocale.iso][key] && this.data[this.currentLocale.iso][key].audio !== undefined && this.data[this.currentLocale.iso][key].audio) {
        result = this.data[this.currentLocale.iso][key].audio;
        this.debug("Resolving localization audio using requested language: ", result);
      } else {
        if (this.data[this.defaultLocale.iso] && this.data[this.defaultLocale.iso][key] && this.data[this.defaultLocale.iso][key].audio !== undefined && this.data[this.defaultLocale.iso][key].audio) {
          result = this.data[this.defaultLocale.iso][key].audio;
          this.warn("Resolving localization audio using default: ", result);
        }
      }
      return result;
    }
  },

  addUrls: {
    value: function(files, baseUrl) {
      var promises = [],
        f;

      for (f = 0; f < files.length; f++) {
        promises.push(this.addUrl(files[f], baseUrl));
      }
      return Q.all(promises);
    }
  },

  addUrl: {
    value: function(file, baseUrl) {
      var deferred = Q.defer(),
        localeCode,
        self = this;

      if (!baseUrl && FieldDBObject && FieldDBObject.application && FieldDBObject.application.corpus && FieldDBObject.application.corpus.url) {
        this.debug("using corpus as base url");
        baseUrl = FieldDBObject.application.corpus.url;
      }

      if (file.indexOf("/messages.json" > -1)) {
        localeCode = file.replace("/messages.json", "");
        if (localeCode.indexOf("/") > -1) {
          localeCode = localeCode.substring(localeCode.lastIndexOf("/"));
        }
        localeCode = localeCode.replace(/[^a-zA-Z-]/g, "").toLowerCase();
        if (!localeCode || localeCode.length < 2) {
          localeCode = "default";
        }
      } else {
        localeCode = "en";
      }

      CORS.makeCORSRequest({
        method: "GET",
        url: baseUrl + "/" + file,
        dataType: "json"
      }).then(function(localeMessages) {
        self.originalDocs = self.originalDocs || [];
        self.originalDocs.push(file);
        self.addMessagesToContextualizedStrings(localeCode, localeMessages)
          .then(deferred.resolve,
            deferred.reject);
      }, function(error) {
        self.warn("There werent any locales at this url" + baseUrl + " :( Maybe this database has no custom locale messages.", error);
      });

      return deferred.promise;
    }
  },

  addMessagesToContextualizedStrings: {
    value: function(localeCode, localeData) {
      var deferred = Q.defer(),
        self = this;

      // Q.nextTick(function() {

      if (!localeData) {
        deferred.reject("The locales data was empty!");
        return;
      }

      if (!localeCode && localeData._id) {
        localeCode = localeData._id.replace("/messages.json", "");
        if (localeCode.indexOf("/") > -1) {
          localeCode = localeCode.substring(localeCode.lastIndexOf("/"));
        }
        localeCode = localeCode.replace(/[^a-zA-Z-]/g, "").toLowerCase();
        if (!localeCode || localeCode.length < 2) {
          localeCode = "default";
        }
      }
      self.originalDocs = self.originalDocs || [];
      self.originalDocs.push(localeData);

      self.data = self.data || {};
      for (var message in localeData) {
        if (localeData.hasOwnProperty(message) && message.indexOf("_") !== 0) {
          self.data[localeCode] = self.data[localeCode] || {
            length: 0
          };
          self.data[localeCode][message] = localeData[message];
          self.data[localeCode].length++;
        }
      }
      deferred.resolve(self.data);

      // });
      return deferred.promise;
    }
  },

  save: {
    value: function() {
      var promises = [];
      for (var locale in this.data) {
        if (!this.data.hasOwnProperty(locale)) {
          continue;
        }
        this.debug("Requsting save of " + locale);
        var doc = new FieldDBObject(this.data[locale]);
        this.debug(doc);
        if (this.email) {
          promises.push(FieldDBObject.prototype.saveToGit.apply(doc, [{
            email: this.email,
            message: "Updated locale messages"
          }]));
        } else {
          doc.id = locale + "/messages.json";
          promises.push(FieldDBObject.prototype.save.apply(doc));
        }

      }
      return Q.allSettled(promises);
    }
  }


});

exports.Contextualizer = Contextualizer;

},{"./../CORS":1,"./../FieldDBObject":4,"./ELanguages":44,"./elanguages.json":45,"./en/messages.json":46,"./es/messages.json":47,"q":76}],44:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class Collection of Datum validation states

 * @name  ELanguages
 * @description The ELanguages is a minimal customization of the Collection
 * to add a primary key of iso.
 *
 * @extends Collection
 * @constructs
 */
var ELanguages = function ELanguages(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "ELanguages";
  }
  this.debug("Constructing ELanguages ", options);
  Collection.apply(this, arguments);
};

ELanguages.prototype = Object.create(Collection.prototype, /** @lends ELanguages.prototype */ {
  constructor: {
    value: ELanguages
  },

  primaryKey: {
    value: "iso"
  },

  INTERNAL_MODELS: {
    value: {
      item: FieldDBObject
    }
  },

  sanitizeStringForPrimaryKey: {
    value: function(value) {
      return value;
    }
  }

});
exports.ELanguages = ELanguages;

},{"./../Collection":2,"./../FieldDBObject":4}],45:[function(require,module,exports){
module.exports=[{
  "iso": "Non applicable",
  "name": "NA",
  "nativeName": "Non applicable"
}, {
  "iso": "ab",
  "name": "Abkhaz",
  "nativeName": "аҧсуа"
}, {
  "iso": "aa",
  "name": "Afar",
  "nativeName": "Afaraf"
}, {
  "iso": "af",
  "name": "Afrikaans",
  "nativeName": "Afrikaans"
}, {
  "iso": "ak",
  "name": "Akan",
  "nativeName": "Akan"
}, {
  "iso": "sq",
  "name": "Albanian",
  "nativeName": "Shqip"
}, {
  "iso": "am",
  "name": "Amharic",
  "nativeName": "አማርኛ"
}, {
  "iso": "ar",
  "name": "Arabic",
  "nativeName": "العربية"
}, {
  "iso": "an",
  "name": "Aragonese",
  "nativeName": "Aragonés"
}, {
  "iso": "hy",
  "name": "Armenian",
  "nativeName": "Հայերեն"
}, {
  "iso": "as",
  "name": "Assamese",
  "nativeName": "অসমীয়া"
}, {
  "iso": "av",
  "name": "Avaric",
  "nativeName": "авар мацӀ, магӀарул мацӀ"
}, {
  "iso": "ae",
  "name": "Avestan",
  "nativeName": "avesta"
}, {
  "iso": "ay",
  "name": "Aymara",
  "nativeName": "aymar aru"
}, {
  "iso": "az",
  "name": "Azerbaijani",
  "nativeName": "azərbaycan dili"
}, {
  "iso": "bm",
  "name": "Bambara",
  "nativeName": "bamanankan"
}, {
  "iso": "ba",
  "name": "Bashkir",
  "nativeName": "башҡорт теле"
}, {
  "iso": "eu",
  "name": "Basque",
  "nativeName": "euskara"
}, {
  "iso": "be",
  "name": "Belarusian",
  "nativeName": "Беларуская"
}, {
  "iso": "bn",
  "name": "Bengali",
  "nativeName": "বাংলা"
}, {
  "iso": "bh",
  "name": "Bihari",
  "nativeName": "भोजपुरी"
}, {
  "iso": "bi",
  "name": "Bislama",
  "nativeName": "Bislama"
}, {
  "iso": "bs",
  "name": "Bosnian",
  "nativeName": "bosanski jezik"
}, {
  "iso": "br",
  "name": "Breton",
  "nativeName": "brezhoneg"
}, {
  "iso": "bg",
  "name": "Bulgarian",
  "nativeName": "български език"
}, {
  "iso": "my",
  "name": "Burmese",
  "nativeName": "ဗမာစာ"
}, {
  "iso": "ca",
  "name": "Catalan; Valencian",
  "nativeName": "Català"
}, {
  "iso": "ch",
  "name": "Chamorro",
  "nativeName": "Chamoru"
}, {
  "iso": "ce",
  "name": "Chechen",
  "nativeName": "нохчийн мотт"
}, {
  "iso": "ny",
  "name": "Chichewa; Chewa; Nyanja",
  "nativeName": "chiCheŵa, chinyanja"
}, {
  "iso": "zh",
  "name": "Chinese",
  "nativeName": "中文"
}, {
  "iso": "cv",
  "name": "Chuvash",
  "nativeName": "чӑваш чӗлхи"
}, {
  "iso": "kw",
  "name": "Cornish",
  "nativeName": "Kernewek"
}, {
  "iso": "co",
  "name": "Corsican",
  "nativeName": "corsu"
}, {
  "iso": "cr",
  "name": "Cree",
  "nativeName": "ᓀᐦᐃᔭᐍᐏᐣ"
}, {
  "iso": "hr",
  "name": "Croatian",
  "nativeName": "hrvatski"
}, {
  "iso": "cs",
  "name": "Czech",
  "nativeName": "česky"
}, {
  "iso": "da",
  "name": "Danish",
  "nativeName": "dansk"
}, {
  "iso": "dv",
  "name": "Divehi; Dhivehi; Maldivian;",
  "nativeName": "ދިވެހި"
}, {
  "iso": "nl",
  "name": "Dutch",
  "nativeName": "Nederlands, Vlaams"
}, {
  "iso": "en",
  "name": "English",
  "nativeName": "English",
  "selected": true
}, {
  "iso": "eo",
  "name": "Esperanto",
  "nativeName": "Esperanto"
}, {
  "iso": "et",
  "name": "Estonian",
  "nativeName": "eesti"
}, {
  "iso": "ee",
  "name": "Ewe",
  "nativeName": "Eʋegbe"
}, {
  "iso": "fo",
  "name": "Faroese",
  "nativeName": "føroyskt"
}, {
  "iso": "fj",
  "name": "Fijian",
  "nativeName": "vosa Vakaviti"
}, {
  "iso": "fi",
  "name": "Finnish",
  "nativeName": "suomi"
}, {
  "iso": "fr",
  "name": "French",
  "nativeName": "français"
}, {
  "iso": "ff",
  "name": "Fula; Fulah; Pulaar; Pular",
  "nativeName": "Fulfulde, Pulaar, Pular"
}, {
  "iso": "gl",
  "name": "Galician",
  "nativeName": "Galego"
}, {
  "iso": "ka",
  "name": "Georgian",
  "nativeName": "ქართული"
}, {
  "iso": "de",
  "name": "German",
  "nativeName": "Deutsch"
}, {
  "iso": "el",
  "name": "Greek, Modern",
  "nativeName": "Ελληνικά"
}, {
  "iso": "gn",
  "name": "Guaraní",
  "nativeName": "Avañeẽ"
}, {
  "iso": "gu",
  "name": "Gujarati",
  "nativeName": "ગુજરાતી"
}, {
  "iso": "ht",
  "name": "Haitian; Haitian Creole",
  "nativeName": "Kreyòl ayisyen"
}, {
  "iso": "ha",
  "name": "Hausa",
  "nativeName": "Hausa, هَوُسَ"
}, {
  "iso": "he",
  "name": "Hebrew (modern)",
  "nativeName": "עברית"
}, {
  "iso": "hz",
  "name": "Herero",
  "nativeName": "Otjiherero"
}, {
  "iso": "hi",
  "name": "Hindi",
  "nativeName": "हिन्दी, हिंदी"
}, {
  "iso": "ho",
  "name": "Hiri Motu",
  "nativeName": "Hiri Motu"
}, {
  "iso": "hu",
  "name": "Hungarian",
  "nativeName": "Magyar"
}, {
  "iso": "ia",
  "name": "Interlingua",
  "nativeName": "Interlingua"
}, {
  "iso": "id",
  "name": "Indonesian",
  "nativeName": "Bahasa Indonesia"
}, {
  "iso": "ie",
  "name": "Interlingue",
  "nativeName": "Occidental"
}, {
  "iso": "ga",
  "name": "Irish",
  "nativeName": "Gaeilge"
}, {
  "iso": "ig",
  "name": "Igbo",
  "nativeName": "Asụsụ Igbo"
}, {
  "iso": "ik",
  "name": "Inupiaq",
  "nativeName": "Iñupiaq, Iñupiatun"
}, {
  "iso": "io",
  "name": "Ido",
  "nativeName": "Ido"
}, {
  "iso": "is",
  "name": "Icelandic",
  "nativeName": "Íslenska"
}, {
  "iso": "it",
  "name": "Italian",
  "nativeName": "Italiano"
}, {
  "iso": "iu",
  "name": "Inuktitut",
  "nativeName": "ᐃᓄᒃᑎᑐᑦ"
}, {
  "iso": "ja",
  "name": "Japanese",
  "nativeName": "日本語"
}, {
  "iso": "jv",
  "name": "Javanese",
  "nativeName": "basa Jawa"
}, {
  "iso": "kl",
  "name": "Kalaallisut, Greenlandic",
  "nativeName": "kalaallisut"
}, {
  "iso": "kn",
  "name": "Kannada",
  "nativeName": "ಕನ್ನಡ"
}, {
  "iso": "kr",
  "name": "Kanuri",
  "nativeName": "Kanuri"
}, {
  "iso": "ks",
  "name": "Kashmiri",
  "nativeName": "कश्मीरी, كشميري‎"
}, {
  "iso": "kk",
  "name": "Kazakh",
  "nativeName": "Қазақ тілі"
}, {
  "iso": "km",
  "name": "Khmer",
  "nativeName": "ភាសាខ្មែរ"
}, {
  "iso": "ki",
  "name": "Kikuyu, Gikuyu",
  "nativeName": "Gĩkũyũ"
}, {
  "iso": "rw",
  "name": "Kinyarwanda",
  "nativeName": "Ikinyarwanda"
}, {
  "iso": "ky",
  "name": "Kirghiz, Kyrgyz",
  "nativeName": "кыргыз тили"
}, {
  "iso": "kv",
  "name": "Komi",
  "nativeName": "коми кыв"
}, {
  "iso": "kg",
  "name": "Kongo",
  "nativeName": "KiKongo"
}, {
  "iso": "ko",
  "name": "Korean",
  "nativeName": "한국어"
}, {
  "iso": "ku",
  "name": "Kurdish",
  "nativeName": "Kurdî, كوردی‎"
}, {
  "iso": "kj",
  "name": "Kwanyama, Kuanyama",
  "nativeName": "Kuanyama"
}, {
  "iso": "la",
  "name": "Latin",
  "nativeName": "latine"
}, {
  "iso": "lb",
  "name": "Luxembourgish, Letzeburgesch",
  "nativeName": "Lëtzebuergesch"
}, {
  "iso": "lg",
  "name": "Luganda",
  "nativeName": "Luganda"
}, {
  "iso": "li",
  "name": "Limburgish, Limburgan, Limburger",
  "nativeName": "Limburgs"
}, {
  "iso": "ln",
  "name": "Lingala",
  "nativeName": "Lingála"
}, {
  "iso": "lo",
  "name": "Lao",
  "nativeName": "ພາສາລາວ"
}, {
  "iso": "lt",
  "name": "Lithuanian",
  "nativeName": "lietuvių kalba"
}, {
  "iso": "lu",
  "name": "Luba-Katanga",
  "nativeName": ""
}, {
  "iso": "lv",
  "name": "Latvian",
  "nativeName": "latviešu valoda"
}, {
  "iso": "gv",
  "name": "Manx",
  "nativeName": "Gaelg, Gailck"
}, {
  "iso": "mk",
  "name": "Macedonian",
  "nativeName": "македонски јазик"
}, {
  "iso": "mg",
  "name": "Malagasy",
  "nativeName": "Malagasy fiteny"
}, {
  "iso": "ms",
  "name": "Malay",
  "nativeName": "bahasa Melayu"
}, {
  "iso": "ml",
  "name": "Malayalam",
  "nativeName": "മലയാളം"
}, {
  "iso": "mt",
  "name": "Maltese",
  "nativeName": "Malti"
}, {
  "iso": "mi",
  "name": "Māori",
  "nativeName": "te reo Māori"
}, {
  "iso": "mr",
  "name": "Marathi (Marāṭhī)",
  "nativeName": "मराठी"
}, {
  "iso": "mh",
  "name": "Marshallese",
  "nativeName": "Kajin M̧ajeļ"
}, {
  "iso": "mn",
  "name": "Mongolian",
  "nativeName": "монгол"
}, {
  "iso": "na",
  "name": "Nauru",
  "nativeName": "Ekakairũ Naoero"
}, {
  "iso": "nv",
  "name": "Navajo, Navaho",
  "nativeName": "Diné bizaad, Dinékʼehǰí"
}, {
  "iso": "nb",
  "name": "Norwegian Bokmål",
  "nativeName": "Norsk bokmål"
}, {
  "iso": "nd",
  "name": "North Ndebele",
  "nativeName": "isiNdebele"
}, {
  "iso": "ne",
  "name": "Nepali",
  "nativeName": "नेपाली"
}, {
  "iso": "ng",
  "name": "Ndonga",
  "nativeName": "Owambo"
}, {
  "iso": "nn",
  "name": "Norwegian Nynorsk",
  "nativeName": "Norsk nynorsk"
}, {
  "iso": "no",
  "name": "Norwegian",
  "nativeName": "Norsk"
}, {
  "iso": "ii",
  "name": "Nuosu",
  "nativeName": "ꆈꌠ꒿ Nuosuhxop"
}, {
  "iso": "nr",
  "name": "South Ndebele",
  "nativeName": "isiNdebele"
}, {
  "iso": "oc",
  "name": "Occitan",
  "nativeName": "Occitan"
}, {
  "iso": "oj",
  "name": "Ojibwe, Ojibwa",
  "nativeName": "ᐊᓂᔑᓈᐯᒧᐎᓐ"
}, {
  "iso": "cu",
  "name": "Old Church Slavonic",
  "alternateNames": "Old Church Slavonic, Church Slavic, Church Slavonic, Old Bulgarian, Old Slavonic",
  "nativeName": "ѩзыкъ словѣньскъ"
}, {
  "iso": "om",
  "name": "Oromo",
  "nativeName": "Afaan Oromoo"
}, {
  "iso": "or",
  "name": "Oriya",
  "nativeName": "ଓଡ଼ିଆ"
}, {
  "iso": "os",
  "name": "Ossetian, Ossetic",
  "nativeName": "ирон æвзаг"
}, {
  "iso": "pa",
  "name": "Panjabi, Punjabi",
  "nativeName": "ਪੰਜਾਬੀ, پنجابی‎"
}, {
  "iso": "pi",
  "name": "Pāli",
  "nativeName": "पाऴि"
}, {
  "iso": "fa",
  "name": "Persian",
  "nativeName": "فارسی"
}, {
  "iso": "pl",
  "name": "Polish",
  "nativeName": "polski"
}, {
  "iso": "ps",
  "name": "Pashto, Pushto",
  "nativeName": "پښتو"
}, {
  "iso": "pt",
  "name": "Portuguese",
  "nativeName": "Português"
}, {
  "iso": "qu",
  "name": "Quechua",
  "nativeName": "Runa Simi, Kichwa"
}, {
  "iso": "rm",
  "name": "Romansh",
  "nativeName": "rumantsch grischun"
}, {
  "iso": "rn",
  "name": "Kirundi",
  "nativeName": "kiRundi"
}, {
  "iso": "ro",
  "name": "Romanian, Moldavian, Moldovan",
  "nativeName": "română"
}, {
  "iso": "ru",
  "name": "Russian",
  "nativeName": "русский язык"
}, {
  "iso": "sa",
  "name": "Sanskrit (Saṁskṛta)",
  "nativeName": "संस्कृतम्"
}, {
  "iso": "sc",
  "name": "Sardinian",
  "nativeName": "sardu"
}, {
  "iso": "sd",
  "name": "Sindhi",
  "nativeName": "सिन्धी, سنڌي، سندھی‎"
}, {
  "iso": "se",
  "name": "Northern Sami",
  "nativeName": "Davvisámegiella"
}, {
  "iso": "sm",
  "name": "Samoan",
  "nativeName": "gagana faa Samoa"
}, {
  "iso": "sg",
  "name": "Sango",
  "nativeName": "yângâ tî sängö"
}, {
  "iso": "sr",
  "name": "Serbian",
  "nativeName": "српски језик"
}, {
  "iso": "gd",
  "name": "Scottish Gaelic; Gaelic",
  "nativeName": "Gàidhlig"
}, {
  "iso": "sn",
  "name": "Shona",
  "nativeName": "chiShona"
}, {
  "iso": "si",
  "name": "Sinhala, Sinhalese",
  "nativeName": "සිංහල"
}, {
  "iso": "sk",
  "name": "Slovak",
  "nativeName": "slovenčina"
}, {
  "iso": "sl",
  "name": "Slovene",
  "nativeName": "slovenščina"
}, {
  "iso": "so",
  "name": "Somali",
  "nativeName": "Soomaaliga, af Soomaali"
}, {
  "iso": "st",
  "name": "Southern Sotho",
  "nativeName": "Sesotho"
}, {
  "iso": "es",
  "name": "Spanish; Castilian",
  "nativeName": "español, castellano"
}, {
  "iso": "su",
  "name": "Sundanese",
  "nativeName": "Basa Sunda"
}, {
  "iso": "sw",
  "name": "Swahili",
  "nativeName": "Kiswahili"
}, {
  "iso": "ss",
  "name": "Swati",
  "nativeName": "SiSwati"
}, {
  "iso": "sv",
  "name": "Swedish",
  "nativeName": "svenska"
}, {
  "iso": "ta",
  "name": "Tamil",
  "nativeName": "தமிழ்"
}, {
  "iso": "te",
  "name": "Telugu",
  "nativeName": "తెలుగు"
}, {
  "iso": "tg",
  "name": "Tajik",
  "nativeName": "тоҷикӣ, toğikī, تاجیکی‎"
}, {
  "iso": "th",
  "name": "Thai",
  "nativeName": "ไทย"
}, {
  "iso": "ti",
  "name": "Tigrinya",
  "nativeName": "ትግርኛ"
}, {
  "iso": "bo",
  "name": "Tibetan Standard",
  "alternateNames": "Tibetan Standard, Tibetan, Central",
  "nativeName": "བོད་ཡིག"
}, {
  "iso": "tk",
  "name": "Turkmen",
  "nativeName": "Türkmen, Түркмен"
}, {
  "iso": "tl",
  "name": "Tagalog",
  "alternateNames": "Wikang Tagalog, ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔",
  "nativeName": "Wikang Tagalog"
}, {
  "iso": "tn",
  "name": "Tswana",
  "nativeName": "Setswana"
}, {
  "iso": "to",
  "name": "Tonga (Tonga Islands)",
  "nativeName": "faka Tonga"
}, {
  "iso": "tr",
  "name": "Turkish",
  "nativeName": "Türkçe"
}, {
  "iso": "ts",
  "name": "Tsonga",
  "nativeName": "Xitsonga"
}, {
  "iso": "tt",
  "name": "Tatar",
  "nativeName": "татарча, tatarça, تاتارچا‎"
}, {
  "iso": "tw",
  "name": "Twi",
  "nativeName": "Twi"
}, {
  "iso": "ty",
  "name": "Tahitian",
  "nativeName": "Reo Tahiti"
}, {
  "iso": "ug",
  "name": "Uighur, Uyghur",
  "nativeName": "Uyƣurqə, ئۇيغۇرچە‎"
}, {
  "iso": "uk",
  "name": "Ukrainian",
  "nativeName": "українська"
}, {
  "iso": "ur",
  "name": "Urdu",
  "nativeName": "اردو"
}, {
  "iso": "uz",
  "name": "Uzbek",
  "nativeName": "zbek, Ўзбек, أۇزبېك‎"
}, {
  "iso": "ve",
  "name": "Venda",
  "nativeName": "Tshivenḓa"
}, {
  "iso": "vi",
  "name": "Vietnamese",
  "nativeName": "Tiếng Việt"
}, {
  "iso": "vo",
  "name": "Volapük",
  "nativeName": "Volapük"
}, {
  "iso": "wa",
  "name": "Walloon",
  "nativeName": "Walon"
}, {
  "iso": "cy",
  "name": "Welsh",
  "nativeName": "Cymraeg"
}, {
  "iso": "wo",
  "name": "Wolof",
  "nativeName": "Wollof"
}, {
  "iso": "fy",
  "name": "Western Frisian",
  "nativeName": "Frysk"
}, {
  "iso": "xh",
  "name": "Xhosa",
  "nativeName": "isiXhosa"
}, {
  "iso": "yi",
  "name": "Yiddish",
  "nativeName": "ייִדיש"
}, {
  "iso": "yo",
  "name": "Yoruba",
  "nativeName": "Yorùbá"
}, {
  "iso": "za",
  "name": "Zhuang, Chuang",
  "nativeName": "Saɯ cueŋƅ, Saw cuengh"
}]

},{}],46:[function(require,module,exports){
module.exports={
  "application_title" : {
    "message" : "LingSync beta",
    "description" : "The title of the application, displayed in the web store."
  },
  "application_description" : {
    "message" : "An on/offline fieldlinguistics database app which adapts to its user's I-Language.",
    "description" : "The description of the application, displayed in the web store."
  },
  "locale_Close_and_login_as_LingLlama" : {
    "message" : "Login as LingLlama",
    "description" : "button"
  },
  "locale_Close_and_login_as_LingLlama_Tooltip" : {
    "message" : "You can log in as LingLlama to explore the app pre-populated with data. There are also comments left by users to explain what widgets are for and how you can use them. If you're new to LingSync this is a great place to start after watching the videos. ",
    "description" : "tooltip"
  },
  "locale_Username" : {
    "message" : "Username:"
  },
  "locale_Password" : {
    "message" : "Password:"
  },
  "locale_Sync_my_data_to_this_computer" : {
    "message" : "Sync my data to this device"
  },
  "locale_Welcome_to_FieldDB" : {
    "message" : "Welcome to LingSync!"
  },
  "locale_An_offline_online_fieldlinguistics_database" : {
    "message" : "LingSync is a free, open source project developed collectively by field linguists and software developers to make a modular, user-friendly app which can be used to collect, search and share data, both online and offline."
  },
  "locale_Welcome_Beta_Testers" : {
    "message" : "<p>Welcome Beta Testers! Please sit back with a cup of tea and <a target='top' href='https://www.youtube.com/embed/videoseries?list=PL984DA79F4B314FAA'>watch this play list before you begin testing LingSync</a>. Leave us notes, bugs, comments, suggestions etc in the Contact Us/Bug Report form in the User Menu. Your feedback helps us prioritize what to fix/implement next!</p>"
  },
  "locale_Welcome_Screen" : {
    "message" : "<p>Curious what this is? <a target='top' href='https://www.youtube.com/embed/videoseries?list=PL984DA79F4B314FAA'>You can watch this play list to find out.</a>. You can find help and more info in the top right menu of the Corpus Dashboard.</p>"
  },
  "locale_Create_a_new_user" : {
    "message" : "Register"
  },
  "locale_What_is_your_username_going_to_be" : {
    "message" : "What is your username going to be?"
  },
  "locale_Confirm_Password" : {
    "message" : "Confirm Password:"
  },
  "locale_Sign_in_with_password" : {
    "message" : "Register"
  },
  "locale_Warning" : {
    "message" : "Warning!"
  },
  "locale_Instructions_to_show_on_dashboard" : {
    "comment" : "<p>Welcome! This is your Corpus dashboard. On the left side, there are Corpus and Elicitation Session quick-views, both of which you    can make full screen by clicking the icon on the top right corner. Full    screen shows you details of the Corpus and Elicitation Session. If this   is your first time seeing this message, you should change your corpus   title and description by clicking <i class=' icon-edit'></i>. You can hover over any    icon to see what the icon does. You should also change your session goals     and date for your first elicitation session.</p>    <p>For more help text, videos and userguide, click the <span class='caret'></span> on the top right corner of the app.     To more information about what a 'Corpus' is, click <i class=' icon-cogs resize-full'></i>.     It will show the corpus settings, which contains explanations of each component of a 'Corpus.'</p>    <p>This is the first draft of these instructions. Please help us make this better. <a href='https://docs.google.com/forms/d/18KcT_SO8YxG8QNlHValEztGmFpEc4-ZrjWO76lm0mUQ/viewform' target='_new'>Contact us</a> </p>",
    "message" : "<p>Welcome! This is your Corpus dashboard. If this is your first time seeing this message, please do the following: </p> <p><b>Corpus</b> On the left side, there is Corpus quick-view. Edit your corpus title and description by clicking <i class=' icon-edit'></i>. To see what Corpus consists of, click <i class=' icon-cogs resize-full'></i>. </p> <p><b>Elicitation Session</b> Below the Corpus quick-view, there is Elicitation Session quick-view. Edit the goal and date for your first elicitation session by clicking <i class=' icon-edit'></i>. Click <i class=' icon icon-resize-full'></i> to see more details of Elicitation Session. </p> <p> You can hover over any icon to see what the icon does. For more help text, videos and userguide, click the <span class='caret'></span> on the top right corner of the app. </p> <p>This is the first draft of these instructions. Please help us make this better. <a href='https://docs.google.com/forms/d/18KcT_SO8YxG8QNlHValEztGmFpEc4-ZrjWO76lm0mUQ/viewform' target='_new'>Contact us</a> </p>"

  },
  "locale_elicitation_sessions_explanation" : {
    "message" : "<p>Like in the real world, an Elicitation Session can have a variety of forms. For example: a 1 hour session with a language consultant, a 3 hour field methods class with several speakers, an extended conversation or narrative, or data from a file import. </p> <p>You can describe various aspects of an Elicitation Session such as date, goal/topic, consultant(s), etc. by clicking the <i class='icons icon-edit'></i> icon in Dashboard view. For additional options, click on the <i class='icon-calendar'></i> icon beside the session name in the list below.</p> <p>Any description you enter will be displayed in the list of Elicitation Sessions below to help you identify them. This information will also be automatically copied into every Datum that is associated with the Session, so that you can search for individual Datum by date, consultant, dialect, etc. </p>"
  },
  "locale_datalists_explanation" : {
    "message" : "<p>A Datalist is a collection of Datum that you put together for some reason. Some examples are: making a handout, sharing data with someone, exporting into another program, or simply keeping track of similar Datum for your research.</p> <p> Creating a Datalist is like making a bookmark to a set of custom search results. First, do a search for whatever you want the Datalist to be about. Then, if you don't want some of the results to be included in the Datalist, click the <i class='icon-remove-sign'></i> icon by any Datum to remove it. Finally, edit the title and description, and click the save button to create the Datalist.</p> <p>You can see your Datalists on the left side of your dashboard (click plus/minus to expand/minimize) or in the list below (double-click on a title to view details). </p><p>To see all your data, do a search with nothing in the search bar. If you have over 200 Datum in your corpus, this can be pretty slow, so you may prefer to search for a subset. In general, a Datalist with more than 100 Datum will take a few seconds to load.</p> <p> In the Datalist view, the Datum will appear in the colour of their current state (i.e. Checked with a consultant, To be checked, Deleted etc). You can make new states in the Datum State Settings on this page. </p>"
  },
  "locale_permissions_explanation" : {
    "message" : "<p>Permissions are where you give other people access to your corpus.</p><p>To add another LingSync user, you need to know their username. Click the <i class='icons icon-edit'></i> icon at the top right and then come back to Permissions and click the 'See current team members' button. You can then add users by typing in their username by the appropriate group.</p> <ul><li>Admins can add other people to any group but not do anything with the data unless they are also writers/readers.</li> <li>Writers can enter new data, add comments, change Datum State from 'to be checked to 'checked' etc, but not see data that is already entered. </li><li>Readers can see data that is already entered in the app but not edit or comment on it. </li></ul><p>If you want someone to be able to both enter data and see existing data, add them as both a writer and a reader.</p><p>If you want to make your corpus public and findable on Google as recommended by EMLED data management best practices, type 'Public' in the 'Public or Private' field below.</p><p>You can, and should, encrypt any Datum containing sensitive information by clicking the <i class=' icon-unlock'></i> button at the bottom of the Datum. Encrypted Datums are shown as 'xxx xx xx xx' to all users, including on the web. If you want to see the contents of a confidential Datum, click on the <i class='icon-eye-open'></i> and enter your password. This will make the Datum visible for 10 minutes.</p>"
  },
  "locale_datum_fields_explanation" : {
    "message" : "<p>Datum Fields are fields where you can add information about your Datum. There fields are automatically detected when you import data, so if you have data already, you should import it to save you time configuring your corpus. </p> <p>By default, the app comes with 4 fields which it uses to create inter-linearized glosses (the pretty view which you are used to seeing in books and handouts). You can add any number of fields (we have tested using over 400 fields). </p> <p>In the Datum Edit view, the fields that are used most frequently in your corpus will automatically appear when you open a Datum, and you can click on <i class='icon-list-alt'> </i> to see the rare fields. </p><p>The fields in your corpus (shown below) are automatically available in search. You can choose to encrypt particular fields (e.g. utterance). If you mark a Datum as confidential, the encrypted fields will be encrypted in the database and masked from the user as 'xxx xx xxxxx'. For example, you may choose to not encrypt a lambda calculus field or a grammatical notes field, as these are usually purely a linguistic formalism and may not transmit any personal information which your consultants would like to keep confidential. </p><p> Each Datum Field has a help convention, which is the text you see below. Use this to help everyone remember what information goes in which field. Anyone who can enter data in your corpus can see these help conventions by clicking the <i class='icon-question-sign'></i> next to the Datum Field label in the Datum Edit view. </p><p>You can edit the help text by clicking <i class='icons icon-edit'></i> icon at the top right. These help conventions are also exported as a README.txt when you export your data, as recommended by EMELD data management best practices. </p>"
  },
    "locale_conversation_fields_explanation" : {
    "message" : "<p>Conversation Fields are fields which where you can add information about your Conversation. As defaults the conversation comes with 2 fields (audio and speakers), and each turn of the conversation (each Datum within it) comes with the usual 4 default datum fields.  You can add any number of fields here if they are relevant to the WHOLE conversation (ex: location, context, world knowledge, sociolinguistic variables).  The conversation fields in your corpus (shown below) are automatically available in the search. You can choose to encrypt particular fields (e.g. utterance). If you mark a Conversation as confidential, the encrypted fields will be encrypted in the database and masked from the user as 'xxx xx xxxxx'. For example, you may choose to not encrypt a 'location' field, but instead choose to encrypt a 'world knowledge' field as it may contain sensitive personal information which consultants would not want public. Each Conversation field can have a help convention, which is the text you see below. Your team members can see these help/conventions by clicking the <i class='icon-question-sign'></i> next to the Conversation field label in the Conversation Edit view. These help conventions are also exported as a README.txt when you export your data, as recommended by EMELD data management best practices. </p>"
  },
  "locale_datum_states_explanation" : {
    "message" : "<p>Datum States are used to keep track of whether the data is valid or invalid, for example, 'Checked' with a consultant, 'To be checked', 'Deleted' etc. </p> <p>Datum States can be as detailed as you choose. You can create your own Datum States for your own corpus to help you manage your team's data validation workflow (e.g. 'To be checked with Sophie,' 'Checked with Gladys').  You can assign colours to your Datum States, which will appear as the background colour of the Datum in any Datalist. </p> <p> If you flag a Datum as Deleted it won't show up in search results anymore, but a Datum in a corpus is never really deleted. It remains in the database complete with its change history so that you can review it at a later date. (In future we might add a button to allow users to 'empty the trash' and mass-delete old Datum from the system.) </p> "
  },
   "locale_advanced_search_explanation" : {
    "message" : "<p>Search errs on the side of including more results, rather than missing anything. </p> <p>For example, you can type 'nay' and search will find the morphemes 'onay', 'naya' etc. </p> <p>Search automatically creates a temporary list of data. If you enter new matching data, it will be added automatically this can be a handy way to see the data you have entered recently, as you enter data.. If you want to keep the list of data, click Save and a new DataList will be created. </p> <p>For now, search is offline, running on your device, but we would eventually like to have a more advanced search that works online, sorts results better, and could let you search for minimal pairs using features.</p>"
   },
  "locale_New_User" : {
    "message" : "New User"
  },
  "locale_Activity_Feed_Your" : {
    "message" : "Your Activity Feed"
  },
  "locale_Activity_Feed_Team" : {
    "message" : "Corpus Team Activity Feed"
  },
  "locale_Refresh_Activities" : {
    "message" : "Refresh activity feed to bring it up-to-date."
  },
  "locale_Need_save" : {
    "message" : " Need save:"
  },
  "locale_60_unsaved" : {
    "message" : "<strong>60% unsaved.</strong>"
  },
  "locale_Recent_Changes" : {
    "message" : "Recent Changes:"
  },
  "locale_Need_sync" : {
    "message" : "Need sync:"
  },
  "locale_Differences_with_the_central_server" : {
    "message" : "Differences with the central server:"
  },
  "locale_to_beta_testers" : {
    "message" : "These messages are here to communicate to users what the app is doing. We will gradually reduce the number of messages as the app becomes more stable. <p>You can close these messages by clicking on their x.</p>"
  },
  "locale_We_need_to_make_sure_its_you" : {
    "message" : "We need to make sure it's you..."
  },
  "locale_Yep_its_me" : {
    "message" : "Yep, it's me"
  },
  "locale_Log_Out" : {
    "message" : "Log Out"
  },
  "locale_Log_In" : {
    "message" : "Log In"
  },
  "locale_User_Settings" : {
    "message" : "User Settings"
  },
  "locale_Keyboard_Shortcuts" : {
    "message" : "Keyboard Shortcuts"
  },
  "locale_Corpus_Settings" : {
    "message" : "Corpus Settings"
  },
  "locale_Terminal_Power_Users" : {
    "message" : "Power Users Backend"
  },
  "locale_New_Datum" : {
    "message" : "New Datum"
  },
  "locale_New_menu" : {
    "message" : "New"
  },
  "locale_New_Conversation" : {
  	"message" : "New Conversation"
  },
  "locale_New_Data_List" : {
    "message" : "New Data List"
  },
  "locale_New_Session" : {
    "message" : "New Session"
  },
  "locale_New_Corpus" : {
    "message" : "New Corpus"
  },
  "locale_Data_menu" : {
    "message" : "Data"
  },
  "locale_Import_Data" : {
    "message" : "Import Data"
  },
  "locale_Export_Data" : {
    "message" : "Export Data"
  },
  "locale_All_Data" : {
    "message" : "All Data"
  },
  "locale_All_Speakers" : {
    "message" : "All (Native/Heritage) Speakers"
  },
  "locale_All_Language_Consultants" : {
    "message" : "All Language Consultants"
  },
  "locale_All_Participants" : {
    "message" : "All Participants"
  },
  "locale_All_Users" : {
    "message" : "All Users"
  },
  "locale_All_Elicitation_Sessions" : {
    "message" : "All Elicitation Sessions"
  },
  "locale_All_Datalists" : {
    "message" : "All Datalists"
  },
  "locale_Save" : {
    "message" : "Save"
  },
  "locale_Title" : {
    "message" : "Title:"
  },
  "locale_Description" : {
    "message" : "Description:"
  },
    "locale_Copyright" : {
    "message" : "Corpus Copyright:"
  },
    "locale_License" : {
    "message" : "Corpus License:"
  },
    "locale_License_explanation" : {
    "message" : "If you make a portion of your corpus available to other people, EMELD recommends that you document clearly your terms of use, and apply a license to enforce them. For easy to understand standard licenses, you can consult <a href='http://creativecommons.org/licenses/' target='_blank'>Creative Commons</a>. Creative Commons licenses are applied to most web/community owned/created data, be it Wikipedia or other popular content sharing websites and mobile apps."
  },
    "locale_Terms_of_use" : {
    "message" : "Corpus Terms of Use:"
  },
    "locale_Terms_explanation" : {
    "message" : "When you decide to make a portion of your corpus public, EMELD recommend that you cleary state your Terms of Use with your corpus. You can modify the sample of “Terms of Use” in the textbox below according to the policy of your project (be sure to discuss with other project members and affected parties before deciding on your terms of use). Please also try to choose a license which makes sense with your Terms of Use. For your reference, see also the terms of use for other corpora such as: <a href='http://www.aiatsis.gov.au/collections/muraread.html' target='_blank'>Mura</a>, <a href='http://www.paradisec.org.au/services.html' target='_blank'>PARADISEC</a>, <a href='http://linguistics.berkeley.edu/~survey/archive/terms-of-use.php' target='_blank'>Survey of California and Other Indian Languages</a> "
  },
  "locale_Sessions_associated" : {
    "message" : "Elicitation Sessions associated with this corpus"
  },
  "locale_Datalists_associated" : {
    "message" : "Datalists associated with this corpus"
  },
  "locale_Permissions_associated" : {
    "message" : "Permissions associated with this corpus"
  },
  "locale_Datum_field_settings" : {
    "message" : "Datum Field Settings"
  },
  "locale_Conversation_field_settings" : {
    "message" : "Conversation Field Settings"
  },
  "locale_Encrypt_if_confidential" : {
    "message" : "Encrypt if confidential:"
  },
  "locale_Help_Text" : {
    "message" : "Help Text:"
  },
  "locale_Add" : {
    "message" : "Add"
  },
  "locale_Datum_state_settings" : {
    "message" : "Datum State Settings"
  },
  "locale_Green" : {
    "message" : "Green"
  },
  "locale_Orange" : {
    "message" : "Orange"
  },
  "locale_Red" : {
    "message" : "Red"
  },
  "locale_Blue" : {
    "message" : "Blue"
  },
  "locale_Teal" : {
    "message" : "Teal"
  },
  "locale_Black" : {
    "message" : "Black"
  },
  "locale_Default" : {
    "message" : "Default"
  },
  "locale_Elicitation_Session" : {
    "message" : "Elicitation Session"
  },
  "locale_Export" : {
    "message" : "Export"
  },
  "locale_Actions" : {
    "message" : "Actions"
  },
  "locale_Navigation" : {
    "message" : "Navigation"
  },
  "locale_Datum_Status_Checked" : {
    "message" : "Mark Datum status as checked/verified with language consultant"
  },
  "locale_Next_Datum" : {
    "message" : "Next Datum"
  },
  "locale_Previous_Datum" : {
    "message" : "Previous Datum"
  },
  "locale_Data_Entry_Area" : {
    "message" : "Data Entry Area <small>(1-200 datum)</small>"
  },
  "locale_Search" : {
    "message" : "Type your search query, or hit enter to see all data"
  },
  "locale_View_Profile_Tooltip" : {
    "message" : "Click to view user's page"
  },
  "locale_View_Public_Profile_Tooltip" : {
    "message" : "View/edit your public user's page"
  },
  "locale_Edit_User_Profile_Tooltip" : {
    "message" : "Click to edit your user profile"
  },
  "locale_Public_Profile_Instructions" : {
    "message" : "This is your public user's page. You can edit it to change/remove information. This is what your team members can see when they click on your gravatar. All of this information (including your gravatar) can be different from the information in your private profile."
  },
  "locale_Private_Profile_Instructions" : {
    "message" : "This is your private profile."
  },
  "locale_Edit_Public_User_Profile" : {
    "message" : "Edit my public user's page"
  },
  "locale_Close" : {
    "message" : "Close"
  },
  "locale_New_Corpus_Instructions" : {
    "message" : "Edit the fields below to create a new corpus, or push ESC to enter more data in the current corpus"
  },
  "locale_New_Corpus_Warning" : {
    "message" : " The New Corpus functionality still needs more testing, this message will disappear when New Corpus is not experimental."
  },
  "locale_Cancel" : {
    "message" : "Cancel"
  },
  "locale_Next" : {
    "message" : "Next"
  },
  "locale_Show" : {
    "message" : "Show"
  },
  "locale_per_page" : {
    "message" : "per page"
  },
  "locale_New_Session_Instructions" : {
    "message" : "<p>Edit the fields below to create a new elicitation session, or push ESC to enter more data in the current session.</p>"
  },
  "locale_Consultants" : {
    "message" : "Consultant(s):"
  },
  "locale_Goal" : {
    "message" : "Goal:"
  },
  "locale_When" : {
    "message" : "When:"
  },
  "locale_Save_And_Import" : {
    "message" : "Save and Finish Importing"
  },
  "locale_Import" : {
    "message" : "Import"
  },
  "locale_percent_completed" : {
    "message" : "% completed."
  },
  "locale_Import_Instructions" : {
    "comment" : " <ol> <li>Type, or Drag and drop a file/text (csv, txt, tabbed, xml, text, eaf, sf) to the area indicated below.</li> <li>(Edit/type in the text area to correct information as needed.)</li> <li>Associate your corpus's existing default data fields with the appropriate columns by either dragging the colored datum fields, or by typing in the column header input box .</li> <li>Type in any other column headings that you want to keep in your data, the app will automatically add these to the corpus' default datum fields. This means that you can search through them to locate your data. Each row in the table will be come a 'datum' in your corpus database.</li> <li>Click on the Attempt Import button at any time to see what your data will look like in a interlinear glossed data list.</li> <li>Review the interlinear glossed data list which appears on the left to see if the import looks good.</li> <li>(Continue to edit the table cells as needed, click Attempt Import and review data list as many times as you would like until the import looks correct).</li> <li>When satisfied with the data list, click Save and your data will be imported into your corpus. A new elicitation session will be created using the date modified of the file you imported (if you want, you can edit this session later to add a more accurate goal discussing why the file was originally created), a new data list will also be created which contains all these data since it is likely that you grouped this data together into a file for a reason in the first place. You can find the resulting new default datum fields, session, and data list in your Corpus Settings page.</li><li>(Click on the home button to do something else while it imports your data in the background.)</li> </ol>",
    "message" : "Everyone's data is different. <a href='http://www.facebook.com/LingSyncApp'>You might know some fellow users who might be able to help you import yours: </a>"
  },
  "locale_Import_First_Step" : {
    "message" : "<p>Step 1: Drag & drop, copy-paste or type your data into the text area, or select audio/video file(s) from your computer. Yes, you can edit the data inside the text area.</p>"
  },
    "locale_Import_Second_Step" : {
    "message" : "<p>Step 2: Drag and drop or type the field names in column headers. Edit data in the table as needed.</p>"
  },
  "locale_Import_Third_Step" : {
    "message" : "<p>Step 3: The imported data will look like this. Edit in the table or the text area above as needed. Edit the datalist title and description, and the eliciation session section before finishing import. </p>"
  },
  "locale_Drag_Fields_Instructions" : {
    "message" : "<p>Drag (or type) the coloured datum fields to the column headings which match. Type in any additional column headings which you would like to keep as datum fields. The columns will become default datum fields in your corpus database and will also become fields that you can search through to locate your data. Each row will become a 'datum' in your corpus database.</p>"
  },
  "locale_Add_Extra_Columns" : {
    "message" : "Insert Extra Columns"
  },
  "locale_Attempt_Import" : {
    "message" : "Preview Import"
  },
  "locale_LaTeX_Code" : {
    "message" : "LaTeX Code:"
  },
  "locale_Unicode_Instructions" : {
    "message" : "By default this is also a keyboard shortcut to type this character in a datum field. To customize the shortcut:"
  },
  "locale_Remove_Unicode" : {
    "message" : "Remove Unicode"
  },
  "locale_Unicode" : {
    "message" : "Unicode"
  },
  "locale_Drag_and_Drop" : {
    "message" : "<small>Drag and Drop</small>"
  },
  "locale_AND" : {
    "message" : "AND"
  },
  "locale_OR" : {
    "message" : "OR"
  },
  "locale_Advanced_Search" : {
    "message" : "Advanced Search"
  },
  "locale_Advanced_Search_Tooltip" : {
    "message" : "Advanced Search allows you to use your corpus-wide datum fields or session details to search for datum, using either AND or OR with substring match."
  },
  "locale_User_Profile" : {
    "message" : "User Profile"
  },
  "locale_Private_Profile" : {
    "message" : "User Profile"
  },
  "locale_Public_Profile" : {
    "message" : "Public Profile"
  },
  "locale_Email" : {
    "message" : "Email:"
  },
  "locale_Research_Interests" : {
    "message" : "Research Interests:"
  },
  "locale_Affiliation" : {
    "message" : "Affiliation:"
  },
  "locale_Corpora" : {
    "message" : "Corpora:"
  },
  "locale_Gravatar" : {
    "message" : "Gravatar"
  },
  "locale_Gravatar_URL" : {
    "message" : "Gravatar URL:"
  },
  "locale_Firstname" : {
    "message" : "First name:"
  },
  "locale_Lastname" : {
    "message" : "Last name:"
  },
  "locale_Skin" : {
    "message" : "Skin:"
  },
  "locale_Background_on_Random" : {
    "message" : "Background on Random"
  },
  "locale_Transparent_Dashboard" : {
    "message" : "Transparent Dashboard"
  },
  "locale_Change_Background" : {
    "message" : "Change Background"
  },
  "locale_Number_Datum" : {
    "message" : "Number of Datum to appear at a time:"
  },
  "locale_Help_Text_Placeholder" : {
    "message" : "Put a help text or your team data entry conventions for this field here (optional)."
  },
  "locale_Add_Placeholder" : {
    "message" : "Add...."
  },
  "locale_Datalist_Description" : {
    "message" : "You can use Datalists to create handouts or to prepare for sessions with consultants, or to share with collaborators."
  },
  "locale_Add_Tag" : {
    "message" : "New Tag..."
  },
  "locale_Drag_and_Drop_Placeholder" : {
    "message" : "Drag and drop, copy-paste or type your data here."
  },
  "locale_Paste_Type_Unicode_Symbol_Placeholder" : {
    "message" : "Paste/type unicode symbol"
  },
  "locale_TIPA_shortcut" : {
    "message" : "TIPA/keyboard shortcut"
  },
  "locale_Show_Activities" : {
    "message" : "Show Activities"
  },
  "locale_Hide_Activities" : {
    "message" : "Hide Activities"
  },
  "locale_Show_Dashboard" : {
    "message" : "Show dashboard with data entry form"
  },
  "locale_Save_on_this_Computer" : {
    "message" : "Save on this device."
  },
  "locale_Sync_and_Share" : {
    "message" : "Sync and share with team"
  },
  "locale_Show_Readonly" : {
    "message" : "Show read only"
  },
  "locale_Show_Fullscreen" : {
    "message" : "Show full screen"
  },
  "locale_Add_New_Datum_Field_Tooltip" : {
    "message" : "Add new datum field"
  },
  "locale_Add_New_Conversation_Field_Tooltip" : {
    "message" : "Add new conversation field"
  },
  "locale_Add_New_Datum_State_Tooltip" : {
    "message" : "Add new datum state"
  },
  "locale_Show_in_Dashboard" : {
    "message" : "Show in dashboard"
  },
  "locale_Edit_corpus" : {
    "message" : "Edit Corpus"
  },
  "locale_Show_corpus_settings" : {
    "message" : "Show Corpus Settings"
  },
  "locale_Drag_and_Drop_Audio_Tooltip" : {
    "message" : "Drag and drop audio over the audio player to attach an audio file. Drag and drop option for YouTube videos coming soon."
  },
  "locale_Play_Audio" : {
    "message" : "Play audio"
  },
  "locale_Play_Audio_checked" : {
    "message" : "Play audio of checked items"
  },
  "locale_Remove_checked_from_datalist_tooltip" : {
    "message" : "Remove checked datum from this data list (they will still be in the corpus). "
  },
  "locale_Plain_Text_Export_Tooltip" : {
    "message" : "Export as plain text/Copy to clipboard"
  },
  "locale_Plain_Text_Export_Tooltip_checked" : {
    "message" : "Export as plain text/Copy checked items to clipboard"
  },
  "locale_Duplicate" : {
    "message" : "Duplicate datum to create a minimal pair"
  },
  "locale_Encrypt" : {
    "message" : "Make this datum confidential"
  },
  "locale_Encrypt_checked" : {
    "message" : "Make checked items confidential"
  },
  "locale_Decrypt_checked" : {
    "message" : "Remove confidentiality from checked items (Warning: this will save them as decrypted in the database). If you just want to unmask them so you can edit edit them, click on the eye instead."
  },
  "locale_Decrypt" : {
    "message" : "Remove confidentiality from this datum (Warning: this will save it as decrypted in the database). If you just want to unmask it so you can edit edit it, click on the eye instead."
  },
  "locale_Show_confidential_items_Tooltip" : {
    "message" : "Unmask confidential/encrypted data so that it can be edited and read for the next 10 minutes."
  },
  "locale_Hide_confidential_items_Tooltip" : {
    "message" : "Return to masked view of confidential/encrypted data"
  },
  "locale_Edit_Datalist" : {
    "message" : "Edit Data List"
  },
  "locale_Export_checked_as_LaTeX" : {
    "message" : "Export checked as LaTeX"
  },
  "locale_Export_checked_as_CSV" : {
    "message" : "Export checked as CSV"
  },
  "locale_Hide_Datalist" : {
    "message" : "Hide datalist"
  },
  "locale_Show_Datalist" : {
    "message" : "Show datalist"
  },
  "locale_Edit_Datum" : {
    "message" : "Edit Datum"
  },
  "locale_See_Fields" : {
    "message" : "Hide/Show infrequent fields"
  },
  "locale_Add_Tags_Tooltip" : {
    "message" : "Add a tag to this datum. Tags can be used to categorize datum, count how many datum of each tag you have, and search datum."
  },
  "locale_Edit_Session" : {
    "message" : "Edit Session"
  },
  "locale_Show_Unicode_Palette" : {
    "message" : "Show Unicode Palette"
  },
  "locale_Hide_Unicode_Palette" : {
    "message" : "Hide Unicode Palette"
  },
  "locale_Add_new_symbol" : {
    "message" : "Add new symbol"
  },
  "locale_Public_or_Private" : {
    "message" : "Public or Private:"
  },
  "locale_Insert_New_Datum" : {
    "message" : "Insert a new datum on top of the dashboard center"
  },
  "locale_LaTeX" : {
    "message" : "Export datum as LaTeX"
  },
  "locale_CSV_Tooltip" : {
    "message" : "Export datum as CSV"
  },
  "locale_of" : {
    "message" : "of"
  },
  "locale_pages_shown" : {
    "message" : "pages shown"
  },
  "locale_More" : {
    "message" : "More"
  }
}

},{}],47:[function(require,module,exports){
module.exports={
  "application_title" : {
    "message" : "iCampo beta"
  },
  "application_description" : {
    "message" : "Un aplicacion de colección de datos linguisticos."
  },
  "locale_Close_and_login_as_LingLlama" : {
    "message" : "Entrar como LingLlama",
    "description" : "button"
  },
  "locale_Close_and_login_as_LingLlama_Tooltip" : {
    "message" : "TODO translate You can log in as LingLlama to explore the app pre-populated with data. There are also comments left by users to explain what widgets are for and how you can use them. If you're new to FieldDB this is a great place to start after watching the videos.",
    "description" : "tooltip"
  },
  "locale_Username" : {
    "message" : "Usuario:"
  },
  "locale_Password" : {
    "message" : "Contraseña:"
  },
  "locale_Sync_my_data_to_this_computer" : {
    "message" : "Sincronisa mis datos con esta computadora"
  },
  "locale_Welcome_to_FieldDB" : {
    "message" : "¡Bienvenido a iCampo! <small>beta</small>"
  },
  "locale_An_offline_online_fieldlinguistics_database" : {
    "message" : "Un aplicacion de coleccion de datos linguisticos...gratis y OpenSource"
  },
  "locale_Welcome_Beta_Testers" : {
    "message" : "¡Bienvenidos! Por favor <a target='top' href='https://www.youtube.com/embed/videoseries?list=PL984DA79F4B314FAA'>vea estos tutoriales antes de empezar de probar iCampo</a>. Dejanos notas, comentarios, sugerencias en la forma abajo."
  },
  "locale_Create_a_new_user" : {
    "message" : "Crear un nuevo usuario"
  },
  "locale_What_is_your_username_going_to_be" : {
    "message" : "¿Que quieres por su usuario?"
  },
  "locale_Confirm_Password" : {
    "message" : "Confirme su contraseña:"
  },
  "locale_Sign_in_with_password" : {
    "message" : "Registrar"
  },
  "locale_Warning" : {
    "message" : "¡Aviso!"
  },
  "locale_Instructions_to_show_on_dashboard" : {
    "message" : "TODO translate instructions"
  },
  "locale_elicitation_sessions_explanation" : {
    "message" : "<p>TODO translate An Elicitation Session is very similar to an elicitation session in the real world. This could be a 1-hour Session with one language consultant, or a 3-hour field methods class, or data from a file import. Generally an elicitation session happens on a specific day, or across a few days, you can write a date or text in the 'dateElicited' field. Often we have a goal set out when we meet for an elicitation Session, if you want, you can put this into the 'Goal' field of the Sessions and it will appear in the Session quick links below. An Elicitation Session has many fields which you can edit by clicking on the <i class='icon-calendar'></i> icons in the app to see the details. These fields are information which is common to all datum elicited that day for example, the dialect, perhaps the language consultants present the date etc. The Session fields are copied into the Datum that were elicited during that Session, this makes it possible to search for Datum containing a particular dialect and/or speaker etc. </p>"
  },
  "locale_datalists_explanation" : {
    "message" : "<p>TODO translate A Datalist is a collection of Datum that you put together for a reason, it could be to prepare  a handout, to share some of your data with someone, to export into another program or simply to keep track of similar Datum for your research. You could think of Datalists as curated search results that the app remembers for you. Datalists have titles and descriptions, their titles appear as links below. You can click on the links to see the details of the  Datalist. In the Datalist view, the Datum will appear in the colour of their current state (i.e. Checked with a consultant, To be checked, Deleted etc). You can make new states in the Datum State Settings on this page. You can create new Datalists by doing a search for what you want to be in the Datalist. You can refine the Datalist items by clicking on <i class='icon-remove-sign'></i> to remove Datum in the Datalist view. The Datalist view is normally on the left side of your dashboard, you can see it by double clicking on a Datalist in the list below. If you want to see all your data click on the 'All Data' link below, this will load all your data into a Datalist view. If you have over 200 Datum in your corpus, this can be pretty slow. If you have a large corpus you may prefer searching for a subset of your data rather than skimming all of it at once. In general, any Datalist with more than 100 Datum takes a few seconds to load and display all the Datum it contains. </p>"
  },
  "locale_permissions_explanation" : {
    "message" : "<p>TODO translate Permissions are where you give your team members access to your corpus. Add users to the 'Admin' group if you want to let them add other team members. Add users to the 'Writers' group if you want to let them add comments, enter new data, change Datum State from 'to be checked to 'checked' etc. For example, if you would like to allow your language consultant to enter or check data, you can put them in the 'writers' group. Add users to the 'Readers' group if you want them to be able to see your data, but not modify it. For example, you might want to share your data with other researchers outside of your team, but you might not want them to leave comments or modify , or mass-export the data. If you want to make your corpus public and findable on Google as recommended by EMLED data management best practices, click the Public checkbox. Don't worry, if your corpus contains confidential or personal information you can, and should, encrypt the Datum containing sensitive information using the <i class=' icon-unlock'></i> buttons. Data which are encrypted are shown as 'xxx xx xx xx' to all users, including on the web. If you want to see the contents of the confidential datum you have to click on the <i class='icon-eye-open'></i>, it will prompt you for your password to make sure you are really you. This will make confidential data visible for 10 minutes.</p>"
  },
  "locale_datum_fields_explanation" : {
    "message" : "<p>TODO translate Datum Fields are fields which where you can add information about your Datum. There fields are automatically detected when you import data, so if you have data already, you should import it to save you time configuring your corpus. As defaults the app comes with 4 fields which it uses to create inter-linear-glossed text views (i.e. pretty view which you are used to seeing in books and handouts). You can add any number of fields (we have tested using over 400 fields). In the Datum Edit view, the fields that are used most frequently in your corpus will automatically appear when you open a Datum, and you can click on <i class='icon-list-alt '> </i> to see the rare fields. The fields in your corpus (shown below) are automatically available in the search. You can choose to encrypt particular fields (e.g. utterance). If you mark a Datum as confidential, the encrypted fields will be encrypted in the database and masked from the user as 'xxx xx xxxxx'. For example, you may choose to not encrypt a lambda calculus field, or a grammatical notes field, as these are usually purely a linguistic formalism and may not transmit any personal information which your consultants would like to keep confidential. Each Datum Fields can have a help convention, which is the text you see below. Your team members can see these help/conventions by clicking the <i class='icon-question-sign'></i> next to the Datum Field label in the Datum Edit view. These help conventions are also exported as a README.txt when you export your data, as recommended by EMELD data management best practices. </p>"
  },
  "locale_datum_states_explanation" : {
    "message" : "<p>TODO translate Datum States are used to keep track of whether the data is valid or invalid, for example, 'Checked' with a consultant, 'To be checked', 'Deleted' etc. Datum States can be as detailed as you choose. You can create your own Datum States for your own corpus to help you manage your team's data validation workflow (e.g. 'To be checked with Sophie,' 'Checked with Gradys').  You can assign colours to your Datum States, these colours will appear in your data list. You can flag a Datum as Deleted and it won't show up in search results. A Datum in a corpus is never really deleted, it remains in the database complete with its change history so that you can review it at a later date.  (In future we might add a button to allow users to 'empty the trash' and mass-delete old Datum from the system.) </p> "
  },
   "locale_advanced_search_explanation" : {
    "message" : "<p>TODO translate There are two ways to access Search, you can type in your query in the search box which is always present on the top left of the screen, or you can click on the button next to it to get to the Advanced Search. Search is very important to field linguists, this is why we made the Search very powerful, and we are planning on making it more powerful in the future. You can type any string of characters in the Datum or Session Fields below. The search will look through the datum of your corpus, and find datum which contain that substring, this means you can type 'nay' and you will get morphemes 'onay' 'naya' etc. While this is not ideal for finding allomorphs, it works pretty well. Right now the search is happening on your computer, offline. In the future we will be adding a 'lexicon webservice' which will work on indexing your morphemes glosses etc to make search faster, but also smarter by build a more linguistically informed indexes of your data so that you can use linguistic constructs to search for your data as you do naturally when you search with your eyes, rather than with a database. We also have planned a 'Dream' module for phonological search that essentially uses a feature geometry ontology to let you search for minimal pairs. A search automatically creates a temporary Datalist, which appears below the Session quick view on the left side of the screen. You can choose to rename and save this Datalist if created a collection of data that you wanted. You can also leave this search data list open, if you enter new datum which matched your search query that appears in the top left corner, they will automatically appear in the search data list too. This can be handy for you to see datum around a certain phenomena while you are entering new data. If your search query is hard to formulate to get all the examples you need, you can search for nothing (leave all fields blank) and it will return all your data as a new Datalist. In general we have decided to implement search such that it errs on the side of high recall, i.e. that it finds all relevant examples, but also returns some garbage, rather than high precision, i.e. that it finds only exact examples, but misses some relevant ones. Currently the search results are not sorted by relevancy to the query. Once we have a proper 'lexicon webservice' we will have more measures of relevancy and will be able to return results and their relevancy scores. </p>"
   },
  "locale_New_User" : {
    "message" : "Usuario Nuevo"
  },
   "locale_Activity_Feed_Your" : {
    "message" : "TODO translate Your Canal de Actividad"
  },
  "locale_Activity_Feed_Team" : {
    "message" : "TODO translate Corpus Team Canal de Actividad"
  },
  "locale_Refresh_Activities" : {
    "message" : "TODO translate"
  },
  "locale_View_Profile_Tooltip" : {
    "message" : "TODO translate Click to view user's page"
  },
  "locale_View_Public_Profile_Tooltip" : {
    "message" : "TODO translate View/edit your public user's page"
  },
  "locale_Edit_User_Profile_Tooltip" : {
    "message" : "TODO translate Click to edit your user profile"
  },
  "locale_Public_Profile_Instructions" : {
    "message" : " TODO translateThis is your public profile, you can edit it to change/remove information. This is what people can see when they click on your gravatar."
  },
  "locale_Private_Profile_Instructions" : {
    "message" : "TODO translate This is your private profile, only you members on your team can see it."
  },
  "locale_Edit_Public_User_Profile" : {
    "message" : "TODO translate Edit My Public Profile"
  },
  "locale_Need_save" : {
    "message" : "Se ocupa guadar:"
  },
  "locale_60_unsaved" : {
    "message" : "<strong>60% sin guardar.</strong>"
  },
  "locale_Recent_Changes" : {
    "message" : "Cambios Recientes:"
  },
  "locale_Need_sync" : {
    "message" : "Se ocupa sincronisar:"
  },
  "locale_Differences_with_the_central_server" : {
    "message" : "Diferencias con el servidor central:"
  },
  "locale_to_beta_testers" : {
    "message" : "Estos mensajes son para comunicar con los provadores que hace la aplicación. Los mensajes se desapareserán cuando la aplicación esta mas estable. <p>Puedes cerrar los mensajes con el x.</p>"
  },
  "locale_We_need_to_make_sure_its_you" : {
    "message" : "Ocupamos asegurar que es ustéd..."
  },
  "locale_Yep_its_me" : {
    "message" : "¡Si, soy yo!"
  },
  "locale_Log_Out" : {
    "message" : "Salir"
  },
  "locale_Log_In" : {
    "message" : "Entrar"
  },
  "locale_User_Profile" : {
    "message" : "Perfil de Usuario"
  },
  "locale_Private_Profile" : {
    "message" : "TODO translate Perfil Privada"
  },
  "locale_Public_Profile" : {
    "message" : "TODO translate Perfil Publico"
  },
  "locale_User_Settings" : {
    "message" : "Configuración de Usuario"
  },
  "locale_Keyboard_Shortcuts" : {
    "message" : "Funciones rápidas de teclado"
  },
  "locale_Corpus_Settings" : {
    "message" : "Configuración de Corpus"
  },
  "locale_Terminal_Power_Users" : {
    "message" : "Terminal"
  },
  "locale_New_Datum" : {
    "message" : "Dato Nuevo"
  },
  "locale_New_menu" : {
    "message" : "Nuevo"
  },
  "locale_New_Data_List" : {
    "message" : "Lista de Datos Nuevo"
  },
  "locale_New_Session" : {
    "message" : "Sesión Nuevo"
  },
  "locale_New_Corpus" : {
    "message" : "Corpus Nuevo"
  },
  "locale_Data_menu" : {
    "message" : "Datos"
  },
  "locale_Import_Data" : {
    "message" : "Importe de Datos"
  },
  "locale_Export_Data" : {
    "message" : "Exporte de Datos"
  },
  "locale_Save" : {
    "message" : "Guadar"
  },
  "locale_Title" : {
    "message" : "Título:"
  },
  "locale_Description" : {
    "message" : "Descripción:"
  },
  "locale_Sessions_associated" : {
    "message" : "Sesiónes de Elicitación asociados con el corpus"
  },
  "locale_Datalists_associated" : {
    "message" : "Listas de datos asociados con el corpus"
  },
  "locale_Permissions_associated" : {
    "message" : "Permisos asociados con el corpus"
  },
  "locale_Datum_field_settings" : {
    "message" : "Configuración de los detailles de datos"
  },
  "locale_Encrypt_if_confidential" : {
    "message" : "Encripta si es confidencial:"
  },
  "locale_Help_Text" : {
    "message" : "Texto de Ayuda:"
  },
  "locale_Add" : {
    "message" : "Añadir"
  },
  "locale_Datum_state_settings" : {
    "message" : "Configuración de Estado de Datos"
  },
  "locale_Green" : {
    "message" : "Verde"
  },
  "locale_Orange" : {
    "message" : "Naranjado"
  },
  "locale_Red" : {
    "message" : "Rojo"
  },
  "locale_Blue" : {
    "message" : "Azul"
  },
  "locale_Teal" : {
    "message" : "Verde Azulado"
  },
  "locale_Black" : {
    "message" : "Negro"
  },
  "locale_Default" : {
    "message" : "Gris"
  },
  "locale_Elicitation_Session" : {
    "message" : "Sesión de Elicitación"
  },
  "locale_Export" : {
    "message" : "Exportar"
  },
  "locale_Actions" : {
    "message" : "Acciónes"
  },
  "locale_Navigation" : {
    "message" : "Navegación"
  },
  "locale_Datum_Status_Checked" : {
    "message" : "TODO translate Mark Datum status as checked/verified with language consultant"
  },
  "locale_Next_Datum" : {
    "message" : "Próximo Dato"
  },
  "locale_Previous_Datum" : {
    "message" : "Último Dato"
  },
  "locale_Data_Entry_Area" : {
    "message" : "TODO translate Data Entry Area <small>(1-5 datum)</small>"
  },
  "locale_Search" : {
    "message" : "Búzqueda"
  },
  "locale_Close" : {
    "message" : "Cerrar"
  },
  "locale_New_Corpus_Instructions" : {
    "message" : "Edite la forma abajo para crear un nuevo corpus, o presione ESC para entrar más datos en el corpus presente."
  },
  "locale_New_Corpus_Warning" : {
    "message" : "La funcionalidad del corpus nuevo aún necesita más pruebas, este mensaje desaparecerá cuando Corpus Nuevo no es experimental."
  },
  "locale_Cancel" : {
    "message" : "Cancel"
  },
  "locale_Next" : {
    "message" : "Próximo"
  },
  "locale_Show" : {
    "message" : "Mostrar"
  },
  "locale_per_page" : {
    "message" : "por pagina"
  },
  "locale_New_Session_Instructions" : {
    "message" : "<p> Edite los forma abajo para crear una sesión, o presionar ESC para entrar más datos en la sesión presente. </ p> "
  },
  "locale_Consultants" : {
    "message" : "Consultor(es):"
  },
  "locale_Goal" : {
    "message" : "Objectivo:"
  },
  "locale_When" : {
    "message" : "Fecha:"
  },
  "locale_Save_And_Import" : {
    "message" : "Guardar y Terminar de Importar"
  },
  "locale_Import" : {
    "message" : "Importar"
  },
  "locale_percent_completed" : {
    "message" : "% completo."
  },
  "locale_Import_Instructions" : {
    "message" : " <ol> <li> Jalar y Soltar un archivo (csv, txt, tabed, xml, text) a la zona abajo..</li> <li>(Modificar su información como necesario.)</li> <li> Jalar o escribe los detailles de datos arriba de los columnos que coinciden. Las columnas se convertirán en filas de su pagina de datos. .</li> <li>Precionar el botón Intenta Importar.</li> <li>Revisa la lista de datos y averigua que su importe se ve bien. </li> <li>Modifica la tabla como necesario, oprime Intentar Importar cuando la lista esta listo, puede hacer este paso las veces que quiere. </li> <li>Cuando esta sastifecho con la lista de datos, oprime Guadar y su lista de datos serían importados a su corpus y un nuevo lista de datos será creado. </li> </ol>"
  },
  "locale_Drag_Fields_Instructions" : {
    "message" : "TODO translate Drag (or type) the colored datum fields to the column headings which match, type in any additional column headings which you would like to keep as datum fields. The columns will become searchable fields in your database."
  },
  "locale_Add_Extra_Columns" : {
    "message" : " Agrega Columnas Extras"
  },
  "locale_Attempt_Import" : {
    "message" : "Intenta Importar"
  },
  "locale_LaTeX_Code" : {
    "message" : "Codigo de LaTeX:"
  },
  "locale_Unicode_Instructions" : {
    "message" : "Esto es un función rápida de teclado para entrar esta letra en un fila de datos. Para cambiar el función:"
  },
  "locale_Remove_Unicode" : {
    "message" : "Quite Unicode"
  },
  "locale_Unicode" : {
    "message" : "Unicode"
  },
  "locale_Drag_and_Drop" : {
    "message" : "<small>Jalar y Soltar</small>"
  },
  "locale_AND" : {
    "message" : "Y"
  },
  "locale_OR" : {
    "message" : "O"
  },
  "locale_Advanced_Search" : {
    "message" : "Búsqueda Advanzada"
  },
  "locale_Advanced_Search_Tooltip" : {
    "message" : "Búsqueda Advanzada allows you to use your corpus-wide datum fields or session details to search for datum, using either AND or OR with substring match."
  },
  "locale_Email" : {
    "message" : "Correo Electronico:"
  },
  "locale_Research_Interests" : {
    "message" : "Intereses de Investigación"
  },
  "locale_Affiliation" : {
    "message" : "Afiliación"
  },
  "locale_Corpora" : {
    "message" : "Corpora"
  },
  "locale_Gravatar" : {
    "message" : "Gravatar"
  },
  "locale_Gravatar_URL" : {
    "message" : "Gravatar URL"
  },
  "locale_Firstname" : {
    "message" : "Primer nombre:"
  },
  "locale_Lastname" : {
    "message" : "Apellido:"
  },
  "locale_Skin" : {
    "message" : "Foro:"
  },
  "locale_Background_on_Random" : {
    "message" : "Aleatorio de Foro"
  },
  "locale_Transparent_Dashboard" : {
    "message" : "Tablero Transparente"
  },
  "locale_Change_Background" : {
    "message" : "Cambiar Foro"
  },
  "locale_Number_Datum" : {
    "message" : "Numbero de Datos a la vez:"
  },
  "locale_Add_Placeholder" : {
    "message" : "Añadir...."
  },
  "locale_Datalist_Description" : {
    "message" : "Se puede usar las lista de datos para preparar para sesiones con consultantes o compartir con colaboradores."
  },
  "locale_Add_Tag" : {
    "message" : "Etiqueta Nueva..."
  },
  "locale_locale_Help_Text" : {
    "message" : "TODO this should be merged with locale_Help_Text?  Se puede incluir text de ayuda aqui (opcional)"
  },
  "locale_Drag_and_Drop_Placeholder" : {
    "message" : "Jale y Suelta achivos o textos aqui!"
  },
  "locale_Paste_Type_Unicode_Symbol_Placeholder" : {
    "message" : "Tecla o pega símbulo de unicode"
  },
  "locale_TIPA_shortcut" : {
    "message" : "Función rapida de teclado"
  },
  "locale_Show_Activities" : {
    "message" : "Mostrar actividades"
  },
  "locale_Hide_Activities" : {
    "message" : "Esconder actividades"
  },
  "locale_Show_Dashboard" : {
    "message" : "Mostrar Tablero"
  },
  "locale_Save_on_this_Computer" : {
    "message" : "Guardar en la computadora"
  },
  "locale_Sync_and_Share" : {
    "message" : "Sincronizar y compartir con el equipo"
  },
  "locale_Show_Readonly" : {
    "message" : "Mostrar en forma para leer "
  },
  "locale_Show_Fullscreen" : {
    "message" : "Mostrar en pantalla completa "
  },
  "locale_Add_New_Datum_Field_Tooltip" : {
    "message" : "Añadir un nuevo detaille de dato"
  },
  "locale_Add_New_Datum_State_Tooltip" : {
    "message" : "Añadir un estado de dato"
  },
  "locale_Show_in_Dashboard" : {
    "message" : "Mostrar en Tablero"
  },
  "locale_Edit_corpus" : {
    "message" : "Edita Corpus"
  },
  "locale_Show_corpus_settings" : {
    "message" : "Mostrar Configuración de Corpus"
  },
  "locale_Drag_and_Drop_Audio_Tooltip" : {
    "message" : "TODO translate Drag and drop audio over the audio player to attach an audio file. You can also drag and drop a YouTube video URL to attach a YouTube video instead."
  },
  "locale_Play_Audio" : {
    "message" : "Tocar audio"
  },
  "locale_Plain_Text_Export_Tooltip" : {
    "message" : "TODO translate Export as plain text/Copy to clipboard"
  },
  "locale_Plain_Text_Export_Tooltip_checked" : {
    "message" : "TODO translate Export as plain text/Copy checked items to clipboard"
  },
  "locale_Duplicate" : {
    "message" : "Duplicar Dato por hacer un contraste minimál"
  },
  "locale_Encrypt" : {
    "message" : "Encriptar/Decriptar"
  },
  "locale_Encrypt_checked" : {
    "message" : "TODO translate Make checked items confidential"
  },
  "locale_Decrypt_checked" : {
    "message" : "TODO translate Remove confidentiality from checked items (Warning: this will save them as decrypted in the database). If you want them to stay confidential and just want to edit them, click on the eye instead."
  },
  "locale_Decrypt" : {
    "message" : "TODO translate Remove confidentiality from this datum (Warning: this will save it as decrypted in the database). If you want it to stay confidential and just want to edit it, click on the eye instead."
  },
  "locale_Show_confidential_items_Tooltip" : {
    "message" : "TODO translate Unmask confidential/encrypted items so that they can be edited and read for the next 10 minutes."
  },
  "locale_Hide_confidential_items_Tooltip" : {
    "message" : "TODO translate Return to masked view of confidential/encrypted datum"
  },
  "locale_Edit_Datalist" : {
    "message" : "Editar lista de datos"
  },
  "locale_Export_checked_as_LaTeX" : {
    "message" : "Exportar lista de datos seleccionados en formato LaTeX"
  },
  "locale_Export_checked_as_CSV" : {
    "message" : "Exportar lista de datos seleccionados en formato CSV"
  },
  "locale_Hide_Datalist" : {
    "message" : "Esconder lista de datos"
  },
  "locale_Show_Datalist" : {
    "message" : "Mostrar lista de datos"
  },
  "locale_Edit_Datum" : {
    "message" : "Editar Datos"
  },
  "locale_See_Fields" : {
    "message" : "TODO translate Hide/Show infrequent fields"
  },
  "locale_Add_Tags_Tooltip" : {
    "message" : "Añadir etiquetas"
  },
  "locale_Edit_Session" : {
    "message" : "Editar Sesión"
  },
  "locale_Show_Unicode_Palette" : {
    "message" : "Mostrar los Unicodes"
  },
  "locale_Hide_Unicode_Palette" : {
    "message" : "Esconder los Unicodes"
  },
  "locale_Add_new_symbol" : {
    "message" : "Añadir un símbulo nuevo"
  },
  "locale_Public_or_Private" : {
    "message" : "Publico o Privado:"
  },
  "locale_Play_Audio_checked" : {
    "message" : "Tocar audio de los seleccionados"
  },
  "locale_Remove_checked_from_datalist_tooltip" : {
    "message" : "TODO translate los seleccionados"
  },
  "locale_Insert_New_Datum" : {
    "message" : "Insertar un nuevo dato arriba"
  },
  "locale_LaTeX" : {
    "message" : "Exportar dato en formato LaTeX"
  },
  "locale_CSV_Tooltip" : {
    "message" : "Exportar dato en formato CSV "
  },
  "locale_of" : {
    "message" : "de"
  },
  "locale_pages_shown" : {
    "message" : "pagínas mostradas"
  },
  "locale_More" : {
    "message" : "Más"
  }
}
},{}],48:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class Search progressively searches a corpus and updates a search/data list
 *  view as a user types keywords in the search box. Both intersection and
 *  union search is possible. It highlights search keywords in the list view.
 *
 * @property {String} searchQuery
 * @property {DataList} A list of data which fulfill the search query
 *
 * @name  Search
 * @extends FieldDBObject
 * @constructs
 */
var Search = function Search(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Search";
  }
  this.debug("Constructing Search length: ", options);
  FieldDBObject.apply(this, arguments);
};

Search.prototype = Object.create(FieldDBObject.prototype, /** @lends Search.prototype */ {
  constructor: {
    value: Search
  },

  defaults: {
    value: {
      searchQuery: ""
    }
  },

  searchKeywords: {
    get: function() {
      this.warn("searchKeywords is deprecated, use searchQuery instead.");
      return this.searchQuery;
    },
    set: function(value) {
      this.warn("searchKeywords is deprecated, use searchQuery instead.");
      this.searchQuery = value;
    }
  },

  searchQuery: {
    get: function() {
      return this._searchQuery || this.defaults.searchQuery;
    },
    set: function(value) {
      if (value === this._searchQuery) {
        return;
      }
      if (!value) {
        delete this._searchQuery;
        return;
      }
      this._searchQuery = value.trim();
    }
  }

});
exports.Search = Search;

},{"./../FieldDBObject":4}],49:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;

/**
 * @class InsertUnicode allows a user to use IPA symbols, characters other than Roman alphabets, etc..
 *    Users can add new symbols. Added symbols are saved and stored, and will show up next time the user
 *    opens InsertUnicode box.
 *
 * @name  InsertUnicode
 * @extends FieldDBObject
 * @constructs
 */
var InsertUnicode = function InsertUnicode(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "InsertUnicode";
  }
  this.debug("Constructing InsertUnicode length: ", options);
  FieldDBObject.apply(this, arguments);
};

InsertUnicode.prototype = Object.create(FieldDBObject.prototype, /** @lends InsertUnicode.prototype */ {
  constructor: {
    value: InsertUnicode
  },

  defaults: {
    value: {
      symbol: "",
      tipa: "",
      useCount: 0
    }
  },
  symbol: {
    get: function() {
      return this._symbol;
    },
    set: function(value) {
      if (value === this._symbol) {
        return;
      }
      if (!value) {
        delete this._symbol;
        return;
      }
      if (typeof value.trim === "function") {
        value = value.trim();
      }
      this._symbol = value.trim();
    }
  }

});
exports.InsertUnicode = InsertUnicode;

},{"./../FieldDBObject":4}],50:[function(require,module,exports){
var Collection = require("./../Collection").Collection;
var InsertUnicode = require("./UnicodeSymbol").InsertUnicode;

/**
 * @class  InsertUnicodes is a set of unicode symbols.
 *
 * @name  InsertUnicodes
 *
 * @extends Collection
 * @constructs
 */
var InsertUnicodes = function InsertUnicodes(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "InsertUnicodes";
  }
  this.debug("Constructing InsertUnicodes length: ", options);
  Collection.apply(this, arguments);
};

InsertUnicodes.prototype = Object.create(Collection.prototype, /** @lends InsertUnicodes.prototype */ {
  constructor: {
    value: InsertUnicodes
  },

  primaryKey: {
    value: "symbol"
  },

  INTERNAL_MODELS: {
    value: {
      item: InsertUnicode
    }
  },

  fill: {
    value: function() {

      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɐ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɑ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɒ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɓ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɔ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɕ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɖ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɗ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɘ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ə"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɚ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɛ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɜ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɝ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɞ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɟ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɠ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɡ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɢ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɣ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɤ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɥ"
      }));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɦ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɧ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɨ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɩ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɪ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ɫ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɬ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɮ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɭ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɯ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɰ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɱ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɲ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɳ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɴ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɵ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɶ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɷ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɸ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɹ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɺ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɻ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɼ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɽ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɾ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ɿ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʀ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʁ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʂ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ʃ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʄ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʅ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʆ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʇ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʈ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʉ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʊ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʋ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʌ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʍ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʎ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʏ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʐ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʑ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ʒ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʓ"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "ʔ"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʕ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʖ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʗ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʘ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʙ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʚ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʛ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʜ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʝ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʞ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʟ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʠ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʡ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʢ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʣ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʤ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʥ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʦ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʧ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʨ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʩ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʪ"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ʫ"}));
      this.add(new InsertUnicode({
        tipa: "\\lambda",
        symbol: "λ "
      }));
      this.add(new InsertUnicode({
        tipa: "\\alpha",
        symbol: "α "
      }));
      this.add(new InsertUnicode({
        tipa: "\\beta",
        symbol: "β "
      }));
      this.add(new InsertUnicode({
        tipa: "\\forall",
        symbol: "∀"
      }));
      this.add(new InsertUnicode({
        tipa: "\\exists",
        symbol: "∃"
      }));
      this.add(new InsertUnicode({
        tipa: "^{\\circ}",
        symbol: "°"
      }));



      //
      //        this.add(new InsertUnicode({tipa: "", symbol:  "γ "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "δ "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ε "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ζ "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "η "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "θ "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "ι "}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "κ "}));



      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∄"
      }));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∅"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "∆"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "∇"}));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∈"
      }));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∉"
      }));

      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∋"
      }));
      this.add(new InsertUnicode({
        tipa: "",
        symbol: "∌"
      }));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "∍"}));

      //        this.add(new InsertUnicode({tipa: "", symbol:  "≁"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≂"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≃"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≄"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≅"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≆"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≇"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≈"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≉"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≊"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≋"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≌"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≍"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≎"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≏"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≐"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≑"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≒"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≓"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≔"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≕"}));

      //        this.add(new InsertUnicode({tipa: "", symbol:  "≤"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≥"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≦"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≧"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≨"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≩"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≪"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≫"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≬"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≭"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≮"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≯"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≰"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≱"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≲"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≳"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "≴"}));

      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊂"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊃"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊄"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊅"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊆"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊇"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊈"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊉"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊊"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊋"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊌"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊍"}));
      //        this.add(new InsertUnicode({tipa: "", symbol:  "⊎"}));
    }
  },

  /**
   *  Cleans a value to become a primary key on an object (replaces punctuation with underscore)
   *  (replaces the default Collection.sanitizeStringForPrimaryKey method which scrubs unicode from the primary keys)
   *
   * @param  String value the potential primary key to be cleaned
   * @return String       the value cleaned and safe as a primary key
   */
  sanitizeStringForPrimaryKey: {
    value: function(value) {
      this.debug("sanitizeStringForPrimaryKey");
      if (!value) {
        return null;
      }
      if (typeof value.replace !== "function") {
        value = value + "";
      }
      value = value.replace(/[-""+=?./\[\]{}() ]/g, "");
      return value;
    }
  }

});
exports.InsertUnicodes = InsertUnicodes;

},{"./../Collection":2,"./UnicodeSymbol":49}],51:[function(require,module,exports){
var Speaker = require("./Speaker").Speaker;
var DEFAULT_CORPUS_MODEL = require("./../corpus/corpus.json");

/**
 *
 * @class The Consultant (commonly refered to as a "language consultant")
 * is a type of Speaker with any additional fields or metadata that a
 * team might use to to cluster consultants into dialects or variations.
 *
 * A consultant might also be associated to a user. In this case a consultant
 * has the same information as a user plus extra, some info (e.g. date of birth)
 * which must be kept confidential. Consultant's gravatar are default
 * unless he/she wants to be public associated with/his username.
 * Consultants which are also users have permissions about the
 * level of access to the data (read only, add/edit).
 *
 *
 * @name  Consultant
 * @extends Speaker
 * @constructs
 */
var Consultant = function Consultant(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Consultant";
  }
  this.debug("Constructing Consultant: ", options);
  Speaker.apply(this, arguments);
};

Consultant.prototype = Object.create(Speaker.prototype, /** @lends Consultant.prototype */ {
  constructor: {
    value: Consultant
  },

  api: {
    value: "consultants"
  },

  defaults: {
    get: function() {
      var doc = {
        fields: DEFAULT_CORPUS_MODEL.consultantFields || DEFAULT_CORPUS_MODEL.speakerFields
      };
      return JSON.parse(JSON.stringify(doc));
    }
  }

});
exports.Consultant = Consultant;

},{"./../corpus/corpus.json":20,"./Speaker":53}],52:[function(require,module,exports){
/* globals FieldDB */
var Speaker = require("./Speaker").Speaker;
var DEFAULT_CORPUS_MODEL = require("./../corpus/corpus.json");

/**
 * @class The Participant is a type of Speaker with any additional fields or metadata that a team might use to run their psycholinguistics analyses.
 *
 *
 * @name  Participant
 * @extends Speaker
 * @constructs
 */
var Participant = function Participant(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Participant";
  }
  this.debug("Constructing Participant length: ", options);
  Speaker.apply(this, arguments);
};

Participant.prototype = Object.create(Speaker.prototype, /** @lends Participant.prototype */ {
  constructor: {
    value: Participant
  },

  api: {
    value: "participants"
  },

  defaults: {
    get: function() {
      var doc = {
        fields: []
      };
      try {
        if (FieldDB && FieldDB.FieldDBObject && FieldDB.FieldDBObject.application && FieldDB.FieldDBObject.application.corpus) {
          if (FieldDB.FieldDBObject.application.corpus.participantFields) {
            doc.fields = FieldDB.FieldDBObject.application.corpus.participantFields.clone();
          } else if (FieldDB.FieldDBObject.application.corpus.speakerFields) {
            doc.fields = FieldDB.FieldDBObject.application.corpus.speakerFields.clone();
          }
        }
      } catch (e) {
        this.warn("Cant get participant fields from the current corpus, instead using defaults.");
        doc.fields = DEFAULT_CORPUS_MODEL.participantFields || DEFAULT_CORPUS_MODEL.speakerFields;
      }
      if (!doc.fields || doc.fields.length === 0) {
        this.warn("There were no corpus specific speaker or participant fiels, instead using defaults");
        doc.fields = DEFAULT_CORPUS_MODEL.participantFields || DEFAULT_CORPUS_MODEL.speakerFields;
      }
      return JSON.parse(JSON.stringify(doc));
    }
  }

});
exports.Participant = Participant;

},{"./../corpus/corpus.json":20,"./Speaker":53}],53:[function(require,module,exports){
var Confidential = require("./../confidentiality_encryption/Confidential").Confidential;
var DatumFields = require("./../datum/DatumFields").DatumFields;
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var UserMask = require("./UserMask").UserMask;

var DEFAULT_CORPUS_MODEL = require("./../corpus/corpus.json");

/**
 * @class The Speaker represents a source of data, usually a
 * language consultant who is a native speaker of the language,
 * or a psycholinguistics experiment participant.
 * Each consultant has their own I-language and/or dialects which they
 * speak (unlike a published source which usually discusses an E-language
 * or standard or normal expected production of an utterance.)
 * Speakers can have any number of additional fields or metadata
 * that a team might use to help cluster or understand variation in data.
 *
 * As "Informant" is not politically correct in many contexts, and "consultant" is
 * ambigious word outside of field work, the word "speaker" is used in communication with
 * users and in the url of db queries/api.
 *
 * A speaker might also be associated to a user. In this case a speaker
 * has the same information as a user plus extra, some info (e.g. date of birth)
 * which must be kept confidential. Speaker's gravatar are locked to
 * default unless he/she wants to be public associated with/his username.
 * Speakers which are also users have permissions about the level of
 * access to the data (read only, add/edit).
 *
 * @name  Speaker
 * @extends UserMask
 * @constructs
 */
var Speaker = function Speaker(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Speaker";
  }
  this.debug("Constructing Speaker: ", options);
  if (!options || (!options._rev && !options.fields)) {
    //If its a new participant with out a revision and without fields use the defaults
    this.fields = this.defaults.fields;
  }
  UserMask.apply(this, arguments);
};

Speaker.prototype = Object.create(UserMask.prototype, /** @lends Speaker.prototype */ {
  constructor: {
    value: Speaker
  },

  api: {
    value: "speakers"
  },

  INTERNAL_MODELS: {
    value: {
      username: FieldDBObject.DEFAULT_STRING,
      anonymousCode: FieldDBObject.DEFAULT_STRING,
      gravatar: FieldDBObject.DEFAULT_STRING,
      fields: DatumFields,
      user: UserMask,
      confidential: Confidential
    }
  },

  defaults: {
    get: function() {
      var doc = {
        fields: DEFAULT_CORPUS_MODEL.speakerFields
      };
      return JSON.parse(JSON.stringify(doc));
    }
  },

  confidentiality: {
    get: function() {
      if (this.fields) {
        return this.fields.confidentiality.value;
      } else {
        return;
      }
    },
    set: function(value) {
      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      // this.warn("Cannot change the public/private of " + this.collection + " (it must be anonymous). " + value);
      this.fields.confidentiality.value = value;
    }
  },


  buildGravatar: {
    value: function() {
      this._gravatar = "968b8e7fb72b5ffe2915256c28a9414c";
      return this._gravatar;
    }
  },

  gravatar: {
    get: function() {
      return this.buildGravatar();
    },
    set: function(value) {
      this.warn("Cannot set the gravatar of a " + this.fieldDBtype + " (it must be anonymous)." + value);
    }
  },

  username: {
    get: function() {
      if (this.fields && this.fields.username && this.fields.username.value) {
        // this.debug("this.fields.username.value :", this.fields.username.value + ":");

        if (this.fields.confidentiality.value === "generalize") {
          this.fields.username.mask = "A native speaker";
        } else if (this.fields.confidentiality.value === "team") {
          this.todo("IF the user is part of the team, they can see the username of the consultant.");
          this.fields.username.mask = this.anonymousCode;
        } else if (this.fields.confidentiality.value === "anonymous") {
          this.fields.username.mask = this.anonymousCode || this.fields.username.mask;
        } else if (this.fields.confidentiality.value === "public") {
          this.fields.username.mask = this.fields.username.value;
        } else {
          this.fields.username.mask = "A native speaker";
        }

        if (this.fields.username.decryptedMode) {
          return this.fields.username.value;
        } else {
          return this.fields.username.mask;
        }
      } else {
        return;
      }
    },
    set: function(value) {
      if (!this.confidential) {
        this.warn("Cannot set the username before the confidential is set");
        return;
      }
      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      // this.fields.username.debugMode = true;
      // this.fields.username.decryptedMode = true;
      this.fields.username.confidential = this.confidential;
      this.fields.username.value = value;
    }
  },

  encryptByCorpus: {
    value: true
  },

  id: {
    get: function() {
      // this._id = this.anonymousCode;
      return this.anonymousCode;
    },
    set: function(value) {
      if (value === this.anonymousCode) {
        this._id = value;
      }
    }
  },

  anonymousCode: {
    get: function() {
      if (this.fields && this.fields.anonymousCode) {
        return this.fields.anonymousCode.value.toUpperCase();
      } else {
        return;
      }
    },
    set: function(value) {
      var actualUsername;
      if (this.fields && this.fields.username && this.fields.username.value) {
        this.fields.username.decryptedMode = true;
        actualUsername = this.fields.username.value;
        this.fields.username.decryptedMode = false;
      }
      if (actualUsername && value.toLowerCase().indexOf(actualUsername) > -1) {
        this.bug("Cannot set the anonymous code to contain any part of the user's actual username, this would potentially breach their confidentiality.");
        return;
      }
      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      this.fields.anonymousCode.value = value;
      this.id = value;
      if (!this.encryptByCorpus) {
        this.confidential = new Confidential({
          secretkey: value
        });
      }
    }
  },

  confidential: {
    get: function() {
      return this.confidentialEncrypter;
    },
    set: function(value) {
      if (value === this.confidentialEncrypter) {
        return;
      }
      if (typeof value.encrypt !== "function" && value.secretkey) {
        value = new this.INTERNAL_MODELS["confidential"](value);
      }
      this.confidentialEncrypter = value;
      if (this.fields) {
        // this.debug("setting speaker fields confidential in the Speaker.confidential set function.");
        this.fields.confidential = value;
      }
    }
  },

  dateOfBirth: {
    configurable: true,
    get: function() {
      if (this.fields) {
        return this.fields.dateOfBirth.value;
      } else {
        return;
      }
    },
    set: function(value) {
      if (this.fields) {
        // this.fields.debugMode = true;
        this.fields.dateOfBirth.value = value;
      } else {
        this.fields = new DatumFields(this.defaults.fields);
        this.fields.dateOfBirth.value = value;
      }
    }
  },

  firstname: {
    configurable: true,
    get: function() {
      if (this.fields && this.fields.firstname) {
        return this.fields.firstname.value;
      } else {
        return;
      }
    },
    set: function(value) {
      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      if (this.fields && this.fields.firstname) {
        // this.fields.debugMode = true;
        this.fields.firstname.value = value;
      } else {
        this.fields.firstname.value = value;
      }
    }
  },

  lastname: {
    configurable: true,
    get: function() {
      if (this.fields && this.fields.lastname) {
        return this.fields.lastname.value;
      } else {
        return;
      }
    },
    set: function(value) {
      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      if (this.fields && this.fields.lastname) {
        // this.fields.debugMode = true;
        this.fields.lastname.value = value;
      } else {
        this.fields.lastname.value = value;
      }
    }
  },

  languages: {
    get: function() {
      if (this.fields) {
        return this.fields.languages.value;
      } else {
        return;
      }
    },
    set: function(value) {
      var stringvalue;
      var objectvalue;
      if (typeof value === "string") {
        this.debug("User set the languages with a string");
        if (this.fields.languages && this.fields.languages && this.fields.languages.json) {
          this.confirm("Do you want to set the languages from " + JSON.stringify(this.fields.languages.json) + " to " + value);
        }
        stringvalue = value;
        objectvalue = {
          value: value,
          label: "languages",
          json: {
            languages: value.split(",")
          }
        };
        objectvalue.json.languages = objectvalue.json.languages.map(function(languageName) {
          return {
            iso: languageName.toLowerCase().trim(),
            name: languageName.trim(),
            nativeName: languageName.trim()
          };
        });
      } else {
        objectvalue = value;
      }

      if (!this.fields) {
        this.fields = new DatumFields(this.defaults.fields);
      }
      if (stringvalue) {
        this.fields.languages.value = stringvalue;
      }
      this.debug("setting language ", objectvalue);

      for (var property in objectvalue) {
        if (!objectvalue.hasOwnProperty(property)) {
          continue;
        }
        this.debug("looking at " + property);
        this.fields.languages[property] = objectvalue[property];
      }
    }
  },

  dialects: {
    get: function() {
      return this.languages;
    },
    set: function(value) {
      return this.languages = value;
    }
  },

  fields: {
    configurable: true,
    get: function() {
      if (this._fields) {
        // this.debug("setting speaker fields confidential in the Speaker.fields get function.");

        // this._fields.encrypted = true;
        // this._fields.decryptedMode = true;
        this._fields.confidential = this.confidential;
      }
      return this._fields;
    },
    set: function(value) {
      if (value === this._fields) {
        return;
      }
      if (!value) {
        delete this._fields;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["fields"](value);
        }
      }
      this._fields = value;
    }
  },

  user: {
    get: function() {
      if (!this.userMask) {

        var self = this;
        if (this.public && this.username) {
          this.userMask = new this.INTERNAL_MODELS["user"]({});
          this.userMask.username = this.username;
          this.userMask.fetch().then(function(result) {
            self.debug("Fetched speaker\"s user mask", result);
          }, function(error) {
            self.debug("Failed to fetch speaker\"s user mask", error);
          });

        } else {
          this.userMask = {};
        }
        this.userMask = {
          username: this.anonymousCode,
          gravatar: this.gravatar
        };
      }
      return this.userMask;
    },
    set: function(value) {
      if (value === this.userMask) {
        return;
      }
      if (!value) {
        value = {};
      }
      this.userMask = value;
    }
  },

  decryptedMode: {
    get: function() {
      return this._decryptedMode;
    },
    set: function(value) {
      this._decryptedMode = value;
      if (this._fields) {
        this._fields.decryptedMode = value;
      }
    }
  },

  languageOne: {
    get: function() {
      return this.getLanguageNumber(0);
    },
    set: function(value) {
      return this.setLanguageNumber(0, value);
    }
  },

  languageTwo: {
    get: function() {
      return this.getLanguageNumber(1);
    },
    set: function(value) {
      return this.setLanguageNumber(1, value);
    }
  },

  languageThree: {
    get: function() {
      return this.getLanguageNumber(2);
    },
    set: function(value) {
      return this.setLanguageNumber(2, value);
    }
  },

  languageFour: {
    get: function() {
      return this.getLanguageNumber(3);
    },
    set: function(value) {
      return this.setLanguageNumber(3, value);
    }
  },

  languageFive: {
    get: function() {
      return this.getLanguageNumber(4);
    },
    set: function(value) {
      return this.setLanguageNumber(4, value);
    }
  },

  getLanguageNumber: {
    value: function(number) {
      if (!this.fields || !this.fields.languages || !this.fields.languages.json || !this.fields.languages.json.languages || !this.fields.languages.json.languages[number]) {
        return;
      }
      return this.fields.languages.json.languages[number];
    }
  },

  setLanguageNumber: {
    value: function(number, value) {
      if (!this.fields || !this.fields.languages) {
        return;
      }
      this.fields.languages.json = this.fields.languages.json || {
        languages: []
      };

      if (value === this.fields.languages.json.languages[number]) {
        return;
      }

      if (value.iso) {
        value = {
          language: value,
          fluency: {
            "comprehensionFluency": "native",
            "speakingFluency": "native"
          },
          dates: {
            start: "",
            end: "",
            proportionOfUse: ""
          }
        };
      }
      value.fluency = value.fluency || {};
      value.dates = value.dates || {};
      value.language = value.language || {};

      this.fields.languages.json.languages[number] = value;
      return this.fields.languages.json.languages[number];
    }
  }


});
exports.Speaker = Speaker;

},{"./../FieldDBObject":4,"./../confidentiality_encryption/Confidential":15,"./../corpus/corpus.json":20,"./../datum/DatumFields":26,"./UserMask":56}],54:[function(require,module,exports){
var UserMask = require("./UserMask").UserMask;

/**
 *
 * @class Team extends from UserMask. It inherits the same attributes as UserMask but can
 * login.
 *
 * @name  Team
 * @extends UserMask
 * @constructs
 */
var Team = function Team(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Team";
  }
  this.debug("Constructing Team: ", options);
  UserMask.apply(this, arguments);
};

Team.prototype = Object.create(UserMask.prototype, /** @lends Team.prototype */ {
  constructor: {
    value: Team
  },

  id: {
    get: function() {
      return "team";
    },
    set: function(value) {
      if (value === this._id) {
        return;
      }
      if (value !== "team") {
        this.warn("Cannot set team id to anything other than \"team.\"");
      }
      this._id = "team";
    }
  },

  defaults: {
    value: {
      // Defaults from UserMask
      username: "",
      password: "",
      email: "",
      gravatar: "user/user_gravatar.png",
      researchInterest: "",
      affiliation: "",
      description: "",
      subtitle: "",
      corpuses: [],
      dataLists: [],
      mostRecentIds: {},
      // Defaults from User
      firstname: "",
      lastname: "",
      teams: [],
      sessionHistory: []
    }
  },

  /**
   * The subtitle function returns user's first and last names.
   */
  subtitle: {
    get: function() {
      return this.name;
    },
    set: function(value) {
      if (value === this.name) {
        return;
      }
      this.warn("subtitle is deprecated, use name instead.");
      this.name = value;
    }
  }

});

exports.Team = Team;

},{"./UserMask":56}],55:[function(require,module,exports){
var UserMask = require("./UserMask").UserMask;
var UserPreference = require("./UserPreference").UserPreference;
var DEFAULT_USER_MODEL = require("./user.json");

/**
 * @class User extends from UserGeneric. It inherits the same attributes as UserGeneric but can
 * login.
 *
 * @property {String} firstname The user's first name.
 * @property {String} lastname The user's last name.
 * @property {Array} teams This is a list of teams a user belongs to.
 * @property {Array} sessionHistory
 * @property {Permission} permissions This is where permissions are specified (eg. read only; add/edit data etc.)
 *
 * @name  User
 * @extends UserMask
 * @constructs
 */
var User = function User(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "User";
  }
  this.debug("Constructing User length: ", options);
  UserMask.apply(this, arguments);
};

User.prototype = Object.create(UserMask.prototype, /** @lends User.prototype */ {
  constructor: {
    value: User
  },

  api: {
    value: "users"
  },

  defaults: {
    get: function() {
      return JSON.parse(JSON.stringify(DEFAULT_USER_MODEL));
    }
  },

  INTERNAL_MODELS: {
    value: {
      prefs: UserPreference
    }
  },

  hotkeys: {
    get: function() {
      if (this.prefs) {
        return this.prefs.hotkeys;
      }
    },
    set: function(value) {
      if (!this.prefs) {
        this.prefs = new this.INTERNAL_MODELS["prefs"]();
      }
      if (Object.prototype.toString.call(value) !== "[object Array]") {
        if (!value.firstKey && !value.secondKey && !value.description) {
          value = [];
        } else {
          value = [value];
        }
      }
      this.prefs.hotkeys = value;
      delete this.hotkeys;
    }
  },

  prefs: {
    get: function() {
      if (!this._prefs && this.INTERNAL_MODELS["prefs"] && typeof this.INTERNAL_MODELS["prefs"] === "function") {
        this.prefs = new this.INTERNAL_MODELS["prefs"](this.defaults.prefs);
      }
      return this._prefs;
    },
    set: function(value) {
      if (value === this._prefs) {
        return;
      }
      if (!value) {
        delete this._prefs;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["prefs"](value);
        }
      }
      this._prefs = value;
    }
  },

  appbrand: {
    get: function() {
      if (this.prefs && !this.prefs.preferedDashboardType) {
        if (this._appbrand === "phophlo") {
          this.debug(" setting preferedDashboardType from user " + this._appbrand);

          this.prefs.preferedDashboardType = "experimenter";
        }
      }
      return this._appbrand || "lingsync";
    },
    set: function(value) {
      if (value === this._appbrand) {
        return;
      }

      if (this._appbrand) {
        this.warn("appbrand cannot be modified by client side apps.");
      } else {
        if (value.trim) {
          value = value.trim();
        }
        this._appbrand = value;
      }
      this.debug(" setting preferedDashboardType from user " + this._appbrand);
      if (this.prefs && !this.prefs.preferedDashboardType) {
        if (this._appbrand === "phophlo") {
          this.prefs._preferedDashboardType = "experimenter";
          this.debug(" it is now " + this.prefs.preferedDashboardType);

        }
      }
    }
  }

});
exports.User = User;

},{"./UserMask":56,"./UserPreference":57,"./user.json":58}],56:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var MD5 = require("MD5");

/**
 * @class A mask of a user which can be saved along with the corpus. It is
 *        generally just a username and gravatar but could be more depending
 *        on what the user allows to be public.
 *
 *
 * @extends FieldDBObject
 * @tutorial tests/UserTest.js
 */
var UserMask = function UserMask(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "UserMask";
  }
  this.debug("Constructing a UserMask " + options);
  FieldDBObject.apply(this, arguments);
};

UserMask.prototype = Object.create(FieldDBObject.prototype, /** @lends UserMask.prototype */ {
  constructor: {
    value: UserMask
  },

  api: {
    value: "/users"
  },

  buildGravatar: {
    value: function(email) {
      var existingGravatar = this._gravatar;
      if (existingGravatar.indexOf("gravatar.com") > -1) {
        existingGravatar = existingGravatar.replace("https://secure.gravatar.com/avatar/", "");
        this._gravatar = existingGravatar;
      } else if (existingGravatar.indexOf("user_gravatar.png") > -1) {
        this._gravatar = "968b8e7fb72b5ffe2915256c28a9414c";
      } else if (email) {
        this._gravatar = MD5(email);
      }
      return this._gravatar;
    }
  },

  defaults: {
    value: {
      username: "",
      firstname: "",
      lastname: "",
      email: "",
      gravatar: "",
      researchInterests: "",
      affiliation: "",
      description: ""
    }
  },

  id: {
    get: function() {
      if (!this._username) {
        this._username = "";
      }
      return this._username;
    },
    set: function(value) {
      if (value === this._username) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._username = value.trim();
    }
  },

  username: {
    get: function() {
      if (!this._username) {
        this._username = "";
      }
      return this._username;
    },
    set: function(value) {
      if (value === this._username) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._username = value.trim();
    }
  },

  firstname: {
    configurable: true,
    get: function() {
      if (!this._firstname) {
        this._firstname = "";
      }
      return this._firstname;
    },
    set: function(value) {
      if (value === this._firstname) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._firstname = value.trim();
    }
  },

  lastname: {
    configurable: true,
    get: function() {
      if (!this._lastname) {
        this._lastname = "";
      }
      return this._lastname;
    },
    set: function(value) {
      if (value === this._lastname) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._lastname = value.trim();
    }
  },

  gravatar: {
    get: function() {
      if (!this._gravatar) {
        this._gravatar = "";
      }
      return this._gravatar;
    },
    set: function(value) {
      if (value === this._gravatar) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._gravatar = value.trim();
    }
  },

  email: {
    get: function() {
      if (!this._email) {
        this._email = "";
      }
      return this._email;
    },
    set: function(value) {
      if (value === this._email) {
        return;
      }
      if (!value) {
        value = "";
      }
      var validEmailRegEx = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (validEmailRegEx.test(value)) {
        this._email = value.trim();
      }
    }
  },

  affiliation: {
    get: function() {
      if (!this._affiliation) {
        this._affiliation = "";
      }
      return this._affiliation;
    },
    set: function(value) {
      if (value === this._affiliation) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._affiliation = value.trim();
    }
  },

  researchInterest: {
    get: function() {
      if (!this._researchInterest) {
        this._researchInterest = "";
      }
      return this._researchInterest;
    },
    set: function(value) {
      if (value === this._researchInterest) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._researchInterest = value.trim();
    }
  },

  description: {
    get: function() {
      if (!this._description) {
        this._description = "";
      }
      return this._description;
    },
    set: function(value) {
      if (value === this._description) {
        return;
      }
      if (!value) {
        value = "";
      }
      this._description = value.trim();
    }
  },

  name: {
    configurable: true,
    get: function() {
      this.firstname = this.firstname || "";
      this.lastname = this.lastname || "";
      var name = (this.firstname + " " + this.lastname).trim();
      if (name) {
        return name;
      }
      return this.anonymousCode || this.username;
    },
    set: function(value) {
      if (!value) {
        return;
      }
      if (value.indexOf(" ") > -1) {
        var pieces = value.replace(/ +/g, " ").split(" ");
        if (pieces[0]) {
          this._firstname = pieces[0];
        }
        if (pieces[1]) {
          this._lastname = pieces[1];
        }
      }
    }
  },
  validateUsername: {
    value: function(value) {
      if (!value) {
        return {
          valid: false,
          username: null,
          original: null,
          suggestion: null
        };
      }
      var safeName = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
      var validation = {
        valid: true,
        username: value,
        original: value
      };
      if (safeName !== value) {
        validation.valid = false;
        validation.suggestion = safeName;
        validation.username = safeName;
      }
      return validation;
    }
  }
});

exports.UserMask = UserMask;

},{"./../FieldDBObject":4,"MD5":59}],57:[function(require,module,exports){
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var HotKeys = require("./../hotkey/HotKeys").HotKeys;
var InsertUnicodes = require("./../unicode/UnicodeSymbols").InsertUnicodes;

/**
 * @class  Hold preferences for users like the skin of the app
 *
 * @property {int} skin This is user's preferred skin.
 * @property {int} numVisibleDatum The number of Datum visible at the time on
 * the Datum*View"s.
 *
 * @name  UserPreference
 * @extends FieldDBObject
 * @constructs
 */
var UserPreference = function UserPreference(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "UserPreference";
  }
  this.debug("Constructing UserPreference length: ", options);
  FieldDBObject.apply(this, arguments);
};

UserPreference.prototype = Object.create(FieldDBObject.prototype, /** @lends UserPreference.prototype */ {
  constructor: {
    value: UserPreference
  },

  defaults: {
    value: {
      skin: "",
      numVisibleDatum: 2, //Use two as default so users can see minimal pairs
      transparentDashboard: "false",
      alwaysRandomizeSkin: "true",
      numberOfItemsInPaginatedViews: 10,
      preferedDashboardLayout: "layoutAllTheData",
      preferedDashboardType: "fieldlinguistNormalUser"
    }
  },

  INTERNAL_MODELS: {
    value: {
      hotkeys: HotKeys,
      unicodes: InsertUnicodes
    }
  },

  preferedDashboardType: {
    get: function() {
      this.debug("getting preferedDashboardType " + this._preferedDashboardType);
      if (!this._preferedDashboardType && this.preferedDashboardLayout) {
        this.debug("getting preferedDashboardType from _preferedDashboardLayout ");
      }
      return this._preferedDashboardType || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      this.debug("setting _preferedDashboardType from " + value);
      if (value === this._preferedDashboardType) {
        return;
      }
      if (!value) {
        delete this._preferedDashboardType;
        return;
      }
      if (value.trim) {
        value = value.trim();
      }
      this._preferedDashboardType = value;
    }
  },

  preferedDashboardLayout: {
    get: function() {
      this.debug("getting preferedDashboardLayout from ");

      return this._preferedDashboardLayout || FieldDBObject.DEFAULT_STRING;
    },
    set: function(value) {
      this.debug("setting preferedDashboardLayout from " + value);

      if (value === this._preferedDashboardLayout) {
        return;
      }
      if (!value) {
        delete this._preferedDashboardLayout;
        return;
      }
      // Guess which kind of user this is
      if (!this.preferedDashboardType) {
        if (this._preferedDashboardLayout === "layoutAllTheData" || this._preferedDashboardLayout === "layoutJustEntering" || this._preferedDashboardLayout === "layoutWhatsHappening") {
          this.preferedDashboardType = "fieldlinguistNormalUser";
        } else if (this._preferedDashboardLayout === "layoutCompareDataLists" || this._preferedDashboardLayout === "layoutEverythingAtOnce") {
          this.preferedDashboardType = "fieldlinguistPowerUser";
        }
      }

      this._preferedDashboardLayout = value;
    }
  },

  hotkeys: {
    get: function() {
      return this._hotkeys || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._hotkeys) {
        return;
      }
      if (!value) {
        delete this._hotkeys;
        return;
      } else {
        if (value.firstKey) {
          value = [value];
        }
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["hotkeys"](value);
        }
      }
      this._hotkeys = value;
    }
  },

  unicodes: {
    get: function() {
      return this._unicodes || FieldDBObject.DEFAULT_COLLECTION;
    },
    set: function(value) {
      if (value === this._unicodes) {
        return;
      }
      if (!value) {
        delete this._unicodes;
        return;
      } else {
        if (Object.prototype.toString.call(value) === "[object Array]") {
          value = new this.INTERNAL_MODELS["unicodes"](value);
        }
      }
      this._unicodes = value;
    }
  }

});
exports.UserPreference = UserPreference;

},{"./../FieldDBObject":4,"./../hotkey/HotKeys":38,"./../unicode/UnicodeSymbols":50}],58:[function(require,module,exports){
module.exports={
  "_id": "",
  "jsonType": "user",
  "username": "",
  "email": "",
  "corpuses": [{
    "protocol": "",
    "domain": "",
    "port": "",
    "pouchname": "",
    "path": "",
    "authUrl": "",
    "userFriendlyServerName": "",
    "title": "",
    "corpusid": "",
    "titleAsUrl": "",
    "description": "The details of this corpus are not public."
  }],
  "activityCouchConnection": {
    "protocol": "",
    "domain": "",
    "port": "",
    "pouchname": "",
    "path": "",
    "authUrl": "",
    "userFriendlyServerName": ""
  },
  "appbrand": "",
  "gravatar": "",
  "appVersionWhenCreated": "1.62.2",
  "authServerVersionWhenCreated": "",
  "authUrl": "",
  "created_at": "",
  "updated_at": "",
  "researchInterest": "",
  "affiliation": "",
  "description": "",
  "subtitle": "",
  "dataLists": [],
  "prefs": {
    "skin": "",
    "numVisibleDatum": "10",
    "transparentDashboard": "false",
    "alwaysRandomizeSkin": "true",
    "numberOfItemsInPaginatedViews": 10,
    "unicodes": [{
      "symbol": "ɔ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ə",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ɛ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ɣ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ɥ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ɦ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ɫ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ʃ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ʒ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "ʔ",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "λ ",
      "tipa": "lambda",
      "useCount": 0
    }, {
      "symbol": "α ",
      "tipa": "alpha",
      "useCount": 0
    }, {
      "symbol": "β ",
      "tipa": "\beta",
      "useCount": 0
    }, {
      "symbol": "∀",
      "tipa": "\forall",
      "useCount": 0
    }, {
      "symbol": "∃",
      "tipa": "exists",
      "useCount": 0
    }, {
      "symbol": "°",
      "tipa": "^{circ}",
      "useCount": 0
    }, {
      "symbol": "∄",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "∅",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "∈",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "∉",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "∋",
      "tipa": "",
      "useCount": 0
    }, {
      "symbol": "∌",
      "tipa": "",
      "useCount": 0
    }],
    "preferedDashboardLayout": "default",
    "showNewDatumAtTopOrBottomOfDataEntryArea": "bottom",
    "hotkeys": []
  },
  "mostRecentIds": {
    "corpusid": "",
    "datalistid": "",
    "sessionid": "",
    "couchConnection": {
      "protocol": "",
      "domain": "",
      "port": "",
      "pouchname": "",
      "path": "",
      "authUrl": "",
      "userFriendlyServerName": "",
      "corpusid": ""
    }
  },
  "firstname": "",
  "lastname": "",
  "sessionHistory": [],
  "hotkeys": {
    "firstKey": "",
    "secondKey": "",
    "description": "",
    "filledWithDefaults": true
  },
  "newCorpusConnections": [{
    "protocol": "",
    "domain": "",
    "port": "",
    "pouchname": "",
    "path": "",
    "authUrl": "",
    "userFriendlyServerName": ""
  }],
  "roles": [],
  "authenticated": true,
  "accessibleDBS": []
}

},{}],59:[function(require,module,exports){
var Buffer=require("__browserify_Buffer");(function(){
  var crypt = require('crypt'),
      utf8 = require('charenc').utf8,
      bin = require('charenc').bin,

  // The core
  md5 = function (message, options) {
    // Convert to byte array
    if (message.constructor == String)
      if (options && options.encoding === 'binary')
        message = bin.stringToBytes(message);
      else
        message = utf8.stringToBytes(message);
    else if (typeof Buffer != 'undefined' &&
        typeof Buffer.isBuffer == 'function' && Buffer.isBuffer(message))
      message = Array.prototype.slice.call(message, 0);
    else if (!Array.isArray(message))
      message = message.toString();
    // else, assume byte array already

    var m = crypt.bytesToWords(message),
        l = message.length * 8,
        a =  1732584193,
        b = -271733879,
        c = -1732584194,
        d =  271733878;

    // Swap endian
    for (var i = 0; i < m.length; i++) {
      m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
             ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
    }

    // Padding
    m[l >>> 5] |= 0x80 << (l % 32);
    m[(((l + 64) >>> 9) << 4) + 14] = l;

    // Method shortcuts
    var FF = md5._ff,
        GG = md5._gg,
        HH = md5._hh,
        II = md5._ii;

    for (var i = 0; i < m.length; i += 16) {

      var aa = a,
          bb = b,
          cc = c,
          dd = d;

      a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
      d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
      c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
      b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
      a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
      d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
      c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
      b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
      a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
      d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
      c = FF(c, d, a, b, m[i+10], 17, -42063);
      b = FF(b, c, d, a, m[i+11], 22, -1990404162);
      a = FF(a, b, c, d, m[i+12],  7,  1804603682);
      d = FF(d, a, b, c, m[i+13], 12, -40341101);
      c = FF(c, d, a, b, m[i+14], 17, -1502002290);
      b = FF(b, c, d, a, m[i+15], 22,  1236535329);

      a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
      d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
      c = GG(c, d, a, b, m[i+11], 14,  643717713);
      b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
      a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
      d = GG(d, a, b, c, m[i+10],  9,  38016083);
      c = GG(c, d, a, b, m[i+15], 14, -660478335);
      b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
      a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
      d = GG(d, a, b, c, m[i+14],  9, -1019803690);
      c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
      b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
      a = GG(a, b, c, d, m[i+13],  5, -1444681467);
      d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
      c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
      b = GG(b, c, d, a, m[i+12], 20, -1926607734);

      a = HH(a, b, c, d, m[i+ 5],  4, -378558);
      d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
      c = HH(c, d, a, b, m[i+11], 16,  1839030562);
      b = HH(b, c, d, a, m[i+14], 23, -35309556);
      a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
      d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
      c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
      b = HH(b, c, d, a, m[i+10], 23, -1094730640);
      a = HH(a, b, c, d, m[i+13],  4,  681279174);
      d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
      c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
      b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
      a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
      d = HH(d, a, b, c, m[i+12], 11, -421815835);
      c = HH(c, d, a, b, m[i+15], 16,  530742520);
      b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

      a = II(a, b, c, d, m[i+ 0],  6, -198630844);
      d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
      c = II(c, d, a, b, m[i+14], 15, -1416354905);
      b = II(b, c, d, a, m[i+ 5], 21, -57434055);
      a = II(a, b, c, d, m[i+12],  6,  1700485571);
      d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
      c = II(c, d, a, b, m[i+10], 15, -1051523);
      b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
      a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
      d = II(d, a, b, c, m[i+15], 10, -30611744);
      c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
      b = II(b, c, d, a, m[i+13], 21,  1309151649);
      a = II(a, b, c, d, m[i+ 4],  6, -145523070);
      d = II(d, a, b, c, m[i+11], 10, -1120210379);
      c = II(c, d, a, b, m[i+ 2], 15,  718787259);
      b = II(b, c, d, a, m[i+ 9], 21, -343485551);

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return crypt.endian([a, b, c, d]);
  };

  // Auxiliary functions
  md5._ff  = function (a, b, c, d, x, s, t) {
    var n = a + (b & c | ~b & d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._gg  = function (a, b, c, d, x, s, t) {
    var n = a + (b & d | c & ~d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._hh  = function (a, b, c, d, x, s, t) {
    var n = a + (b ^ c ^ d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._ii  = function (a, b, c, d, x, s, t) {
    var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };

  // Package private blocksize
  md5._blocksize = 16;
  md5._digestsize = 16;

  module.exports = function (message, options) {
    if(typeof message == 'undefined')
      return;

    var digestbytes = crypt.wordsToBytes(md5(message, options));
    return options && options.asBytes ? digestbytes :
        options && options.asString ? bin.bytesToString(digestbytes) :
        crypt.bytesToHex(digestbytes);
  };

})();

},{"__browserify_Buffer":63,"charenc":60,"crypt":61}],60:[function(require,module,exports){
var charenc = {
  // UTF-8 encoding
  utf8: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
    }
  },

  // Binary encoding
  bin: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      for (var bytes = [], i = 0; i < str.length; i++)
        bytes.push(str.charCodeAt(i) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      for (var str = [], i = 0; i < bytes.length; i++)
        str.push(String.fromCharCode(bytes[i]));
      return str.join('');
    }
  }
};

module.exports = charenc;

},{}],61:[function(require,module,exports){
(function() {
  var base64map
      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  crypt = {
    // Bit-wise rotation left
    rotl: function(n, b) {
      return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotation right
    rotr: function(n, b) {
      return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function(n) {
      // If number given, swap endian
      if (n.constructor == Number) {
        return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
      }

      // Else, assume array and swap all items
      for (var i = 0; i < n.length; i++)
        n[i] = crypt.endian(n[i]);
      return n;
    },

    // Generate an array of any length of random bytes
    randomBytes: function(n) {
      for (var bytes = []; n > 0; n--)
        bytes.push(Math.floor(Math.random() * 256));
      return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function(bytes) {
      for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
      return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function(words) {
      for (var bytes = [], b = 0; b < words.length * 32; b += 8)
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function(bytes) {
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join('');
    },

    // Convert a hex string to a byte array
    hexToBytes: function(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function(bytes) {
      for (var base64 = [], i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        for (var j = 0; j < 4; j++)
          if (i * 8 + j * 6 <= bytes.length * 8)
            base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
          else
            base64.push('=');
      }
      return base64.join('');
    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function(base64) {
      // Remove non-base-64 characters
      base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

      for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
          imod4 = ++i % 4) {
        if (imod4 == 0) continue;
        bytes.push(((base64map.indexOf(base64.charAt(i - 1))
            & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
            | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
      }
      return bytes;
    }
  };

  module.exports = crypt;
})();

},{}],62:[function(require,module,exports){
var Buffer=require("__browserify_Buffer");(function () {
  "use strict";

  function atob(str) {
    return new Buffer(str, 'base64').toString('binary');
  }

  module.exports = atob;
}());

},{"__browserify_Buffer":63}],63:[function(require,module,exports){
require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"PcZj9L":[function(require,module,exports){
var TA = require('typedarray')
var xDataView = typeof DataView === 'undefined'
  ? TA.DataView : DataView
var xArrayBuffer = typeof ArrayBuffer === 'undefined'
  ? TA.ArrayBuffer : ArrayBuffer
var xUint8Array = typeof Uint8Array === 'undefined'
  ? TA.Uint8Array : Uint8Array

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

var browserSupport

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 *
 * Firefox is a special case because it doesn't allow augmenting "native" object
 * instances. See `ProxyBuffer` below for more details.
 */
function Buffer (subject, encoding) {
  var type = typeof subject

  // Work-around: node's base64 implementation
  // allows for non-padded strings while base64-js
  // does not..
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // Assume object is an array
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf = augment(new xUint8Array(length))
  if (Buffer.isBuffer(subject)) {
    // Speed optimization -- use set if we're copying from a Uint8Array
    buf.set(subject)
  } else if (isArrayIsh(subject)) {
    // Treat array-ish objects as a byte array.
    for (var i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function(encoding) {
  switch ((encoding + '').toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
    case 'raw':
      return true

    default:
      return false
  }
}

Buffer.isBuffer = function isBuffer (b) {
  return b && b._isBuffer
}

Buffer.byteLength = function (str, encoding) {
  switch (encoding || 'utf8') {
    case 'hex':
      return str.length / 2

    case 'utf8':
    case 'utf-8':
      return utf8ToBytes(str).length

    case 'ascii':
    case 'binary':
      return str.length

    case 'base64':
      return base64ToBytes(str).length

    default:
      throw new Error('Unknown encoding')
  }
}

Buffer.concat = function (list, totalLength) {
  if (!Array.isArray(list)) {
    throw new Error('Usage: Buffer.concat(list, [totalLength])\n' +
        'list should be an Array.')
  }

  var i
  var buf

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      buf = list[i]
      totalLength += buf.length
    }
  }

  var buffer = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    buf = list[i]
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

// INSTANCE METHODS
// ================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) {
    throw new Error('Invalid hex string')
  }
  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var bytes, pos
  return Buffer._charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
}

function _asciiWrite (buf, string, offset, length) {
  var bytes, pos
  return Buffer._charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var bytes, pos
  return Buffer._charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
}

function BufferWrite (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  switch (encoding) {
    case 'hex':
      return _hexWrite(this, string, offset, length)

    case 'utf8':
    case 'utf-8':
      return _utf8Write(this, string, offset, length)

    case 'ascii':
      return _asciiWrite(this, string, offset, length)

    case 'binary':
      return _binaryWrite(this, string, offset, length)

    case 'base64':
      return _base64Write(this, string, offset, length)

    default:
      throw new Error('Unknown encoding')
  }
}

function BufferToString (encoding, start, end) {
  var self = (this instanceof ProxyBuffer)
    ? this._proxy
    : this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  switch (encoding) {
    case 'hex':
      return _hexSlice(self, start, end)

    case 'utf8':
    case 'utf-8':
      return _utf8Slice(self, start, end)

    case 'ascii':
      return _asciiSlice(self, start, end)

    case 'binary':
      return _binarySlice(self, start, end)

    case 'base64':
      return _base64Slice(self, start, end)

    default:
      throw new Error('Unknown encoding')
  }
}

function BufferToJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
function BufferCopy (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start)
    throw new Error('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new Error('targetStart out of bounds')
  if (start < 0 || start >= source.length)
    throw new Error('sourceStart out of bounds')
  if (end < 0 || end > source.length)
    throw new Error('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  // copy!
  for (var i = 0; i < end - start; i++)
    target[i + target_start] = this[i + start]
}

function _base64Slice (buf, start, end) {
  var bytes = buf.slice(start, end)
  return require('base64-js').fromByteArray(bytes)
}

function _utf8Slice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  var tmp = ''
  var i = 0
  while (i < bytes.length) {
    if (bytes[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(bytes[i])
      tmp = ''
    } else {
      tmp += '%' + bytes[i].toString(16)
    }

    i++
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var ret = ''
  for (var i = 0; i < bytes.length; i++)
    ret += String.fromCharCode(bytes[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

// TODO: add test that modifying the new buffer slice will modify memory in the
// original buffer! Use code from:
// http://nodejs.org/api/buffer.html#buffer_buf_slice_start_end
function BufferSlice (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)
  return augment(this.subarray(start, end)) // Uint8Array built-in method
}

function BufferReadUInt8 (offset, noAssert) {
  var buf = this
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < buf.length, 'Trying to read beyond buffer length')
  }

  if (offset >= buf.length)
    return

  return buf[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 1 === len) {
    var dv = new xDataView(new xArrayBuffer(2))
    dv.setUint8(0, buf[len - 1])
    return dv.getUint16(0, littleEndian)
  } else {
    return buf._dataview.getUint16(offset, littleEndian)
  }
}

function BufferReadUInt16LE (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

function BufferReadUInt16BE (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 3 >= len) {
    var dv = new xDataView(new xArrayBuffer(4))
    for (var i = 0; i + offset < len; i++) {
      dv.setUint8(i, buf[i + offset])
    }
    return dv.getUint32(0, littleEndian)
  } else {
    return buf._dataview.getUint32(offset, littleEndian)
  }
}

function BufferReadUInt32LE (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

function BufferReadUInt32BE (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

function BufferReadInt8 (offset, noAssert) {
  var buf = this
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < buf.length, 'Trying to read beyond buffer length')
  }

  if (offset >= buf.length)
    return

  return buf._dataview.getInt8(offset)
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 1 === len) {
    var dv = new xDataView(new xArrayBuffer(2))
    dv.setUint8(0, buf[len - 1])
    return dv.getInt16(0, littleEndian)
  } else {
    return buf._dataview.getInt16(offset, littleEndian)
  }
}

function BufferReadInt16LE (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

function BufferReadInt16BE (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 3 >= len) {
    var dv = new xDataView(new xArrayBuffer(4))
    for (var i = 0; i + offset < len; i++) {
      dv.setUint8(i, buf[i + offset])
    }
    return dv.getInt32(0, littleEndian)
  } else {
    return buf._dataview.getInt32(offset, littleEndian)
  }
}

function BufferReadInt32LE (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

function BufferReadInt32BE (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return buf._dataview.getFloat32(offset, littleEndian)
}

function BufferReadFloatLE (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

function BufferReadFloatBE (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return buf._dataview.getFloat64(offset, littleEndian)
}

function BufferReadDoubleLE (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

function BufferReadDoubleBE (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

function BufferWriteUInt8 (value, offset, noAssert) {
  var buf = this
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= buf.length) return

  buf[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 1 === len) {
    var dv = new xDataView(new xArrayBuffer(2))
    dv.setUint16(0, value, littleEndian)
    buf[offset] = dv.getUint8(0)
  } else {
    buf._dataview.setUint16(offset, value, littleEndian)
  }
}

function BufferWriteUInt16LE (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

function BufferWriteUInt16BE (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 3 >= len) {
    var dv = new xDataView(new xArrayBuffer(4))
    dv.setUint32(0, value, littleEndian)
    for (var i = 0; i + offset < len; i++) {
      buf[i + offset] = dv.getUint8(i)
    }
  } else {
    buf._dataview.setUint32(offset, value, littleEndian)
  }
}

function BufferWriteUInt32LE (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

function BufferWriteUInt32BE (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

function BufferWriteInt8 (value, offset, noAssert) {
  var buf = this
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= buf.length) return

  buf._dataview.setInt8(offset, value)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 1 === len) {
    var dv = new xDataView(new xArrayBuffer(2))
    dv.setInt16(0, value, littleEndian)
    buf[offset] = dv.getUint8(0)
  } else {
    buf._dataview.setInt16(offset, value, littleEndian)
  }
}

function BufferWriteInt16LE (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

function BufferWriteInt16BE (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 3 >= len) {
    var dv = new xDataView(new xArrayBuffer(4))
    dv.setInt32(0, value, littleEndian)
    for (var i = 0; i + offset < len; i++) {
      buf[i + offset] = dv.getUint8(i)
    }
  } else {
    buf._dataview.setInt32(offset, value, littleEndian)
  }
}

function BufferWriteInt32LE (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

function BufferWriteInt32BE (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 3 >= len) {
    var dv = new xDataView(new xArrayBuffer(4))
    dv.setFloat32(0, value, littleEndian)
    for (var i = 0; i + offset < len; i++) {
      buf[i + offset] = dv.getUint8(i)
    }
  } else {
    buf._dataview.setFloat32(offset, value, littleEndian)
  }
}

function BufferWriteFloatLE (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

function BufferWriteFloatBE (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof (littleEndian) === 'boolean',
        'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len) {
    return
  } else if (offset + 7 >= len) {
    var dv = new xDataView(new xArrayBuffer(8))
    dv.setFloat64(0, value, littleEndian)
    for (var i = 0; i + offset < len; i++) {
      buf[i + offset] = dv.getUint8(i)
    }
  } else {
    buf._dataview.setFloat64(offset, value, littleEndian)
  }
}

function BufferWriteDoubleLE (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

function BufferWriteDoubleBE (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
function BufferFill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('value is not a number')
  }

  if (end < start) throw new Error('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) {
    throw new Error('start out of bounds')
  }

  if (end < 0 || end > this.length) {
    throw new Error('end out of bounds')
  }

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

function BufferInspect () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

// Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
// Added in Node 0.12.
function BufferToArrayBuffer () {
  return (new Buffer(this)).buffer
}


// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

/**
 * Check to see if the browser supports augmenting a `Uint8Array` instance.
 * @return {boolean}
 */
function _browserSupport () {
  var arr = new xUint8Array(0)
  arr.foo = function () { return 42 }

  try {
    return (42 === arr.foo())
  } catch (e) {
    return false
  }
}

/**
 * Class: ProxyBuffer
 * ==================
 *
 * Only used in Firefox, since Firefox does not allow augmenting "native"
 * objects (like Uint8Array instances) with new properties for some unknown
 * (probably silly) reason. So we'll use an ES6 Proxy (supported since
 * Firefox 18) to wrap the Uint8Array instance without actually adding any
 * properties to it.
 *
 * Instances of this "fake" Buffer class are the "target" of the
 * ES6 Proxy (see `augment` function).
 *
 * We couldn't just use the `Uint8Array` as the target of the `Proxy` because
 * Proxies have an important limitation on trapping the `toString` method.
 * `Object.prototype.toString.call(proxy)` gets called whenever something is
 * implicitly cast to a String. Unfortunately, with a `Proxy` this
 * unconditionally returns `Object.prototype.toString.call(target)` which would
 * always return "[object Uint8Array]" if we used the `Uint8Array` instance as
 * the target. And, remember, in Firefox we cannot redefine the `Uint8Array`
 * instance's `toString` method.
 *
 * So, we use this `ProxyBuffer` class as the proxy's "target". Since this class
 * has its own custom `toString` method, it will get called whenever `toString`
 * gets called, implicitly or explicitly, on the `Proxy` instance.
 *
 * We also have to define the Uint8Array methods `subarray` and `set` on
 * `ProxyBuffer` because if we didn't then `proxy.subarray(0)` would have its
 * `this` set to `proxy` (a `Proxy` instance) which throws an exception in
 * Firefox which expects it to be a `TypedArray` instance.
 */
function ProxyBuffer (arr) {
  this._arr = arr

  if (arr.byteLength !== 0)
    this._dataview = new xDataView(arr.buffer, arr.byteOffset, arr.byteLength)
}

ProxyBuffer.prototype.write = BufferWrite
ProxyBuffer.prototype.toString = BufferToString
ProxyBuffer.prototype.toLocaleString = BufferToString
ProxyBuffer.prototype.toJSON = BufferToJSON
ProxyBuffer.prototype.copy = BufferCopy
ProxyBuffer.prototype.slice = BufferSlice
ProxyBuffer.prototype.readUInt8 = BufferReadUInt8
ProxyBuffer.prototype.readUInt16LE = BufferReadUInt16LE
ProxyBuffer.prototype.readUInt16BE = BufferReadUInt16BE
ProxyBuffer.prototype.readUInt32LE = BufferReadUInt32LE
ProxyBuffer.prototype.readUInt32BE = BufferReadUInt32BE
ProxyBuffer.prototype.readInt8 = BufferReadInt8
ProxyBuffer.prototype.readInt16LE = BufferReadInt16LE
ProxyBuffer.prototype.readInt16BE = BufferReadInt16BE
ProxyBuffer.prototype.readInt32LE = BufferReadInt32LE
ProxyBuffer.prototype.readInt32BE = BufferReadInt32BE
ProxyBuffer.prototype.readFloatLE = BufferReadFloatLE
ProxyBuffer.prototype.readFloatBE = BufferReadFloatBE
ProxyBuffer.prototype.readDoubleLE = BufferReadDoubleLE
ProxyBuffer.prototype.readDoubleBE = BufferReadDoubleBE
ProxyBuffer.prototype.writeUInt8 = BufferWriteUInt8
ProxyBuffer.prototype.writeUInt16LE = BufferWriteUInt16LE
ProxyBuffer.prototype.writeUInt16BE = BufferWriteUInt16BE
ProxyBuffer.prototype.writeUInt32LE = BufferWriteUInt32LE
ProxyBuffer.prototype.writeUInt32BE = BufferWriteUInt32BE
ProxyBuffer.prototype.writeInt8 = BufferWriteInt8
ProxyBuffer.prototype.writeInt16LE = BufferWriteInt16LE
ProxyBuffer.prototype.writeInt16BE = BufferWriteInt16BE
ProxyBuffer.prototype.writeInt32LE = BufferWriteInt32LE
ProxyBuffer.prototype.writeInt32BE = BufferWriteInt32BE
ProxyBuffer.prototype.writeFloatLE = BufferWriteFloatLE
ProxyBuffer.prototype.writeFloatBE = BufferWriteFloatBE
ProxyBuffer.prototype.writeDoubleLE = BufferWriteDoubleLE
ProxyBuffer.prototype.writeDoubleBE = BufferWriteDoubleBE
ProxyBuffer.prototype.fill = BufferFill
ProxyBuffer.prototype.inspect = BufferInspect
ProxyBuffer.prototype.toArrayBuffer = BufferToArrayBuffer
ProxyBuffer.prototype._isBuffer = true
ProxyBuffer.prototype.subarray = function () {
  return this._arr.subarray.apply(this._arr, arguments)
}
ProxyBuffer.prototype.set = function () {
  return this._arr.set.apply(this._arr, arguments)
}

var ProxyHandler = {
  get: function (target, name) {
    if (name in target) return target[name]
    else return target._arr[name]
  },
  set: function (target, name, value) {
    target._arr[name] = value
  }
}

function augment (arr) {
  if (browserSupport === undefined) {
    browserSupport = _browserSupport()
  }

  if (browserSupport) {
    // Augment the Uint8Array *instance* (not the class!) with Buffer methods
    arr.write = BufferWrite
    arr.toString = BufferToString
    arr.toLocaleString = BufferToString
    arr.toJSON = BufferToJSON
    arr.copy = BufferCopy
    arr.slice = BufferSlice
    arr.readUInt8 = BufferReadUInt8
    arr.readUInt16LE = BufferReadUInt16LE
    arr.readUInt16BE = BufferReadUInt16BE
    arr.readUInt32LE = BufferReadUInt32LE
    arr.readUInt32BE = BufferReadUInt32BE
    arr.readInt8 = BufferReadInt8
    arr.readInt16LE = BufferReadInt16LE
    arr.readInt16BE = BufferReadInt16BE
    arr.readInt32LE = BufferReadInt32LE
    arr.readInt32BE = BufferReadInt32BE
    arr.readFloatLE = BufferReadFloatLE
    arr.readFloatBE = BufferReadFloatBE
    arr.readDoubleLE = BufferReadDoubleLE
    arr.readDoubleBE = BufferReadDoubleBE
    arr.writeUInt8 = BufferWriteUInt8
    arr.writeUInt16LE = BufferWriteUInt16LE
    arr.writeUInt16BE = BufferWriteUInt16BE
    arr.writeUInt32LE = BufferWriteUInt32LE
    arr.writeUInt32BE = BufferWriteUInt32BE
    arr.writeInt8 = BufferWriteInt8
    arr.writeInt16LE = BufferWriteInt16LE
    arr.writeInt16BE = BufferWriteInt16BE
    arr.writeInt32LE = BufferWriteInt32LE
    arr.writeInt32BE = BufferWriteInt32BE
    arr.writeFloatLE = BufferWriteFloatLE
    arr.writeFloatBE = BufferWriteFloatBE
    arr.writeDoubleLE = BufferWriteDoubleLE
    arr.writeDoubleBE = BufferWriteDoubleBE
    arr.fill = BufferFill
    arr.inspect = BufferInspect
    arr.toArrayBuffer = BufferToArrayBuffer
    arr._isBuffer = true

    if (arr.byteLength !== 0)
      arr._dataview = new xDataView(arr.buffer, arr.byteOffset, arr.byteLength)

    return arr

  } else {
    // This is a browser that doesn't support augmenting the `Uint8Array`
    // instance (*ahem* Firefox) so use an ES6 `Proxy`.
    var proxyBuffer = new ProxyBuffer(arr)
    var proxy = new Proxy(proxyBuffer, ProxyHandler)
    proxyBuffer._proxy = proxy
    return proxy
  }
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArrayIsh (subject) {
  return Array.isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++)
    if (str.charCodeAt(i) <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var h = encodeURIComponent(str.charAt(i)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }

  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }

  return byteArray
}

function base64ToBytes (str) {
  return require('base64-js').toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos, i = 0
  while (i < length) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break

    dst[i + offset] = src[i]
    i++
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 *
 *      value           The number to check for validity
 *
 *      max             The maximum value
 */
function verifuint (value, max) {
  assert(typeof (value) == 'number', 'cannot write a non-number as a number')
  assert(value >= 0,
      'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

/*
 * A series of checks to make sure we actually have a signed 32-bit number
 */
function verifsint(value, max, min) {
  assert(typeof (value) == 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754(value, max, min) {
  assert(typeof (value) == 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":3,"typedarray":4}],"native-buffer-browserify":[function(require,module,exports){
module.exports=require('PcZj9L');
},{}],3:[function(require,module,exports){
(function (exports) {
	'use strict';

	var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	function b64ToByteArray(b64) {
		var i, j, l, tmp, placeHolders, arr;
	
		if (b64.length % 4 > 0) {
			throw 'Invalid string. Length must be a multiple of 4';
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		placeHolders = b64.indexOf('=');
		placeHolders = placeHolders > 0 ? b64.length - placeHolders : 0;

		// base64 is 4/3 + up to two characters of the original data
		arr = [];//new Uint8Array(b64.length * 3 / 4 - placeHolders);

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length;

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (lookup.indexOf(b64[i]) << 18) | (lookup.indexOf(b64[i + 1]) << 12) | (lookup.indexOf(b64[i + 2]) << 6) | lookup.indexOf(b64[i + 3]);
			arr.push((tmp & 0xFF0000) >> 16);
			arr.push((tmp & 0xFF00) >> 8);
			arr.push(tmp & 0xFF);
		}

		if (placeHolders === 2) {
			tmp = (lookup.indexOf(b64[i]) << 2) | (lookup.indexOf(b64[i + 1]) >> 4);
			arr.push(tmp & 0xFF);
		} else if (placeHolders === 1) {
			tmp = (lookup.indexOf(b64[i]) << 10) | (lookup.indexOf(b64[i + 1]) << 4) | (lookup.indexOf(b64[i + 2]) >> 2);
			arr.push((tmp >> 8) & 0xFF);
			arr.push(tmp & 0xFF);
		}

		return arr;
	}

	function uint8ToBase64(uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length;

		function tripletToBase64 (num) {
			return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
		};

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
			output += tripletToBase64(temp);
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1];
				output += lookup[temp >> 2];
				output += lookup[(temp << 4) & 0x3F];
				output += '==';
				break;
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1]);
				output += lookup[temp >> 10];
				output += lookup[(temp >> 4) & 0x3F];
				output += lookup[(temp << 2) & 0x3F];
				output += '=';
				break;
		}

		return output;
	}

	module.exports.toByteArray = b64ToByteArray;
	module.exports.fromByteArray = uint8ToBase64;
}());

},{}],4:[function(require,module,exports){
var undefined = (void 0); // Paranoia

// Beyond this value, index getters/setters (i.e. array[0], array[1]) are so slow to
// create, and consume so much memory, that the browser appears frozen.
var MAX_ARRAY_LENGTH = 1e5;

// Approximations of internal ECMAScript conversion functions
var ECMAScript = (function() {
  // Stash a copy in case other scripts modify these
  var opts = Object.prototype.toString,
      ophop = Object.prototype.hasOwnProperty;

  return {
    // Class returns internal [[Class]] property, used to avoid cross-frame instanceof issues:
    Class: function(v) { return opts.call(v).replace(/^\[object *|\]$/g, ''); },
    HasProperty: function(o, p) { return p in o; },
    HasOwnProperty: function(o, p) { return ophop.call(o, p); },
    IsCallable: function(o) { return typeof o === 'function'; },
    ToInt32: function(v) { return v >> 0; },
    ToUint32: function(v) { return v >>> 0; }
  };
}());

// Snapshot intrinsics
var LN2 = Math.LN2,
    abs = Math.abs,
    floor = Math.floor,
    log = Math.log,
    min = Math.min,
    pow = Math.pow,
    round = Math.round;

// ES5: lock down object properties
function configureProperties(obj) {
  if (getOwnPropertyNames && defineProperty) {
    var props = getOwnPropertyNames(obj), i;
    for (i = 0; i < props.length; i += 1) {
      defineProperty(obj, props[i], {
        value: obj[props[i]],
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
  }
}

// emulate ES5 getter/setter API using legacy APIs
// http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
// (second clause tests for Object.defineProperty() in IE<9 that only supports extending DOM prototypes, but
// note that IE<9 does not support __defineGetter__ or __defineSetter__ so it just renders the method harmless)
var defineProperty = Object.defineProperty || function(o, p, desc) {
  if (!o === Object(o)) throw new TypeError("Object.defineProperty called on non-object");
  if (ECMAScript.HasProperty(desc, 'get') && Object.prototype.__defineGetter__) { Object.prototype.__defineGetter__.call(o, p, desc.get); }
  if (ECMAScript.HasProperty(desc, 'set') && Object.prototype.__defineSetter__) { Object.prototype.__defineSetter__.call(o, p, desc.set); }
  if (ECMAScript.HasProperty(desc, 'value')) { o[p] = desc.value; }
  return o;
};

var getOwnPropertyNames = Object.getOwnPropertyNames || function getOwnPropertyNames(o) {
  if (o !== Object(o)) throw new TypeError("Object.getOwnPropertyNames called on non-object");
  var props = [], p;
  for (p in o) {
    if (ECMAScript.HasOwnProperty(o, p)) {
      props.push(p);
    }
  }
  return props;
};

// ES5: Make obj[index] an alias for obj._getter(index)/obj._setter(index, value)
// for index in 0 ... obj.length
function makeArrayAccessors(obj) {
  if (!defineProperty) { return; }

  if (obj.length > MAX_ARRAY_LENGTH) throw new RangeError("Array too large for polyfill");

  function makeArrayAccessor(index) {
    defineProperty(obj, index, {
      'get': function() { return obj._getter(index); },
      'set': function(v) { obj._setter(index, v); },
      enumerable: true,
      configurable: false
    });
  }

  var i;
  for (i = 0; i < obj.length; i += 1) {
    makeArrayAccessor(i);
  }
}

// Internal conversion functions:
//    pack<Type>()   - take a number (interpreted as Type), output a byte array
//    unpack<Type>() - take a byte array, output a Type-like number

function as_signed(value, bits) { var s = 32 - bits; return (value << s) >> s; }
function as_unsigned(value, bits) { var s = 32 - bits; return (value << s) >>> s; }

function packI8(n) { return [n & 0xff]; }
function unpackI8(bytes) { return as_signed(bytes[0], 8); }

function packU8(n) { return [n & 0xff]; }
function unpackU8(bytes) { return as_unsigned(bytes[0], 8); }

function packU8Clamped(n) { n = round(Number(n)); return [n < 0 ? 0 : n > 0xff ? 0xff : n & 0xff]; }

function packI16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackI16(bytes) { return as_signed(bytes[0] << 8 | bytes[1], 16); }

function packU16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackU16(bytes) { return as_unsigned(bytes[0] << 8 | bytes[1], 16); }

function packI32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackI32(bytes) { return as_signed(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packU32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackU32(bytes) { return as_unsigned(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packIEEE754(v, ebits, fbits) {

  var bias = (1 << (ebits - 1)) - 1,
      s, e, f, ln,
      i, bits, str, bytes;

  function roundToEven(n) {
    var w = floor(n), f = n - w;
    if (f < 0.5)
      return w;
    if (f > 0.5)
      return w + 1;
    return w % 2 ? w + 1 : w;
  }

  // Compute sign, exponent, fraction
  if (v !== v) {
    // NaN
    // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
    e = (1 << ebits) - 1; f = pow(2, fbits - 1); s = 0;
  } else if (v === Infinity || v === -Infinity) {
    e = (1 << ebits) - 1; f = 0; s = (v < 0) ? 1 : 0;
  } else if (v === 0) {
    e = 0; f = 0; s = (1 / v === -Infinity) ? 1 : 0;
  } else {
    s = v < 0;
    v = abs(v);

    if (v >= pow(2, 1 - bias)) {
      e = min(floor(log(v) / LN2), 1023);
      f = roundToEven(v / pow(2, e) * pow(2, fbits));
      if (f / pow(2, fbits) >= 2) {
        e = e + 1;
        f = 1;
      }
      if (e > bias) {
        // Overflow
        e = (1 << ebits) - 1;
        f = 0;
      } else {
        // Normalized
        e = e + bias;
        f = f - pow(2, fbits);
      }
    } else {
      // Denormalized
      e = 0;
      f = roundToEven(v / pow(2, 1 - bias - fbits));
    }
  }

  // Pack sign, exponent, fraction
  bits = [];
  for (i = fbits; i; i -= 1) { bits.push(f % 2 ? 1 : 0); f = floor(f / 2); }
  for (i = ebits; i; i -= 1) { bits.push(e % 2 ? 1 : 0); e = floor(e / 2); }
  bits.push(s ? 1 : 0);
  bits.reverse();
  str = bits.join('');

  // Bits to bytes
  bytes = [];
  while (str.length) {
    bytes.push(parseInt(str.substring(0, 8), 2));
    str = str.substring(8);
  }
  return bytes;
}

function unpackIEEE754(bytes, ebits, fbits) {

  // Bytes to bits
  var bits = [], i, j, b, str,
      bias, s, e, f;

  for (i = bytes.length; i; i -= 1) {
    b = bytes[i - 1];
    for (j = 8; j; j -= 1) {
      bits.push(b % 2 ? 1 : 0); b = b >> 1;
    }
  }
  bits.reverse();
  str = bits.join('');

  // Unpack sign, exponent, fraction
  bias = (1 << (ebits - 1)) - 1;
  s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
  e = parseInt(str.substring(1, 1 + ebits), 2);
  f = parseInt(str.substring(1 + ebits), 2);

  // Produce number
  if (e === (1 << ebits) - 1) {
    return f !== 0 ? NaN : s * Infinity;
  } else if (e > 0) {
    // Normalized
    return s * pow(2, e - bias) * (1 + f / pow(2, fbits));
  } else if (f !== 0) {
    // Denormalized
    return s * pow(2, -(bias - 1)) * (f / pow(2, fbits));
  } else {
    return s < 0 ? -0 : 0;
  }
}

function unpackF64(b) { return unpackIEEE754(b, 11, 52); }
function packF64(v) { return packIEEE754(v, 11, 52); }
function unpackF32(b) { return unpackIEEE754(b, 8, 23); }
function packF32(v) { return packIEEE754(v, 8, 23); }


//
// 3 The ArrayBuffer Type
//

(function() {

  /** @constructor */
  var ArrayBuffer = function ArrayBuffer(length) {
    length = ECMAScript.ToInt32(length);
    if (length < 0) throw new RangeError('ArrayBuffer size is not a small enough positive integer');

    this.byteLength = length;
    this._bytes = [];
    this._bytes.length = length;

    var i;
    for (i = 0; i < this.byteLength; i += 1) {
      this._bytes[i] = 0;
    }

    configureProperties(this);
  };

  exports.ArrayBuffer = exports.ArrayBuffer || ArrayBuffer;

  //
  // 4 The ArrayBufferView Type
  //

  // NOTE: this constructor is not exported
  /** @constructor */
  var ArrayBufferView = function ArrayBufferView() {
    //this.buffer = null;
    //this.byteOffset = 0;
    //this.byteLength = 0;
  };

  //
  // 5 The Typed Array View Types
  //

  function makeConstructor(bytesPerElement, pack, unpack) {
    // Each TypedArray type requires a distinct constructor instance with
    // identical logic, which this produces.

    var ctor;
    ctor = function(buffer, byteOffset, length) {
      var array, sequence, i, s;

      if (!arguments.length || typeof arguments[0] === 'number') {
        // Constructor(unsigned long length)
        this.length = ECMAScript.ToInt32(arguments[0]);
        if (length < 0) throw new RangeError('ArrayBufferView size is not a small enough positive integer');

        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;
      } else if (typeof arguments[0] === 'object' && arguments[0].constructor === ctor) {
        // Constructor(TypedArray array)
        array = arguments[0];

        this.length = array.length;
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          this._setter(i, array._getter(i));
        }
      } else if (typeof arguments[0] === 'object' &&
                 !(arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(sequence<type> array)
        sequence = arguments[0];

        this.length = ECMAScript.ToUint32(sequence.length);
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          s = sequence[i];
          this._setter(i, Number(s));
        }
      } else if (typeof arguments[0] === 'object' &&
                 (arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(ArrayBuffer buffer,
        //             optional unsigned long byteOffset, optional unsigned long length)
        this.buffer = buffer;

        this.byteOffset = ECMAScript.ToUint32(byteOffset);
        if (this.byteOffset > this.buffer.byteLength) {
          throw new RangeError("byteOffset out of range");
        }

        if (this.byteOffset % this.BYTES_PER_ELEMENT) {
          // The given byteOffset must be a multiple of the element
          // size of the specific type, otherwise an exception is raised.
          throw new RangeError("ArrayBuffer length minus the byteOffset is not a multiple of the element size.");
        }

        if (arguments.length < 3) {
          this.byteLength = this.buffer.byteLength - this.byteOffset;

          if (this.byteLength % this.BYTES_PER_ELEMENT) {
            throw new RangeError("length of buffer minus byteOffset not a multiple of the element size");
          }
          this.length = this.byteLength / this.BYTES_PER_ELEMENT;
        } else {
          this.length = ECMAScript.ToUint32(length);
          this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        }

        if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
          throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }

      this.constructor = ctor;

      configureProperties(this);
      makeArrayAccessors(this);
    };

    ctor.prototype = new ArrayBufferView();
    ctor.prototype.BYTES_PER_ELEMENT = bytesPerElement;
    ctor.prototype._pack = pack;
    ctor.prototype._unpack = unpack;
    ctor.BYTES_PER_ELEMENT = bytesPerElement;

    // getter type (unsigned long index);
    ctor.prototype._getter = function(index) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = [], i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        bytes.push(this.buffer._bytes[o]);
      }
      return this._unpack(bytes);
    };

    // NONSTANDARD: convenience alias for getter: type get(unsigned long index);
    ctor.prototype.get = ctor.prototype._getter;

    // setter void (unsigned long index, type value);
    ctor.prototype._setter = function(index, value) {
      if (arguments.length < 2) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = this._pack(value), i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        this.buffer._bytes[o] = bytes[i];
      }
    };

    // void set(TypedArray array, optional unsigned long offset);
    // void set(sequence<type> array, optional unsigned long offset);
    ctor.prototype.set = function(index, value) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");
      var array, sequence, offset, len,
          i, s, d,
          byteOffset, byteLength, tmp;

      if (typeof arguments[0] === 'object' && arguments[0].constructor === this.constructor) {
        // void set(TypedArray array, optional unsigned long offset);
        array = arguments[0];
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + array.length > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        byteOffset = this.byteOffset + offset * this.BYTES_PER_ELEMENT;
        byteLength = array.length * this.BYTES_PER_ELEMENT;

        if (array.buffer === this.buffer) {
          tmp = [];
          for (i = 0, s = array.byteOffset; i < byteLength; i += 1, s += 1) {
            tmp[i] = array.buffer._bytes[s];
          }
          for (i = 0, d = byteOffset; i < byteLength; i += 1, d += 1) {
            this.buffer._bytes[d] = tmp[i];
          }
        } else {
          for (i = 0, s = array.byteOffset, d = byteOffset;
               i < byteLength; i += 1, s += 1, d += 1) {
            this.buffer._bytes[d] = array.buffer._bytes[s];
          }
        }
      } else if (typeof arguments[0] === 'object' && typeof arguments[0].length !== 'undefined') {
        // void set(sequence<type> array, optional unsigned long offset);
        sequence = arguments[0];
        len = ECMAScript.ToUint32(sequence.length);
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + len > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        for (i = 0; i < len; i += 1) {
          s = sequence[i];
          this._setter(offset + i, Number(s));
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }
    };

    // TypedArray subarray(long begin, optional long end);
    ctor.prototype.subarray = function(start, end) {
      function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

      start = ECMAScript.ToInt32(start);
      end = ECMAScript.ToInt32(end);

      if (arguments.length < 1) { start = 0; }
      if (arguments.length < 2) { end = this.length; }

      if (start < 0) { start = this.length + start; }
      if (end < 0) { end = this.length + end; }

      start = clamp(start, 0, this.length);
      end = clamp(end, 0, this.length);

      var len = end - start;
      if (len < 0) {
        len = 0;
      }

      return new this.constructor(
        this.buffer, this.byteOffset + start * this.BYTES_PER_ELEMENT, len);
    };

    return ctor;
  }

  var Int8Array = makeConstructor(1, packI8, unpackI8);
  var Uint8Array = makeConstructor(1, packU8, unpackU8);
  var Uint8ClampedArray = makeConstructor(1, packU8Clamped, unpackU8);
  var Int16Array = makeConstructor(2, packI16, unpackI16);
  var Uint16Array = makeConstructor(2, packU16, unpackU16);
  var Int32Array = makeConstructor(4, packI32, unpackI32);
  var Uint32Array = makeConstructor(4, packU32, unpackU32);
  var Float32Array = makeConstructor(4, packF32, unpackF32);
  var Float64Array = makeConstructor(8, packF64, unpackF64);

  exports.Int8Array = exports.Int8Array || Int8Array;
  exports.Uint8Array = exports.Uint8Array || Uint8Array;
  exports.Uint8ClampedArray = exports.Uint8ClampedArray || Uint8ClampedArray;
  exports.Int16Array = exports.Int16Array || Int16Array;
  exports.Uint16Array = exports.Uint16Array || Uint16Array;
  exports.Int32Array = exports.Int32Array || Int32Array;
  exports.Uint32Array = exports.Uint32Array || Uint32Array;
  exports.Float32Array = exports.Float32Array || Float32Array;
  exports.Float64Array = exports.Float64Array || Float64Array;
}());

//
// 6 The DataView View Type
//

(function() {
  function r(array, index) {
    return ECMAScript.IsCallable(array.get) ? array.get(index) : array[index];
  }

  var IS_BIG_ENDIAN = (function() {
    var u16array = new(exports.Uint16Array)([0x1234]),
        u8array = new(exports.Uint8Array)(u16array.buffer);
    return r(u8array, 0) === 0x12;
  }());

  // Constructor(ArrayBuffer buffer,
  //             optional unsigned long byteOffset,
  //             optional unsigned long byteLength)
  /** @constructor */
  var DataView = function DataView(buffer, byteOffset, byteLength) {
    if (arguments.length === 0) {
      buffer = new ArrayBuffer(0);
    } else if (!(buffer instanceof ArrayBuffer || ECMAScript.Class(buffer) === 'ArrayBuffer')) {
      throw new TypeError("TypeError");
    }

    this.buffer = buffer || new ArrayBuffer(0);

    this.byteOffset = ECMAScript.ToUint32(byteOffset);
    if (this.byteOffset > this.buffer.byteLength) {
      throw new RangeError("byteOffset out of range");
    }

    if (arguments.length < 3) {
      this.byteLength = this.buffer.byteLength - this.byteOffset;
    } else {
      this.byteLength = ECMAScript.ToUint32(byteLength);
    }

    if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
      throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
    }

    configureProperties(this);
  };

  function makeGetter(arrayType) {
    return function(byteOffset, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);

      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }
      byteOffset += this.byteOffset;

      var uint8Array = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT),
          bytes = [], i;
      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(uint8Array, i));
      }

      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      return r(new arrayType(new Uint8Array(bytes).buffer), 0);
    };
  }

  DataView.prototype.getUint8 = makeGetter(exports.Uint8Array);
  DataView.prototype.getInt8 = makeGetter(exports.Int8Array);
  DataView.prototype.getUint16 = makeGetter(exports.Uint16Array);
  DataView.prototype.getInt16 = makeGetter(exports.Int16Array);
  DataView.prototype.getUint32 = makeGetter(exports.Uint32Array);
  DataView.prototype.getInt32 = makeGetter(exports.Int32Array);
  DataView.prototype.getFloat32 = makeGetter(exports.Float32Array);
  DataView.prototype.getFloat64 = makeGetter(exports.Float64Array);

  function makeSetter(arrayType) {
    return function(byteOffset, value, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);
      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }

      // Get bytes
      var typeArray = new arrayType([value]),
          byteArray = new Uint8Array(typeArray.buffer),
          bytes = [], i, byteView;

      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(byteArray, i));
      }

      // Flip if necessary
      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      // Write them
      byteView = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT);
      byteView.set(bytes);
    };
  }

  DataView.prototype.setUint8 = makeSetter(exports.Uint8Array);
  DataView.prototype.setInt8 = makeSetter(exports.Int8Array);
  DataView.prototype.setUint16 = makeSetter(exports.Uint16Array);
  DataView.prototype.setInt16 = makeSetter(exports.Int16Array);
  DataView.prototype.setUint32 = makeSetter(exports.Uint32Array);
  DataView.prototype.setInt32 = makeSetter(exports.Int32Array);
  DataView.prototype.setFloat32 = makeSetter(exports.Float32Array);
  DataView.prototype.setFloat64 = makeSetter(exports.Float64Array);

  exports.DataView = exports.DataView || DataView;

}());

},{}]},{},[])
;;module.exports=require("native-buffer-browserify").Buffer

},{}],64:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],65:[function(require,module,exports){
var Buffer=require("__browserify_Buffer");(function () {
  "use strict";

  function btoa(str) {
    var buffer
      ;

    if (str instanceof Buffer) {
      buffer = str;
    } else {
      buffer = new Buffer(str.toString(), 'binary');
    }

    return buffer.toString('base64');
  }

  module.exports = btoa;
}());

},{"__browserify_Buffer":63}],66:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var BlockCipher = C_lib.BlockCipher;
	    var C_algo = C.algo;

	    // Lookup tables
	    var SBOX = [];
	    var INV_SBOX = [];
	    var SUB_MIX_0 = [];
	    var SUB_MIX_1 = [];
	    var SUB_MIX_2 = [];
	    var SUB_MIX_3 = [];
	    var INV_SUB_MIX_0 = [];
	    var INV_SUB_MIX_1 = [];
	    var INV_SUB_MIX_2 = [];
	    var INV_SUB_MIX_3 = [];

	    // Compute lookup tables
	    (function () {
	        // Compute double table
	        var d = [];
	        for (var i = 0; i < 256; i++) {
	            if (i < 128) {
	                d[i] = i << 1;
	            } else {
	                d[i] = (i << 1) ^ 0x11b;
	            }
	        }

	        // Walk GF(2^8)
	        var x = 0;
	        var xi = 0;
	        for (var i = 0; i < 256; i++) {
	            // Compute sbox
	            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
	            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
	            SBOX[x] = sx;
	            INV_SBOX[sx] = x;

	            // Compute multiplication
	            var x2 = d[x];
	            var x4 = d[x2];
	            var x8 = d[x4];

	            // Compute sub bytes, mix columns tables
	            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
	            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
	            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
	            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
	            SUB_MIX_3[x] = t;

	            // Compute inv sub bytes, inv mix columns tables
	            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
	            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
	            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
	            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
	            INV_SUB_MIX_3[sx] = t;

	            // Compute next counter
	            if (!x) {
	                x = xi = 1;
	            } else {
	                x = x2 ^ d[d[d[x8 ^ x2]]];
	                xi ^= d[d[xi]];
	            }
	        }
	    }());

	    // Precomputed Rcon lookup
	    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

	    /**
	     * AES block cipher algorithm.
	     */
	    var AES = C_algo.AES = BlockCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var key = this._key;
	            var keyWords = key.words;
	            var keySize = key.sigBytes / 4;

	            // Compute number of rounds
	            var nRounds = this._nRounds = keySize + 6

	            // Compute number of key schedule rows
	            var ksRows = (nRounds + 1) * 4;

	            // Compute key schedule
	            var keySchedule = this._keySchedule = [];
	            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
	                if (ksRow < keySize) {
	                    keySchedule[ksRow] = keyWords[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 1];

	                    if (!(ksRow % keySize)) {
	                        // Rot word
	                        t = (t << 8) | (t >>> 24);

	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

	                        // Mix Rcon
	                        t ^= RCON[(ksRow / keySize) | 0] << 24;
	                    } else if (keySize > 6 && ksRow % keySize == 4) {
	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
	                    }

	                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
	                }
	            }

	            // Compute inv key schedule
	            var invKeySchedule = this._invKeySchedule = [];
	            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
	                var ksRow = ksRows - invKsRow;

	                if (invKsRow % 4) {
	                    var t = keySchedule[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 4];
	                }

	                if (invKsRow < 4 || ksRow <= 4) {
	                    invKeySchedule[invKsRow] = t;
	                } else {
	                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
	                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
	                }
	            }
	        },

	        encryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
	        },

	        decryptBlock: function (M, offset) {
	            // Swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;

	            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

	            // Inv swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;
	        },

	        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
	            // Shortcut
	            var nRounds = this._nRounds;

	            // Get input, add round key
	            var s0 = M[offset]     ^ keySchedule[0];
	            var s1 = M[offset + 1] ^ keySchedule[1];
	            var s2 = M[offset + 2] ^ keySchedule[2];
	            var s3 = M[offset + 3] ^ keySchedule[3];

	            // Key schedule row counter
	            var ksRow = 4;

	            // Rounds
	            for (var round = 1; round < nRounds; round++) {
	                // Shift rows, sub bytes, mix columns, add round key
	                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
	                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
	                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
	                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

	                // Update state
	                s0 = t0;
	                s1 = t1;
	                s2 = t2;
	                s3 = t3;
	            }

	            // Shift rows, sub bytes, add round key
	            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
	            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
	            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
	            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

	            // Set output
	            M[offset]     = t0;
	            M[offset + 1] = t1;
	            M[offset + 2] = t2;
	            M[offset + 3] = t3;
	        },

	        keySize: 256/32
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
	     */
	    C.AES = BlockCipher._createHelper(AES);
	}());


	return CryptoJS.AES;

}));
},{"./cipher-core":67,"./core":68,"./enc-base64":69,"./evpkdf":71,"./md5":73}],67:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Cipher core components.
	 */
	CryptoJS.lib.Cipher || (function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var Base64 = C_enc.Base64;
	    var C_algo = C.algo;
	    var EvpKDF = C_algo.EvpKDF;

	    /**
	     * Abstract base cipher template.
	     *
	     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
	     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
	     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
	     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
	     */
	    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {WordArray} iv The IV to use for this operation.
	         */
	        cfg: Base.extend(),

	        /**
	         * Creates this cipher in encryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createEncryptor: function (key, cfg) {
	            return this.create(this._ENC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Creates this cipher in decryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createDecryptor: function (key, cfg) {
	            return this.create(this._DEC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Initializes a newly created cipher.
	         *
	         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
	         */
	        init: function (xformMode, key, cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Store transform mode and key
	            this._xformMode = xformMode;
	            this._key = key;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this cipher to its initial state.
	         *
	         * @example
	         *
	         *     cipher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-cipher logic
	            this._doReset();
	        },

	        /**
	         * Adds data to be encrypted or decrypted.
	         *
	         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.process('data');
	         *     var encrypted = cipher.process(wordArray);
	         */
	        process: function (dataUpdate) {
	            // Append
	            this._append(dataUpdate);

	            // Process available blocks
	            return this._process();
	        },

	        /**
	         * Finalizes the encryption or decryption process.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after final processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.finalize();
	         *     var encrypted = cipher.finalize('data');
	         *     var encrypted = cipher.finalize(wordArray);
	         */
	        finalize: function (dataUpdate) {
	            // Final data update
	            if (dataUpdate) {
	                this._append(dataUpdate);
	            }

	            // Perform concrete-cipher logic
	            var finalProcessedData = this._doFinalize();

	            return finalProcessedData;
	        },

	        keySize: 128/32,

	        ivSize: 128/32,

	        _ENC_XFORM_MODE: 1,

	        _DEC_XFORM_MODE: 2,

	        /**
	         * Creates shortcut functions to a cipher's object interface.
	         *
	         * @param {Cipher} cipher The cipher to create a helper for.
	         *
	         * @return {Object} An object with encrypt and decrypt shortcut functions.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
	         */
	        _createHelper: (function () {
	            function selectCipherStrategy(key) {
	                if (typeof key == 'string') {
	                    return PasswordBasedCipher;
	                } else {
	                    return SerializableCipher;
	                }
	            }

	            return function (cipher) {
	                return {
	                    encrypt: function (message, key, cfg) {
	                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
	                    },

	                    decrypt: function (ciphertext, key, cfg) {
	                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
	                    }
	                };
	            };
	        }())
	    });

	    /**
	     * Abstract base stream cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
	     */
	    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
	        _doFinalize: function () {
	            // Process partial blocks
	            var finalProcessedBlocks = this._process(!!'flush');

	            return finalProcessedBlocks;
	        },

	        blockSize: 1
	    });

	    /**
	     * Mode namespace.
	     */
	    var C_mode = C.mode = {};

	    /**
	     * Abstract base block cipher mode template.
	     */
	    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
	        /**
	         * Creates this mode for encryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
	         */
	        createEncryptor: function (cipher, iv) {
	            return this.Encryptor.create(cipher, iv);
	        },

	        /**
	         * Creates this mode for decryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
	         */
	        createDecryptor: function (cipher, iv) {
	            return this.Decryptor.create(cipher, iv);
	        },

	        /**
	         * Initializes a newly created mode.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
	         */
	        init: function (cipher, iv) {
	            this._cipher = cipher;
	            this._iv = iv;
	        }
	    });

	    /**
	     * Cipher Block Chaining mode.
	     */
	    var CBC = C_mode.CBC = (function () {
	        /**
	         * Abstract base CBC mode.
	         */
	        var CBC = BlockCipherMode.extend();

	        /**
	         * CBC encryptor.
	         */
	        CBC.Encryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // XOR and encrypt
	                xorBlock.call(this, words, offset, blockSize);
	                cipher.encryptBlock(words, offset);

	                // Remember this block to use with next block
	                this._prevBlock = words.slice(offset, offset + blockSize);
	            }
	        });

	        /**
	         * CBC decryptor.
	         */
	        CBC.Decryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // Remember this block to use with next block
	                var thisBlock = words.slice(offset, offset + blockSize);

	                // Decrypt and XOR
	                cipher.decryptBlock(words, offset);
	                xorBlock.call(this, words, offset, blockSize);

	                // This block becomes the previous block
	                this._prevBlock = thisBlock;
	            }
	        });

	        function xorBlock(words, offset, blockSize) {
	            // Shortcut
	            var iv = this._iv;

	            // Choose mixing block
	            if (iv) {
	                var block = iv;

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            } else {
	                var block = this._prevBlock;
	            }

	            // XOR blocks
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= block[i];
	            }
	        }

	        return CBC;
	    }());

	    /**
	     * Padding namespace.
	     */
	    var C_pad = C.pad = {};

	    /**
	     * PKCS #5/7 padding strategy.
	     */
	    var Pkcs7 = C_pad.Pkcs7 = {
	        /**
	         * Pads data using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to pad.
	         * @param {number} blockSize The multiple that the data should be padded to.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
	         */
	        pad: function (data, blockSize) {
	            // Shortcut
	            var blockSizeBytes = blockSize * 4;

	            // Count padding bytes
	            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

	            // Create padding word
	            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

	            // Create padding
	            var paddingWords = [];
	            for (var i = 0; i < nPaddingBytes; i += 4) {
	                paddingWords.push(paddingWord);
	            }
	            var padding = WordArray.create(paddingWords, nPaddingBytes);

	            // Add padding
	            data.concat(padding);
	        },

	        /**
	         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to unpad.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
	         */
	        unpad: function (data) {
	            // Get number of padding bytes from last byte
	            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	            // Remove padding
	            data.sigBytes -= nPaddingBytes;
	        }
	    };

	    /**
	     * Abstract base block cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
	     */
	    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Mode} mode The block mode to use. Default: CBC
	         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
	         */
	        cfg: Cipher.cfg.extend({
	            mode: CBC,
	            padding: Pkcs7
	        }),

	        reset: function () {
	            // Reset cipher
	            Cipher.reset.call(this);

	            // Shortcuts
	            var cfg = this.cfg;
	            var iv = cfg.iv;
	            var mode = cfg.mode;

	            // Reset block mode
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                var modeCreator = mode.createEncryptor;
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                var modeCreator = mode.createDecryptor;

	                // Keep at least one block in the buffer for unpadding
	                this._minBufferSize = 1;
	            }
	            this._mode = modeCreator.call(mode, this, iv && iv.words);
	        },

	        _doProcessBlock: function (words, offset) {
	            this._mode.processBlock(words, offset);
	        },

	        _doFinalize: function () {
	            // Shortcut
	            var padding = this.cfg.padding;

	            // Finalize
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                // Pad data
	                padding.pad(this._data, this.blockSize);

	                // Process final blocks
	                var finalProcessedBlocks = this._process(!!'flush');
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                // Process final blocks
	                var finalProcessedBlocks = this._process(!!'flush');

	                // Unpad data
	                padding.unpad(finalProcessedBlocks);
	            }

	            return finalProcessedBlocks;
	        },

	        blockSize: 128/32
	    });

	    /**
	     * A collection of cipher parameters.
	     *
	     * @property {WordArray} ciphertext The raw ciphertext.
	     * @property {WordArray} key The key to this ciphertext.
	     * @property {WordArray} iv The IV used in the ciphering operation.
	     * @property {WordArray} salt The salt used with a key derivation function.
	     * @property {Cipher} algorithm The cipher algorithm.
	     * @property {Mode} mode The block mode used in the ciphering operation.
	     * @property {Padding} padding The padding scheme used in the ciphering operation.
	     * @property {number} blockSize The block size of the cipher.
	     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
	     */
	    var CipherParams = C_lib.CipherParams = Base.extend({
	        /**
	         * Initializes a newly created cipher params object.
	         *
	         * @param {Object} cipherParams An object with any of the possible cipher parameters.
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.lib.CipherParams.create({
	         *         ciphertext: ciphertextWordArray,
	         *         key: keyWordArray,
	         *         iv: ivWordArray,
	         *         salt: saltWordArray,
	         *         algorithm: CryptoJS.algo.AES,
	         *         mode: CryptoJS.mode.CBC,
	         *         padding: CryptoJS.pad.PKCS7,
	         *         blockSize: 4,
	         *         formatter: CryptoJS.format.OpenSSL
	         *     });
	         */
	        init: function (cipherParams) {
	            this.mixIn(cipherParams);
	        },

	        /**
	         * Converts this cipher params object to a string.
	         *
	         * @param {Format} formatter (Optional) The formatting strategy to use.
	         *
	         * @return {string} The stringified cipher params.
	         *
	         * @throws Error If neither the formatter nor the default formatter is set.
	         *
	         * @example
	         *
	         *     var string = cipherParams + '';
	         *     var string = cipherParams.toString();
	         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
	         */
	        toString: function (formatter) {
	            return (formatter || this.formatter).stringify(this);
	        }
	    });

	    /**
	     * Format namespace.
	     */
	    var C_format = C.format = {};

	    /**
	     * OpenSSL formatting strategy.
	     */
	    var OpenSSLFormatter = C_format.OpenSSL = {
	        /**
	         * Converts a cipher params object to an OpenSSL-compatible string.
	         *
	         * @param {CipherParams} cipherParams The cipher params object.
	         *
	         * @return {string} The OpenSSL-compatible string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
	         */
	        stringify: function (cipherParams) {
	            // Shortcuts
	            var ciphertext = cipherParams.ciphertext;
	            var salt = cipherParams.salt;

	            // Format
	            if (salt) {
	                var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
	            } else {
	                var wordArray = ciphertext;
	            }

	            return wordArray.toString(Base64);
	        },

	        /**
	         * Converts an OpenSSL-compatible string to a cipher params object.
	         *
	         * @param {string} openSSLStr The OpenSSL-compatible string.
	         *
	         * @return {CipherParams} The cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
	         */
	        parse: function (openSSLStr) {
	            // Parse base64
	            var ciphertext = Base64.parse(openSSLStr);

	            // Shortcut
	            var ciphertextWords = ciphertext.words;

	            // Test for salt
	            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
	                // Extract salt
	                var salt = WordArray.create(ciphertextWords.slice(2, 4));

	                // Remove salt from ciphertext
	                ciphertextWords.splice(0, 4);
	                ciphertext.sigBytes -= 16;
	            }

	            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
	        }
	    };

	    /**
	     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
	     */
	    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
	         */
	        cfg: Base.extend({
	            format: OpenSSLFormatter
	        }),

	        /**
	         * Encrypts a message.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Encrypt
	            var encryptor = cipher.createEncryptor(key, cfg);
	            var ciphertext = encryptor.finalize(message);

	            // Shortcut
	            var cipherCfg = encryptor.cfg;

	            // Create and return serializable cipher params
	            return CipherParams.create({
	                ciphertext: ciphertext,
	                key: key,
	                iv: cipherCfg.iv,
	                algorithm: cipher,
	                mode: cipherCfg.mode,
	                padding: cipherCfg.padding,
	                blockSize: cipher.blockSize,
	                formatter: cfg.format
	            });
	        },

	        /**
	         * Decrypts serialized ciphertext.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Decrypt
	            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

	            return plaintext;
	        },

	        /**
	         * Converts serialized ciphertext to CipherParams,
	         * else assumed CipherParams already and returns ciphertext unchanged.
	         *
	         * @param {CipherParams|string} ciphertext The ciphertext.
	         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
	         *
	         * @return {CipherParams} The unserialized ciphertext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
	         */
	        _parse: function (ciphertext, format) {
	            if (typeof ciphertext == 'string') {
	                return format.parse(ciphertext, this);
	            } else {
	                return ciphertext;
	            }
	        }
	    });

	    /**
	     * Key derivation function namespace.
	     */
	    var C_kdf = C.kdf = {};

	    /**
	     * OpenSSL key derivation function.
	     */
	    var OpenSSLKdf = C_kdf.OpenSSL = {
	        /**
	         * Derives a key and IV from a password.
	         *
	         * @param {string} password The password to derive from.
	         * @param {number} keySize The size in words of the key to generate.
	         * @param {number} ivSize The size in words of the IV to generate.
	         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
	         *
	         * @return {CipherParams} A cipher params object with the key, IV, and salt.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
	         */
	        execute: function (password, keySize, ivSize, salt) {
	            // Generate random salt
	            if (!salt) {
	                salt = WordArray.random(64/8);
	            }

	            // Derive key and IV
	            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

	            // Separate key and IV
	            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
	            key.sigBytes = keySize * 4;

	            // Return params
	            return CipherParams.create({ key: key, iv: iv, salt: salt });
	        }
	    };

	    /**
	     * A serializable cipher wrapper that derives the key from a password,
	     * and returns ciphertext as a serializable cipher params object.
	     */
	    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
	         */
	        cfg: SerializableCipher.cfg.extend({
	            kdf: OpenSSLKdf
	        }),

	        /**
	         * Encrypts a message using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Encrypt
	            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

	            // Mix in derived params
	            ciphertext.mixIn(derivedParams);

	            return ciphertext;
	        },

	        /**
	         * Decrypts serialized ciphertext using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Decrypt
	            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

	            return plaintext;
	        }
	    });
	}());


}));
},{"./core":68}],68:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory();
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define([], factory);
	}
	else {
		// Global (browser)
		root.CryptoJS = factory();
	}
}(this, function () {

	/**
	 * CryptoJS core components.
	 */
	var CryptoJS = CryptoJS || (function (Math, undefined) {
	    /**
	     * CryptoJS namespace.
	     */
	    var C = {};

	    /**
	     * Library namespace.
	     */
	    var C_lib = C.lib = {};

	    /**
	     * Base object for prototypal inheritance.
	     */
	    var Base = C_lib.Base = (function () {
	        function F() {}

	        return {
	            /**
	             * Creates a new object that inherits from this object.
	             *
	             * @param {Object} overrides Properties to copy into the new object.
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         field: 'value',
	             *
	             *         method: function () {
	             *         }
	             *     });
	             */
	            extend: function (overrides) {
	                // Spawn
	                F.prototype = this;
	                var subtype = new F();

	                // Augment
	                if (overrides) {
	                    subtype.mixIn(overrides);
	                }

	                // Create default initializer
	                if (!subtype.hasOwnProperty('init')) {
	                    subtype.init = function () {
	                        subtype.$super.init.apply(this, arguments);
	                    };
	                }

	                // Initializer's prototype is the subtype object
	                subtype.init.prototype = subtype;

	                // Reference supertype
	                subtype.$super = this;

	                return subtype;
	            },

	            /**
	             * Extends this object and runs the init method.
	             * Arguments to create() will be passed to init().
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var instance = MyType.create();
	             */
	            create: function () {
	                var instance = this.extend();
	                instance.init.apply(instance, arguments);

	                return instance;
	            },

	            /**
	             * Initializes a newly created object.
	             * Override this method to add some logic when your objects are created.
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         init: function () {
	             *             // ...
	             *         }
	             *     });
	             */
	            init: function () {
	            },

	            /**
	             * Copies properties into this object.
	             *
	             * @param {Object} properties The properties to mix in.
	             *
	             * @example
	             *
	             *     MyType.mixIn({
	             *         field: 'value'
	             *     });
	             */
	            mixIn: function (properties) {
	                for (var propertyName in properties) {
	                    if (properties.hasOwnProperty(propertyName)) {
	                        this[propertyName] = properties[propertyName];
	                    }
	                }

	                // IE won't copy toString using the loop above
	                if (properties.hasOwnProperty('toString')) {
	                    this.toString = properties.toString;
	                }
	            },

	            /**
	             * Creates a copy of this object.
	             *
	             * @return {Object} The clone.
	             *
	             * @example
	             *
	             *     var clone = instance.clone();
	             */
	            clone: function () {
	                return this.init.prototype.extend(this);
	            }
	        };
	    }());

	    /**
	     * An array of 32-bit words.
	     *
	     * @property {Array} words The array of 32-bit words.
	     * @property {number} sigBytes The number of significant bytes in this word array.
	     */
	    var WordArray = C_lib.WordArray = Base.extend({
	        /**
	         * Initializes a newly created word array.
	         *
	         * @param {Array} words (Optional) An array of 32-bit words.
	         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.create();
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
	         */
	        init: function (words, sigBytes) {
	            words = this.words = words || [];

	            if (sigBytes != undefined) {
	                this.sigBytes = sigBytes;
	            } else {
	                this.sigBytes = words.length * 4;
	            }
	        },

	        /**
	         * Converts this word array to a string.
	         *
	         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
	         *
	         * @return {string} The stringified word array.
	         *
	         * @example
	         *
	         *     var string = wordArray + '';
	         *     var string = wordArray.toString();
	         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
	         */
	        toString: function (encoder) {
	            return (encoder || Hex).stringify(this);
	        },

	        /**
	         * Concatenates a word array to this word array.
	         *
	         * @param {WordArray} wordArray The word array to append.
	         *
	         * @return {WordArray} This word array.
	         *
	         * @example
	         *
	         *     wordArray1.concat(wordArray2);
	         */
	        concat: function (wordArray) {
	            // Shortcuts
	            var thisWords = this.words;
	            var thatWords = wordArray.words;
	            var thisSigBytes = this.sigBytes;
	            var thatSigBytes = wordArray.sigBytes;

	            // Clamp excess bits
	            this.clamp();

	            // Concat
	            if (thisSigBytes % 4) {
	                // Copy one byte at a time
	                for (var i = 0; i < thatSigBytes; i++) {
	                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
	                }
	            } else if (thatWords.length > 0xffff) {
	                // Copy one word at a time
	                for (var i = 0; i < thatSigBytes; i += 4) {
	                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
	                }
	            } else {
	                // Copy all words at once
	                thisWords.push.apply(thisWords, thatWords);
	            }
	            this.sigBytes += thatSigBytes;

	            // Chainable
	            return this;
	        },

	        /**
	         * Removes insignificant bits.
	         *
	         * @example
	         *
	         *     wordArray.clamp();
	         */
	        clamp: function () {
	            // Shortcuts
	            var words = this.words;
	            var sigBytes = this.sigBytes;

	            // Clamp
	            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
	            words.length = Math.ceil(sigBytes / 4);
	        },

	        /**
	         * Creates a copy of this word array.
	         *
	         * @return {WordArray} The clone.
	         *
	         * @example
	         *
	         *     var clone = wordArray.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone.words = this.words.slice(0);

	            return clone;
	        },

	        /**
	         * Creates a word array filled with random bytes.
	         *
	         * @param {number} nBytes The number of random bytes to generate.
	         *
	         * @return {WordArray} The random word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.random(16);
	         */
	        random: function (nBytes) {
	            var words = [];

	            var r = (function (m_w) {
	                var m_w = m_w;
	                var m_z = 0x3ade68b1;
	                var mask = 0xffffffff;

	                return function () {
	                    m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
	                    m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
	                    var result = ((m_z << 0x10) + m_w) & mask;
	                    result /= 0x100000000;
	                    result += 0.5;
	                    return result * (Math.random() > .5 ? 1 : -1);
	                }
	            });

	            for (var i = 0, rcache; i < nBytes; i += 4) {
	                var _r = r((rcache || Math.random()) * 0x100000000);

	                rcache = _r() * 0x3ade67b7;
	                words.push((_r() * 0x100000000) | 0);
	            }

	            return new WordArray.init(words, nBytes);
	        }
	    });

	    /**
	     * Encoder namespace.
	     */
	    var C_enc = C.enc = {};

	    /**
	     * Hex encoding strategy.
	     */
	    var Hex = C_enc.Hex = {
	        /**
	         * Converts a word array to a hex string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The hex string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var hexChars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                hexChars.push((bite >>> 4).toString(16));
	                hexChars.push((bite & 0x0f).toString(16));
	            }

	            return hexChars.join('');
	        },

	        /**
	         * Converts a hex string to a word array.
	         *
	         * @param {string} hexStr The hex string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
	         */
	        parse: function (hexStr) {
	            // Shortcut
	            var hexStrLength = hexStr.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < hexStrLength; i += 2) {
	                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
	            }

	            return new WordArray.init(words, hexStrLength / 2);
	        }
	    };

	    /**
	     * Latin1 encoding strategy.
	     */
	    var Latin1 = C_enc.Latin1 = {
	        /**
	         * Converts a word array to a Latin1 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Latin1 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var latin1Chars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                latin1Chars.push(String.fromCharCode(bite));
	            }

	            return latin1Chars.join('');
	        },

	        /**
	         * Converts a Latin1 string to a word array.
	         *
	         * @param {string} latin1Str The Latin1 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
	         */
	        parse: function (latin1Str) {
	            // Shortcut
	            var latin1StrLength = latin1Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < latin1StrLength; i++) {
	                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
	            }

	            return new WordArray.init(words, latin1StrLength);
	        }
	    };

	    /**
	     * UTF-8 encoding strategy.
	     */
	    var Utf8 = C_enc.Utf8 = {
	        /**
	         * Converts a word array to a UTF-8 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-8 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            try {
	                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
	            } catch (e) {
	                throw new Error('Malformed UTF-8 data');
	            }
	        },

	        /**
	         * Converts a UTF-8 string to a word array.
	         *
	         * @param {string} utf8Str The UTF-8 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
	         */
	        parse: function (utf8Str) {
	            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
	        }
	    };

	    /**
	     * Abstract buffered block algorithm template.
	     *
	     * The property blockSize must be implemented in a concrete subtype.
	     *
	     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
	     */
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
	        /**
	         * Resets this block algorithm's data buffer to its initial state.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm.reset();
	         */
	        reset: function () {
	            // Initial values
	            this._data = new WordArray.init();
	            this._nDataBytes = 0;
	        },

	        /**
	         * Adds new data to this block algorithm's buffer.
	         *
	         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm._append('data');
	         *     bufferedBlockAlgorithm._append(wordArray);
	         */
	        _append: function (data) {
	            // Convert string to WordArray, else assume WordArray already
	            if (typeof data == 'string') {
	                data = Utf8.parse(data);
	            }

	            // Append
	            this._data.concat(data);
	            this._nDataBytes += data.sigBytes;
	        },

	        /**
	         * Processes available data blocks.
	         *
	         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
	         *
	         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
	         *
	         * @return {WordArray} The processed data.
	         *
	         * @example
	         *
	         *     var processedData = bufferedBlockAlgorithm._process();
	         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
	         */
	        _process: function (doFlush) {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;
	            var dataSigBytes = data.sigBytes;
	            var blockSize = this.blockSize;
	            var blockSizeBytes = blockSize * 4;

	            // Count blocks ready
	            var nBlocksReady = dataSigBytes / blockSizeBytes;
	            if (doFlush) {
	                // Round up to include partial blocks
	                nBlocksReady = Math.ceil(nBlocksReady);
	            } else {
	                // Round down to include only full blocks,
	                // less the number of blocks that must remain in the buffer
	                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
	            }

	            // Count words ready
	            var nWordsReady = nBlocksReady * blockSize;

	            // Count bytes ready
	            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

	            // Process blocks
	            if (nWordsReady) {
	                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
	                    // Perform concrete-algorithm logic
	                    this._doProcessBlock(dataWords, offset);
	                }

	                // Remove processed words
	                var processedWords = dataWords.splice(0, nWordsReady);
	                data.sigBytes -= nBytesReady;
	            }

	            // Return processed words
	            return new WordArray.init(processedWords, nBytesReady);
	        },

	        /**
	         * Creates a copy of this object.
	         *
	         * @return {Object} The clone.
	         *
	         * @example
	         *
	         *     var clone = bufferedBlockAlgorithm.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone._data = this._data.clone();

	            return clone;
	        },

	        _minBufferSize: 0
	    });

	    /**
	     * Abstract hasher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
	     */
	    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         */
	        cfg: Base.extend(),

	        /**
	         * Initializes a newly created hasher.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
	         *
	         * @example
	         *
	         *     var hasher = CryptoJS.algo.SHA256.create();
	         */
	        init: function (cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this hasher to its initial state.
	         *
	         * @example
	         *
	         *     hasher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-hasher logic
	            this._doReset();
	        },

	        /**
	         * Updates this hasher with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {Hasher} This hasher.
	         *
	         * @example
	         *
	         *     hasher.update('message');
	         *     hasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            // Append
	            this._append(messageUpdate);

	            // Update the hash
	            this._process();

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the hash computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The hash.
	         *
	         * @example
	         *
	         *     var hash = hasher.finalize();
	         *     var hash = hasher.finalize('message');
	         *     var hash = hasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Final message update
	            if (messageUpdate) {
	                this._append(messageUpdate);
	            }

	            // Perform concrete-hasher logic
	            var hash = this._doFinalize();

	            return hash;
	        },

	        blockSize: 512/32,

	        /**
	         * Creates a shortcut function to a hasher's object interface.
	         *
	         * @param {Hasher} hasher The hasher to create a helper for.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
	         */
	        _createHelper: function (hasher) {
	            return function (message, cfg) {
	                return new hasher.init(cfg).finalize(message);
	            };
	        },

	        /**
	         * Creates a shortcut function to the HMAC's object interface.
	         *
	         * @param {Hasher} hasher The hasher to use in this HMAC helper.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
	         */
	        _createHmacHelper: function (hasher) {
	            return function (message, key) {
	                return new C_algo.HMAC.init(hasher, key).finalize(message);
	            };
	        }
	    });

	    /**
	     * Algorithm namespace.
	     */
	    var C_algo = C.algo = {};

	    return C;
	}(Math));


	return CryptoJS;

}));
},{}],69:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_enc = C.enc;

	    /**
	     * Base64 encoding strategy.
	     */
	    var Base64 = C_enc.Base64 = {
	        /**
	         * Converts a word array to a Base64 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Base64 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;
	            var map = this._map;

	            // Clamp excess bits
	            wordArray.clamp();

	            // Convert
	            var base64Chars = [];
	            for (var i = 0; i < sigBytes; i += 3) {
	                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
	                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
	                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

	                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

	                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
	                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
	                }
	            }

	            // Add padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                while (base64Chars.length % 4) {
	                    base64Chars.push(paddingChar);
	                }
	            }

	            return base64Chars.join('');
	        },

	        /**
	         * Converts a Base64 string to a word array.
	         *
	         * @param {string} base64Str The Base64 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
	         */
	        parse: function (base64Str) {
	            // Shortcuts
	            var base64StrLength = base64Str.length;
	            var map = this._map;

	            // Ignore padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                var paddingIndex = base64Str.indexOf(paddingChar);
	                if (paddingIndex != -1) {
	                    base64StrLength = paddingIndex;
	                }
	            }

	            // Convert
	            var words = [];
	            var nBytes = 0;
	            for (var i = 0; i < base64StrLength; i++) {
	                if (i % 4) {
	                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
	                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
	                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
	                    nBytes++;
	                }
	            }

	            return WordArray.create(words, nBytes);
	        },

	        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
	    };
	}());


	return CryptoJS.enc.Base64;

}));
},{"./core":68}],70:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.enc.Utf8;

}));
},{"./core":68}],71:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./sha1"), require("./hmac"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./sha1", "./hmac"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var C_algo = C.algo;
	    var MD5 = C_algo.MD5;

	    /**
	     * This key derivation function is meant to conform with EVP_BytesToKey.
	     * www.openssl.org/docs/crypto/EVP_BytesToKey.html
	     */
	    var EvpKDF = C_algo.EvpKDF = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
	         * @property {Hasher} hasher The hash algorithm to use. Default: MD5
	         * @property {number} iterations The number of iterations to perform. Default: 1
	         */
	        cfg: Base.extend({
	            keySize: 128/32,
	            hasher: MD5,
	            iterations: 1
	        }),

	        /**
	         * Initializes a newly created key derivation function.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
	         *
	         * @example
	         *
	         *     var kdf = CryptoJS.algo.EvpKDF.create();
	         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
	         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
	         */
	        init: function (cfg) {
	            this.cfg = this.cfg.extend(cfg);
	        },

	        /**
	         * Derives a key from a password.
	         *
	         * @param {WordArray|string} password The password.
	         * @param {WordArray|string} salt A salt.
	         *
	         * @return {WordArray} The derived key.
	         *
	         * @example
	         *
	         *     var key = kdf.compute(password, salt);
	         */
	        compute: function (password, salt) {
	            // Shortcut
	            var cfg = this.cfg;

	            // Init hasher
	            var hasher = cfg.hasher.create();

	            // Initial values
	            var derivedKey = WordArray.create();

	            // Shortcuts
	            var derivedKeyWords = derivedKey.words;
	            var keySize = cfg.keySize;
	            var iterations = cfg.iterations;

	            // Generate key
	            while (derivedKeyWords.length < keySize) {
	                if (block) {
	                    hasher.update(block);
	                }
	                var block = hasher.update(password).finalize(salt);
	                hasher.reset();

	                // Iterations
	                for (var i = 1; i < iterations; i++) {
	                    block = hasher.finalize(block);
	                    hasher.reset();
	                }

	                derivedKey.concat(block);
	            }
	            derivedKey.sigBytes = keySize * 4;

	            return derivedKey;
	        }
	    });

	    /**
	     * Derives a key from a password.
	     *
	     * @param {WordArray|string} password The password.
	     * @param {WordArray|string} salt A salt.
	     * @param {Object} cfg (Optional) The configuration options to use for this computation.
	     *
	     * @return {WordArray} The derived key.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var key = CryptoJS.EvpKDF(password, salt);
	     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
	     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
	     */
	    C.EvpKDF = function (password, salt, cfg) {
	        return EvpKDF.create(cfg).compute(password, salt);
	    };
	}());


	return CryptoJS.EvpKDF;

}));
},{"./core":68,"./hmac":72,"./sha1":74}],72:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var C_algo = C.algo;

	    /**
	     * HMAC algorithm.
	     */
	    var HMAC = C_algo.HMAC = Base.extend({
	        /**
	         * Initializes a newly created HMAC.
	         *
	         * @param {Hasher} hasher The hash algorithm to use.
	         * @param {WordArray|string} key The secret key.
	         *
	         * @example
	         *
	         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
	         */
	        init: function (hasher, key) {
	            // Init hasher
	            hasher = this._hasher = new hasher.init();

	            // Convert string to WordArray, else assume WordArray already
	            if (typeof key == 'string') {
	                key = Utf8.parse(key);
	            }

	            // Shortcuts
	            var hasherBlockSize = hasher.blockSize;
	            var hasherBlockSizeBytes = hasherBlockSize * 4;

	            // Allow arbitrary length keys
	            if (key.sigBytes > hasherBlockSizeBytes) {
	                key = hasher.finalize(key);
	            }

	            // Clamp excess bits
	            key.clamp();

	            // Clone key for inner and outer pads
	            var oKey = this._oKey = key.clone();
	            var iKey = this._iKey = key.clone();

	            // Shortcuts
	            var oKeyWords = oKey.words;
	            var iKeyWords = iKey.words;

	            // XOR keys with pad constants
	            for (var i = 0; i < hasherBlockSize; i++) {
	                oKeyWords[i] ^= 0x5c5c5c5c;
	                iKeyWords[i] ^= 0x36363636;
	            }
	            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this HMAC to its initial state.
	         *
	         * @example
	         *
	         *     hmacHasher.reset();
	         */
	        reset: function () {
	            // Shortcut
	            var hasher = this._hasher;

	            // Reset
	            hasher.reset();
	            hasher.update(this._iKey);
	        },

	        /**
	         * Updates this HMAC with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {HMAC} This HMAC instance.
	         *
	         * @example
	         *
	         *     hmacHasher.update('message');
	         *     hmacHasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            this._hasher.update(messageUpdate);

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the HMAC computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The HMAC.
	         *
	         * @example
	         *
	         *     var hmac = hmacHasher.finalize();
	         *     var hmac = hmacHasher.finalize('message');
	         *     var hmac = hmacHasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Shortcut
	            var hasher = this._hasher;

	            // Compute HMAC
	            var innerHash = hasher.finalize(messageUpdate);
	            hasher.reset();
	            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

	            return hmac;
	        }
	    });
	}());


}));
},{"./core":68}],73:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (Math) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Constants table
	    var T = [];

	    // Compute constants
	    (function () {
	        for (var i = 0; i < 64; i++) {
	            T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
	        }
	    }());

	    /**
	     * MD5 hash algorithm.
	     */
	    var MD5 = C_algo.MD5 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init([
	                0x67452301, 0xefcdab89,
	                0x98badcfe, 0x10325476
	            ]);
	        },

	        _doProcessBlock: function (M, offset) {
	            // Swap endian
	            for (var i = 0; i < 16; i++) {
	                // Shortcuts
	                var offset_i = offset + i;
	                var M_offset_i = M[offset_i];

	                M[offset_i] = (
	                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
	                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
	                );
	            }

	            // Shortcuts
	            var H = this._hash.words;

	            var M_offset_0  = M[offset + 0];
	            var M_offset_1  = M[offset + 1];
	            var M_offset_2  = M[offset + 2];
	            var M_offset_3  = M[offset + 3];
	            var M_offset_4  = M[offset + 4];
	            var M_offset_5  = M[offset + 5];
	            var M_offset_6  = M[offset + 6];
	            var M_offset_7  = M[offset + 7];
	            var M_offset_8  = M[offset + 8];
	            var M_offset_9  = M[offset + 9];
	            var M_offset_10 = M[offset + 10];
	            var M_offset_11 = M[offset + 11];
	            var M_offset_12 = M[offset + 12];
	            var M_offset_13 = M[offset + 13];
	            var M_offset_14 = M[offset + 14];
	            var M_offset_15 = M[offset + 15];

	            // Working varialbes
	            var a = H[0];
	            var b = H[1];
	            var c = H[2];
	            var d = H[3];

	            // Computation
	            a = FF(a, b, c, d, M_offset_0,  7,  T[0]);
	            d = FF(d, a, b, c, M_offset_1,  12, T[1]);
	            c = FF(c, d, a, b, M_offset_2,  17, T[2]);
	            b = FF(b, c, d, a, M_offset_3,  22, T[3]);
	            a = FF(a, b, c, d, M_offset_4,  7,  T[4]);
	            d = FF(d, a, b, c, M_offset_5,  12, T[5]);
	            c = FF(c, d, a, b, M_offset_6,  17, T[6]);
	            b = FF(b, c, d, a, M_offset_7,  22, T[7]);
	            a = FF(a, b, c, d, M_offset_8,  7,  T[8]);
	            d = FF(d, a, b, c, M_offset_9,  12, T[9]);
	            c = FF(c, d, a, b, M_offset_10, 17, T[10]);
	            b = FF(b, c, d, a, M_offset_11, 22, T[11]);
	            a = FF(a, b, c, d, M_offset_12, 7,  T[12]);
	            d = FF(d, a, b, c, M_offset_13, 12, T[13]);
	            c = FF(c, d, a, b, M_offset_14, 17, T[14]);
	            b = FF(b, c, d, a, M_offset_15, 22, T[15]);

	            a = GG(a, b, c, d, M_offset_1,  5,  T[16]);
	            d = GG(d, a, b, c, M_offset_6,  9,  T[17]);
	            c = GG(c, d, a, b, M_offset_11, 14, T[18]);
	            b = GG(b, c, d, a, M_offset_0,  20, T[19]);
	            a = GG(a, b, c, d, M_offset_5,  5,  T[20]);
	            d = GG(d, a, b, c, M_offset_10, 9,  T[21]);
	            c = GG(c, d, a, b, M_offset_15, 14, T[22]);
	            b = GG(b, c, d, a, M_offset_4,  20, T[23]);
	            a = GG(a, b, c, d, M_offset_9,  5,  T[24]);
	            d = GG(d, a, b, c, M_offset_14, 9,  T[25]);
	            c = GG(c, d, a, b, M_offset_3,  14, T[26]);
	            b = GG(b, c, d, a, M_offset_8,  20, T[27]);
	            a = GG(a, b, c, d, M_offset_13, 5,  T[28]);
	            d = GG(d, a, b, c, M_offset_2,  9,  T[29]);
	            c = GG(c, d, a, b, M_offset_7,  14, T[30]);
	            b = GG(b, c, d, a, M_offset_12, 20, T[31]);

	            a = HH(a, b, c, d, M_offset_5,  4,  T[32]);
	            d = HH(d, a, b, c, M_offset_8,  11, T[33]);
	            c = HH(c, d, a, b, M_offset_11, 16, T[34]);
	            b = HH(b, c, d, a, M_offset_14, 23, T[35]);
	            a = HH(a, b, c, d, M_offset_1,  4,  T[36]);
	            d = HH(d, a, b, c, M_offset_4,  11, T[37]);
	            c = HH(c, d, a, b, M_offset_7,  16, T[38]);
	            b = HH(b, c, d, a, M_offset_10, 23, T[39]);
	            a = HH(a, b, c, d, M_offset_13, 4,  T[40]);
	            d = HH(d, a, b, c, M_offset_0,  11, T[41]);
	            c = HH(c, d, a, b, M_offset_3,  16, T[42]);
	            b = HH(b, c, d, a, M_offset_6,  23, T[43]);
	            a = HH(a, b, c, d, M_offset_9,  4,  T[44]);
	            d = HH(d, a, b, c, M_offset_12, 11, T[45]);
	            c = HH(c, d, a, b, M_offset_15, 16, T[46]);
	            b = HH(b, c, d, a, M_offset_2,  23, T[47]);

	            a = II(a, b, c, d, M_offset_0,  6,  T[48]);
	            d = II(d, a, b, c, M_offset_7,  10, T[49]);
	            c = II(c, d, a, b, M_offset_14, 15, T[50]);
	            b = II(b, c, d, a, M_offset_5,  21, T[51]);
	            a = II(a, b, c, d, M_offset_12, 6,  T[52]);
	            d = II(d, a, b, c, M_offset_3,  10, T[53]);
	            c = II(c, d, a, b, M_offset_10, 15, T[54]);
	            b = II(b, c, d, a, M_offset_1,  21, T[55]);
	            a = II(a, b, c, d, M_offset_8,  6,  T[56]);
	            d = II(d, a, b, c, M_offset_15, 10, T[57]);
	            c = II(c, d, a, b, M_offset_6,  15, T[58]);
	            b = II(b, c, d, a, M_offset_13, 21, T[59]);
	            a = II(a, b, c, d, M_offset_4,  6,  T[60]);
	            d = II(d, a, b, c, M_offset_11, 10, T[61]);
	            c = II(c, d, a, b, M_offset_2,  15, T[62]);
	            b = II(b, c, d, a, M_offset_9,  21, T[63]);

	            // Intermediate hash value
	            H[0] = (H[0] + a) | 0;
	            H[1] = (H[1] + b) | 0;
	            H[2] = (H[2] + c) | 0;
	            H[3] = (H[3] + d) | 0;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);

	            var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
	            var nBitsTotalL = nBitsTotal;
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = (
	                (((nBitsTotalH << 8)  | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
	                (((nBitsTotalH << 24) | (nBitsTotalH >>> 8))  & 0xff00ff00)
	            );
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
	                (((nBitsTotalL << 8)  | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
	                (((nBitsTotalL << 24) | (nBitsTotalL >>> 8))  & 0xff00ff00)
	            );

	            data.sigBytes = (dataWords.length + 1) * 4;

	            // Hash final blocks
	            this._process();

	            // Shortcuts
	            var hash = this._hash;
	            var H = hash.words;

	            // Swap endian
	            for (var i = 0; i < 4; i++) {
	                // Shortcut
	                var H_i = H[i];

	                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
	                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
	            }

	            // Return final computed hash
	            return hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });

	    function FF(a, b, c, d, x, s, t) {
	        var n = a + ((b & c) | (~b & d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function GG(a, b, c, d, x, s, t) {
	        var n = a + ((b & d) | (c & ~d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function HH(a, b, c, d, x, s, t) {
	        var n = a + (b ^ c ^ d) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function II(a, b, c, d, x, s, t) {
	        var n = a + (c ^ (b | ~d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.MD5('message');
	     *     var hash = CryptoJS.MD5(wordArray);
	     */
	    C.MD5 = Hasher._createHelper(MD5);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacMD5(message, key);
	     */
	    C.HmacMD5 = Hasher._createHmacHelper(MD5);
	}(Math));


	return CryptoJS.MD5;

}));
},{"./core":68}],74:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Reusable object
	    var W = [];

	    /**
	     * SHA-1 hash algorithm.
	     */
	    var SHA1 = C_algo.SHA1 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init([
	                0x67452301, 0xefcdab89,
	                0x98badcfe, 0x10325476,
	                0xc3d2e1f0
	            ]);
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcut
	            var H = this._hash.words;

	            // Working variables
	            var a = H[0];
	            var b = H[1];
	            var c = H[2];
	            var d = H[3];
	            var e = H[4];

	            // Computation
	            for (var i = 0; i < 80; i++) {
	                if (i < 16) {
	                    W[i] = M[offset + i] | 0;
	                } else {
	                    var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
	                    W[i] = (n << 1) | (n >>> 31);
	                }

	                var t = ((a << 5) | (a >>> 27)) + e + W[i];
	                if (i < 20) {
	                    t += ((b & c) | (~b & d)) + 0x5a827999;
	                } else if (i < 40) {
	                    t += (b ^ c ^ d) + 0x6ed9eba1;
	                } else if (i < 60) {
	                    t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
	                } else /* if (i < 80) */ {
	                    t += (b ^ c ^ d) - 0x359d3e2a;
	                }

	                e = d;
	                d = c;
	                c = (b << 30) | (b >>> 2);
	                b = a;
	                a = t;
	            }

	            // Intermediate hash value
	            H[0] = (H[0] + a) | 0;
	            H[1] = (H[1] + b) | 0;
	            H[2] = (H[2] + c) | 0;
	            H[3] = (H[3] + d) | 0;
	            H[4] = (H[4] + e) | 0;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
	            data.sigBytes = dataWords.length * 4;

	            // Hash final blocks
	            this._process();

	            // Return final computed hash
	            return this._hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA1('message');
	     *     var hash = CryptoJS.SHA1(wordArray);
	     */
	    C.SHA1 = Hasher._createHelper(SHA1);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA1(message, key);
	     */
	    C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
	}());


	return CryptoJS.SHA1;

}));
},{"./core":68}],75:[function(require,module,exports){
// Diacritics.js
// 
// Started as something to be an equivalent of the Google Java Library diacritics library for JavaScript.
// Found this: http://jsperf.com/diacritics/6 and converted it into a reusable module.
// 
// @author Nijiko Yonskai
// @license MIT
// @copyright Nijikokun 2013 <nijikokun@gmail.com>
(function (name, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else this[name] = definition()
})('Diacritics', function () {
  // Create public object
  var output = {
    map: {}
  };

  // Create private reference map.
  var reference = [
    {'base':' ',    'letters':'\u00A0'},
    {'base':'A',    'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'},
    {'base':'AA',   'letters':'\uA732'},
    {'base':'AE',   'letters':'\u00C6\u01FC\u01E2'},
    {'base':'AO',   'letters':'\uA734'},
    {'base':'AU',   'letters':'\uA736'},
    {'base':'AV',   'letters':'\uA738\uA73A'},
    {'base':'AY',   'letters':'\uA73C'},
    {'base':'B',    'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
    {'base':'C',    'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
    {'base':'D',    'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779'},
    {'base':'DZ',   'letters':'\u01F1\u01C4'},
    {'base':'Dz',   'letters':'\u01F2\u01C5'},
    {'base':'E',    'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
    {'base':'F',    'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
    {'base':'G',    'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
    {'base':'H',    'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
    {'base':'I',    'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
    {'base':'J',    'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
    {'base':'K',    'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
    {'base':'L',    'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
    {'base':'LJ',   'letters':'\u01C7'},
    {'base':'Lj',   'letters':'\u01C8'},
    {'base':'M',    'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
    {'base':'N',    'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
    {'base':'NJ',   'letters':'\u01CA'},
    {'base':'Nj',   'letters':'\u01CB'},
    {'base':'O',    'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'},
    {'base':'OI',   'letters':'\u01A2'},
    {'base':'OO',   'letters':'\uA74E'},
    {'base':'OU',   'letters':'\u0222'},
    {'base':'P',    'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
    {'base':'Q',    'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
    {'base':'R',    'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
    {'base':'S',    'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
    {'base':'T',    'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
    {'base':'Th',   'letters':'\u00DE'},
    {'base':'TZ',   'letters':'\uA728'},
    {'base':'U',    'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
    {'base':'V',    'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
    {'base':'VY',   'letters':'\uA760'},
    {'base':'W',    'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
    {'base':'X',    'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
    {'base':'Y',    'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
    {'base':'Z',    'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
    {'base':'a',    'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250\u0251'},
    {'base':'aa',   'letters':'\uA733'},
    {'base':'ae',   'letters':'\u00E6\u01FD\u01E3'},
    {'base':'ao',   'letters':'\uA735'},
    {'base':'au',   'letters':'\uA737'},
    {'base':'av',   'letters':'\uA739\uA73B'},
    {'base':'ay',   'letters':'\uA73D'},
    {'base':'b',    'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
    {'base':'c',    'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
    {'base':'d',    'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
    {'base':'dz',   'letters':'\u01F3\u01C6'},
    {'base':'e',    'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
    {'base':'f',    'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
    {'base':'ff',   'letters':'\uFB00'},
    {'base':'fi',   'letters':'\uFB01'},
    {'base':'fl',   'letters':'\uFB02'},
    {'base':'ffi',  'letters':'\uFB03'},
    {'base':'ffl',  'letters':'\uFB04'},
    {'base':'g',    'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
    {'base':'h',    'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
    {'base':'hv',   'letters':'\u0195'},
    {'base':'i',    'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
    {'base':'j',    'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
    {'base':'k',    'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
    {'base':'l',    'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
    {'base':'lj',   'letters':'\u01C9'},
    {'base':'m',    'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
    {'base':'n',    'letters':'\x6E\xF1\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5\u043B\u0509'},
    {'base':'nj',   'letters':'\u01CC'},
    {'base':'o',    'letters':'\u07C0\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'},
    {'base':'oe',   'letters':'\u0152\u0153'},
    {'base':'oi',   'letters':'\u01A3'},
    {'base':'ou',   'letters':'\u0223'},
    {'base':'oo',   'letters':'\uA74F'},
    {'base':'p',    'letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
    {'base':'q',    'letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
    {'base':'r',    'letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
    {'base':'s',    'letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
    {'base':'ss',   'letters':'\xDF'},
    {'base':'t',    'letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
    {'base':'th',   'letters':'\u00FE'},
    {'base':'tz',   'letters':'\uA729'},
    {'base':'u',    'letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
    {'base':'v',    'letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
    {'base':'vy',   'letters':'\uA761'},
    {'base':'w',    'letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
    {'base':'x',    'letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
    {'base':'y',    'letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
    {'base':'z',    'letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
  ];

  // Generate reference mapping
  for (var i = 0, refLength = reference.length; i < refLength; i++){
    var letters = reference[i].letters.split("");

    for (var j = 0, letLength = letters.length; j < letLength; j++){
      output.map[letters[j]] = reference[i].base;
    }
  }

  /**
   * Clean accents (diacritics) from string.
   * 
   * @param  {String} input String to be cleaned of diacritics.
   * @return {String}
   */
  output.clean = function (input) {
    if (!input || !input.length || input.length < 1) {
      return "";
    }

    var string = "";
    var letters = input.split("");
    var index = 0;
    var length = letters.length;
    var letter;

    for (; index < length; index++) {
      letter = letters[index];
      string += letter in output.map ? output.map[letter] : letter;
    }

    return string;
  };

  return output;
});
},{}],76:[function(require,module,exports){
var process=require("__browserify_process");// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    // Turn off strict mode for this function so we can assign to global.Q
    /* jshint strict: false */

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else {
        Q = definition();
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be fulfilled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return isObject(object) &&
        typeof object.promiseDispatch === "function" &&
        typeof object.inspect === "function";
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return result.value;
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return exception.value;
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, message) {
    return Q(object).timeout(ms, message);
};

Promise.prototype.timeout = function (ms, message) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        deferred.reject(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

},{"__browserify_process":64}],77:[function(require,module,exports){
/*
 * textgrid
 * https://github.com/OpenSourceFieldlinguistics/PraatTextGridJS
 *
 * Copyright (c) 2014 OpenSourceFieldLinguistics Contribs
 * Licensed under the Apache 2.0 license.
 */

(function(exports) {

	'use strict';

	var TextGrid = {

	};

	TextGrid.init = function() {
		return "init";
	};


	var createAnObject = function(lines) {
		var json = {},
			pieces,
			key,
			value;

		for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			pieces = lines[lineIndex].split(" = ");
			key = pieces[0].trim().replace(/ /g, "_");
			value = pieces[1].trim().replace(/"/g, "");
			json[key] = value;
		}
		return json;
	};

	TextGrid.textgridToJSON = function(textgrid, assumeTiersAreSpeakers) {
		var lines = textgrid.split("\n"),
			json = {
				items: []
			},
			line,
			lineIndex,
			pieces,
			items = [],
			currentItem = null,
			type,
			fileName = "Unknown",
			fileNames = [],
			key,
			value,
			text;

		// console.log("File length " + lines.length);
		while (lines.length > 0) {
			line = lines.shift();
			/* keys at the file level */
			if (!line) {
				line = lines.shift();
				if (!line) {
					if (currentItem) {
						currentItem.fileName = fileName;
						json.items.push(currentItem);
					}
					currentItem = null;
					fileName = "Unknown"; /* reset filename if there is are two empty lines */
					console.log("Reset filename if there is are two empty lines");
				}
			} else if (line.search(/ /) !== 0) {
				pieces = line.split(" = ");
				if (pieces.length === 2) {
					key = pieces[0].trim().replace(/ /g, "_");
					value = pieces[1].trim().replace(/"/g, "");
					json[key] = value;
					if (key === "File_name") {
						fileName = value + "";
						console.log(" Found a file name " + fileName);
						fileNames.push(fileName);
					}
				}
			} else {
				/* either point or interval introducers, or keys for items */
				if (line.search(/\[[\0-9]+\]/) !== -1) {
					pieces = line.split("[");
					type = pieces[0].trim();
					if (type === "item") {
						console.log("  Found an item for " + fileName);
						if (currentItem) {
							currentItem.fileName = fileName;
							json.items.push(currentItem);
						}
						currentItem = {};
					} else if (type === "points") {
						var p = createAnObject([lines.shift(), lines.shift()]);
						currentItem[type] = currentItem[type] || [];
						currentItem[type].push(p);
					} else if (type === "intervals") {
						var interval = createAnObject([lines.shift(), lines.shift(), lines.shift()]);
						currentItem[type] = currentItem[type] || [];
						currentItem[type].push(interval);

					}
				} else {
					pieces = line.split(" = ");
					if (pieces.length === 2) {
						key = pieces[0].trim().replace(/ /g, "_");
						value = pieces[1].trim().replace(/"/g, "");
						if (key.indexOf(":_size") > -1) {
							key = key.replace(":_", "_");
							value = parseInt(value, 10);
						}
						currentItem[key] = value;
					}
				}
			}
		}
		if (currentItem) {
			currentItem.fileName = fileName;
			json.items.push(currentItem);
		}
		json.fileNames = fileNames;
		return json;
	};

	TextGrid.textgridToIGT = function(textgrid, assumeTiersAreSpeakers) {
		return this.jsonToIGT(this.textgridToJSON(textgrid, assumeTiersAreSpeakers), assumeTiersAreSpeakers);
	};

	TextGrid.jsonToIGT = function(json, assumeTiersAreSpeakers) {
		var tiersByLength = {};
		json.intervalsByXmin = {};
		json.intervalsByText = {};
		var itemIndex;
		var intervalIndex;
		var xmin,
			xmax,
			key,
			interval,
			fileName,
			text,
			length,
			probablyFromElanWithSpeakerEncodedInTierName = false,
			probablyFromElanWithSpeakerEncodedInTierNameCount = 0;

		var maximizeFindingTextInAudio = /[ #?!'".,\/\(\)\*\#0-9-]/g;
		var tierNames = json.items.map(function(tier) {
			if (tier.name.indexOf("@") > -1 /* probably elan tiers */ ) {
				tier.speaker = tier.name.substring(tier.name.indexOf("@") + 1).trim();
				tier.name = tier.name.substring(0, tier.name.indexOf("@")).trim();
				probablyFromElanWithSpeakerEncodedInTierNameCount++;
			}
			if (assumeTiersAreSpeakers) {
				tier.speaker = tier.name;
			}
			if (tier.name === "silences") {
				tier.name = "utterances";
			}
			return tier.name;
		});
		// console.log(tierNames);
		if (tierNames.length - probablyFromElanWithSpeakerEncodedInTierNameCount == 0) {
			probablyFromElanWithSpeakerEncodedInTierName = true;
		}
		if (!json || !json.items) {
			return json;
		}
		for (itemIndex = 0; itemIndex < json.items.length; itemIndex++) {
			tiersByLength[json.items[itemIndex].name] = json.items[itemIndex].intervals_size || json.items[itemIndex].points_size;
			if (json.items[itemIndex].intervals) {
				for (intervalIndex = 0; intervalIndex < json.items[itemIndex].intervals.length; intervalIndex++) {
					xmin = this.marginForConsideringIntervalsMatching(json.items[itemIndex].intervals[intervalIndex].xmin);
					xmax = this.marginForConsideringIntervalsMatching(json.items[itemIndex].intervals[intervalIndex].xmax);
					interval = json.items[itemIndex].intervals[intervalIndex];
					interval.fileName = json.items[itemIndex].fileName;
					interval.tierName = json.items[itemIndex].name;
					interval.speaker = json.items[itemIndex].speaker;
					key = xmin + ":" + xmax;
					json.intervalsByXmin[key] = json.intervalsByXmin[key] || [];
					json.intervalsByXmin[key].push(interval);

					text = interval.text ? interval.text.trim().toLocaleLowerCase().replace(maximizeFindingTextInAudio, "") : "";
					if (text) {
						// if its the only interval, and it says utterance, put the file name there instead under the assumption that the filename is probably meaningful
						if (text === "utterance" && json.items[itemIndex].intervals.length < 3) {
							text = interval.fileName;
							if (text.indexOf(".") > -1) {
								text = text.substring(0, interval.fileName.lastIndexOf("."));
							}
							text = text.trim().replace(/_/g, " ");
							// console.log("text replaced with filename. " + text);
							interval.text = text;
						}
						json.intervalsByText[text] = json.intervalsByText[text] || [];
						length = json.intervalsByText[text].length;
						json.intervalsByText[text][length] = interval;
					}

					//json.intervalsByXmin[key].push({
					//text: interval.text,
					//tierName: tierName
					//});

					//json.intervalsByXmin[xmin + ":" + xmax].push({
					//tierName: interval.text 
					//});
				}
			}
		}
		// this.printIGT(json.intervalsByXmin);
		json.probablyFromElanWithSpeakerEncodedInTierName = probablyFromElanWithSpeakerEncodedInTierName;
		json.isIGTNestedOrAlignedOrBySpeaker = this.isIGTNestedOrAlignedOrBySpeaker(json);
		return json;
	};

	TextGrid.isIGTNestedOrAlignedOrBySpeaker = function(json) {
		var intervals = json.intervalsByXmin;
		var histogram = {},
			bin,
			intervalKey,
			totalPotentialIGTIntervals = 0,
			probablyBySpeaker = false,
			probablyAligned = false;

		for (var tier in json.items) {
			if (json.items.hasOwnProperty(tier) && json.items[tier].speaker) {
				probablyBySpeaker = true;
			}
		}

		for (intervalKey in intervals) {
			histogram[intervals[intervalKey].length] = histogram[intervals[intervalKey].length] ? histogram[intervals[intervalKey].length] + 1 : 1;
			totalPotentialIGTIntervals++;
		}
		/* Normalize the histogram */
		for (bin in histogram) {
			histogram[bin] = histogram[bin] / totalPotentialIGTIntervals;
			if (bin > 1 && histogram[bin] > 0.10) {
				probablyAligned = true;
			}
			// console.log(histogram[bin]);
		}

		// If there are more than 4 files, they are probably not IGT across files. 
		if (json.fileNames && json.fileNames.length > 4) {
			probablyAligned = false;
		}
		// console.log(histogram);
		// console.log("probably aligned " + probablyAligned);

		return {
			histogram: histogram,
			probablyAligned: probablyAligned,
			probablyBySpeaker: probablyBySpeaker
		};
	};

	TextGrid.marginForConsideringIntervalsMatching = function(value, optionalMillisecond) {
		if (optionalMillisecond) {
			optionalMillisecond = 100 / optionalMillisecond;
		} else {
			optionalMillisecond = 100 / 20;
		}
		return (Math.round(value * optionalMillisecond) / optionalMillisecond).toFixed(2);
	};

	TextGrid.printIGT = function(igtIntervalsJSON) {
		for (var interval in igtIntervalsJSON) {
			console.log(interval);
			if (igtIntervalsJSON.hasOwnProperty(interval)) {
				console.log(igtIntervalsJSON[interval].map(function(interval) {
					return interval.xmin + "," + interval.xmax + "," + interval.text;
				}));
			}
		}
	};

	exports.TextGrid = TextGrid;

}(typeof exports === "object" && exports || this));

},{}],78:[function(require,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}],79:[function(require,module,exports){
module.exports={
  "name": "fielddb",
  "version": "2.28.0",
  "description": "An offline/online field database which adapts to its user's terminology and I-Language",
  "homepage": "https://github.com/OpenSourceFieldlinguistics/FieldDB/issues/milestones?state=closed",
  "repository": {
    "type": "git",
    "url": "git://github.com/OpenSourceFieldlinguistics/FieldDB.git"
  },
  "bugs": {
    "url": "https://github.com/OpenSourceFieldlinguistics/FieldDB/issues"
  },
  "keywords": [
    "fielddb",
    "client"
  ],
  "contributors": [
    "cesine <cesine@yahoo.com>",
    "trisapeace <trisapeace@gmail.com>",
    "hisakonog <hisakonog@gmail.com>",
    "Emmy Cathcart <maryellencathcart@gmail.com>",
    "Tobin Skinner <tobin.skinner@gmail.com>",
    "Yuliya Manyakina <yulia.manyakina@gmail.com>",
    "Elise <elise.mcclay@gmail.com>",
    "Josh Horner <josh.horner@gmail.com>",
    "gretchenmcc <gretchen.mcculloch@gmail.com>",
    "jrwdunham <jrwdunham@gmail.com>",
    "ghazan <gay.hazan@gmail.com>",
    "Fieldlinguist <info@fieldlinguist.com>",
    "zazoo <kimdan.ng@gmail.com>",
    "louisa-bielig <louisa.bielig@gmail.com>",
    "lingllama <lingllama@lingsync.org>",
    "geekrax <rakshit@thetechtime.com>",
    "Yogurt1206 <sunx4@miamioh.edu>",
    "Pablo Duboue <pablo.duboue@gmail.com>",
    "Oriana <oriana.kilbourn-ceron@mail.mcgill.ca>"
  ],
  "dependencies": {
    "MD5": "1.2.1",
    "atob": "^1.1.2",
    "btoa": "^1.1.2",
    "crypto-js": "^3.1.2-5",
    "diacritic": "0.0.2",
    "q": "1.0.1",
    "textgrid": "2.2.0",
    "underscore": "^1.6.0"
  },
  "devDependencies": {
    "browserify": "3.2.2",
    "grunt": "*",
    "grunt-browserify": "1.3.2",
    "grunt-contrib-concat": "0.3.0",
    "grunt-contrib-jshint": "0.10.0",
    "grunt-contrib-uglify": "0.2.7",
    "grunt-contrib-watch": "0.6.1",
    "grunt-exec": "^0.4.6",
    "grunt-jasmine-node": "git://github.com/cesine/grunt-jasmine-node.git",
    "grunt-jsdoc": "0.4.3",
    "jasmine-node": "^1.14.5"
  },
  "main": "./scripts/build_template_databases_using_fielddb.sh",
  "bin": {
    "fielddb": "./scripts/build_template_databases_using_fielddb.sh"
  },
  "engines": {
    "node": "~0.8 || ~0.10"
  },
  "scripts": {
    "test": "grunt"
  },
  "license": "Apache 2.0",
  "licenses": [
    {
      "type": "Apache 2.0"
    }
  ]
}

},{}]},{},[36])
;