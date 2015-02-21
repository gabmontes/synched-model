
var chai = require("chai");
var deep = require("deep-diff");

var assert = chai.assert;

var SynchedModel = require("..");

// var testAdapter = require("./testAdapter");

suite("Basic", function () {

    test("initialization", function (done) {
        var testAdapter = {
            on: function (event, callback) {
                assert.include(["connect", "disconnect", "update", "error"], event);
                assert.typeOf(callback, "function");
            },
            connect: function () {
                done();
            },
            fetch: function () {
                assert.fail();
            }
        };
        var model = new SynchedModel(testAdapter);
        assert.strictEqual(model.status, "out_of_sync");
        assert.deepEqual(model.data, null);
    });

    test("connection", function (done) {
        var testData = {
            key1: "value1"
        };
        var testAdapter = {
            callbacks: {},
            on: function (event, callback) {
                assert.typeOf(callback, "function");
                this.callbacks[event] = callback;
            },
            connect: function () {
                this.callbacks.connect();
            },
            fetch: function (callback) {
                assert.typeOf(callback, "function");
                setTimeout(function () {
                    callback(null, testData);
                }, 0);
            }
        };
        var reset = false;
        var model = new SynchedModel(testAdapter);
        model.on("reset", function (data) {
            assert.deepEqual(data, testData);
            reset = true;
        });
        model.on("in_sync", function () {
            assert.strictEqual(model.status, "in_sync");
            assert.isTrue(reset);
            done();
        });
        model.on("out_of_sync", function () {
            assert.fail();
        });
    });

    test("disconnection", function (done) {
        var testData = {
            key1: "value1"
        };
        var testAdapter = {
            callbacks: {},
            on: function (event, callback) {
                assert.typeOf(callback, "function");
                this.callbacks[event] = callback;
            },
            connect: function () {
                this.callbacks.connect();
            },
            fetch: function (callback) {
                assert.typeOf(callback, "function");
                setTimeout(function () {
                    callback(null, testData);
                }, 0);
            }
        };
        var reset = false;
        var model = new SynchedModel(testAdapter);
        model.on("reset", function (data) {
            assert.deepEqual(data, testData);
            reset = true;
        });
        model.on("in_sync", function () {
            assert.strictEqual(model.status, "in_sync");
            assert.isTrue(reset);
            testAdapter.callbacks.disconnect();
        });
        model.on("out_of_sync", function () {
            assert.strictEqual(model.status, "out_of_sync");
            done();
        });
    });

    test("disconnection and reconnection", function (done) {
        var testData1 = {
            key1: "value1"
        };
        var testData2 = {
            key1: "value1",
            key2: "value2"
        };
        var calls = 0;
        var testAdapter = {
            callbacks: {},
            on: function (event, callback) {
                assert.typeOf(callback, "function");
                this.callbacks[event] = callback;
            },
            connect: function () {
                this.callbacks.connect();
            },
            fetch: function (callback) {
                assert.typeOf(callback, "function");
                setTimeout(function () {
                    callback(null, calls === 0 ? testData1 : testData2);
                }, 0);
            }
        };
        var model = new SynchedModel(testAdapter);
        model.on("reset", function (data) {
            assert.deepEqual(data, calls === 0 ? testData1 : testData2);
            if (++calls === 2) {
                done();
            }
        });
        model.on("in_sync", function () {
            assert.strictEqual(model.status, "in_sync");
            testAdapter.callbacks.disconnect();
        });
        model.on("out_of_sync", function () {
            assert.strictEqual(model.status, "out_of_sync");
            testAdapter.callbacks.connect();
        });
    });

    test("update", function (done) {
        var testData1 = {
            key1: "value1"
        };
        var testData2 = {
            key1: "value1-updated",
            key2: "value2"
        };
        var diff = deep.diff(testData1, testData2);
        var testAdapter = {
            callbacks: {},
            on: function (event, callback) {
                assert.typeOf(callback, "function");
                this.callbacks[event] = callback;
            },
            connect: function () {
                this.callbacks.connect();
            },
            fetch: function (callback) {
                assert.typeOf(callback, "function");
                setTimeout(function () {
                    callback(null, testData1);
                }, 0);
            }
        };
        var reset = false;
        var model = new SynchedModel(testAdapter);
        model.on("reset", function (data) {
            assert.deepEqual(data, testData1);
            reset = true;
        });
        model.on("in_sync", function () {
            assert.isTrue(reset);
            assert.strictEqual(model.status, "in_sync");
            testAdapter.callbacks.update(diff);
        });
        model.on("change", function (changes) {
            assert.deepEqual(changes, diff);
            assert.deepEqual(model.data, testData2);
            done();
        });
        model.on("out_of_sync", function () {
            assert.fail();
        });
    });

    test("retry fetch", function (done) {
        var testData = {
            key1: "value1"
        };
        var attempts = 3;
        var testAdapter = {
            callbacks: {},
            on: function (event, callback) {
                assert.typeOf(callback, "function");
                this.callbacks[event] = callback;
            },
            connect: function () {
                this.callbacks.connect();
            },
            fetch: function (callback) {
                assert.typeOf(callback, "function");
                setTimeout(function () {
                    callback(--attempts === 0 ? null : new Error(), testData);
                }, 0);
            }
        };
        var reset = false;
        var model = new SynchedModel(testAdapter);
        model.on("reset", function (data) {
            assert.deepEqual(data, testData);
            reset = true;
        });
        model.on("in_sync", function () {
            assert.strictEqual(model.status, "in_sync");
            assert.isTrue(reset);
            done();
        });
        model.on("out_of_sync", function () {
            assert.fail();
        });
    });
});
