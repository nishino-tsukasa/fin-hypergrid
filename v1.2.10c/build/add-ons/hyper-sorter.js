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
            behavior.autosizeAllColumns();
            self.repaint();
        }, 10);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9mYWtlXzI4NGU2NmYxLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItc29ydGVyL21peC1pbnMvY29sdW1uLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1zb3J0ZXIvbWl4LWlucy9kYXRhTW9kZWwuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLXNvcnRlci9taXgtaW5zL2dyaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gSHlwZXJzb3J0ZXIoZ3JpZCwgb2JqZWN0cykge1xuICAgIHRoaXMuZ3JpZCA9IGdyaWQ7XG4gICAgb2JqZWN0cyA9IG9iamVjdHMgfHwge307XG5cbiAgICBnZXRQcm90b3R5cGUoJ0h5cGVyZ3JpZCcsIGdyaWQpLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9ncmlkJykpO1xuICAgIGdldFByb3RvdHlwZSgnQmVoYXZpb3InLCBncmlkLmJlaGF2aW9yKS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvYmVoYXZpb3InKSk7XG4gICAgZ2V0UHJvdG90eXBlKCdDb2x1bW4nLCBncmlkLmJlaGF2aW9yLmFsbENvbHVtbnMubGVuZ3RoICYmIGdyaWQuYmVoYXZpb3IuYWxsQ29sdW1uc1swXSkubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2NvbHVtbicpKTtcbiAgICBnZXRQcm90b3R5cGUoJ0RhdGFNb2RlbCcsIGdyaWQuYmVoYXZpb3IuZGF0YU1vZGVsKS5taXhJbihyZXF1aXJlKCcuL21peC1pbnMvZGF0YU1vZGVsJykpO1xuXG4gICAgdGhpcy5ncmlkLmFkZEV2ZW50TGlzdGVuZXIoJ2Zpbi1jb2x1bW4tc29ydCcsIGZ1bmN0aW9uKGMsIGtleXMpe1xuICAgICAgICBncmlkLnRvZ2dsZVNvcnQoYywga2V5cyk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBnZXRQcm90b3R5cGUobmFtZSwgaW5zdGFuY2UsIG1peGluKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSBvYmplY3RzW25hbWVdO1xuICAgICAgICByZXR1cm4gb2JqZWN0ICYmIG9iamVjdC5wcm90b3R5cGUgfHwgT2JqZWN0LmdldFByb3RvdHlwZU9mKGluc3RhbmNlKTtcbiAgICB9XG59XG5cbkh5cGVyc29ydGVyLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogSHlwZXJzb3J0ZXIsXG4gICAgJCRDTEFTU19OQU1FOiAnaHlwZXJzb3J0ZXInLFxuICAgIHN0YXRlOiB7XG4gICAgICAgIHNvcnRzOiBbXVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogQGltcGxlbWVudHMgc29ydGVyQVBJXG4gICAgICogQGRlc2MgTm90ZXMgcmVnYXJkaW5nIHNwZWNpZmljIHByb3BlcnRpZXM6XG4gICAgICogKiBgc29ydHNgIFRoZSBhcnJheSBvZiBvYmplY3RzIGRlc2NyaWJlIHRoZSBzb3J0IHN0YXRlIG9mIGVhY2ggY29sdW1uIGluY2x1ZGluZyB0eXBlLCBkaXJlY3Rpb24gYW5kIGNvbHVtbiBpbmRleFxuICAgICAqICogYHR5cGVgIE5vdGlmaWNhdGlvbiB0aGF0IGEgY29sdW1uIHdpdGhpbiB0aGUgc29ydHMgdHlwZSBoYXMgY2hhbmdlZFxuICAgICAqIEBtZW1iZXJPZiBIeXBlcnNvcnRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBwcm9wZXJ0aWVzOiBmdW5jdGlvbihwcm9wZXJ0aWVzKSB7XG4gICAgICAgIHZhciByZXN1bHQsIHZhbHVlLCBvYmplY3QsXG4gICAgICAgICAgICBkbSA9IHRoaXMuZ3JpZC5iZWhhdmlvci5kYXRhTW9kZWw7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIHByb3BlcnRpZXMuY29sdW1uKSB7XG4gICAgICAgICAgICBvYmplY3QgPSBkbS5nZXRDb2x1bW5Tb3J0U3RhdGUocHJvcGVydGllcy5jb2x1bW4uaW5kZXgpO1xuICAgICAgICB9ICBlbHNlIHtcbiAgICAgICAgICAgIG9iamVjdCA9IHRoaXMuc3RhdGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvcGVydGllcyAmJiBvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLmdldFByb3BOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gb2JqZWN0W3Byb3BlcnRpZXMuZ2V0UHJvcE5hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBwcm9wZXJ0aWVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgb2JqZWN0W2tleV07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh5cGVyc29ydGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYyAtIGdyaWQgY29sdW1uIGluZGV4LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGtleXNcbiAgICAgKi9cbiAgICB0b2dnbGVTb3J0OiBmdW5jdGlvbihjLCBrZXlzKSB7XG4gICAgICAgIHZhciBjb2x1bW4gPSB0aGlzLmdldEFjdGl2ZUNvbHVtbihjKTtcbiAgICAgICAgaWYgKGNvbHVtbikge1xuICAgICAgICAgICAgY29sdW1uLnRvZ2dsZVNvcnQoa2V5cyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNvcnRDaGFuZ2VkOiBmdW5jdGlvbihoaWRkZW5Db2x1bW5zKXtcbiAgICAgICAgdmFyIGRpcnR5ID0gcmVtb3ZlSGlkZGVuQ29sdW1ucyhcbiAgICAgICAgICAgIHRoaXMuZ2V0U29ydGVkQ29sdW1uSW5kZXhlcygpLFxuICAgICAgICAgICAgKGhpZGRlbkNvbHVtbnMgfHwgdGhpcy5nZXRIaWRkZW5Db2x1bW5zKCkpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChkaXJ0eSl7XG4gICAgICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICAgICAgfVxuICAgIH1cblxufTtcbi8vTG9naWMgdG8gbW92ZWQgdG8gYWRhcHRlciBsYXllciBvdXRzaWRlIG9mIEh5cGVyZ3JpZCBDb3JlXG5mdW5jdGlvbiByZW1vdmVIaWRkZW5Db2x1bW5zKG9sZFNvcnRlZCwgaGlkZGVuQ29sdW1ucyl7XG4gICAgdmFyIGRpcnR5ID0gZmFsc2U7XG4gICAgb2xkU29ydGVkLmZvckVhY2goZnVuY3Rpb24oaSkge1xuICAgICAgICB2YXIgaiA9IDAsXG4gICAgICAgICAgICBjb2xJbmRleDtcbiAgICAgICAgd2hpbGUgKGogPCBoaWRkZW5Db2x1bW5zLmxlbmd0aCkge1xuICAgICAgICAgICAgY29sSW5kZXggPSBoaWRkZW5Db2x1bW5zW2pdLmluZGV4ICsgMTsgLy9oYWNrIHRvIGdldCBhcm91bmQgMCBpbmRleFxuICAgICAgICAgICAgaWYgKGNvbEluZGV4ID09PSBpKSB7XG4gICAgICAgICAgICAgICAgaGlkZGVuQ29sdW1uc1tqXS51blNvcnQoKTtcbiAgICAgICAgICAgICAgICBkaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBqKys7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGlydHk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGtleXMpIHtcbiAgICAgICAgdGhpcy5kYXRhTW9kZWwudG9nZ2xlU29ydCh0aGlzLCBrZXlzKTtcbiAgICB9LFxuXG4gICAgdW5Tb3J0OiBmdW5jdGlvbihkZWZlcnJlZCkge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC51blNvcnRDb2x1bW4odGhpcywgZGVmZXJyZWQpO1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVUFdBUkRTX0JMQUNLX0FSUk9XID0gJ1xcdTI1YjInLCAvLyBha2EgJ+KWsidcbiAgICBET1dOV0FSRFNfQkxBQ0tfQVJST1cgPSAnXFx1MjViYyc7IC8vIGFrYSAn4pa8J1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICogQHBhcmFtIGNvbHVtblxuICAgICAqIEBwYXJhbSBrZXlzXG4gICAgICovXG4gICAgdG9nZ2xlU29ydDogZnVuY3Rpb24oY29sdW1uLCBrZXlzKSB7XG4gICAgICAgIHRoaXMuaW5jcmVtZW50U29ydFN0YXRlKGNvbHVtbiwga2V5cyk7XG4gICAgICAgIHRoaXMuc2VyaWFsaXplU29ydFN0YXRlKCk7XG4gICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gY29sdW1uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkZWZlcnJlZFxuICAgICAqL1xuICAgIHVuU29ydENvbHVtbjogZnVuY3Rpb24oY29sdW1uLCBkZWZlcnJlZCkge1xuICAgICAgICB2YXIgc29ydHMgPSB0aGlzLmdldFNvcnRlZENvbHVtbkluZGV4ZXMoKSxcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuZ2V0Q29sdW1uU29ydFN0YXRlKGNvbHVtbi5pbmRleCksXG4gICAgICAgICAgICBzb3J0UG9zaXRpb24gPSByZXN1bHQuc29ydFBvc2l0aW9uO1xuXG4gICAgICAgIGlmIChzb3J0UG9zaXRpb24gPiAtMSkge1xuICAgICAgICAgICAgc29ydHMuc3BsaWNlKHNvcnRQb3NpdGlvbiwgMSk7IC8vUmVtb3ZlZCBmcm9tIHNvcnRzXG4gICAgICAgICAgICBpZiAoIWRlZmVycmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3J0ZXIucHJvcCgnY29sdW1uU29ydHMnLCBzb3J0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWluZGV4KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXJpYWxpemVTb3J0U3RhdGUoKTtcbiAgICB9LFxuXG4gICAgZ2V0Q29sdW1uU29ydFN0YXRlOiBmdW5jdGlvbihjb2x1bW5JbmRleCl7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuZ2V0U29ydGVkQ29sdW1uSW5kZXhlcygpLFxuICAgICAgICAgICAgc29ydFBvc2l0aW9uID0gLTEsXG4gICAgICAgICAgICBzb3J0U3BlYyA9IHNvcnRzLmZpbmQoZnVuY3Rpb24oc3BlYywgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBzb3J0UG9zaXRpb24gPSBpbmRleDtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3BlYy5jb2x1bW5JbmRleCA9PT0gY29sdW1uSW5kZXg7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHtzb3J0U3BlYzogc29ydFNwZWMsIHNvcnRQb3NpdGlvbjogc29ydFBvc2l0aW9ufTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0gY29sdW1uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5c1xuICAgICAqIEByZXR1cm4ge29iamVjdFtdfSBzb3J0c1xuICAgICAqL1xuICAgIGluY3JlbWVudFNvcnRTdGF0ZTogZnVuY3Rpb24oY29sdW1uLCBrZXlzKSB7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuZ2V0U29ydGVkQ29sdW1uSW5kZXhlcygpLFxuICAgICAgICAgICAgY29sdW1uSW5kZXggPSBjb2x1bW4uaW5kZXgsXG4gICAgICAgICAgICBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYVtjb2x1bW5JbmRleF0sXG4gICAgICAgICAgICBzb3J0U3BlYyA9IHRoaXMuZ2V0Q29sdW1uU29ydFN0YXRlKGNvbHVtbkluZGV4KS5zb3J0U3BlYztcblxuICAgICAgICBpZiAoIXNvcnRTcGVjKSB7IC8vIHdhcyB1bnNvcnRlZFxuICAgICAgICAgICAgaWYgKGtleXMuaW5kZXhPZignQ1RSTCcpIDwgMCkgeyBzb3J0cy5sZW5ndGggPSAwOyB9XG4gICAgICAgICAgICBzb3J0cy51bnNoaWZ0KHtcbiAgICAgICAgICAgICAgICBjb2x1bW5JbmRleDogY29sdW1uSW5kZXgsIC8vIHNvIGRlZmluZSBhbmQuLi5cbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IDEsIC8vIC4uLm1ha2UgYXNjZW5kaW5nXG4gICAgICAgICAgICAgICAgdHlwZTogY29sdW1uU2NoZW1hLnR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKHNvcnRTcGVjLmRpcmVjdGlvbiA+IDApIHsgLy8gd2FzIGFzY2VuZGluZ1xuICAgICAgICAgICAgc29ydFNwZWMuZGlyZWN0aW9uID0gLTE7IC8vIHNvIG1ha2UgZGVzY2VuZGluZ1xuICAgICAgICB9IGVsc2UgeyAvLyB3YXMgZGVzY2VuZGluZ1xuICAgICAgICAgICAgdGhpcy51blNvcnRDb2x1bW4oY29sdW1uLCB0cnVlKTsgLy8gc28gbWFrZSB1bnNvcnRlZFxuICAgICAgICB9XG5cbiAgICAgICAgLy9NaW5vciBpbXByb3ZlbWVudCwgYnV0IHRoaXMgY2hlY2sgY2FuIGhhcHBlIG4gZWFybGllciBhbmQgdGVybWluYXRlIGVhcmxpZXJcbiAgICAgICAgaWYgKHNvcnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgICAgIHNvcnRzLmxlbmd0aCA9IDM7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc2VyaWFsaXplU29ydFN0YXRlOiBmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLmdyaWQucHJvcGVydGllcy5zb3J0cyA9IHRoaXMuZ2V0U29ydGVkQ29sdW1uSW5kZXhlcygpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBkZXNjIHJldHVybnMgdGhlIGNvbHVtbnMgdGhhdCBjdXJyZW50bHkgc29ydGVkIGFuZCB0aGVpciBpbnRlbmRlZCBkaXJlY3Rpb24gb2YgdGhlIHNvcnRcbiAgICAgKi9cbiAgICBnZXRTb3J0ZWRDb2x1bW5JbmRleGVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc29ydGVyLnByb3AoJ3NvcnRzJykgfHwgW107XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBpbmRleFxuICAgICAqIEBwYXJhbSByZXR1cm5Bc1N0cmluZ1xuICAgICAqIEBkZXNjIFByb3ZpZGVzIHRoZSB1bmljb2RlIGNoYXJhY3RlciB1c2VkIHRvIGRlbm90ZSB2aXN1YWxseSBpZiBhIGNvbHVtbiBpcyBhIHNvcnRlZCBzdGF0ZVxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGdldFNvcnRJbWFnZUZvckNvbHVtbjogZnVuY3Rpb24oY29sdW1uSW5kZXgpIHtcbiAgICAgICAgdmFyIHNvcnRzID0gdGhpcy5nZXRTb3J0ZWRDb2x1bW5JbmRleGVzKCksXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuZ2V0Q29sdW1uU29ydFN0YXRlKGNvbHVtbkluZGV4KSxcbiAgICAgICAgICAgIHNvcnRTcGVjID0gc3RhdGUuc29ydFNwZWMsXG4gICAgICAgICAgICBzb3J0UG9zaXRpb24gPSBzdGF0ZS5zb3J0UG9zaXRpb24sXG4gICAgICAgICAgICByZXN1bHQsIHJhbms7XG5cbiAgICAgICAgaWYgKHNvcnRTcGVjKSB7XG4gICAgICAgICAgICB2YXIgYXJyb3cgPSBzb3J0U3BlYy5kaXJlY3Rpb24gPiAwXG4gICAgICAgICAgICAgICAgPyBVUFdBUkRTX0JMQUNLX0FSUk9XXG4gICAgICAgICAgICAgICAgOiBET1dOV0FSRFNfQkxBQ0tfQVJST1c7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGFycm93ICsgJyAnO1xuXG4gICAgICAgICAgICBpZiAoc29ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHJhbmsgPSBzb3J0cy5sZW5ndGggLSBzb3J0UG9zaXRpb247XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gcmFuayArIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkLnByb3RvdHlwZVxuICAgICAqIEBwYXJhbSBldmVudFxuICAgICAqL1xuICAgIHRvZ2dsZVNvcnQ6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5hYm9ydEVkaXRpbmcoKSkgeyByZXR1cm47IH1cblxuICAgICAgICB2YXIgYmVoYXZpb3IgPSB0aGlzLmJlaGF2aW9yLFxuICAgICAgICAgICAgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBjID0gZXZlbnQuZGV0YWlsLmNvbHVtbixcbiAgICAgICAgICAgIGtleXMgPSAgZXZlbnQuZGV0YWlsLmtleXM7XG5cbiAgICAgICAgYmVoYXZpb3IudG9nZ2xlU29ydChjLCBrZXlzKTtcblxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5zeW5jaHJvbml6ZVNjcm9sbGluZ0JvdW5kYXJpZXMoKTtcbiAgICAgICAgICAgIGJlaGF2aW9yLmF1dG9zaXplQWxsQ29sdW1ucygpO1xuICAgICAgICAgICAgc2VsZi5yZXBhaW50KCk7XG4gICAgICAgIH0sIDEwKTtcbiAgICB9XG5cbn07XG4iXX0=
