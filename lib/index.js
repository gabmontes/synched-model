
// module dependencies
var deep = require("deep-diff");
var util = require("util");
var Backoff = require("backoff-retry");
var EventEmitter = require("events").EventEmitter;

/**
 * `SynchedModel` constructor. It will keep the data in sync with the source.
 * The `dataSource` must implement the following interface:
 *
 * `dataSource.on(event, callback)`
 * Adds listeners to data source events.
 *
 * `dataSource.on#connect`
 * Must be emitted when the connection with the data source is established. If
 * the connection was lost and established again, it must be emitted again.
 *
 * `dataSource.on#disconnect`
 * Must be emitted when the connection with the data source is lost.
 *
 * `dataSource.on#update`
 * Must be emitted on data change. The change must be passed as parameter to the
 * callback and must follow the format returned by `deep.diff()`.
 *
 * `dataSource.on#error`
 * Must be emitted on any connection error.
 *
 * `dataSource.connect()`
 * Initiates the connection to the data source to receive events.
 *
 * `dataSource.fetch(callback)`
 * Requests a full set of data from the data source. The `callback` receives an
 * `Error` object or `null` as first parameter and the actual data object as the
 * second one.
 *
 * @param {DataSourceAdapter} dataSource is the adapted to the data source.
 */
function SynchedModel(dataSource) {
    "use strict";

    var self = this;

    // call `EventEmitter` constructor
    SynchedModel.super_.call(this);

    // set public `status` and reference to the `data`
    this.status = "out_of_sync";
    this.data = null;

    // set private reference to `dataSource` adapter
    this._dataSource = dataSource;

    // listen for `dataSource` events
    dataSource.on("connect", this._onConnect.bind(this));
    dataSource.on("update", this._onUpdate.bind(this));
    dataSource.on("disconnect", function () {
        self._onError.call(self, new Error("Disconnected from data source"));
    });
    dataSource.on("error", this._onError.bind(this));

    // connect to data source to start receiving events
    dataSource.connect();
}

// make `SynchedModel` an `EventEmitter`
util.inherits(SynchedModel, EventEmitter);

/**
 * Helper to set the model status. It will change the internal status and emit
 * a status change event.
 *
 * @param {String} status is the model status.
 * @param {Object} data is any data associated with the status change.
 *
 * @api private
 */
SynchedModel.prototype._setStatus = function (status, data) {
    "use strict";

    this.status = status;
    this.emit(status, data);
};

/**
 * Handles the `connect` event. It will try to get the full set of data from
 * the source. If there is an error during this operation, it will retry using
 * an exponential backoff algorithm up to 20 times before rising an error. Once
 * the full data is retrieved, it will emit a `reset` event and set the status
 * to `in_sync`.
 *
 * @api private
 */
SynchedModel.prototype._onConnect = function () {
    "use strict";

    var self = this;

    // skip if already in sync
    if (this.status === "in_sync") {
        return;
    }

    // retrieve a full data set from source
    var retrier = new Backoff(this._dataSource.fetch, function (err, data) {

        // catch errors and notify
        if (err) {
            self.emit("error", err);
            return;
        }

        // keep a reference to the returned data and send notification
        self.data = data;
        self.emit("reset", self.data);

        // and notify new status
        self._setStatus("in_sync");
    }, {
        maxAttemps: 20
    });
    retrier.on("attempt_failed", function () {});
};

/**
 * Handles the reception of updates.
 *
 * @param {Object} changes is the object describing the changes. It must follow
 * the format returned by `deep.diff()`.
 *
 * @api private
 */
SynchedModel.prototype._onUpdate = function (changes) {
    "use strict";

    var self = this;

    // skip if out of sync
    if (this.status === "out_of_sync") {
        return;
    }

    // apply changes and notify
    changes.forEach(function (change) {
        deep.applyChange(self.data, {}, change);
    });
    this.emit("change", changes, this.data);
};

/**
 * Handles the `error` events by setting the status and notifying the event.
 *
 * @param {Error} err is the object representing the error.
 *
 * @api private
 */
SynchedModel.prototype._onError = function (err) {
    "use strict";

    this._setStatus("out_of_sync", err);
};

// export module interface
module.exports = SynchedModel;
