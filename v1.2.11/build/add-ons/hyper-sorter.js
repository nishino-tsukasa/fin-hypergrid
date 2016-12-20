(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function Hypersorter(grid, objects) {
    this.grid = grid;

    this.sorts = [];

    objects = objects || {};

    var hypergridPrototype = getPrototype('Hypergrid', grid);

    hypergridPrototype.constructor.properties.mixIn(require('./mix-ins/defaults'));

    hypergridPrototype.mixIn(require('./mix-ins/grid'));
    getPrototype('Behavior', grid.behavior).mixIn(require('./mix-ins/behavior'));
    getPrototype('Column', grid.behavior.allColumns.length && grid.behavior.allColumns[0]).mixIn(require('./mix-ins/column'));
    getPrototype('DataModel', grid.behavior.dataModel).mixIn(require('./mix-ins/dataModel'));

    this.grid.addEventListener('fin-column-sort', function(c, keys){
        grid.toggleSort(c, keys);
    });

    function getPrototype(name, instance) {
        var object = objects[name];
        return object && object.prototype || Object.getPrototypeOf(instance);
    }
}

Hypersorter.prototype.name = 'hypersorter';

/** @typedef {object} sortSpecInterface
 * @property {number} columnIndex
 * @property {number} direction
 * @property {string} [type]
 */

/**
 * @implements dataControlInterface#properties
 * @desc See {@link sortSpecInterface} for available sort properties.
 * @memberOf Hypersorter.prototype
 */
Hypersorter.prototype.properties = function(properties) {
    var result, value,
        columnSort = this.grid.behavior.dataModel.getColumnSortState(properties.COLUMN.index);

    if (columnSort) {
        if (properties.GETTER) {
            result = columnSort[properties.GETTER];
            if (result === undefined) {
                result = null;
            }
        } else {
            for (var key in properties) {
                value = properties[key];
                columnSort[key] = typeof value === 'function' ? value() : value;
            }
        }
    }

    return result;
};

window.fin.Hypergrid.hypersorter = Hypersorter;

},{"./mix-ins/behavior":2,"./mix-ins/column":3,"./mix-ins/dataModel":4,"./mix-ins/defaults":5,"./mix-ins/grid":6}],2:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @memberOf Behavior#
     */
    get sorter() {
        return this.dataModel.sorter;
    },
    set sorter(sorter) {
        this.dataModel.sorter = sorter;
    },

    /**
     * @memberOf Behavior.prototype
     * @param {number} c - grid column index.
     * @param {string[]} keys
     */
    toggleSort: function(c, keys) {
        var column = this.getActiveColumn(c);
        if (column) {
            column.toggleSort(keys);
        }
    },
    sortChanged: function(hiddenColumns){
        if (removeHiddenColumns(
                this.sorter.sorts,
                hiddenColumns || this.getHiddenColumns()
        )) {
            this.reindex();
        }
    }

};
//Logic to moved to adapter layer outside of Hypergrid Core
function removeHiddenColumns(oldSorted, hiddenColumns){
    var dirty = false;
    oldSorted.forEach(function(i) {
        var j = 0,
            colIndex;
        while (j < hiddenColumns.length) {
            colIndex = hiddenColumns[j].index + 1; //hack to get around 0 index
            if (colIndex === i) {
                hiddenColumns[j].unSort();
                dirty = true;
                break;
            }
            j++;
        }
    });
    return dirty;
}

},{}],3:[function(require,module,exports){
'use strict';

module.exports = {
    toggleSort: function(keys) {
        this.dataModel.toggleSort(this, keys);
    },

    unSort: function(deferred) {
        this.dataModel.unSortColumn(this, deferred);
    }
};

},{}],4:[function(require,module,exports){
'use strict';

var UPWARDS_BLACK_ARROW = '\u25b2', // aka '▲'
    DOWNWARDS_BLACK_ARROW = '\u25bc'; // aka '▼'

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @param {dataControlInterface|undefined|null} sorter
     * @memberOf Behavior#
     */
    get sorter() {
        return this.getController('sorter');
    },
    set sorter(sorter) {
        this.setController('sorter', sorter);
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param keys
     */
    toggleSort: function(column, keys) {
        this.incrementSortState(column, keys);
        this.serializeSortState();
        this.reindex();
    },
    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param {boolean} deferred
     */
    unSortColumn: function(column, deferred) {
        var sortSpec = this.getColumnSortState(column.index);

        if (sortSpec) {
            this.sorter.sorts.splice(sortSpec.rank, 1); //Removed from sorts
            if (!deferred) {
                this.reindex();
            }
        }

        this.serializeSortState();
    },

    /**
     * @param {number} columnIndex
     * @returns {sortSpecInterface}
     */
    getColumnSortState: function(columnIndex){
        var rank,
            sort = this.sorter.sorts.find(function(sort, index) {
                rank = index;
                return sort.columnIndex === columnIndex;
            });

        return sort && { sort: sort, rank: rank };
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param {string[]} keys
     * @return {object[]} sorts
     */
    incrementSortState: function(column, keys) {
        var sorts = this.sorter.sorts,
            columnIndex = column.index,
            columnSchema = this.schema[columnIndex],
            sortSpec = this.getColumnSortState(columnIndex);

        if (!sortSpec) { // was unsorted
            if (keys.indexOf('CTRL') < 0) {
                sorts.length = 0;
            }
            sorts.unshift({
                columnIndex: columnIndex, // so define and...
                direction: 1, // ...make ascending
                type: columnSchema.type
            });
        } else if (sortSpec.sort.direction > 0) { // was ascending
            sortSpec.sort.direction = -1; // so make descending
        } else { // was descending
            this.unSortColumn(column, true); // so make unsorted
        }

        //Minor improvement, but this check can happen earlier and terminate earlier
        sorts.length = Math.min(sorts.length, this.grid.properties.maxSortColumns);
    },

    serializeSortState: function(){
        this.grid.properties.sorts = this.sorter.sorts;
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param index
     * @param returnAsString
     * @desc Provides the unicode character used to denote visually if a column is a sorted state
     * @returns {*}
     */
    getSortImageForColumn: function(columnIndex) {
        var sorts = this.sorter.sorts,
            sortSpec = this.getColumnSortState(columnIndex),
            result, rank;

        if (sortSpec) {
            var arrow = sortSpec.sort.direction > 0
                ? UPWARDS_BLACK_ARROW
                : DOWNWARDS_BLACK_ARROW;

            result = arrow + ' ';

            if (sorts.length > 1) {
                rank = sorts.length - sortSpec.rank;
                result = rank + result;
            }
        }

        return result;
    }
};

},{}],5:[function(require,module,exports){
'use strict';

exports.maxSortColumns = 3;

},{}],6:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's sorter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @memberOf Hypergrid#
     */
    get sorter() {
        return this.behavior.sorter;
    },
    set sorter(sorter) {
        this.behavior.sorter = sorter;
    },

    /**
     * @memberOf Hypergrid#
     * @param event
     */
    toggleSort: function(event) {
        if (!this.abortEditing()) { return; }

        var behavior = this.behavior,
            self = this,
            c = event.detail.column,
            keys =  event.detail.keys;

        behavior.toggleSort(c, keys);

        setTimeout(function() {
            self.synchronizeScrollingBoundaries();
            behavior.autosizeAllColumns();
            self.repaint();
        }, 10);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9mYWtlXzk2YmU5MDJiLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItc29ydGVyL21peC1pbnMvY29sdW1uLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9kYXRhTW9kZWwuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9taXgtaW5zL2RlZmF1bHRzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9ncmlkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIEh5cGVyc29ydGVyKGdyaWQsIG9iamVjdHMpIHtcbiAgICB0aGlzLmdyaWQgPSBncmlkO1xuXG4gICAgdGhpcy5zb3J0cyA9IFtdO1xuXG4gICAgb2JqZWN0cyA9IG9iamVjdHMgfHwge307XG5cbiAgICB2YXIgaHlwZXJncmlkUHJvdG90eXBlID0gZ2V0UHJvdG90eXBlKCdIeXBlcmdyaWQnLCBncmlkKTtcblxuICAgIGh5cGVyZ3JpZFByb3RvdHlwZS5jb25zdHJ1Y3Rvci5wcm9wZXJ0aWVzLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9kZWZhdWx0cycpKTtcblxuICAgIGh5cGVyZ3JpZFByb3RvdHlwZS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvZ3JpZCcpKTtcbiAgICBnZXRQcm90b3R5cGUoJ0JlaGF2aW9yJywgZ3JpZC5iZWhhdmlvcikubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2JlaGF2aW9yJykpO1xuICAgIGdldFByb3RvdHlwZSgnQ29sdW1uJywgZ3JpZC5iZWhhdmlvci5hbGxDb2x1bW5zLmxlbmd0aCAmJiBncmlkLmJlaGF2aW9yLmFsbENvbHVtbnNbMF0pLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9jb2x1bW4nKSk7XG4gICAgZ2V0UHJvdG90eXBlKCdEYXRhTW9kZWwnLCBncmlkLmJlaGF2aW9yLmRhdGFNb2RlbCkubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2RhdGFNb2RlbCcpKTtcblxuICAgIHRoaXMuZ3JpZC5hZGRFdmVudExpc3RlbmVyKCdmaW4tY29sdW1uLXNvcnQnLCBmdW5jdGlvbihjLCBrZXlzKXtcbiAgICAgICAgZ3JpZC50b2dnbGVTb3J0KGMsIGtleXMpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZ2V0UHJvdG90eXBlKG5hbWUsIGluc3RhbmNlKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSBvYmplY3RzW25hbWVdO1xuICAgICAgICByZXR1cm4gb2JqZWN0ICYmIG9iamVjdC5wcm90b3R5cGUgfHwgT2JqZWN0LmdldFByb3RvdHlwZU9mKGluc3RhbmNlKTtcbiAgICB9XG59XG5cbkh5cGVyc29ydGVyLnByb3RvdHlwZS5uYW1lID0gJ2h5cGVyc29ydGVyJztcblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IHNvcnRTcGVjSW50ZXJmYWNlXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29sdW1uSW5kZXhcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkaXJlY3Rpb25cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZV1cbiAqL1xuXG4vKipcbiAqIEBpbXBsZW1lbnRzIGRhdGFDb250cm9sSW50ZXJmYWNlI3Byb3BlcnRpZXNcbiAqIEBkZXNjIFNlZSB7QGxpbmsgc29ydFNwZWNJbnRlcmZhY2V9IGZvciBhdmFpbGFibGUgc29ydCBwcm9wZXJ0aWVzLlxuICogQG1lbWJlck9mIEh5cGVyc29ydGVyLnByb3RvdHlwZVxuICovXG5IeXBlcnNvcnRlci5wcm90b3R5cGUucHJvcGVydGllcyA9IGZ1bmN0aW9uKHByb3BlcnRpZXMpIHtcbiAgICB2YXIgcmVzdWx0LCB2YWx1ZSxcbiAgICAgICAgY29sdW1uU29ydCA9IHRoaXMuZ3JpZC5iZWhhdmlvci5kYXRhTW9kZWwuZ2V0Q29sdW1uU29ydFN0YXRlKHByb3BlcnRpZXMuQ09MVU1OLmluZGV4KTtcblxuICAgIGlmIChjb2x1bW5Tb3J0KSB7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLkdFVFRFUikge1xuICAgICAgICAgICAgcmVzdWx0ID0gY29sdW1uU29ydFtwcm9wZXJ0aWVzLkdFVFRFUl07XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgICAgICAgICBjb2x1bW5Tb3J0W2tleV0gPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSgpIDogdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIeXBlcnNvcnRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUaGUgYmVoYXZpb3JzJ3Mgc29ydGVyIGRhdGEgY29udHJvbGxlci5cbiAgICAgKiBAZGVzYyBUaGlzIGdldHRlci9zZXR0ZXIgaXMgc3ludGFjdGljIHN1Z2FyIGZvciBjYWxscyB0byBgZ2V0Q29udHJvbGxlcmAgYW5kIGBzZXRDb250cm9sbGVyYC5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgZ2V0IHNvcnRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YU1vZGVsLnNvcnRlcjtcbiAgICB9LFxuICAgIHNldCBzb3J0ZXIoc29ydGVyKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnNvcnRlciA9IHNvcnRlcjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjIC0gZ3JpZCBjb2x1bW4gaW5kZXguXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5c1xuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGMsIGtleXMpIHtcbiAgICAgICAgdmFyIGNvbHVtbiA9IHRoaXMuZ2V0QWN0aXZlQ29sdW1uKGMpO1xuICAgICAgICBpZiAoY29sdW1uKSB7XG4gICAgICAgICAgICBjb2x1bW4udG9nZ2xlU29ydChrZXlzKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc29ydENoYW5nZWQ6IGZ1bmN0aW9uKGhpZGRlbkNvbHVtbnMpe1xuICAgICAgICBpZiAocmVtb3ZlSGlkZGVuQ29sdW1ucyhcbiAgICAgICAgICAgICAgICB0aGlzLnNvcnRlci5zb3J0cyxcbiAgICAgICAgICAgICAgICBoaWRkZW5Db2x1bW5zIHx8IHRoaXMuZ2V0SGlkZGVuQ29sdW1ucygpXG4gICAgICAgICkpIHtcbiAgICAgICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuLy9Mb2dpYyB0byBtb3ZlZCB0byBhZGFwdGVyIGxheWVyIG91dHNpZGUgb2YgSHlwZXJncmlkIENvcmVcbmZ1bmN0aW9uIHJlbW92ZUhpZGRlbkNvbHVtbnMob2xkU29ydGVkLCBoaWRkZW5Db2x1bW5zKXtcbiAgICB2YXIgZGlydHkgPSBmYWxzZTtcbiAgICBvbGRTb3J0ZWQuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgIHZhciBqID0gMCxcbiAgICAgICAgICAgIGNvbEluZGV4O1xuICAgICAgICB3aGlsZSAoaiA8IGhpZGRlbkNvbHVtbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb2xJbmRleCA9IGhpZGRlbkNvbHVtbnNbal0uaW5kZXggKyAxOyAvL2hhY2sgdG8gZ2V0IGFyb3VuZCAwIGluZGV4XG4gICAgICAgICAgICBpZiAoY29sSW5kZXggPT09IGkpIHtcbiAgICAgICAgICAgICAgICBoaWRkZW5Db2x1bW5zW2pdLnVuU29ydCgpO1xuICAgICAgICAgICAgICAgIGRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGorKztcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkaXJ0eTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgdG9nZ2xlU29ydDogZnVuY3Rpb24oa2V5cykge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC50b2dnbGVTb3J0KHRoaXMsIGtleXMpO1xuICAgIH0sXG5cbiAgICB1blNvcnQ6IGZ1bmN0aW9uKGRlZmVycmVkKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnVuU29ydENvbHVtbih0aGlzLCBkZWZlcnJlZCk7XG4gICAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFVQV0FSRFNfQkxBQ0tfQVJST1cgPSAnXFx1MjViMicsIC8vIGFrYSAn4payJ1xuICAgIERPV05XQVJEU19CTEFDS19BUlJPVyA9ICdcXHUyNWJjJzsgLy8gYWthICfilrwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgVGhlIGJlaGF2aW9ycydzIHNvcnRlciBkYXRhIGNvbnRyb2xsZXIuXG4gICAgICogQGRlc2MgVGhpcyBnZXR0ZXIvc2V0dGVyIGlzIHN5bnRhY3RpYyBzdWdhciBmb3IgY2FsbHMgdG8gYGdldENvbnRyb2xsZXJgIGFuZCBgc2V0Q29udHJvbGxlcmAuXG4gICAgICogQHBhcmFtIHtkYXRhQ29udHJvbEludGVyZmFjZXx1bmRlZmluZWR8bnVsbH0gc29ydGVyXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yI1xuICAgICAqL1xuICAgIGdldCBzb3J0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRyb2xsZXIoJ3NvcnRlcicpO1xuICAgIH0sXG4gICAgc2V0IHNvcnRlcihzb3J0ZXIpIHtcbiAgICAgICAgdGhpcy5zZXRDb250cm9sbGVyKCdzb3J0ZXInLCBzb3J0ZXIpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBjb2x1bW5cbiAgICAgKiBAcGFyYW0ga2V5c1xuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGNvbHVtbiwga2V5cykge1xuICAgICAgICB0aGlzLmluY3JlbWVudFNvcnRTdGF0ZShjb2x1bW4sIGtleXMpO1xuICAgICAgICB0aGlzLnNlcmlhbGl6ZVNvcnRTdGF0ZSgpO1xuICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICogQHBhcmFtIGNvbHVtblxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZGVmZXJyZWRcbiAgICAgKi9cbiAgICB1blNvcnRDb2x1bW46IGZ1bmN0aW9uKGNvbHVtbiwgZGVmZXJyZWQpIHtcbiAgICAgICAgdmFyIHNvcnRTcGVjID0gdGhpcy5nZXRDb2x1bW5Tb3J0U3RhdGUoY29sdW1uLmluZGV4KTtcblxuICAgICAgICBpZiAoc29ydFNwZWMpIHtcbiAgICAgICAgICAgIHRoaXMuc29ydGVyLnNvcnRzLnNwbGljZShzb3J0U3BlYy5yYW5rLCAxKTsgLy9SZW1vdmVkIGZyb20gc29ydHNcbiAgICAgICAgICAgIGlmICghZGVmZXJyZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2VyaWFsaXplU29ydFN0YXRlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb2x1bW5JbmRleFxuICAgICAqIEByZXR1cm5zIHtzb3J0U3BlY0ludGVyZmFjZX1cbiAgICAgKi9cbiAgICBnZXRDb2x1bW5Tb3J0U3RhdGU6IGZ1bmN0aW9uKGNvbHVtbkluZGV4KXtcbiAgICAgICAgdmFyIHJhbmssXG4gICAgICAgICAgICBzb3J0ID0gdGhpcy5zb3J0ZXIuc29ydHMuZmluZChmdW5jdGlvbihzb3J0LCBpbmRleCkge1xuICAgICAgICAgICAgICAgIHJhbmsgPSBpbmRleDtcbiAgICAgICAgICAgICAgICByZXR1cm4gc29ydC5jb2x1bW5JbmRleCA9PT0gY29sdW1uSW5kZXg7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gc29ydCAmJiB7IHNvcnQ6IHNvcnQsIHJhbms6IHJhbmsgfTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gY29sdW1uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5c1xuICAgICAqIEByZXR1cm4ge29iamVjdFtdfSBzb3J0c1xuICAgICAqL1xuICAgIGluY3JlbWVudFNvcnRTdGF0ZTogZnVuY3Rpb24oY29sdW1uLCBrZXlzKSB7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuc29ydGVyLnNvcnRzLFxuICAgICAgICAgICAgY29sdW1uSW5kZXggPSBjb2x1bW4uaW5kZXgsXG4gICAgICAgICAgICBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYVtjb2x1bW5JbmRleF0sXG4gICAgICAgICAgICBzb3J0U3BlYyA9IHRoaXMuZ2V0Q29sdW1uU29ydFN0YXRlKGNvbHVtbkluZGV4KTtcblxuICAgICAgICBpZiAoIXNvcnRTcGVjKSB7IC8vIHdhcyB1bnNvcnRlZFxuICAgICAgICAgICAgaWYgKGtleXMuaW5kZXhPZignQ1RSTCcpIDwgMCkge1xuICAgICAgICAgICAgICAgIHNvcnRzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzb3J0cy51bnNoaWZ0KHtcbiAgICAgICAgICAgICAgICBjb2x1bW5JbmRleDogY29sdW1uSW5kZXgsIC8vIHNvIGRlZmluZSBhbmQuLi5cbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IDEsIC8vIC4uLm1ha2UgYXNjZW5kaW5nXG4gICAgICAgICAgICAgICAgdHlwZTogY29sdW1uU2NoZW1hLnR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKHNvcnRTcGVjLnNvcnQuZGlyZWN0aW9uID4gMCkgeyAvLyB3YXMgYXNjZW5kaW5nXG4gICAgICAgICAgICBzb3J0U3BlYy5zb3J0LmRpcmVjdGlvbiA9IC0xOyAvLyBzbyBtYWtlIGRlc2NlbmRpbmdcbiAgICAgICAgfSBlbHNlIHsgLy8gd2FzIGRlc2NlbmRpbmdcbiAgICAgICAgICAgIHRoaXMudW5Tb3J0Q29sdW1uKGNvbHVtbiwgdHJ1ZSk7IC8vIHNvIG1ha2UgdW5zb3J0ZWRcbiAgICAgICAgfVxuXG4gICAgICAgIC8vTWlub3IgaW1wcm92ZW1lbnQsIGJ1dCB0aGlzIGNoZWNrIGNhbiBoYXBwZW4gZWFybGllciBhbmQgdGVybWluYXRlIGVhcmxpZXJcbiAgICAgICAgc29ydHMubGVuZ3RoID0gTWF0aC5taW4oc29ydHMubGVuZ3RoLCB0aGlzLmdyaWQucHJvcGVydGllcy5tYXhTb3J0Q29sdW1ucyk7XG4gICAgfSxcblxuICAgIHNlcmlhbGl6ZVNvcnRTdGF0ZTogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy5ncmlkLnByb3BlcnRpZXMuc29ydHMgPSB0aGlzLnNvcnRlci5zb3J0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gaW5kZXhcbiAgICAgKiBAcGFyYW0gcmV0dXJuQXNTdHJpbmdcbiAgICAgKiBAZGVzYyBQcm92aWRlcyB0aGUgdW5pY29kZSBjaGFyYWN0ZXIgdXNlZCB0byBkZW5vdGUgdmlzdWFsbHkgaWYgYSBjb2x1bW4gaXMgYSBzb3J0ZWQgc3RhdGVcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICBnZXRTb3J0SW1hZ2VGb3JDb2x1bW46IGZ1bmN0aW9uKGNvbHVtbkluZGV4KSB7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuc29ydGVyLnNvcnRzLFxuICAgICAgICAgICAgc29ydFNwZWMgPSB0aGlzLmdldENvbHVtblNvcnRTdGF0ZShjb2x1bW5JbmRleCksXG4gICAgICAgICAgICByZXN1bHQsIHJhbms7XG5cbiAgICAgICAgaWYgKHNvcnRTcGVjKSB7XG4gICAgICAgICAgICB2YXIgYXJyb3cgPSBzb3J0U3BlYy5zb3J0LmRpcmVjdGlvbiA+IDBcbiAgICAgICAgICAgICAgICA/IFVQV0FSRFNfQkxBQ0tfQVJST1dcbiAgICAgICAgICAgICAgICA6IERPV05XQVJEU19CTEFDS19BUlJPVztcblxuICAgICAgICAgICAgcmVzdWx0ID0gYXJyb3cgKyAnICc7XG5cbiAgICAgICAgICAgIGlmIChzb3J0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgcmFuayA9IHNvcnRzLmxlbmd0aCAtIHNvcnRTcGVjLnJhbms7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gcmFuayArIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5tYXhTb3J0Q29sdW1ucyA9IDM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgVGhlIGJlaGF2aW9ycydzIHNvcnRlciBkYXRhIGNvbnRyb2xsZXIuXG4gICAgICogQGRlc2MgVGhpcyBnZXR0ZXIvc2V0dGVyIGlzIHN5bnRhY3RpYyBzdWdhciBmb3IgY2FsbHMgdG8gYGdldENvbnRyb2xsZXJgIGFuZCBgc2V0Q29udHJvbGxlcmAuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZCNcbiAgICAgKi9cbiAgICBnZXQgc29ydGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5iZWhhdmlvci5zb3J0ZXI7XG4gICAgfSxcbiAgICBzZXQgc29ydGVyKHNvcnRlcikge1xuICAgICAgICB0aGlzLmJlaGF2aW9yLnNvcnRlciA9IHNvcnRlcjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZCNcbiAgICAgKiBAcGFyYW0gZXZlbnRcbiAgICAgKi9cbiAgICB0b2dnbGVTb3J0OiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuYWJvcnRFZGl0aW5nKCkpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgdmFyIGJlaGF2aW9yID0gdGhpcy5iZWhhdmlvcixcbiAgICAgICAgICAgIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgYyA9IGV2ZW50LmRldGFpbC5jb2x1bW4sXG4gICAgICAgICAgICBrZXlzID0gIGV2ZW50LmRldGFpbC5rZXlzO1xuXG4gICAgICAgIGJlaGF2aW9yLnRvZ2dsZVNvcnQoYywga2V5cyk7XG5cbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYuc3luY2hyb25pemVTY3JvbGxpbmdCb3VuZGFyaWVzKCk7XG4gICAgICAgICAgICBiZWhhdmlvci5hdXRvc2l6ZUFsbENvbHVtbnMoKTtcbiAgICAgICAgICAgIHNlbGYucmVwYWludCgpO1xuICAgICAgICB9LCAxMCk7XG4gICAgfVxuXG59O1xuIl19
