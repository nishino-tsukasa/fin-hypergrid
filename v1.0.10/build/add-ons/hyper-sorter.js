(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function Hypersorter(grid, objects) {
    this.grid = grid;
    objects = objects || {};

    getPrototype('Hypergrid', grid).mixIn(require('./mix-ins/grid'));
    getPrototype('Behavior', grid.behavior).mixIn(require('./mix-ins/behavior'));
    getPrototype('Column', grid.behavior.allColumns.length && grid.behavior.allColumns[0]).mixIn(require('./mix-ins/column'));
    getPrototype('DataModel', grid.behavior.dataModel).mixIn(require('./mix-ins/dataModel'));

    this.grid.addEventListener('fin-column-sort', function(c, keys){
        grid.toggleSort(c, keys);
    });

    function getPrototype(name, instance, mixin) {
        var object = objects[name];
        return object && object.prototype || Object.getPrototypeOf(instance);
    }
}

Hypersorter.prototype = {
    constructor: Hypersorter,
    $$CLASS_NAME: 'hypersorter',
    state: {
        sorts: []
    },
    /**
     * @implements sorterAPI
     * @desc Notes regarding specific properties:
     * * `sorts` The array of objects describe the sort state of each column including type, direction and column index
     * * `type` Notification that a column within the sorts type has changed
     * @memberOf Hypersorter.prototype
     */
    properties: function(properties) {
        var result, value, object,
            dm = this.grid.behavior.dataModel;
        if (properties && properties.column) {
            object = dm.getColumnSortState(properties.column.index);
        }  else {
            object = this.state;
        }

        if (properties && object) {
            if (properties.getPropName) {
                result = object[properties.getPropName];
                if (result === undefined) {
                    result = null;
                }
            } else {
                for (var key in properties) {
                    value = properties[key];
                    if (value === undefined) {
                        delete object[key];
                    } else if (typeof value === 'function') {
                        object[key] = value();
                    } else {
                        object[key] = value;
                    }
                }
            }
        }

        return result;
    }
};

window.fin.Hypergrid.Hypersorter = Hypersorter;

},{"./mix-ins/behavior":2,"./mix-ins/column":3,"./mix-ins/dataModel":4,"./mix-ins/grid":5}],2:[function(require,module,exports){
'use strict';

module.exports = {

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
        var dirty = removeHiddenColumns(
            this.getSortedColumnIndexes(),
            (hiddenColumns || this.getHiddenColumns())
        );
        if (dirty){
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
        var sorts = this.getSortedColumnIndexes(),
            result = this.getColumnSortState(column.index),
            sortPosition = result.sortPosition;

        if (sortPosition > -1) {
            sorts.splice(sortPosition, 1); //Removed from sorts
            if (!deferred) {
                this.sorter.prop('columnSorts', sorts);
                this.reindex();
            }
        }
        this.serializeSortState();
    },

    getColumnSortState: function(columnIndex){
        var sorts = this.getSortedColumnIndexes(),
            sortPosition = -1,
            sortSpec = sorts.find(function(spec, index) {
                sortPosition = index;
                return spec.columnIndex === columnIndex;
            });
        return {sortSpec: sortSpec, sortPosition: sortPosition};
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @param column
     * @param {string[]} keys
     * @return {object[]} sorts
     */
    incrementSortState: function(column, keys) {
        var sorts = this.getSortedColumnIndexes(),
            columnIndex = column.index,
            columnSchema = this.schema[columnIndex],
            sortSpec = this.getColumnSortState(columnIndex).sortSpec;

        if (!sortSpec) { // was unsorted
            if (keys.indexOf('CTRL') < 0) { sorts.length = 0; }
            sorts.unshift({
                columnIndex: columnIndex, // so define and...
                direction: 1, // ...make ascending
                type: columnSchema.type
            });
        } else if (sortSpec.direction > 0) { // was ascending
            sortSpec.direction = -1; // so make descending
        } else { // was descending
            this.unSortColumn(column, true); // so make unsorted
        }

        //Minor improvement, but this check can happe n earlier and terminate earlier
        if (sorts.length > 3) {
            sorts.length = 3;
        }
    },

    serializeSortState: function(){
        this.grid.properties.sorts = this.getSortedColumnIndexes();
    },

    /**
     * @memberOf dataModels.JSON.prototype
     * @desc returns the columns that currently sorted and their intended direction of the sort
     */
    getSortedColumnIndexes: function() {
        return this.sorter.prop('sorts') || [];
    },
    /**
     * @memberOf dataModels.JSON.prototype
     * @param index
     * @param returnAsString
     * @desc Provides the unicode character used to denote visually if a column is a sorted state
     * @returns {*}
     */
    getSortImageForColumn: function(columnIndex) {
        var sorts = this.getSortedColumnIndexes(),
            state = this.getColumnSortState(columnIndex),
            sortSpec = state.sortSpec,
            sortPosition = state.sortPosition,
            result, rank;

        if (sortSpec) {
            var arrow = sortSpec.direction > 0
                ? UPWARDS_BLACK_ARROW
                : DOWNWARDS_BLACK_ARROW;

            result = arrow + ' ';

            if (sorts.length > 1) {
                rank = sorts.length - sortPosition;
                result = rank + result;
            }
        }

        return result;
    }
};

},{}],5:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @memberOf Hypergrid.prototype
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
            //self.behaviorChanged();
            if (self.isColumnAutosizing()) {
                behavior.autosizeAllColumns();
            }
            self.repaint();
        }, 10);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9mYWtlXzEzOGQ5NzZhLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItc29ydGVyL21peC1pbnMvY29sdW1uLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9kYXRhTW9kZWwuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9taXgtaW5zL2dyaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIEh5cGVyc29ydGVyKGdyaWQsIG9iamVjdHMpIHtcbiAgICB0aGlzLmdyaWQgPSBncmlkO1xuICAgIG9iamVjdHMgPSBvYmplY3RzIHx8IHt9O1xuXG4gICAgZ2V0UHJvdG90eXBlKCdIeXBlcmdyaWQnLCBncmlkKS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvZ3JpZCcpKTtcbiAgICBnZXRQcm90b3R5cGUoJ0JlaGF2aW9yJywgZ3JpZC5iZWhhdmlvcikubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2JlaGF2aW9yJykpO1xuICAgIGdldFByb3RvdHlwZSgnQ29sdW1uJywgZ3JpZC5iZWhhdmlvci5hbGxDb2x1bW5zLmxlbmd0aCAmJiBncmlkLmJlaGF2aW9yLmFsbENvbHVtbnNbMF0pLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9jb2x1bW4nKSk7XG4gICAgZ2V0UHJvdG90eXBlKCdEYXRhTW9kZWwnLCBncmlkLmJlaGF2aW9yLmRhdGFNb2RlbCkubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2RhdGFNb2RlbCcpKTtcblxuICAgIHRoaXMuZ3JpZC5hZGRFdmVudExpc3RlbmVyKCdmaW4tY29sdW1uLXNvcnQnLCBmdW5jdGlvbihjLCBrZXlzKXtcbiAgICAgICAgZ3JpZC50b2dnbGVTb3J0KGMsIGtleXMpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZ2V0UHJvdG90eXBlKG5hbWUsIGluc3RhbmNlLCBtaXhpbikge1xuICAgICAgICB2YXIgb2JqZWN0ID0gb2JqZWN0c1tuYW1lXTtcbiAgICAgICAgcmV0dXJuIG9iamVjdCAmJiBvYmplY3QucHJvdG90eXBlIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZihpbnN0YW5jZSk7XG4gICAgfVxufVxuXG5IeXBlcnNvcnRlci5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IEh5cGVyc29ydGVyLFxuICAgICQkQ0xBU1NfTkFNRTogJ2h5cGVyc29ydGVyJyxcbiAgICBzdGF0ZToge1xuICAgICAgICBzb3J0czogW11cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEBpbXBsZW1lbnRzIHNvcnRlckFQSVxuICAgICAqIEBkZXNjIE5vdGVzIHJlZ2FyZGluZyBzcGVjaWZpYyBwcm9wZXJ0aWVzOlxuICAgICAqICogYHNvcnRzYCBUaGUgYXJyYXkgb2Ygb2JqZWN0cyBkZXNjcmliZSB0aGUgc29ydCBzdGF0ZSBvZiBlYWNoIGNvbHVtbiBpbmNsdWRpbmcgdHlwZSwgZGlyZWN0aW9uIGFuZCBjb2x1bW4gaW5kZXhcbiAgICAgKiAqIGB0eXBlYCBOb3RpZmljYXRpb24gdGhhdCBhIGNvbHVtbiB3aXRoaW4gdGhlIHNvcnRzIHR5cGUgaGFzIGNoYW5nZWRcbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJzb3J0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgcHJvcGVydGllczogZnVuY3Rpb24ocHJvcGVydGllcykge1xuICAgICAgICB2YXIgcmVzdWx0LCB2YWx1ZSwgb2JqZWN0LFxuICAgICAgICAgICAgZG0gPSB0aGlzLmdyaWQuYmVoYXZpb3IuZGF0YU1vZGVsO1xuICAgICAgICBpZiAocHJvcGVydGllcyAmJiBwcm9wZXJ0aWVzLmNvbHVtbikge1xuICAgICAgICAgICAgb2JqZWN0ID0gZG0uZ2V0Q29sdW1uU29ydFN0YXRlKHByb3BlcnRpZXMuY29sdW1uLmluZGV4KTtcbiAgICAgICAgfSAgZWxzZSB7XG4gICAgICAgICAgICBvYmplY3QgPSB0aGlzLnN0YXRlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5nZXRQcm9wTmFtZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG9iamVjdFtwcm9wZXJ0aWVzLmdldFByb3BOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydGllc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9iamVjdFtrZXldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIeXBlcnNvcnRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGMgLSBncmlkIGNvbHVtbiBpbmRleC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlzXG4gICAgICovXG4gICAgdG9nZ2xlU29ydDogZnVuY3Rpb24oYywga2V5cykge1xuICAgICAgICB2YXIgY29sdW1uID0gdGhpcy5nZXRBY3RpdmVDb2x1bW4oYyk7XG4gICAgICAgIGlmIChjb2x1bW4pIHtcbiAgICAgICAgICAgIGNvbHVtbi50b2dnbGVTb3J0KGtleXMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzb3J0Q2hhbmdlZDogZnVuY3Rpb24oaGlkZGVuQ29sdW1ucyl7XG4gICAgICAgIHZhciBkaXJ0eSA9IHJlbW92ZUhpZGRlbkNvbHVtbnMoXG4gICAgICAgICAgICB0aGlzLmdldFNvcnRlZENvbHVtbkluZGV4ZXMoKSxcbiAgICAgICAgICAgIChoaWRkZW5Db2x1bW5zIHx8IHRoaXMuZ2V0SGlkZGVuQ29sdW1ucygpKVxuICAgICAgICApO1xuICAgICAgICBpZiAoZGlydHkpe1xuICAgICAgICAgICAgdGhpcy5yZWluZGV4KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG4vL0xvZ2ljIHRvIG1vdmVkIHRvIGFkYXB0ZXIgbGF5ZXIgb3V0c2lkZSBvZiBIeXBlcmdyaWQgQ29yZVxuZnVuY3Rpb24gcmVtb3ZlSGlkZGVuQ29sdW1ucyhvbGRTb3J0ZWQsIGhpZGRlbkNvbHVtbnMpe1xuICAgIHZhciBkaXJ0eSA9IGZhbHNlO1xuICAgIG9sZFNvcnRlZC5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgdmFyIGogPSAwLFxuICAgICAgICAgICAgY29sSW5kZXg7XG4gICAgICAgIHdoaWxlIChqIDwgaGlkZGVuQ29sdW1ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbEluZGV4ID0gaGlkZGVuQ29sdW1uc1tqXS5pbmRleCArIDE7IC8vaGFjayB0byBnZXQgYXJvdW5kIDAgaW5kZXhcbiAgICAgICAgICAgIGlmIChjb2xJbmRleCA9PT0gaSkge1xuICAgICAgICAgICAgICAgIGhpZGRlbkNvbHVtbnNbal0udW5Tb3J0KCk7XG4gICAgICAgICAgICAgICAgZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaisrO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRpcnR5O1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICB0b2dnbGVTb3J0OiBmdW5jdGlvbihrZXlzKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnRvZ2dsZVNvcnQodGhpcywga2V5cyk7XG4gICAgfSxcblxuICAgIHVuU29ydDogZnVuY3Rpb24oZGVmZXJyZWQpIHtcbiAgICAgICAgdGhpcy5kYXRhTW9kZWwudW5Tb3J0Q29sdW1uKHRoaXMsIGRlZmVycmVkKTtcbiAgICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVVBXQVJEU19CTEFDS19BUlJPVyA9ICdcXHUyNWIyJywgLy8gYWthICfilrInXG4gICAgRE9XTldBUkRTX0JMQUNLX0FSUk9XID0gJ1xcdTI1YmMnOyAvLyBha2EgJ+KWvCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBjb2x1bW5cbiAgICAgKiBAcGFyYW0ga2V5c1xuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGNvbHVtbiwga2V5cykge1xuICAgICAgICB0aGlzLmluY3JlbWVudFNvcnRTdGF0ZShjb2x1bW4sIGtleXMpO1xuICAgICAgICB0aGlzLnNlcmlhbGl6ZVNvcnRTdGF0ZSgpO1xuICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICogQHBhcmFtIGNvbHVtblxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZGVmZXJyZWRcbiAgICAgKi9cbiAgICB1blNvcnRDb2x1bW46IGZ1bmN0aW9uKGNvbHVtbiwgZGVmZXJyZWQpIHtcbiAgICAgICAgdmFyIHNvcnRzID0gdGhpcy5nZXRTb3J0ZWRDb2x1bW5JbmRleGVzKCksXG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLmdldENvbHVtblNvcnRTdGF0ZShjb2x1bW4uaW5kZXgpLFxuICAgICAgICAgICAgc29ydFBvc2l0aW9uID0gcmVzdWx0LnNvcnRQb3NpdGlvbjtcblxuICAgICAgICBpZiAoc29ydFBvc2l0aW9uID4gLTEpIHtcbiAgICAgICAgICAgIHNvcnRzLnNwbGljZShzb3J0UG9zaXRpb24sIDEpOyAvL1JlbW92ZWQgZnJvbSBzb3J0c1xuICAgICAgICAgICAgaWYgKCFkZWZlcnJlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc29ydGVyLnByb3AoJ2NvbHVtblNvcnRzJywgc29ydHMpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VyaWFsaXplU29ydFN0YXRlKCk7XG4gICAgfSxcblxuICAgIGdldENvbHVtblNvcnRTdGF0ZTogZnVuY3Rpb24oY29sdW1uSW5kZXgpe1xuICAgICAgICB2YXIgc29ydHMgPSB0aGlzLmdldFNvcnRlZENvbHVtbkluZGV4ZXMoKSxcbiAgICAgICAgICAgIHNvcnRQb3NpdGlvbiA9IC0xLFxuICAgICAgICAgICAgc29ydFNwZWMgPSBzb3J0cy5maW5kKGZ1bmN0aW9uKHNwZWMsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgc29ydFBvc2l0aW9uID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNwZWMuY29sdW1uSW5kZXggPT09IGNvbHVtbkluZGV4O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7c29ydFNwZWM6IHNvcnRTcGVjLCBzb3J0UG9zaXRpb246IHNvcnRQb3NpdGlvbn07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICogQHBhcmFtIGNvbHVtblxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGtleXNcbiAgICAgKiBAcmV0dXJuIHtvYmplY3RbXX0gc29ydHNcbiAgICAgKi9cbiAgICBpbmNyZW1lbnRTb3J0U3RhdGU6IGZ1bmN0aW9uKGNvbHVtbiwga2V5cykge1xuICAgICAgICB2YXIgc29ydHMgPSB0aGlzLmdldFNvcnRlZENvbHVtbkluZGV4ZXMoKSxcbiAgICAgICAgICAgIGNvbHVtbkluZGV4ID0gY29sdW1uLmluZGV4LFxuICAgICAgICAgICAgY29sdW1uU2NoZW1hID0gdGhpcy5zY2hlbWFbY29sdW1uSW5kZXhdLFxuICAgICAgICAgICAgc29ydFNwZWMgPSB0aGlzLmdldENvbHVtblNvcnRTdGF0ZShjb2x1bW5JbmRleCkuc29ydFNwZWM7XG5cbiAgICAgICAgaWYgKCFzb3J0U3BlYykgeyAvLyB3YXMgdW5zb3J0ZWRcbiAgICAgICAgICAgIGlmIChrZXlzLmluZGV4T2YoJ0NUUkwnKSA8IDApIHsgc29ydHMubGVuZ3RoID0gMDsgfVxuICAgICAgICAgICAgc29ydHMudW5zaGlmdCh7XG4gICAgICAgICAgICAgICAgY29sdW1uSW5kZXg6IGNvbHVtbkluZGV4LCAvLyBzbyBkZWZpbmUgYW5kLi4uXG4gICAgICAgICAgICAgICAgZGlyZWN0aW9uOiAxLCAvLyAuLi5tYWtlIGFzY2VuZGluZ1xuICAgICAgICAgICAgICAgIHR5cGU6IGNvbHVtblNjaGVtYS50eXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3J0U3BlYy5kaXJlY3Rpb24gPiAwKSB7IC8vIHdhcyBhc2NlbmRpbmdcbiAgICAgICAgICAgIHNvcnRTcGVjLmRpcmVjdGlvbiA9IC0xOyAvLyBzbyBtYWtlIGRlc2NlbmRpbmdcbiAgICAgICAgfSBlbHNlIHsgLy8gd2FzIGRlc2NlbmRpbmdcbiAgICAgICAgICAgIHRoaXMudW5Tb3J0Q29sdW1uKGNvbHVtbiwgdHJ1ZSk7IC8vIHNvIG1ha2UgdW5zb3J0ZWRcbiAgICAgICAgfVxuXG4gICAgICAgIC8vTWlub3IgaW1wcm92ZW1lbnQsIGJ1dCB0aGlzIGNoZWNrIGNhbiBoYXBwZSBuIGVhcmxpZXIgYW5kIHRlcm1pbmF0ZSBlYXJsaWVyXG4gICAgICAgIGlmIChzb3J0cy5sZW5ndGggPiAzKSB7XG4gICAgICAgICAgICBzb3J0cy5sZW5ndGggPSAzO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHNlcmlhbGl6ZVNvcnRTdGF0ZTogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy5ncmlkLnByb3BlcnRpZXMuc29ydHMgPSB0aGlzLmdldFNvcnRlZENvbHVtbkluZGV4ZXMoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAZGVzYyByZXR1cm5zIHRoZSBjb2x1bW5zIHRoYXQgY3VycmVudGx5IHNvcnRlZCBhbmQgdGhlaXIgaW50ZW5kZWQgZGlyZWN0aW9uIG9mIHRoZSBzb3J0XG4gICAgICovXG4gICAgZ2V0U29ydGVkQ29sdW1uSW5kZXhlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNvcnRlci5wcm9wKCdzb3J0cycpIHx8IFtdO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gaW5kZXhcbiAgICAgKiBAcGFyYW0gcmV0dXJuQXNTdHJpbmdcbiAgICAgKiBAZGVzYyBQcm92aWRlcyB0aGUgdW5pY29kZSBjaGFyYWN0ZXIgdXNlZCB0byBkZW5vdGUgdmlzdWFsbHkgaWYgYSBjb2x1bW4gaXMgYSBzb3J0ZWQgc3RhdGVcbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgICBnZXRTb3J0SW1hZ2VGb3JDb2x1bW46IGZ1bmN0aW9uKGNvbHVtbkluZGV4KSB7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuZ2V0U29ydGVkQ29sdW1uSW5kZXhlcygpLFxuICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmdldENvbHVtblNvcnRTdGF0ZShjb2x1bW5JbmRleCksXG4gICAgICAgICAgICBzb3J0U3BlYyA9IHN0YXRlLnNvcnRTcGVjLFxuICAgICAgICAgICAgc29ydFBvc2l0aW9uID0gc3RhdGUuc29ydFBvc2l0aW9uLFxuICAgICAgICAgICAgcmVzdWx0LCByYW5rO1xuXG4gICAgICAgIGlmIChzb3J0U3BlYykge1xuICAgICAgICAgICAgdmFyIGFycm93ID0gc29ydFNwZWMuZGlyZWN0aW9uID4gMFxuICAgICAgICAgICAgICAgID8gVVBXQVJEU19CTEFDS19BUlJPV1xuICAgICAgICAgICAgICAgIDogRE9XTldBUkRTX0JMQUNLX0FSUk9XO1xuXG4gICAgICAgICAgICByZXN1bHQgPSBhcnJvdyArICcgJztcblxuICAgICAgICAgICAgaWYgKHNvcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICByYW5rID0gc29ydHMubGVuZ3RoIC0gc29ydFBvc2l0aW9uO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHJhbmsgKyByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gZXZlbnRcbiAgICAgKi9cbiAgICB0b2dnbGVTb3J0OiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuYWJvcnRFZGl0aW5nKCkpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgdmFyIGJlaGF2aW9yID0gdGhpcy5iZWhhdmlvcixcbiAgICAgICAgICAgIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgYyA9IGV2ZW50LmRldGFpbC5jb2x1bW4sXG4gICAgICAgICAgICBrZXlzID0gIGV2ZW50LmRldGFpbC5rZXlzO1xuICAgICAgICBiZWhhdmlvci50b2dnbGVTb3J0KGMsIGtleXMpO1xuXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLnN5bmNocm9uaXplU2Nyb2xsaW5nQm91bmRhcmllcygpO1xuICAgICAgICAgICAgLy9zZWxmLmJlaGF2aW9yQ2hhbmdlZCgpO1xuICAgICAgICAgICAgaWYgKHNlbGYuaXNDb2x1bW5BdXRvc2l6aW5nKCkpIHtcbiAgICAgICAgICAgICAgICBiZWhhdmlvci5hdXRvc2l6ZUFsbENvbHVtbnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbGYucmVwYWludCgpO1xuICAgICAgICB9LCAxMCk7XG4gICAgfVxuXG59O1xuIl19
