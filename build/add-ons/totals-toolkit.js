(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var totalsToolkit = {
    preinstall: function(Hypergrid) {
        Hypergrid.mixIn(require('./mix-ins/grid'));

        var Behavior = Hypergrid.constructor.behaviors.Behavior;
        Behavior.prototype.mixIn(require('./mix-ins/behavior'));
    }
};

window.fin.Hypergrid.totalsToolkit = totalsToolkit;

},{"./mix-ins/behavior":2,"./mix-ins/grid":3}],2:[function(require,module,exports){
'use strict';

module.exports = {

    /** @typedef {*[]} valueList
     * @desc One of:
     * * `activeColumnsList` falsy - Array of row values semantically congruent to `this.columns`.
     * * `activeColumnsList` truthy - Array of row values semantically congruent to `this.allColumns`.
     */

    /**
     * @param {number} x - Column index. If you have an "active" column index, you can translate it with `this.getActiveColumn(x).index`.
     * @param {number} y - Totals row index, local to the totals area.
     * @param value
     * @param {string|string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     * @memberOf Behavior.prototype
     */
    setTotalsValue: function(x, y, value, areas) {
        if (!areas) {
            areas = [];
            if (this.subgrids.topTotals) { areas.push('top'); }
            if (this.subgrids.bottomTotal) { areas.push('bottom'); }
        } else if (!Array.isArray(areas)) {
            areas = [areas];
        }
        areas.forEach(function(area) {
            this.getTotals(area)[y][x] = value;
        }, this);
        this.grid.setTotalsValueNotification(x, y, value, areas);
    },

    /**
     * @summary Set the top total row(s).
     * @param {valueList[]} [rows] - Array of 0 or more rows containing summary data. Omit to set to empty array.
     * @param {boolean} [activeColumnsList=false]
     * @memberOf Behavior.prototype
     */
    setTopTotals: function(rows, activeColumnsList) {
        return this.setTotals('top', rows, activeColumnsList);
    },

    /**
     * @summary Get the top total row(s).
     * @returns {valueList[]}
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList|*[]} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getTopTotals: function(activeColumnsList) {
        return this.getTotals('top', activeColumnsList);
    },

    /**
     * @summary Set the bottom totals.
     * @param {valueList[]} rows - Array of 0 or more rows containing summary data. Omit to set to empty array.
     * @param {boolean} [activeColumnsList=false] - If `true`, `rows` only contains active columns.
     * @memberOf Behavior.prototype
     */
    setBottomTotals: function(rows, activeColumnsList) {
        return this.setTotals('bottom', rows, activeColumnsList);
    },

    /**
     * @summary Get the bottom total row(s).
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getBottomTotals: function(activeColumnsList) {
        return this.getTotals('bottom', activeColumnsList);
    },

    /**
     *
     * @param {string} key
     * @param {valueList[]} rows
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList[]}
     * @returns {*}
     * @memberOf Behavior.prototype
     */
    setTotals: function(key, rows, activeColumnsList) {
        key += 'Totals';

        var totals = this.subgrids[key];

        if (!totals) {
            throw new this.HypergridError('Expected subgrids.' + key + '.');
        }

        if (!Array.isArray(rows)) {
            // if not an array, fail silently
            rows = [];
        } else if (rows.length && !Array.isArray(rows[0])) {
            // if an unnested array representing a single row, nest it
            rows = [rows];
        }

        if (activeColumnsList) {
            rows.forEach(function(row, i, rows) {
                rows[i] = this.expandActiveRowToDataRow(row);
            }, this);
        }

        var newRowCount = rows.length,
            oldRowCount = totals.getRowCount();

        totals.setData(rows);

        if (newRowCount === oldRowCount) {
            this.grid.repaint();
        } else {
            this.grid.behavior.shapeChanged();
        }

        return rows;
    },

    /**
     *
     * @param key
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList} Full data row object, or object containing just the "active" columns, per `activeColumnsList`.
     * @memberOf Behavior.prototype
     */
    getTotals: function(key, activeColumnsList) {
        key += 'Totals';

        var rows = this.subgrids[key];
        rows = rows ? rows.getData() : [];

        if (activeColumnsList) {
            rows.forEach(function(row, i, rows) {
                rows[i] = this.collapseDataRowToActiveRow(row);
            }, this);
        }

        return rows;
    },

    /**
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList}
     * @memberOf Behavior.prototype
     */
    expandActiveRowToDataRow: function(activeColumnValues) {
        var dataRow = Array(this.allColumns.length);

        this.columns.forEach(function(column, i) {
            if (activeColumnValues[i] !== undefined) {
                dataRow[column.index] = activeColumnValues[i];
            }
        });

        return dataRow;
    },

    /**
     * @param {boolean} [activeColumnsList=false]
     * @returns {valueList}
     * @memberOf Behavior.prototype
     */
    collapseDataRowToActiveRow: function(allColumnValues) {
        var dataRow = Array(this.columns.length);

        this.columns.forEach(function(column, i) {
            if (allColumnValues[column.index] !== undefined) {
                dataRow[i] = allColumnValues[column.index];
            }
        });

        return dataRow;
    }

};

},{}],3:[function(require,module,exports){
/* eslint-env browser */

'use strict';

module.exports = {

    /**
     * @memberOf Hypergrid.prototype
     * @param {number} x - column index
     * @param {number} y - totals row index local to the totals area
     * @param value
     * @param {string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     */
    setTotalsValueNotification: function(x, y, value, areas) {
        this.fireSyntheticSetTotalsValue(x, y, value, areas);
    },

    /**
     * @memberOf Hypergrid.prototype
     * @param {number} x - column index
     * @param {number} y - totals row index local to the totals area
     * @param value
     * @param {string[]} [areas=['top', 'bottom']] - may include `'top'` and/or `'bottom'`
     */
    fireSyntheticSetTotalsValue: function(x, y, value, areas) {
        var clickEvent = new CustomEvent('fin-set-totals-value', {
            detail: {
                x: x,
                y: y,
                value: value,
                areas: areas
            }
        });
        this.canvas.dispatchEvent(clickEvent);
    }

};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy90b3RhbHMtdG9vbGtpdC9mYWtlXzdiOGQ1MWQ2LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9hZGQtb25zL3RvdGFscy10b29sa2l0L21peC1pbnMvYmVoYXZpb3IuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL2FkZC1vbnMvdG90YWxzLXRvb2xraXQvbWl4LWlucy9ncmlkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciB0b3RhbHNUb29sa2l0ID0ge1xuICAgIHByZWluc3RhbGw6IGZ1bmN0aW9uKEh5cGVyZ3JpZCkge1xuICAgICAgICBIeXBlcmdyaWQubWl4SW4ocmVxdWlyZSgnLi9taXgtaW5zL2dyaWQnKSk7XG5cbiAgICAgICAgdmFyIEJlaGF2aW9yID0gSHlwZXJncmlkLmNvbnN0cnVjdG9yLmJlaGF2aW9ycy5CZWhhdmlvcjtcbiAgICAgICAgQmVoYXZpb3IucHJvdG90eXBlLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9iZWhhdmlvcicpKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRvdGFsc1Rvb2xraXQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqIEB0eXBlZGVmIHsqW119IHZhbHVlTGlzdFxuICAgICAqIEBkZXNjIE9uZSBvZjpcbiAgICAgKiAqIGBhY3RpdmVDb2x1bW5zTGlzdGAgZmFsc3kgLSBBcnJheSBvZiByb3cgdmFsdWVzIHNlbWFudGljYWxseSBjb25ncnVlbnQgdG8gYHRoaXMuY29sdW1uc2AuXG4gICAgICogKiBgYWN0aXZlQ29sdW1uc0xpc3RgIHRydXRoeSAtIEFycmF5IG9mIHJvdyB2YWx1ZXMgc2VtYW50aWNhbGx5IGNvbmdydWVudCB0byBgdGhpcy5hbGxDb2x1bW5zYC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gQ29sdW1uIGluZGV4LiBJZiB5b3UgaGF2ZSBhbiBcImFjdGl2ZVwiIGNvbHVtbiBpbmRleCwgeW91IGNhbiB0cmFuc2xhdGUgaXQgd2l0aCBgdGhpcy5nZXRBY3RpdmVDb2x1bW4oeCkuaW5kZXhgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVG90YWxzIHJvdyBpbmRleCwgbG9jYWwgdG8gdGhlIHRvdGFscyBhcmVhLlxuICAgICAqIEBwYXJhbSB2YWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBbYXJlYXM9Wyd0b3AnLCAnYm90dG9tJ11dIC0gbWF5IGluY2x1ZGUgYCd0b3AnYCBhbmQvb3IgYCdib3R0b20nYFxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUb3RhbHNWYWx1ZTogZnVuY3Rpb24oeCwgeSwgdmFsdWUsIGFyZWFzKSB7XG4gICAgICAgIGlmICghYXJlYXMpIHtcbiAgICAgICAgICAgIGFyZWFzID0gW107XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJncmlkcy50b3BUb3RhbHMpIHsgYXJlYXMucHVzaCgndG9wJyk7IH1cbiAgICAgICAgICAgIGlmICh0aGlzLnN1YmdyaWRzLmJvdHRvbVRvdGFsKSB7IGFyZWFzLnB1c2goJ2JvdHRvbScpOyB9XG4gICAgICAgIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoYXJlYXMpKSB7XG4gICAgICAgICAgICBhcmVhcyA9IFthcmVhc107XG4gICAgICAgIH1cbiAgICAgICAgYXJlYXMuZm9yRWFjaChmdW5jdGlvbihhcmVhKSB7XG4gICAgICAgICAgICB0aGlzLmdldFRvdGFscyhhcmVhKVt5XVt4XSA9IHZhbHVlO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgdGhpcy5ncmlkLnNldFRvdGFsc1ZhbHVlTm90aWZpY2F0aW9uKHgsIHksIHZhbHVlLCBhcmVhcyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCB0aGUgdG9wIHRvdGFsIHJvdyhzKS5cbiAgICAgKiBAcGFyYW0ge3ZhbHVlTGlzdFtdfSBbcm93c10gLSBBcnJheSBvZiAwIG9yIG1vcmUgcm93cyBjb250YWluaW5nIHN1bW1hcnkgZGF0YS4gT21pdCB0byBzZXQgdG8gZW1wdHkgYXJyYXkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRvcFRvdGFsczogZnVuY3Rpb24ocm93cywgYWN0aXZlQ29sdW1uc0xpc3QpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0VG90YWxzKCd0b3AnLCByb3dzLCBhY3RpdmVDb2x1bW5zTGlzdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEdldCB0aGUgdG9wIHRvdGFsIHJvdyhzKS5cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0W119XG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdHwqW119IEZ1bGwgZGF0YSByb3cgb2JqZWN0LCBvciBvYmplY3QgY29udGFpbmluZyBqdXN0IHRoZSBcImFjdGl2ZVwiIGNvbHVtbnMsIHBlciBgYWN0aXZlQ29sdW1uc0xpc3RgLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUb3BUb3RhbHM6IGZ1bmN0aW9uKGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFRvdGFscygndG9wJywgYWN0aXZlQ29sdW1uc0xpc3QpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgdGhlIGJvdHRvbSB0b3RhbHMuXG4gICAgICogQHBhcmFtIHt2YWx1ZUxpc3RbXX0gcm93cyAtIEFycmF5IG9mIDAgb3IgbW9yZSByb3dzIGNvbnRhaW5pbmcgc3VtbWFyeSBkYXRhLiBPbWl0IHRvIHNldCB0byBlbXB0eSBhcnJheS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV0gLSBJZiBgdHJ1ZWAsIGByb3dzYCBvbmx5IGNvbnRhaW5zIGFjdGl2ZSBjb2x1bW5zLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRCb3R0b21Ub3RhbHM6IGZ1bmN0aW9uKHJvd3MsIGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldFRvdGFscygnYm90dG9tJywgcm93cywgYWN0aXZlQ29sdW1uc0xpc3QpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIGJvdHRvbSB0b3RhbCByb3cocykuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdH0gRnVsbCBkYXRhIHJvdyBvYmplY3QsIG9yIG9iamVjdCBjb250YWluaW5nIGp1c3QgdGhlIFwiYWN0aXZlXCIgY29sdW1ucywgcGVyIGBhY3RpdmVDb2x1bW5zTGlzdGAuXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldEJvdHRvbVRvdGFsczogZnVuY3Rpb24oYWN0aXZlQ29sdW1uc0xpc3QpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VG90YWxzKCdib3R0b20nLCBhY3RpdmVDb2x1bW5zTGlzdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxuICAgICAqIEBwYXJhbSB7dmFsdWVMaXN0W119IHJvd3NcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV1cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0W119XG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRvdGFsczogZnVuY3Rpb24oa2V5LCByb3dzLCBhY3RpdmVDb2x1bW5zTGlzdCkge1xuICAgICAgICBrZXkgKz0gJ1RvdGFscyc7XG5cbiAgICAgICAgdmFyIHRvdGFscyA9IHRoaXMuc3ViZ3JpZHNba2V5XTtcblxuICAgICAgICBpZiAoIXRvdGFscykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuSHlwZXJncmlkRXJyb3IoJ0V4cGVjdGVkIHN1YmdyaWRzLicgKyBrZXkgKyAnLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJvd3MpKSB7XG4gICAgICAgICAgICAvLyBpZiBub3QgYW4gYXJyYXksIGZhaWwgc2lsZW50bHlcbiAgICAgICAgICAgIHJvd3MgPSBbXTtcbiAgICAgICAgfSBlbHNlIGlmIChyb3dzLmxlbmd0aCAmJiAhQXJyYXkuaXNBcnJheShyb3dzWzBdKSkge1xuICAgICAgICAgICAgLy8gaWYgYW4gdW5uZXN0ZWQgYXJyYXkgcmVwcmVzZW50aW5nIGEgc2luZ2xlIHJvdywgbmVzdCBpdFxuICAgICAgICAgICAgcm93cyA9IFtyb3dzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhY3RpdmVDb2x1bW5zTGlzdCkge1xuICAgICAgICAgICAgcm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvdywgaSwgcm93cykge1xuICAgICAgICAgICAgICAgIHJvd3NbaV0gPSB0aGlzLmV4cGFuZEFjdGl2ZVJvd1RvRGF0YVJvdyhyb3cpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV3Um93Q291bnQgPSByb3dzLmxlbmd0aCxcbiAgICAgICAgICAgIG9sZFJvd0NvdW50ID0gdG90YWxzLmdldFJvd0NvdW50KCk7XG5cbiAgICAgICAgdG90YWxzLnNldERhdGEocm93cyk7XG5cbiAgICAgICAgaWYgKG5ld1Jvd0NvdW50ID09PSBvbGRSb3dDb3VudCkge1xuICAgICAgICAgICAgdGhpcy5ncmlkLnJlcGFpbnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ3JpZC5iZWhhdmlvci5zaGFwZUNoYW5nZWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb3dzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBrZXlcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV1cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0fSBGdWxsIGRhdGEgcm93IG9iamVjdCwgb3Igb2JqZWN0IGNvbnRhaW5pbmcganVzdCB0aGUgXCJhY3RpdmVcIiBjb2x1bW5zLCBwZXIgYGFjdGl2ZUNvbHVtbnNMaXN0YC5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0VG90YWxzOiBmdW5jdGlvbihrZXksIGFjdGl2ZUNvbHVtbnNMaXN0KSB7XG4gICAgICAgIGtleSArPSAnVG90YWxzJztcblxuICAgICAgICB2YXIgcm93cyA9IHRoaXMuc3ViZ3JpZHNba2V5XTtcbiAgICAgICAgcm93cyA9IHJvd3MgPyByb3dzLmdldERhdGEoKSA6IFtdO1xuXG4gICAgICAgIGlmIChhY3RpdmVDb2x1bW5zTGlzdCkge1xuICAgICAgICAgICAgcm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvdywgaSwgcm93cykge1xuICAgICAgICAgICAgICAgIHJvd3NbaV0gPSB0aGlzLmNvbGxhcHNlRGF0YVJvd1RvQWN0aXZlUm93KHJvdyk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb3dzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthY3RpdmVDb2x1bW5zTGlzdD1mYWxzZV1cbiAgICAgKiBAcmV0dXJucyB7dmFsdWVMaXN0fVxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHBhbmRBY3RpdmVSb3dUb0RhdGFSb3c6IGZ1bmN0aW9uKGFjdGl2ZUNvbHVtblZhbHVlcykge1xuICAgICAgICB2YXIgZGF0YVJvdyA9IEFycmF5KHRoaXMuYWxsQ29sdW1ucy5sZW5ndGgpO1xuXG4gICAgICAgIHRoaXMuY29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbiwgaSkge1xuICAgICAgICAgICAgaWYgKGFjdGl2ZUNvbHVtblZhbHVlc1tpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YVJvd1tjb2x1bW4uaW5kZXhdID0gYWN0aXZlQ29sdW1uVmFsdWVzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGF0YVJvdztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYWN0aXZlQ29sdW1uc0xpc3Q9ZmFsc2VdXG4gICAgICogQHJldHVybnMge3ZhbHVlTGlzdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgY29sbGFwc2VEYXRhUm93VG9BY3RpdmVSb3c6IGZ1bmN0aW9uKGFsbENvbHVtblZhbHVlcykge1xuICAgICAgICB2YXIgZGF0YVJvdyA9IEFycmF5KHRoaXMuY29sdW1ucy5sZW5ndGgpO1xuXG4gICAgICAgIHRoaXMuY29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbiwgaSkge1xuICAgICAgICAgICAgaWYgKGFsbENvbHVtblZhbHVlc1tjb2x1bW4uaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhUm93W2ldID0gYWxsQ29sdW1uVmFsdWVzW2NvbHVtbi5pbmRleF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkYXRhUm93O1xuICAgIH1cblxufTtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIGNvbHVtbiBpbmRleFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gdG90YWxzIHJvdyBpbmRleCBsb2NhbCB0byB0aGUgdG90YWxzIGFyZWFcbiAgICAgKiBAcGFyYW0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbYXJlYXM9Wyd0b3AnLCAnYm90dG9tJ11dIC0gbWF5IGluY2x1ZGUgYCd0b3AnYCBhbmQvb3IgYCdib3R0b20nYFxuICAgICAqL1xuICAgIHNldFRvdGFsc1ZhbHVlTm90aWZpY2F0aW9uOiBmdW5jdGlvbih4LCB5LCB2YWx1ZSwgYXJlYXMpIHtcbiAgICAgICAgdGhpcy5maXJlU3ludGhldGljU2V0VG90YWxzVmFsdWUoeCwgeSwgdmFsdWUsIGFyZWFzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIGNvbHVtbiBpbmRleFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gdG90YWxzIHJvdyBpbmRleCBsb2NhbCB0byB0aGUgdG90YWxzIGFyZWFcbiAgICAgKiBAcGFyYW0gdmFsdWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbYXJlYXM9Wyd0b3AnLCAnYm90dG9tJ11dIC0gbWF5IGluY2x1ZGUgYCd0b3AnYCBhbmQvb3IgYCdib3R0b20nYFxuICAgICAqL1xuICAgIGZpcmVTeW50aGV0aWNTZXRUb3RhbHNWYWx1ZTogZnVuY3Rpb24oeCwgeSwgdmFsdWUsIGFyZWFzKSB7XG4gICAgICAgIHZhciBjbGlja0V2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdmaW4tc2V0LXRvdGFscy12YWx1ZScsIHtcbiAgICAgICAgICAgIGRldGFpbDoge1xuICAgICAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgYXJlYXM6IGFyZWFzXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNhbnZhcy5kaXNwYXRjaEV2ZW50KGNsaWNrRXZlbnQpO1xuICAgIH1cblxufTtcbiJdfQ==
