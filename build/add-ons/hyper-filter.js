(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var DefaultFilter = require('./js/DefaultFilter');
var ColumnSchemaFactory = require('./js/ColumnSchemaFactory');

/**
 * @param {Hypergrid} grid
 * @param {object} [targets] - Hash of mixin targets. These are typically prototype objects. If not given or any targets are missing, defaults to current grid's various prototypes.
 * @constructor
 */
function Hyperfilter(grid, targets) {
    this.grid = grid;
    targets = targets || {};

    mixInTo('Hypergrid', grid, require('./mix-ins/grid'));
    mixInTo('Behavior', grid.behavior, require('./mix-ins/behavior'));
    mixInTo('DataModel', grid.behavior.dataModel, require('./mix-ins/dataModel'));

    function mixInTo(target, instance, mixin) {
        var object = targets[target];
        var prototype = object && object.prototype || Object.getPrototypeOf(instance);

        prototype.mixIn(mixin);
    }
}

Hyperfilter.prototype = {
    constructor: Hyperfilter.prototype.constructor,

    $$CLASS_NAME: 'Hyperfilter',

    /**
     * @type {boolean}
     */
    caseSensitiveData: true,

    /**
     * @type {boolean}
     */
    caseSensitiveColumnNames: true,

    /**
     * @type {boolean}
     */
    resolveAliases: false,

    /**
     * @type {string}
     */
    defaultColumnFilterOperator: '', // blank means use default ('=')

    /**
     * Call this before calling `create` if you want to organize and/or sort your schema.
     */
    deriveSchema: function() {
        this.factory = new ColumnSchemaFactory(this.grid.behavior.columns);
    },
    organizeSchema: function(columnGroupsRegex, options) {
        this.factory.organize(columnGroupsRegex, options);
    },
    sortSchema: function(submenuPlacement) {
        this.factory.sort(submenuPlacement);
    },
    lookupInSchema: function(findOptions, value) {
        return this.factory.lookup(findOptions, value);
    },
    walkSchema: function(iteratee) {
        return this.factory.walk(iteratee);
    },

    /**
     * @param {menuItem[]} [schema] - If omitted, use derived schema. If no derived schema, derive it now.
     */
    create: function(schema) {
        if (!schema) {
            if (!this.factory) {
                this.deriveSchema();
            }
            schema = this.factory.schema;
            delete this.factory; // force new schema each call to create
        }
        return new DefaultFilter({
            schema: schema,
            caseSensitiveData: this.caseSensitiveData,
            caseSensitiveColumnNames: this.caseSensitiveColumnNames,
            resolveAliases: this.resolveAliases,
            defaultColumnFilterOperator: this.defaultColumnFilterOperator
        });
    }
};

window.fin.Hypergrid.Hyperfilter = Hyperfilter;

},{"./js/ColumnSchemaFactory":2,"./js/DefaultFilter":3,"./mix-ins/behavior":5,"./mix-ins/dataModel":6,"./mix-ins/grid":7}],2:[function(require,module,exports){
'use strict';

var popMenu = require('pop-menu');

/**
 * @classdesc Build, organize, and sort a column schema list from a list of columns.
 *
 * FilterTree requires a column schema. As a fallback when you don't have a column schema of your own, the string array returned by behavior.dataModel.getFields() would work as is. This factory object will do a little better than that, taking Hypergrid's column array and creating a more textured column schema, including column aliases and types.
 *
 * CAVEAT: Set up the schema completely before instantiating your filter state. Filter-tree uses the schema (in part) to generate column selection drop-downs as part of its "query builder" UI. Note that the UI is *not* automatically updated if you change the schema later.
 *
 * @param {Column[]} columns
 * @constructor
 */
function ColumnSchemaFactory(columns) {
    /**
     * This is the output produced by the factory.
     * @type {menuItem[]}
     */
    this.schema = columns.map(function(column) {
        var item = {
            name: column.name,
            alias: column.header,
            type: column.getType()
        };

        if (column.calculator) {
            item.calculator = column.calculator;
        }

        return item;
    });
}

var placementPrefixMap = {
    top: '\u0000',
    bottom: '\uffff',
    undefined: ''
};

ColumnSchemaFactory.prototype = {

    constructor: ColumnSchemaFactory.prototype.constructor,

    /**
     * Organize schema into submenus.
     * @param {RegExp} columnGroupsRegex - Schema names or aliases that match this are put into a submenu.
     * @param {string} [options.key='name'] - Must be either 'name' or 'alias'.
     */
    organize: function(columnGroupsRegex, options) {
        var key = options && options.key || 'name',
            submenus = {},
            menu = [];

        this.schema.forEach(function(item) {
            var value = item[key],
                group = value.match(columnGroupsRegex);
            if (group) {
                group = group[0];
                if (!(group in submenus)) {
                    submenus[group] = {
                        label: group.toUpperCase(),
                        submenu: []
                    };
                }
                submenus[group].submenu.push(item);
            } else {
                menu.push(item);
            }
        });

        for (var submenuName in submenus) {
            menu.push(submenus[submenuName]);
        }

        this.schema = menu;
    },

    lookup: function(findOptions, value) {
        return popMenu.lookup.apply(this.schema, arguments);
    },

    walk: function(iteratee) {
        return popMenu.walk.apply(this.schema, arguments);
    },

    /**
     * @summary Sort the schema.
     * @desc Walk the menu structure, sorting each submenu until finally the top-level menu is sorted.
     * @param {boolean} [submenuPlacement] - One of:
     * * `'top'` - Place all the submenus at the top of each enclosing submenu.
     * * `'bottom'` - Place all the submenus at the bottom of each enclosing submenu.
     * * `undefined` (or omitted) - Give no special treatment to submenus.
     */
    sort: function(submenuPlacement) {
        var prefix = placementPrefixMap[submenuPlacement];

        this.schema.sort(function recurse(a, b) {
            if (a.label && !a.sorted) {
                a.submenu.sort(recurse);
                a.sorted = true;
            }
            a = a.label ? prefix + a.label : a.alias || a.name || a;
            b = b.label ? prefix + b.label : b.alias || b.name || b;
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }
};

module.exports = ColumnSchemaFactory;

},{"pop-menu":23}],3:[function(require,module,exports){
'use strict';

var _ = require('object-iterators');

var FilterTree = require('filter-tree');
var ParserCQL = require('./parser-CQL');

// Add a property `menuModes` to th e tree, defaulting to `operators` as the only active mode
FilterTree.Node.optionsSchema.menuModes = {
    default: {
        operators: 1
    }
};

// Add `opMenuGroups` to prototype because needed by FilterBox.
FilterTree.Node.prototype.opMenuGroups = FilterTree.Conditionals.groups;

function quote(text) {
    var qt = ParserCQL.qt;
    return qt + text.replace(new RegExp(qt, 'g'), qt + qt) + qt;
}

var likeDresses = [
    { regex: /^(NOT )?LIKE %(.+)%$/i, operator: 'contains' },
    { regex: /^(NOT )?LIKE (.+)%$/i, operator: 'begins' },
    { regex: /^(NOT )?LIKE %(.+)$/i, operator: 'ends' }
];
var regexEscapedLikePatternChars = /\[([_\[\]%])\]/g; // capture all _, [, ], and % chars enclosed in []
var regexLikePatternChar = /[_\[\]%]/; // find any _, [, ], and % chars NOT enclosed in []

// convert certain LIKE expressions to BEGINS, ENDS, CONTAINS
function convertLikeToPseudoOp(result) {
    likeDresses.find(function(dress) {
        var match = result.match(dress.regex);

        if (match) {
            // unescape all LIKE pattern chars escaped with brackets
            var not = (match[1] || '').toLowerCase(),
                operator = dress.operator,
                operand = match[2],
                operandWithoutEscapedChars = operand.replace(regexEscapedLikePatternChars, '');

            // if result has no actua remaining LIKE pattern chars, go with the conversion
            if (!regexLikePatternChar.test(operandWithoutEscapedChars)) {
                operand = operand.replace(regexEscapedLikePatternChars, '$1'); // unescape the escaped chars
                result = not + operator + ' ' + operand;
            }

            return true; // break out of loop
        }
    });

    return result;
}

var conditionalsCQL = new FilterTree.Conditionals();
conditionalsCQL.makeLIKE = function(beg, end, op, originalOp, c) {
    op = originalOp.toLowerCase();
    return op + ' ' + quote(c.operand);
};
conditionalsCQL.makeIN = function(op, c) {
    return op.toLowerCase() + ' (' + c.operand.replace(/\s*,\s*/g, ', ') + ')';
};
conditionalsCQL.make = function(op, c) {
    var numericOperand;
    op = op.toLowerCase();
    if (/\w/.test(op)) { op += ' '; }
    op += c.getType() === 'number' && !isNaN(numericOperand = Number(c.operand))
        ? numericOperand
        : quote(c.operand);
    return op;
};

// replace the default filter tree terminal node constructor with an extension of same
var CustomFilterLeaf = FilterTree.prototype.addEditor({
    getState: function getState(options) {
        var result,
            syntax = options && options.syntax;

        if (syntax === 'CQL') {
            result = this.getSyntax(conditionalsCQL);
            result = convertLikeToPseudoOp(result);
            var defaultOp = this.schema.lookup(this.column).defaultOp || this.root.parserCQL.defaultOp; // mimics logic in parser-CQL.js, line 110
            if (result.toUpperCase().indexOf(defaultOp) === 0) {
                result = result.substr(defaultOp.length);
            }
        } else {
            result = FilterTree.Leaf.prototype.getState.call(this, options);
        }

        return result;
    }
});

FilterTree.prototype.addEditor('Columns');

// Add some node templates by updating shared instance of FilterNode's templates. (OK to mutate shared instance; filter-tree not being used for anything else here. Alternatively, we could have instantiated a new Templates object for our DefaultFilter prototype, although this would only affect tree nodes, not leaf nodes, but that would be ok in this case since the additions below are tree node templates.)
_(FilterTree.Node.prototype.templates).extendOwn({
    columnFilter: [
        '<span class="filter-tree">',
        '   <strong><span>{2} </span></strong><br>',
        '   Match',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
        '   of the following:',
        '   <select>',
        '       <option value="">New expression&hellip;</option>',
        '   </select>',
        '   <ol></ol>',
        '</span>'
    ]
        .join('\n'),

    columnFilters: [
        '<span class="filter-tree filter-tree-type-column-filters">',
        '   Match <strong>all</strong> of the following column filter subexpressions:',
        '   <ol></ol>',
        '</span>'
    ]
        .join('\n')
});

/** @constructor
 *
 * @desc This extension of FilterTree forces a specific tree structure.
 * See {@link makeNewRoot} for a description.
 *
 * See also {@tutorial filter-api}.
 *
 * @param {FilterTreeOptionsObject} options - You should provide a column schema. The easiest approach is to provide a schema for the entire filter tree through `options.schema`.
 *
 * Although not recommended, the column schema can also be embedded in the state object, either at the root, `options.state.schema`, or for any descendant node. For example, a separate schema could be provided for each expression or subexpression that need to render column list drop-downs.
 *
 * NOTE: If `options.state` is undefined, it is defined in `preInitialize()` as a new empty state scaffold (see {@link makeNewRoot}) with the two trunks to hold a table filter and column filters. Expressions and subexpressions can be added to this empty scaffold either programmatically or through the Query Builder UI.
 */
var DefaultFilter = FilterTree.extend('DefaultFilter', {
    preInitialize: function(options) {
        options = options || {};

        // Set up the default "Hyperfilter" profile (see function comments)
        var state = options.state = options.state || this.makeNewRoot();

        // Upon creation of a 'columnFilter' node, force the schema to the one column
        if ((options.type || state && state.type) === 'columnFilter') {
            this.schema = [
                options.parent.root.schema.lookup(state.children[0].column)
            ];
        }

        return [options];
    },

    initialize: function(options) {
        this.cache = {};

        if (!this.parent) {
            this.extractSubtrees();
        }
    },

    postInitialize: function(options) {
        if (this === this.root && !this.parserCQL) {
            this.parserCQL = new ParserCQL(this.conditionals.ops, {
                schema: this.schema,
                defaultOp: options.defaultColumnFilterOperator
            });
        }

        if (this.type === 'columnFilter') {
            this.dontPersist.schema = true;
        }
    },

    /**
     * Create convenience vars to reference the 2 root "Hyperfilter" nodes
     * @memberOf DefaultFilter.prototype
     */
    extractSubtrees: function() {
        var rootNodes = this.root.children;
        this.tableFilter = rootNodes[0];
        this.columnFilters = rootNodes[1];
    },

    /**
     * @summary Make a new empty Hypergrid filter tree state object.
     * @desc This function makes a new default state object as used by Hypergrid, a root with exactly two "trunks."
     *
     * > **Definition:** A *trunk* is defined as a child node with a truthy `keep` property, making this node immune to the usual pruning that would occur when it has no child nodes of its own. To be a true trunk, all ancestor nodes to be trunks as well. Note that the root is a natural trunk; it does not require a `keep` property.
     *
     * The two trunks of the Hypergrid filter are:
     * * The **Table Filter** (left trunk, or `children[0]`), a hierarchy of filter expressions and subexpressions.
     * * The **Column Filters** (right trunk, or `children[1]`), a series of subexpressions, one per active column filter. Each subexpression contains any number of expressions bound to that column but no further subexpressions.
     *
     * The `operator` properties for all subexpressions default to `'op-and'`, which means:
     * * All table filter expressions and subexpressions are AND'd together. (This is just the default and may be changed from the UI.)
     * * All expressions within a column filter subexpression are AND'd together. (This is just the default and may be changed from the UI.)
     * * All column Filters subexpressions are AND'd together. (This may not be changed from UI.)
     * * Finally, the table filter and column filters are AND'd together. (This may not be changed from UI.)
     *
     * @returns {object} A plain object to serve as a filter-tree state object representing a new Hypergrid filter.
     *
     * @memberOf DefaultFilter.prototype
     */
    makeNewRoot: function() {

        this.tableFilter = {
            keep: true,
            children: [
                // table filter expressions and subexpressions go here
            ]
        };

        this.columnFilters = {
            keep: true,
            type: 'columnFilters',
            children: [
                // subexpressions with type 'columnFilter' go here, one for each active column filter
            ]
        };

        var filter = {
            children: [
                this.tableFilter,
                this.columnFilters
            ]
        };

        return filter;
    },

    /**
     * @summary Get the column filter subexpression node.
     * @desc Each column filter subexpression node is a child node of the `columnFilters` trunk of the Hypergrid filter tree.
     * Each such node contains all the column filter expressions for the named column. It will never be empty; if there is no column filter for the named column, it won't exist in `columnFilters`.
     *
     * CAUTION: This is the actual node object. Do not confuse it with the column filter _state_ object (for which see the {@link DefaultFilter#getColumnFilterState|getColumnFilterState()} method).
     * @param {string} columnName
     * @returns {undefined|DefaultFilter} Returns `undefined` if the column filter does not exist.
     * @memberOf DefaultFilter.prototype
     */
    getColumnFilter: function(columnName) {
        return this.columnFilters.children.find(function(columnFilter) {
            return columnFilter.children.length && columnFilter.children[0].column === columnName;
        });
    },

    /** @typedef {object} FilterTreeGetStateOptionsObject
     * See the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeGetStateOptionsObject|type definition} in the filter-tree documentation.
     */

    /** @typedef {object} FilterTreeSetStateOptionsObject
     * See the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeSetStateOptionsObject|type definition} in the filter-tree documentation.
     */

    /**
     * @summary Get a particular column filter's state.
     * @param {string} rawColumnName - Column name for case and alias lookup.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getColumnFilterState: function(rawColumnName, options) {
        var result = '',
            columnSchema = this.schema.lookup(rawColumnName);

        if (columnSchema) {
            var subexpression = this.getColumnFilter(columnSchema.name);

            if (subexpression) {
                if (!(options && options.syntax)) {
                    options = options || {};
                    options.syntax = 'CQL';
                }
                result = subexpression.getState(options);
            }
        }

        return result;
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc Adds CQL support to this.getState(). This function throws parser errors.
     *
     * @param {string} columnName
     *
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`this.root.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     *
     * @param {string} rawColumnName - Column name for case and alias lookup.
     *
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     *
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setColumnFilterState`'s default syntax, `'CQL'`, differs from the other get state methods.
     *
     * @memberOf DefaultFilter.prototype
     */
    setColumnFilterState: function(rawColumnName, state, options) {
        var error,
            subexpression;

        var columnName = this.schema.lookup(rawColumnName).name;

        if (!columnName) {
            throw 'Unknown column name "' + rawColumnName + '"';
        }

        subexpression = this.getColumnFilter(columnName);

        if (state) {
            options = _({}).extend(options); // clone it because we may mutate it below
            options.syntax = options.syntax || 'CQL';

            if (options.syntax === 'CQL') {
                // Convert some CQL state syntax into a filter tree state object.
                // There must be at least one complete expression or `state` will become undefined.
                try {
                    state = this.root.parserCQL.parse(state, columnName);
                    if (state) {
                        options.syntax = 'object';
                    } else {
                        error = new Error('DefaultFilter: No complete expression.');
                    }
                } catch (e) {
                    error = e;
                }
            }

            if (!error) { // parse successful
                if (subexpression) { // subexpression already exists
                    // replace subexpression representing this column
                    subexpression.setState(state, options);
                } else {
                    // add a new subexpression representing this column
                    state = this.parseStateString(state, options); // because .add() only takes object syntax
                    subexpression = this.columnFilters.add(state);
                }

                error = subexpression.invalid(options);
            }
        }

        if (subexpression && (!state || error)) {
            // remove subexpression representing this column
            subexpression.remove();
        }

        if (error) {
            throw error;
        }
    },

    /**
     * @summary Get state of all column filters.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getColumnFiltersState: function(options) {
        if (options && options.syntax === 'CQL') {
            throw 'The CQL syntax is intended for use on a single column filter only. It does not support multiple columns or subexpressions.';
        }
        return this.root.columnFilters.getState(options);
    },

    /**
     * @summary Set state of all column filters.
     * @desc Note that the column filters implementation depends on the nodes having certain meta-data; you should not be calling this without these meta-data being in place. Specifically `type = 'columnFilters'` and  `keep = true` for the column filters subtree and`type = 'columnFilter'` for each individual column filter subexpression. In addition the subtree operators should always be `'op-and'`.
     * @param {string} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     *
     * @returns {undefined|Error|string} `undefined` indicates success.
     *
     * @memberOf DefaultFilter.prototype
     */
    setColumnFiltersState: function(state, options) {
        var error;

        if (state) {
            this.root.columnFilters.setState(state, options);
            error = this.root.columnFilters.invalid(options);
        }

        return error;
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getTableFilterState: function(options) {
        if (options && options.syntax === 'CQL') {
            throw 'The CQL syntax is intended for use on a single column filter only. It does not support multiple columns or subexpressions.';
        }
        return this.root.tableFilter.getState(options);
    },

    /**
     * @param {string} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf DefaultFilter.prototype
     */
    setTableFilterState: function(state, options) {
        var error;

        if (state) {
            this.root.tableFilter.setState(state, options);
            error = this.root.tableFilter.invalid(options);
        } else {
            this.root.tableFilter.children.length = 0;
        }

        return error;
    },

    /**
     * @desc The CQL syntax should only be requested for a subtree containing homogeneous column names and no subexpressions.
     *
     * @param {string} [options.syntax='object'] - If `'CQL'`, walks the tree, returning a string suitable for a Hypergrid filter cell. All other values are forwarded to the prototype's `getState` method for further interpretation.
     *
     * NOTE: CQL is not intended to be used outside the context of a `columnFilters` subexpression.
     *
     * @returns {FilterTreeStateObject}
     *
     * @memberOf DefaultFilter.prototype
     */
    getState: function getState(options) {
        var result,
            syntax = options && options.syntax;

        if (syntax === 'CQL') {
            var operator = this.operator.substr(3); // remove the 'op-' prefix
            result = '';
            this.children.forEach(function(child, idx) {
                if (child) {
                    if (child instanceof CustomFilterLeaf) {
                        if (idx) {
                            result += ' ' + operator + ' ';
                        }
                        result += child.getState(options);
                    } else if (child.children.length) {
                        throw new Error('DefaultFilter: Expected a conditional but found a subexpression. Subexpressions are not supported in CQL (Column Query Language, the filter cell syntax).');
                    }
                }
            });
        } else {
            result = FilterTree.prototype.getState.call(this, options);
        }

        return result;
    },

    /** @summary List of filter properties to be treated as first class objects.
     * @desc On filter property set, for a property value that is a function:
     * * If listed here, function it self is assigned to property.
     * * If _not_ listed here, function will be executed to get value to assign to property.
     * @memberOf DefaultFilter.prototype
     */
    firstClassProperties: {
        calculator: true
    },

    /**
     * @implements dataSourceHelperAPI#properties
     * @desc Notes regarding specific properties:
     * * `caseSensitiveData` (root property) pertains to string compares only. This includes untyped columns, columns typed as strings, typed columns containing data that cannot be coerced to type or when the filter expression operand cannot be coerced. This is a shared property and affects all grids managed by this instance of the app.
     * * `calculator` (column property) Computed column calculator.
     *
     * @returns One of:
     * * **Getter** type call: Value of requested property or `null` if undefined.
     * * **Setter** type call: `undefined`
     *
     * @memberOf DefaultFilter.prototype
     */
    properties: function(properties) {
        var result, value,
            object = properties && properties.column
                ? this.schema.lookup(properties.column.name)
                : this.root;

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
                    } else if (typeof value === 'function' && !this.firstClassProperties[key]) {
                        object[key] = value();
                    } else {
                        object[key] = value;
                    }
                }
            }
        }

        return result;
    }
});


module.exports = DefaultFilter;

},{"./parser-CQL":4,"filter-tree":11,"object-iterators":21}],4:[function(require,module,exports){
'use strict';

var _ = require('object-iterators');

var REGEXP_BOOLS = /\b(AND|OR|NOR)\b/gi,
    EXP = '(.*?)', BR = '\\b',
    PREFIX = '^' + EXP + BR,
    INFIX = BR + EXP + BR,
    POSTFIX = BR + EXP + '$';

function ParserCqlError(message) {
    this.message = message;
}
ParserCqlError.prototype = Object.create(Error.prototype);
ParserCqlError.prototype.name = 'ParserCqlError';

/**
 * @constructor
 *
 * @summary Column Query Language (CQL) parser
 *
 * @author Jonathan Eiten jonathan@openfin.com
 *
 * @desc See {@tutorial CQL} for the grammar.
 *
 * @param {object} operatorsHash - Hash of valid operators.
 * @param {object} [options]
 * @param {menuItem[]} [options.schema] - Column schema for column name/alias validation. Throws an error if name fails validation (but see `resolveAliases`). Omit to skip column name validation.
 * @param {boolean} [options.defaultOp='='] - Default operator for column when not defined in column schema.
 */
function ParserCQL(operatorsHash, options) {
    var operators = [];

    this.schema = options && options.schema;
    this.defaultOp = (options && options.defaultOp || '=').toUpperCase();

    _(operatorsHash).each(function(props, op) {
        if (op !== 'undefined') {
            operators.push(op);
        }
    });

    // Put larger ones first so that in case a smaller one is a substring of a larger one (such as '<' is to '<='), larger one will be matched first.
    operators = operators.sort(descendingByLength);

    // Escape all symbolic (non alpha) operators.
    operators = operators.map(function(op) {
        if (/^[^A-Z]/.test(op)) {
            op = '\\' + op.split('').join('\\');
        }
        return op;
    });

    var symbolicOperators = operators.filter(function(op) { return op[0] === '\\'; }),
        alphaOperators = operators.filter(function(op) { return op[0] !== '\\'; }).join('|');

    if (alphaOperators) {
        alphaOperators = '\\b(' + alphaOperators + ')\\b';
    }
    /** @summary Regex to match any operator.
     * @desc Matches symbolic operators (made up of non-alpha characters) or identifier operators (word-boundary-isolated runs of alphanumeric characters).
     * @type {RegExp}
     */
    this.REGEX_OPERATOR = new RegExp(symbolicOperators.concat(alphaOperators).join('|'), 'ig');

    operators = operators.join('|') // pipe them
        .replace(/\s+/g, '\\s+'); // arbitrary string of whitespace chars -> whitespace regex matcher

    /** @summary Regex to match an operator + optional operator
     * @desc THe operator is optional. The operand may (or may not) be enclosed in parentheses.
     * @desc Match list:
     * 0. _input string_
     * 1. operator
     * 2. outer operand (may include parentheses)
     * 3. inner operand without parentheses (when an operand was given with parentheses)
     * 4. inner operand (when an operand was given without parentheses)
     * @type {RegExp}
     * @private
     * @memberOf ParserCQL.prototype
     */
    this.REGEX_EXPRESSION = new RegExp('^\\s*(' + operators + ')?\\s*(\\(\\s*(.+?)\\s*\\)|(.+?))\\s*$', 'i');

    this.REGEX_LITERAL_TOKENS = new RegExp('\\' + ParserCQL.qt + '(\\d+)' + '\\' + ParserCQL.qt, 'g');

}

/** @summary Operand quotation mark character.
 * @desc Should be a single character (length === 1).
 * @default '"'
 * @type {string}
 */
ParserCQL.qt = '"';

ParserCQL.prototype = {

    constructor: ParserCQL.prototype.constructor,

    /**
     * @summary Extract the boolean operators from an expression chain.
     * @desc Returns list of homogeneous operators transformed to lower case.
     *
     * Throws an error if all the boolean operators in the chain are not identical.
     * @param {string} cql
     * @returns {string[]}
     */
    captureBooleans: function(cql) {
        var booleans = cql.match(REGEXP_BOOLS);
        return booleans && booleans.map(function(bool) {
            return bool.toLowerCase();
        });
    },

    validateBooleans: function(booleans) {
        if (booleans) {
            var heterogeneousOperator = booleans.find(function(op, i) {
                return booleans[i] !== booleans[0];
            });

            if (heterogeneousOperator) {
                throw new ParserCqlError('Expected homogeneous boolean operators. You cannot mix AND, OR, and NOR operators here because the order of operations is ambiguous.\nTip: In Manage Filters, you can group operations with subexpressions in the Query Builder tab or by using parentheses in the SQL tab.');
            }
        }
        return booleans;
    },

    /**
     * @summary Break an expression chain into a list of expressions.
     * @param {string} cql
     * @param {string[]} booleans
     * @returns {string[]}
     */
    captureExpressions: function(cql, booleans) {
        var expressions, re;

        if (booleans) {
            re = new RegExp(PREFIX + booleans.join(INFIX) + POSTFIX, 'i');
            expressions = cql.match(re);
            expressions.shift(); // discard [0] (input)
        } else {
            expressions = [cql];
        }

        return expressions;
    },

    /**
     * @summary Make a list of children out of a list of expressions.
     * @desc Uses only _complete_ expressions (a value OR an operator + a value).
     *
     * Ignores _incomplete_ expressions (empty string OR an operator - a value).
     *
     * @param {string} columnName
     * @param {string[]} expressions
     * @param {string[]} literals - list of literals indexed by token
     *
     * @returns {expressionState[]} where `expressionState` is one of:
     * * `{column: string, operator: string, operand: string}`
     * * `{column: string, operator: string, operand: string, editor: 'Columns'}`
     */
    makeChildren: function(columnName, expressions, literals) {
        var self = this;
        return expressions.reduce(function(children, exp) {
            if (exp) {
                var parts = exp.match(self.REGEX_EXPRESSION);
                if (parts) {
                    var op = parts[1],
                        outerLiteral = parts[2],
                        innerLiteral = parts.slice(3).find(function(part) {
                            return part !== undefined;
                        });

                    op = (op || '').replace(/\s+/g, ' ').trim().toUpperCase();

                    var parenthesized = /^\(.*\)$/.test(outerLiteral),
                        innerOperators = innerLiteral.match(self.REGEX_OPERATOR);

                    if (!parenthesized && innerOperators) {
                        if (op === '' && outerLiteral === innerOperators[0]) {
                            throw new ParserCqlError('Expected an operand.');
                        }

                        throw new ParserCqlError(
                            'Expected operand but found additional operator(s): ' +
                            innerOperators
                                .toString() // convert to comma-separated list
                                .toUpperCase()
                                .replace(/,/g, ', ') // add spaces after the commas
                                .replace(/^([^,]+), ([^,]+)$/, '$1 and $2') // replace only comma with "and"
                                .replace(/(.+,.+), ([^,]+)$/, '$1, and $2') // add "and" after last of several commas
                        );
                    }

                    op = op ||
                        self.schema && self.schema.lookup(columnName).defaultOp || // column's default operator from schema
                        self.defaultOp; // grid's default operator

                    var child = {
                        column: columnName,
                        operator: op
                    };

                    var fieldName = self.schema && self.schema.lookup(innerLiteral);
                    if (fieldName) {
                        child.operand = fieldName.name || fieldName;
                        child.editor = 'Columns';
                    } else {
                        // Find and expand all collapsed literals.
                        child.operand = innerLiteral.replace(self.REGEX_LITERAL_TOKENS, function(match, index) {
                            return literals[index];
                        });
                    }

                    children.push(child);
                }

                return children;
            }
        }, []);
    },

    /**
     * @summary The position of the operator of the expression under the cursor.
     * @param {string} cql - CQL expression under construction.
     * @param {number} cursor - Current cursor's starting position (`input.startSelection`)
     * @returns {{start: number, end: number}}
     */
    getOperatorPosition: function(cql, cursor) {
        // first tokenize literals in case they contain booleans...
        var literals = [];
        cql = tokenizeLiterals(cql, ParserCQL.qt, literals);

        // ...then expand tokens but with x's just for length
        cql = cql.replace(this.REGEX_LITERAL_TOKENS, function(match, index) {
            var length = 1 + literals[index].length + 1; // add quote chars
            return Array(length + 1).join('x');
        });

        var booleans, expressions, position, tabs, end, tab, expression, oldOperator, oldOperatorOffset;

        if ((booleans = this.captureBooleans(cql))) {
            // boolean(s) found so concatenated expressions
            expressions = this.captureExpressions(cql, booleans);
            position = 0;
            tabs = expressions.map(function(expr, idx) { // get starting position of each expression
                var bool = booleans[idx - 1] || '';
                position += expr.length + bool.length;
                return position;
            });

            // find beginning of expression under cursor position
            tabs.find(function(tick, idx) {
                tab = idx;
                return cursor <= tick;
            });

            cursor = tabs[tab - 1] || 0;
            end = cursor += (booleans[tab - 1] || '').length;

            expression = expressions[tab];
        } else {
            // booleans not found so single expression
            cursor = 0;
            end = cql.length;
            expression = cql;
        }

        oldOperatorOffset = expression.search(this.REGEX_OPERATOR);
        if (oldOperatorOffset >= 0) {
            oldOperator = expression.match(this.REGEX_OPERATOR)[0];
            cursor += oldOperatorOffset;
            end = cursor + oldOperator.length;
        }

        return {
            start: cursor,
            end: end
        };
    },

    /**
     * @summary Make a "locked" subexpression definition object from an expression chain.
     * @desc _Locked_ means it is locked to a single field.
     *
     * When there is only a single expression in the chain, the `operator` is omitted (defaults to `'op-and'`).
     *
     * @param {string} cql - A compound CQL expression, consisting of one or more simple expressions all separated by the same logical operator).
     *
     * @param {string} columnName

     * @returns {undefined|{operator: string, children: string[], schema: string[]}}
     * `undefined` when there are no complete expressions
     *
     * @memberOf module:CQL
     */
    parse: function(cql, columnName) {
        // reduce all runs of white space to a single space; then trim
        cql = cql.replace(/\s\s+/g, ' ').trim();

        var literals = [];
        cql = tokenizeLiterals(cql, ParserCQL.qt, literals);

        var booleans = this.validateBooleans(this.captureBooleans(cql)),
            expressions = this.captureExpressions(cql, booleans),
            children = this.makeChildren(columnName, expressions, literals),
            operator = booleans && booleans[0],
            state;

        if (children.length) {
            state = {
                type: 'columnFilter',
                children: children
            };

            if (operator) {
                state.operator = 'op-' + operator;
            }
        }

        return state;
    }
};

function descendingByLength(a, b) {
    return b.length - a.length;
}

/**
 * @summary Collapse literals.
 * @desc Allows reserved words to exist inside a quoted string.
 * Literals are collapsed to a quoted numerical index into the `literals` array.
 * @param {string} text
 * @param {string} qt
 * @param {string[]} literals - Empty array in which to return extracted literals.
 * @returns {string}
 * @memberOf ParserCQL
 * @inner
 */
function tokenizeLiterals(text, qt, literals) {
    literals.length = 0;

    for (
        var i = 0, j = 0, k, innerLiteral;
        (j = text.indexOf(qt, j)) >= 0;
        j += 1 + (i + '').length + 1, i++
    ) {
        k = j;
        do {
            k = text.indexOf(qt, k + 1);
            if (k < 0) {
                throw new ParserCqlError('Quotation marks must be paired; nested quotation marks must be doubled.');
            }
        } while (text[++k] === qt);

        innerLiteral = text
            .slice(++j, --k) // extract
            .replace(new RegExp(qt + qt, 'g'), qt); // unescape escaped quotation marks

        literals.push(innerLiteral);

        text = text.substr(0, j) + i + text.substr(k); // collapse
    }

    return text;
}

module.exports = ParserCQL;

},{"object-iterators":21}],5:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        return this.dataModel.getFilter(columnIndexOrName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state, reapplies the filter to the data source.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        this.dataModel.setFilter(columnIndexOrName, state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getFilters: function(options) {
        return this.dataModel.getFilters(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setFilters: function(state, options) {
        this.dataModel.setFilters(state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getTableFilter: function(options) {
        return this.dataModel.getTableFilter(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setTableFilter: function(state, options) {
        this.dataModel.setTableFilter(state, options);
    },

};

},{}],6:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary Get a particular column filter's state.
     * @param {string} columnName
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        var isIndex = !isNaN(Number(columnIndexOrName)),
            columnName = isIndex ? this.schema[columnIndexOrName].name : columnIndexOrName;

        return this.filter.getColumnFilterState(columnName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state, reapplies the filter to the data source.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        var isIndex = !isNaN(Number(columnIndexOrName)),
            columnName = isIndex ? this.schema[columnIndexOrName].name : columnIndexOrName;

        this.filter.setColumnFilterState(columnName, state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getFilters: function(options) {
        return this.filter.getColumnFiltersState(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setFilters: function(state, options) {
        this.filter.setColumnFiltersState(state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getTableFilter: function(options) {
        return this.filter.getTableFilterState(options);
    },

    /**
     * @summary Set a the table filter state.
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setTableFilter: function(state, options) {
        this.filter.setTableFilterState(state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

};

},{}],7:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        return this.behavior.getFilter(columnIndexOrName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state:
     * * Reapplies the filter to the data source.
     * * Calls `behaviorChanged()` to update the grid canvas.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        if (this.cellEditor) {
            this.cellEditor.hideEditor();
        }
        this.behavior.setFilter(columnIndexOrName, state, options);
        this.behaviorChanged();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getFilters: function(options) {
        return this.behavior.getFilters(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setFilters: function(state, options) {
        if (this.cellEditor) {
            this.cellEditor.hideEditor();
        }
        this.behavior.setFilters(state, options);
        this.behaviorChanged();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getTableFilter: function(options) {
        return this.behavior.getTableFilter(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setTableFilter: function(state, options) {
        this.behavior.setTableFilter(state, options);
        this.behaviorChanged();
    },

};

},{}],8:[function(require,module,exports){
'use strict';

/* eslint-env browser */

/** @namespace cssInjector */

/**
 * @summary Insert base stylesheet into DOM
 *
 * @desc Creates a new `<style>...</style>` element from the named text string(s) and inserts it but only if it does not already exist in the specified container as per `referenceElement`.
 *
 * > Caveat: If stylesheet is for use in a shadow DOM, you must specify a local `referenceElement`.
 *
 * @returns A reference to the newly created `<style>...</style>` element.
 *
 * @param {string|string[]} cssRules
 * @param {string} [ID]
 * @param {undefined|null|Element|string} [referenceElement] - Container for insertion. Overloads:
 * * `undefined` type (or omitted): injects stylesheet at top of `<head>...</head>` element
 * * `null` value: injects stylesheet at bottom of `<head>...</head>` element
 * * `Element` type: injects stylesheet immediately before given element, wherever it is found.
 * * `string` type: injects stylesheet immediately before given first element found that matches the given css selector.
 *
 * @memberOf cssInjector
 */
function cssInjector(cssRules, ID, referenceElement) {
    if (typeof referenceElement === 'string') {
        referenceElement = document.querySelector(referenceElement);
        if (!referenceElement) {
            throw 'Cannot find reference element for CSS injection.';
        }
    } else if (referenceElement && !(referenceElement instanceof Element)) {
        throw 'Given value not a reference element.';
    }

    var container = referenceElement && referenceElement.parentNode || document.head || document.getElementsByTagName('head')[0];

    if (ID) {
        ID = cssInjector.idPrefix + ID;

        if (container.querySelector('#' + ID)) {
            return; // stylesheet already in DOM
        }
    }

    var style = document.createElement('style');
    style.type = 'text/css';
    if (ID) {
        style.id = ID;
    }
    if (cssRules instanceof Array) {
        cssRules = cssRules.join('\n');
    }
    cssRules = '\n' + cssRules + '\n';
    if (style.styleSheet) {
        style.styleSheet.cssText = cssRules;
    } else {
        style.appendChild(document.createTextNode(cssRules));
    }

    if (referenceElement === undefined) {
        referenceElement = container.firstChild;
    }

    container.insertBefore(style, referenceElement);

    return style;
}

/**
 * @summary Optional prefix for `<style>` tag IDs.
 * @desc Defaults to `'injected-stylesheet-'`.
 * @type {string}
 * @memberOf cssInjector
 */
cssInjector.idPrefix = 'injected-stylesheet-';

// Interface
module.exports = cssInjector;

},{}],9:[function(require,module,exports){
'use strict';

var overrider = require('overrider');

/** @namespace extend-me **/

/** @summary Extends an existing constructor into a new constructor.
 *
 * @returns {ChildConstructor} A new constructor, extended from the given context, possibly with some prototype additions.
 *
 * @desc Extends "objects" (constructors), with optional additional code, optional prototype additions, and optional prototype member aliases.
 *
 * > CAVEAT: Not to be confused with Underscore-style .extend() which is something else entirely. I've used the name "extend" here because other packages (like Backbone.js) use it this way. You are free to call it whatever you want when you "require" it, such as `var inherits = require('extend')`.
 *
 * Provide a constructor as the context and any prototype additions you require in the first argument.
 *
 * For example, if you wish to be able to extend `BaseConstructor` to a new constructor with prototype overrides and/or additions, basic usage is:
 *
 * ```javascript
 * var Base = require('extend-me').Base;
 * var BaseConstructor = Base.extend(basePrototype); // mixes in .extend
 * var ChildConstructor = BaseConstructor.extend(childPrototypeOverridesAndAdditions);
 * var GrandchildConstructor = ChildConstructor.extend(grandchildPrototypeOverridesAndAdditions);
 * ```
 *
 * This function (`extend()`) is added to the new extended object constructor as a property `.extend`, essentially making the object constructor itself easily "extendable." (Note: This is a property of each constructor and not a method of its prototype!)
 *
 * @param {string} [extendedClassName] - This is simply added to the prototype as $$CLASS_NAME. Useful for debugging because all derived constructors appear to have the same name ("Constructor") in the debugger.
 *
 * @param {extendedPrototypeAdditionsObject} [prototypeAdditions] - Object with members to copy to new constructor's prototype.
 *
 * @property {boolean} [debug] - See parameter `extendedClassName` _(above)_.
 *
 * @property {object} Base - A convenient base class from which all other classes can be extended.
 *
 * @memberOf extend-me
 */
function extend(extendedClassName, prototypeAdditions) {
    switch (arguments.length) {
        case 0:
            prototypeAdditions = {};
            break;
        case 1:
            switch (typeof extendedClassName) {
                case 'object':
                    prototypeAdditions = extendedClassName;
                    extendedClassName = undefined;
                    break;
                case 'string':
                    prototypeAdditions = {};
                    break;
                default:
                    throw 'Single-parameter overload must be either string or object.';
            }
            break;
        case 2:
            if (typeof extendedClassName !== 'string' || typeof prototypeAdditions !== 'object') {
                throw 'Two-parameter overload must be string, object.';
            }
            break;
        default:
            throw 'Too many parameters';
    }

    function Constructor() {
        if (prototypeAdditions.preInitialize) {
            prototypeAdditions.preInitialize.apply(this, arguments);
        }

        initializePrototypeChain.apply(this, arguments);

        if (prototypeAdditions.postInitialize) {
            prototypeAdditions.postInitialize.apply(this, arguments);
        }
    }

    Constructor.extend = extend;

    var prototype = Constructor.prototype = Object.create(this.prototype);
    prototype.constructor = Constructor;

    if (extendedClassName) {
        prototype.$$CLASS_NAME = extendedClassName;
    }

    overrider(prototype, prototypeAdditions);

    return Constructor;
}

function Base() {}
Base.prototype = {
    constructor: Base.prototype.constructor,
    get super() {
        return Object.getPrototypeOf(Object.getPrototypeOf(this));
    }
};
Base.extend = extend;
extend.Base = Base;

/** @typedef {function} extendedConstructor
 * @property prototype.super - A reference to the prototype this constructor was extended from.
 * @property [extend] - If `prototypeAdditions.extendable` was truthy, this will be a reference to {@link extend.extend|extend}.
 */

/** @typedef {object} extendedPrototypeAdditionsObject
 * @desc All members are copied to the new object. The following have special meaning.
 * @property {function} [initialize] - Additional constructor code for new object. This method is added to the new constructor's prototype. Gets passed new object as context + same args as constructor itself. Called on instantiation after similar function in all ancestors called with same signature.
 * @property {function} [preInitialize] - Called before the `initialize` cascade. Gets passed new object as context + same args as constructor itself.
 * @property {function} [postInitialize] - Called after the `initialize` cascade. Gets passed new object as context + same args as constructor itself.
 */

/** @summary Call all `initialize` methods found in prototype chain, beginning with the most senior ancestor's first.
 * @desc This recursive routine is called by the constructor.
 * 1. Walks back the prototype chain to `Object`'s prototype
 * 2. Walks forward to new object, calling any `initialize` methods it finds along the way with the same context and arguments with which the constructor was called.
 * @private
 * @memberOf extend-me
 */
function initializePrototypeChain() {
    var term = this,
        args = arguments;
    recur(term);

    function recur(obj) {
        var proto = Object.getPrototypeOf(obj);
        if (proto.constructor !== Object) {
            recur(proto);
            if (proto.hasOwnProperty('initialize')) {
                proto.initialize.apply(term, args);
            }
        }
    }
}

module.exports = extend;

},{"overrider":22}],10:[function(require,module,exports){
'use strict';

exports['column-CQL-syntax'] = [
'<li>',
'	<button type="button" class="copy"></button>',
'	<div class="filter-tree-remove-button" title="delete conditional"></div>',
'	{1}:',
'	<input name="{2}" class="{4}" value="{3:encode}">',
'</li>'
].join('\n');

exports['column-SQL-syntax'] = [
'<li>',
'	<button type="button" class="copy"></button>',
'	<div class="filter-tree-remove-button" title="delete conditional"></div>',
'	{1}:',
'	<textarea name="{2}" rows="1" class="{4}">{3:encode}</textarea>',
'</li>'
].join('\n');

exports.columnFilter = [
'<span class="filter-tree">',
'	 <strong><span>{2} </span>column filter subexpression:</strong><br>',
'	 Match',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
'	 of the following:',
'	 <select>',
'		 <option value="">New expression&hellip;</option>',
'	 </select>',
'	 <ol></ol>',
' </span>'
].join('\n');

exports.columnFilters = [
'<span class="filter-tree filter-tree-type-column-filters">',
'	 Match <strong>all</strong> of the following column filters:',
'	 <ol></ol>',
' </span>'
].join('\n');

exports.lockedColumn = [
'<span>',
'	 {1:encode}',
'	 <input type="hidden" value="{2}">',
' </span>'
].join('\n');

exports.note = [
'<div class="footnotes">',
'	<div class="footnote"></div>',
'	<p>Select a new value or delete the expression altogether.</p>',
'</div>'
].join('\n');

exports.notes = [
'<div class="footnotes">',
'	<p>Note the following error conditions:</p>',
'	<ul class="footnote"></ul>',
'	<p>Select new values or delete the expression altogether.</p>',
'</div>'
].join('\n');

exports.optionMissing = [
'The requested value of <span class="field-name">{1:encode}</span>',
'(<span class="field-value">{2:encode}</span>) is not valid.'
].join('\n');

exports.removeButton = [
'<div class="filter-tree-remove-button" title="delete conditional"></div>'
].join('\n');

exports.subtree = [
'<span class="filter-tree">',
'	 Match',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
'	 of the following:',
'	 <select>',
'		 <option value="">New expression&hellip;</option>',
'		 <option value="subexp" style="border-bottom:1px solid black">Subexpression</option>',
'	 </select>',
'	 <ol></ol>',
' </span>'
].join('\n');

},{}],11:[function(require,module,exports){
'use strict';

var _ = require('object-iterators');
var popMenu = require('pop-menu');

var FilterTree = require('./js/FilterTree');
FilterTree.Node = require('./js/FilterNode'); // aka: Object.getPrototypeOf(FilterTree.prototype).constructor
FilterTree.Leaf = require('./js/FilterLeaf'); // aka: FilterTree.prototype.editors.Default

// expose some objects for plug-in access

FilterTree.Conditionals = require('./js/Conditionals');

// FOLLOWING PROPERTIES ARE *** TEMPORARY ***,
// FOR THE DEMO TO ACCESS THESE NODE MODULES.

FilterTree._ = _;
FilterTree.popMenu = popMenu;


module.exports = FilterTree;

},{"./js/Conditionals":12,"./js/FilterLeaf":13,"./js/FilterNode":14,"./js/FilterTree":15,"object-iterators":21,"pop-menu":23}],12:[function(require,module,exports){
/** @module conditionals */

'use strict';

var Base = require('extend-me').Base;
var _ = require('object-iterators');
var regExpLIKE = require('regexp-like');

var IN = 'IN',
    NOT_IN = 'NOT ' + IN,
    LIKE = 'LIKE',
    NOT_LIKE = 'NOT ' + LIKE,
    LIKE_WILD_CARD = '%',
    NIL = '';

var toString;

var defaultIdQts = {
    beg: '"',
    end: '"'
};


/**
 * @constructor
 */
var Conditionals = Base.extend({
    /**
     * @param {sqlIdQtsObject} [options.sqlIdQts={beg:'"',end:'"'}]
     * @memberOf Conditionals#
     */
    initialize: function(options) {
        var idQts = options && options.sqlIdQts;
        if (idQts) {
            this.sqlIdQts = idQts; // only override if defined
        }
    },

    sqlIdQts: defaultIdQts,
    /**
     * @param id
     * @returns {string}
     * @memberOf Conditionals#
     */
    makeSqlIdentifier: function(id) {
        return this.sqlIdQts.beg + id + this.sqlIdQts.end;
    },

    /**
     * @param string
     * @returns {string}
     * @memberOf Conditionals#
     */
    makeSqlString: function(string) {
        return '\'' + sqEsc(string) + '\'';
    },

    /**
     * @memberOf Conditionals#
     */
    makeLIKE: function(beg, end, op, originalOp, c) {
        var escaped = c.operand.replace(/([_\[\]%])/g, '[$1]'); // escape all LIKE reserved chars
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + this.makeSqlString(beg + escaped + end);
    },

    /**
     * @memberOf Conditionals#
     */
    makeIN: function(op, c) {
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + '(\'' + sqEsc(c.operand).replace(/\s*,\s*/g, '\', \'') + '\')';
    },

    /**
     * @memberOf Conditionals#
     */
    make: function(op, c) {
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + c.makeSqlOperand();
    }
});

var ops = Conditionals.prototype.ops = {
    undefined: {
        test: function() { return true; },
        make: function() { return ''; }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<': {
        test: function(a, b) { return a < b; },
        make: function(c) { return this.make('<', c); }
    },
    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<=': {
        test: function(a, b) { return a <= b; },
        make: function(c) { return this.make('<=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '=': {
        test: function(a, b) { return a === b; },
        make: function(c) { return this.make('=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '>=': {
        test: function(a, b) { return a >= b; },
        make: function(c) { return this.make('>=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '>': {
        test: function(a, b) { return a > b; },
        make: function(c) { return this.make('>', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<>': {
        test: function(a, b) { return a !== b; },
        make: function(c) { return this.make('<>', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    LIKE: {
        test: function(a, b) { return regExpLIKE.cached(b, true).test(a); },
        make: function(c) { return this.make(LIKE, c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT LIKE': {
        test: function(a, b) { return !regExpLIKE.cached(b, true).test(a); },
        make: function(c) { return this.make(NOT_LIKE, c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    IN: { // TODO: currently forcing string typing; rework calling code to respect column type
        test: function(a, b) { return inOp(a, b) >= 0; },
        make: function(c) { return this.makeIN(IN, c); },
        operandList: true,
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT IN': { // TODO: currently forcing string typing; rework calling code to respect column type
        test: function(a, b) { return inOp(a, b) < 0; },
        make: function(c) { return this.makeIN(NOT_IN, c); },
        operandList: true,
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    CONTAINS: {
        test: function(a, b) { return containsOp(a, b) >= 0; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, LIKE_WILD_CARD, LIKE, 'CONTAINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT CONTAINS': {
        test: function(a, b) { return containsOp(a, b) < 0; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, LIKE_WILD_CARD, NOT_LIKE, 'NOT CONTAINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    BEGINS: {
        test: function(a, b) { b = toString(b); return beginsOp(a, b.length) === b; },
        make: function(c) { return this.makeLIKE(NIL, LIKE_WILD_CARD, LIKE, 'BEGINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT BEGINS': {
        test: function(a, b) { b = toString(b); return beginsOp(a, b.length) !== b; },
        make: function(c) { return this.makeLIKE(NIL, LIKE_WILD_CARD, NOT_LIKE, 'NOT BEGINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    ENDS: {
        test: function(a, b) { b = toString(b); return endsOp(a, b.length) === b; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, NIL, LIKE, 'ENDS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT ENDS': {
        test: function(a, b) { b = toString(b); return endsOp(a, b.length) !== b; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, NIL, NOT_LIKE, 'NOT ENDS', c); },
        type: 'string'
    }
};

// some synonyms
ops['\u2264'] = ops['<='];  // UNICODE 'LESS-THAN OR EQUAL TO'
ops['\u2265'] = ops['>='];  // UNICODE 'GREATER-THAN OR EQUAL TO'
ops['\u2260'] = ops['<>'];  // UNICODE 'NOT EQUAL TO'

function inOp(a, b) {
    return b
        .trim() // remove leading and trailing space chars
        .replace(/\s*,\s*/g, ',') // remove any white-space chars from around commas
        .split(',') // put in an array
        .indexOf((a + '')); // search array whole matches
}

function containsOp(a, b) {
    return toString(a).indexOf(toString(b));
}

function beginsOp(a, length) {
    return toString(a).substr(0, length);
}

function endsOp(a, length) {
    return toString(a).substr(-length, length);
}

function sqEsc(string) {
    return string.replace(/'/g, '\'\'');
}

var groups = {
    equality: {
        label: 'Equality',
        submenu: ['=']
    },
    inequalities: {
        label: 'Inequalities',
        submenu: [
            '<',
            '\u2264', // UNICODE 'LESS-THAN OR EQUAL TO'; on a Mac, type option-comma (≤)
            '\u2260', // UNICODE 'NOT EQUALS'; on a Mac, type option-equals (≠)
            '\u2265', // UNICODE 'GREATER-THAN OR EQUAL TO'; on a Mac, type option-period (≥)
            '>'
        ]
    },
    sets: {
        label: 'Set scans',
        submenu: ['IN', 'NOT IN']
    },
    strings: {
        label: 'String scans',
        submenu: [
            'CONTAINS', 'NOT CONTAINS',
            'BEGINS', 'NOT BEGINS',
            'ENDS', 'NOT ENDS'
        ]
    },
    patterns: {
        label: 'Pattern scans',
        submenu: ['LIKE', 'NOT LIKE']
    }
};

// add a `name` prop to each group
_(groups).each(function(group, key) { group.name = key; });

/**
 * @memberOf Conditionals
 */
Conditionals.groups = groups;

/** Default operator menu when consisting of all of the groups in {@link module:conditionals.groups|groups}. This menu is used when none of the following is otherwise defined:
 * * The `opMenu` property of the column schema.
 * * The entry in the node's `typeOpMap` hash corresponding to the `type` property of the column schema.
 * * The node's `treeOpMenu` object.
 * @type {menuItem[]}
 * @memberOf Conditionals
 */
Conditionals.defaultOpMenu = [ // hierarchical menu of relational operators
    groups.equality,
    groups.inequalities,
    groups.sets,
    groups.strings,
    groups.patterns
];


// Meant to be called by FilterTree.prototype.setSensitivity only
Conditionals.setToString = function(fn) {
    return (toString = fn);
};

module.exports = Conditionals;

},{"extend-me":9,"object-iterators":21,"regexp-like":24}],13:[function(require,module,exports){
/* eslint-env browser */
/* eslint-disable key-spacing */

'use strict';

var popMenu = require('pop-menu');

var FilterNode = require('./FilterNode');
var Conditionals = require('./Conditionals');


var toString; // set by FilterLeaf.setToString() called from ../index.js


/** @typedef {object} converter
 * @property {function} toType - Returns input value converted to type. Fails silently.
 * @property {function} failed - Tests input value against type, returning `false if type or `true` if not type.
 */

/** @type {converter} */
var numberConverter = {
    toType: Number,
    failed: isNaN
};

/** @type {converter} */
var dateConverter = {
    toType: function(s) { return new Date(s); },
    failed: isNaN
};

/**
 * @typedef {object} filterLeafViewObject
 *
 * @property {HTMLElement} column - A drop-down with options from the `FilterLeaf` instance's schema. Value is the name of the column being tested (i.e., the column to which this conditional expression applies).
 *
 * @property operator - A drop-down with options from {@link columnOpMenu}, {@link typeOpMap}, or {@link treeOpMenu}. Value is the string representation of the operator.
 *
 * @property operand - An input element, such as a drop-down or a text box.
 */

/** @constructor
 * @summary An object that represents a conditional expression node in a filter tree.
 * @desc This object represents a conditional expression. It is always a terminal node in the filter tree; it has no child nodes of its own.
 *
 * A conditional expression is a simple dyadic expression with the following syntax in the UI:
 *
 * > _column operator operand_
 *
 * where:
 * * _column_ is the name of a column from the data row object
 * * _operator_ is the name of an operator from the node's operator list
 * * _operand_ is a literal value to compare against the value in the named column
 *
 * **NOTE:** The {@link ColumnLeaf} extension of this object has a different implementation of _operand_ which is: The name of a column from which to fetch the compare value (from the same data row object) to compare against the value in the named column. See *Extending the conditional expression object* in the {@link http://joneit.github.io/filter-tree/index.html|readme}.
 *
 * The values of the terms of the expression above are stored in the first three properties below. Each of these three properties is set either by `setState()` or by the user via a control in `el`. Note that these properties are not dynamically bound to the UI controls; they are updated by the validation function, `invalid()`.
 *
 * **See also the properties of the superclass:** {@link FilterNode}
 *
 * @property {string} column - Name of the member in the data row objects against which `operand` will be compared. Reflects the value of the `view.column` control after validation.
 *
 * @property {string} operator - Operator symbol. This must match a key in the `this.root.conditionals.ops` hash. Reflects the value of the `view.operator` control after validation.
 *
 * @property {string} operand - Value to compare against the the member of data row named by `column`. Reflects the value of the `view.operand` control, after validation.
 *
 * @property {string} name - Used to describe the object in the UI so user can select an expression editor.
 *
 * @property {string} [type='string'] - The data type of the subexpression if neither the operator nor the column schema defines a type.
 *
 * @property {HTMLElement} el - A `<span>...</span>` element that contains the UI controls. This element is automatically appeneded to the parent `FilterTree`'s `el`. Generated by {@link FilterLeaf#createView|createView}.
 *
 * @property {filterLeafViewObject} view - A hash containing direct references to the controls in `el`. Added by {@link FilterLeaf#createView|createView}.
 */
var FilterLeaf = FilterNode.extend('FilterLeaf', {

    name: 'column = value', // display string for drop-down

    destroy: function() {
        if (this.view) {
            for (var key in this.view) {
                this.view[key].removeEventListener('change', this.onChange);
            }
        }
    },

    /** @summary Create a new view.
     * @desc This new "view" is a group of HTML `Element` controls that completely describe the conditional expression this object represents. This method creates the view, setting `this.el` to point to it, and the members of `this.view` to point to the individual controls therein.
     * @memberOf FilterLeaf#
     */
    createView: function(state) {
        var el = this.el = document.createElement('span');

        el.className = 'filter-tree-editor filter-tree-default';

        if (state && state.column) {
            // State includes column:
            // Operator menu is built later in loadState; we don't need to build it now. The call to
            // getOpMenu below with undefined columnName returns [] resulting in an empty drop-down.
        } else {
            // When state does NOT include column, it's because either:
            // a. column is unknown and op menu will be empty until user chooses a column; or
            // b. column is hard-coded when there's only one possible column as inferable from schema:
            var schema = this.schema && this.schema.length === 1 && this.schema[0],
                columnName = schema && schema.name || schema;
        }

        this.view = {
            column: this.makeElement(this.schema, 'column', this.sortColumnMenu),
            operator: this.makeElement(getOpMenu.call(this, columnName), 'operator'),
            operand: this.makeElement()
        };

        el.appendChild(document.createElement('br'));
    },

    loadState: function(state) {
        var value, el, i, b, selected, ops, thisOp, opMenu, notes;
        if (state) {
            notes = [];
            for (var key in state) {
                if (!FilterNode.optionsSchema[key]) {
                    value = this[key] = state[key];
                    el = this.view[key];
                    switch (el.type) {
                        case 'checkbox':
                        case 'radio':
                            el = document.querySelectorAll('input[name=\'' + el.name + '\']');
                            for (i = 0; i < el.length; i++) {
                                el[i].checked = value.indexOf(el[i].value) >= 0;
                            }
                            break;
                        case 'select-multiple':
                            el = el.options;
                            for (i = 0, b = false; i < el.length; i++, b = b || selected) {
                                selected = value.indexOf(el[i].value) >= 0;
                                el[i].selected = selected;
                            }
                            FilterNode.setWarningClass(el, b);
                            break;
                        default:
                            el.value = value;
                            if (el.value === '' && key === 'operator') {
                                // Operator may be a synonym.
                                ops = this.root.conditionals.ops;
                                thisOp = ops[value];
                                opMenu = getOpMenu.call(this, state.column || this.column);
                                // Check each menu item's op object for equivalency to possible synonym's op object.
                                popMenu.walk.call(opMenu, equiv);
                            }
                            if (!FilterNode.setWarningClass(el)) {
                                notes.push({ key: key, value: value });
                            } else if (key === 'column') {
                                makeOpMenu.call(this, value);
                            }
                    }
                }
            }
            if (notes.length) {
                var multiple = notes.length > 1,
                    templates = this.templates,
                    footnotes = templates.get(multiple ? 'notes' : 'note'),
                    inner = footnotes.querySelector('.footnote');
                notes.forEach(function(note) {
                    var footnote = multiple ? document.createElement('li') : inner;
                    note = templates.get('optionMissing', note.key, note.value);
                    while (note.length) { footnote.appendChild(note[0]); }
                    if (multiple) { inner.appendChild(footnote); }
                });
            }
            this.notesEl = footnotes;
        }
        function equiv(opMenuItem) {
            var opName = opMenuItem.name || opMenuItem;
            if (ops[opName] === thisOp) {
                el.value = opName;
            }
        }
    },

    /**
     * @property {converter} number
     * @property {converter} int - synonym of `number`
     * @property {converter} float - synonym of `number`
     * @property {converter} date
     * @property {converter} string
     */
    converters: {
        number: numberConverter,
        int: numberConverter,
        float: numberConverter,
        date: dateConverter
    },

    /**
     * Called by the parent node's {@link FilterTree#invalid|invalid()} method, which catches the error thrown when invalid.
     *
     * Also performs the following compilation actions:
     * * Copies all `this.view`' values from the DOM to similarly named properties of `this`.
     * * Pre-sets `this.op` and `this.converter` for use in `test`'s tree walk.
     *
     * @param {boolean} [options.throw=false] - Throw an error if missing or invalid value.
     * @param {boolean} [options.focus=false] - Move focus to offending control.
     * @returns {undefined} This is the normal return when valid; otherwise throws error when invalid.
     * @memberOf FilterLeaf#
     */
    invalid: function(options) {
        var elementName, type, focused;

        for (elementName in this.view) {
            var el = this.view[elementName],
                value = controlValue(el).trim();

            if (
                value === '' && elementName === 'operator' && // not in operator menu
                this.root.conditionals.ops[this.operator] && // but valid in operator hash
                !getProperty.call(this, this.column, 'opMustBeInMenu') // and is doesn't have to be in menu to be valid
            ) {
                value = this.operator; // use it as is then
            }

            if (value === '') {
                if (!focused && options && options.focus) {
                    clickIn(el);
                    focused = true;
                }
                if (options && options.throw) {
                    throw new this.Error('Missing or invalid ' + elementName + ' in conditional expression. Complete the expression or remove it.', this);
                }
            } else {
                // Copy each controls's value as a new similarly named property of this object.
                this[elementName] = value;
            }
        }

        this.op = this.root.conditionals.ops[this.operator];

        type = this.getType();

        this.converter = type && type !== 'string' && this.converters[type];

        this.calculator = this.getCalculator();
    },

    getType: function() {
        return this.op.type || getProperty.call(this, this.column, 'type');
    },

    getCalculator: function() {
        return getProperty.call(this, this.column, 'calculator');
    },

    valOrFunc: function(columnName) {
        var result, calculator;
        if (this) {
            result = this[columnName];
            calculator = (typeof result)[0] === 'f' && result || this.calculator;
            if (calculator) {
                result = calculator.call(this, columnName);
            }
        }
        return result || result === 0 || result === false ? result : '';
    },

    p: function(dataRow) {
        return this.valOrFunc.call(dataRow, this.column);
    },

    // To be overridden when operand is a column name (see columns.js).
    q: function() {
        return this.operand;
    },

    test: function(dataRow) {
        var p, q, // untyped versions of args
            P, Q, // typed versions of p and q
            converter;

        // TODO: If a literal (i.e., when this.q is not overridden), q only needs to be fetched ONCE for all rows
        return (
            (p = this.p(dataRow)) === undefined ||
            (q = this.q(dataRow)) === undefined
        )
            ? false // data inaccessible so exclude row
            : (
                (converter = this.converter) &&
                !converter.failed(P = converter.toType(p)) && // attempt to convert data to type
                !converter.failed(Q = converter.toType(q))
            )
                ? this.op.test(P, Q) // both conversions successful: compare as types
                : this.op.test(toString(p), toString(q)); // one or both conversions failed: compare as strings
    },

    toJSON: function() {
        var state = {};
        if (this.editor) {
            state.editor = this.editor;
        }
        for (var key in this.view) {
            state[key] = this[key];
        }
        if (this.schema !== this.parent.schema) {
            state.schema = this.schema;
        }
        return state;
    },

    /**
     * For `'object'` and `'JSON'` note that the subtree's version of `getState` will not call this leaf version of `getState` because the former uses `unstrungify()` and `JSON.stringify()`, respectively, both of which recurse and call `toJSON()` on their own.
     *
     * @param {object} [options='object'] - See the subtree version of {@link FilterTree#getState|getState} for more info.
     *
     * @memberOf FilterLeaf#
     */
    getState: function getState(options) {
        var result = '',
            syntax = options && options.syntax || 'object';

        switch (syntax) {
            case 'object': // see note above
                result = this.toJSON();
                break;
            case 'JSON': // see note above
                result = JSON.stringify(this, null, options && options.space) || '';
                break;
            case 'SQL':
                result = this.getSyntax(this.root.conditionals);
        }

        return result;
    },

    makeSqlOperand: function() {
        return this.root.conditionals.makeSqlString(this.operand); // todo: this should be a number if type is number instead of a string -- but we will have to ensure it is numeric!
    },

    getSyntax: function(conditionals) {
        return this.root.conditionals.ops[this.operator].make.call(conditionals, this);
    },

    /** @summary HTML form controls factory.
     * @desc Creates and appends a text box or a drop-down.
     * > Defined on the FilterTree prototype for access by derived types (alternate filter editors).
     * @returns The new element.
     * @param {menuItem[]} [menu] - Overloads:
     * * If omitted, will create an `<input/>` (text box) element.
     * * If contains only a single option, will create a `<span>...</span>` element containing the string and a `<input type=hidden>` containing the value.
     * * Otherwise, creates a `<select>...</select>` element with these menu items.
     * @param {null|string} [prompt=''] - Adds an initial `<option>...</option>` element to the drop-down with this value, parenthesized, as its `text`; and empty string as its `value`. Omitting creates a blank prompt; `null` suppresses.
     * @param [sort]
     * @memberOf FilterLeaf#
     */
    makeElement: function(menu, prompt, sort) {
        var el, result, options,
            option = menu,
            tagName = menu ? 'SELECT' : 'INPUT';

        // determine if there would be only a single item in the dropdown
        while (option instanceof Array) {
            if (option.length === 1 && !popMenu.isGroupProxy(option[0])) {
                option = option[0];
            } else {
                option = undefined;
            }
        }

        if (option) {
            // hard text when single item
            el = this.templates.get(
                'lockedColumn',
                option.alias || option.name || option,
                option.name || option.alias || option
            );
            result = el.querySelector('input');
        } else {
            options = {
                prompt: prompt,
                sort: sort,
                group: function(groupName) { return Conditionals.groups[groupName]; }
            };

            // make an element
            el = popMenu.build(tagName, menu, options);

            // if it's a textbox, listen for keyup events
            if (el.type === 'text' && this.eventHandler) {
                this.el.addEventListener('keyup', this.eventHandler);
            }

            // handle onchange events
            this.onChange = this.onChange || cleanUpAndMoveOn.bind(this);
            this.el.addEventListener('change', this.onChange);

            FilterNode.setWarningClass(el);
            result = el;
        }

        this.el.appendChild(el);

        return result;
    }
});

/** `change` event handler for all form controls.
 * Rebuilds the operator drop-down as needed.
 * Removes error CSS class from control.
 * Adds warning CSS class from control if blank; removes if not blank.
 * Adds warning CSS class from control if blank; removes if not blank.
 * Moves focus to next non-blank sibling control.
 * @this {FilterLeaf}
 */
function cleanUpAndMoveOn(evt) {
    var el = evt.target;

    // remove `error` CSS class, which may have been added by `FilterLeaf.prototype.invalid`
    el.classList.remove('filter-tree-error');

    // set or remove 'warning' CSS class, as per el.value
    FilterNode.setWarningClass(el);

    if (el === this.view.column) {
        // rebuild operator list according to selected column name or type, restoring selected item
        makeOpMenu.call(this, el.value);
    }

    if (el.value) {
        // find next sibling control, if any
        if (!el.multiple) {
            while ((el = el.nextElementSibling) && (!('name' in el) || el.value.trim() !== '')); // eslint-disable-line curly
        }

        // and click in it (opens select list)
        if (el && el.value.trim() === '') {
            el.value = ''; // rid of any white space
            FilterNode.clickIn(el);
        }
    }

    // forward the event to the application's event handler
    if (this.eventHandler) {
        this.eventHandler(evt);
    }
}

/**
 * @summary Get the node property.
 * @desc Priority ladder:
 * 1. Schema property.
 * 2. Mixin (if given).
 * 3. Node property is final priority.
 * @this {FilterLeaf}
 * @param {string} columnName
 * @param {string} propertyName
 * @param {function|boolean} [mixin] - Optional function or value if schema property undefined. If function, called in context with `propertyName` and `columnName`.
 * @returns {object}
 */
function getProperty(columnName, propertyName, mixin) {
    var columnSchema = this.schema.lookup(columnName) || {};
    return (
        columnSchema[propertyName] // the expression's column schema property
            ||
        typeof mixin === 'function' && mixin.call(this, columnSchema, propertyName)
            ||
        typeof mixin !== 'function' && mixin
            ||
        this[propertyName] // the expression node's property
    );
}

/**
 * @this {FilterLeaf}
 * @param {string} columnName
 * @returns {undefined|menuItem[]}
 */
function getOpMenu(columnName) {
    return getProperty.call(this, columnName, 'opMenu', function(columnSchema) {
        return this.typeOpMap && this.typeOpMap[columnSchema.type || this.type];
    });
}

/**
 * @this {FilterLeaf}
 * @param {string} columnName
 */
function makeOpMenu(columnName) {
    var opMenu = getOpMenu.call(this, columnName);

    if (opMenu !== this.renderedOpMenu) {
        var newOpDrop = this.makeElement(opMenu, 'operator');

        newOpDrop.value = this.view.operator.value;
        this.el.replaceChild(newOpDrop, this.view.operator);
        this.view.operator = newOpDrop;

        FilterNode.setWarningClass(newOpDrop);

        this.renderedOpMenu = opMenu;
    }
}

function clickIn(el) {
    setTimeout(function() {
        el.classList.add('filter-tree-error');
        FilterNode.clickIn(el);
    }, 0);
}

function controlValue(el) {
    var value, i;

    switch (el.type) {
        case 'checkbox':
        case 'radio':
            el = document.querySelectorAll('input[name=\'' + el.name + '\']:enabled:checked');
            for (value = [], i = 0; i < el.length; i++) {
                value.push(el[i].value);
            }
            break;

        case 'select-multiple':
            el = el.options;
            for (value = [], i = 0; i < el.length; i++) {
                if (!el.disabled && el.selected) {
                    value.push(el[i].value);
                }
            }
            break;

        default:
            value = el.value;
    }

    return value;
}

// Meant to be called by FilterTree.prototype.setSensitivity only
FilterLeaf.setToString = function(fn) {
    toString = fn;
    return Conditionals.setToString(fn);
};


module.exports = FilterLeaf;

},{"./Conditionals":12,"./FilterNode":14,"pop-menu":23}],14:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var _ = require('object-iterators');
var extend = require('extend-me'), Base = extend.Base; extend.debug = true;
var popMenu = require('pop-menu');

var cssInjector = require('./stylesheet');
var Templates = require('./Templates');
var Conditionals = require('./Conditionals');
var ParserSQL = require('./parser-SQL');


var CHILDREN_TAG = 'OL',
    CHILD_TAG = 'LI';

// JSON-detector: begins _and_ ends with either [ and ] _or_ { and }
var reJSON = /^\s*((\[[^]*\])|(\{[^]*\}))\s*$/;

function FilterTreeError(message, node) {
    this.message = message;
    this.node = node;
}
FilterTreeError.prototype = Object.create(Error.prototype);
FilterTreeError.prototype.name = 'FilterTreeError';

/** @typedef {object} FilterTreeSetStateOptionsObject
 *
 * @property {boolean} [syntax='auto'] - Specify parser to use on `state`. One of:
 * * `'auto'` - Auto-detect; see {@link FilterNode#parseStateString} for algorithm.
 * * `'object'` - A raw state object such as that produced by the [getState()]{@link FilterTree#getState} method.
 * * `'JSON'` - A JSON string version of a state object such as that produced by the [getState()]{@link FilterTree#getState} method.
 * * `'SQL'` - A SQL [search condition expression]{@link https://msdn.microsoft.com/en-us/library/ms173545.aspx} string.
 *
 * @param {Element} [context] If defined, the provided input string is used as a selector to an `HTMLElement` contained in `context`. The `value` property of this element is fetched from the DOM and is used as the input state string; proceed as above.
 */

/** @typedef {object} FilterTreeOptionsObject
 *
 * @property {menuItem[]} [schema] - A default list of column names for field drop-downs of all descendant terminal nodes. Overrides `options.state.schema` (see). May be defined for any node and pertains to all descendants of that node (including terminal nodes). If omitted (and no `ownSchema`), will use the nearest ancestor `schema` definition. However, descendants with their own definition of `types` will override any ancestor definition.
 *
 * > Typically only used by the caller for the top-level (root) tree.
 *
 * @property {menuItem[]} [ownSchema] - A default list of column names for field drop-downs of immediate descendant terminal nodes _only_. Overrides `options.state.ownSchema` (see).
 *
 * Although both `options.schema` and `options.ownSchema` are notated as optional herein, by the time a terminal node tries to render a schema drop-down, a `schema` list should be defined through (in order of priority):
 *
 * * Terminal node's own `options.schema` (or `options.state.schema`) definition.
 * * Terminal node's parent node's `option.ownSchema` (or `option.state.nodesFields`) definition.
 * * Terminal node's parent (or any ancestor) node's `options.schema` (or `options.state.schema`) definition.
 *
 * @property {FilterTreeStateObject} [state] - A data structure that describes a tree, subtree, or leaf (terminal node). If undefined, loads an empty filter, which is a `FilterTree` node consisting the default `operator` value (`'op-and'`).
 *
 * @property {function} [editor='Default'] - The name of the conditional expression's UI "editor." This name must be registered in the parent node's {@link FilterTree#editors|editors} hash, where it maps to a leaf constructor (`FilterLeaf` or a descendant thereof). (Use {@link FilterTree#addEditor} to register new editors.)
 *
 * @property {FilterTree} [parent] - Used internally to insert element when creating nested subtrees. The only time it may be (and must be) omitted is when creating the root node.
 *
 * @property {string|HTMLElement} [cssStylesheetReferenceElement] - passed to cssInsert
 */

/** @typedef {object|string} FilterTreeStateObject
 *
 * @summary State with which to create a new node or replace an existing node.
 *
 * @desc A string or plain object that describes a filter-tree node. If a string, it is parsed into an object by {@link FilterNode~parseStateString}. (See, for available overloads.)
 *
 * The resulting object may be a flat object that describes a terminal node or a childless root or branch node; or may be a hierarchical object to define an entire tree or subtree.
 *
 * In any case, the resulting object may have any of the following properties:
 *
 * @property {menuItem[]} [schema] - See `schema` property of {@link FilterTreeOptionsObject}.
 *
 * @property {string} [editor='Default'] - See `editor` property of {@link FilterTreeOptionsObject}.
 *
 * @property misc - Other miscellaneous properties will be copied directly to the new `FitlerNode` object. (The name "misc" here is just a stand-in; there is no specific property called "misc".)
 *
 * * May describe a non-terminal node with properties:
 *   * `schema` - Overridden on instantiation by `options.schema`. If both unspecified, uses parent's definition.
 *   * `operator` - One of {@link treeOperators}.
 *   * `children` -  Array containing additional terminal and non-terminal nodes.
 *
 * The constructor auto-detects `state`'s type:
 *  * JSON string to be parsed by `JSON.parse()` into a plain object
 *  * SQL WHERE clause string to be parsed into a plain object
 *  * CSS selector of an Element whose `value` contains one of the above
 *  * plain object
 */

/**
 * @constructor
 *
 * @summary A node in a filter tree.
 *
 * @description A filter tree represents a _complex conditional expression_ and consists of a single instance of a {@link FilterTree} object as the _root_ of an _n_-ary tree.
 *
 * Filter trees are comprised of instances of `FilterNode` objects. However, the `FilterNode` constructor is an "abstract class"; filter node objects are never instantiated directly from this constructor. A filter tree is actually comprised of instances of two "subclasses" of `FilterNode` objects:
 * * {@link FilterTree} (or subclass thereof) objects, instances of which represent the root node and all the branch nodes:
 *   * There is always exactly one root node, containing the whole filter tree, which represents the filter expression in its entirety. The root node is distinguished by having no parent node.
 *   * There are zero or more branch nodes, or subtrees, which are child nodes of the root or other branches higher up in the tree, representing subexpressions within the larger filter expression. Each branch node has exactly one parent node.
 *   * These nodes point to zero or more child nodes which are either nested subtrees, or:
 * * {@link FilterLeaf} (or subclass thereof) objects, each instance of which represents a single simple conditional expression. These are terminal nodes, having exactly one parent node, and no child nodes.
 *
 * The programmer may extend the semantics of filter trees by extending the above objects.
 *
 * @property {sqlIdQtsObject} [sqlIdQts={beg:'"',end:'"'}] - Quote characters for SQL identifiers. Used for both parsing and generating SQL. Should be placed on the root node.
 *
 * @property {HTMLElement} el - The DOM element created by the `render` method to represent this node. Contains the `el`s for all child nodes (which are themselves pointed to by those nodes). This is always generated but is only in the page DOM if you put it there.
 */

var FilterNode = Base.extend('FilterNode', {

    /**
     * @summary Create a new node or subtree.
     * @desc Typically used by the application layer to create the entire filter tree; and internally, recursively, to create each node including both subtrees and leaves.
     *
     * **Node properties and options:** Nodes are instantiated with:
     * 1. Certain **required properties** which differ for subtrees and leaves.
     * 2. Arbitrary **non-standard option properties** are defined on the `options` object (so long as their names do not conflict with any standard options) and never persist.
     * 3. Certain **standard options properties** as defined in the {@link FilterNode~optionsSchema|optionsSchema} hash, come from various sources, as prioritized as follows:
     *    1. `options` object; does not persist
     *    2. `state`; object; persists
     *    3. `parent` object; persists
     *    4. `default` object; does not persist
     *
     * Notes:
     * 1. "Persists" means output by {@link FilterTree#getState|getState()}.
     * 2. The `parent` object is generated internally for subtrees. It allows standard options to inherit from the parent node.
     * 3. The `default` object comes from the `default` property, if any, of the {@link FilterNode~optionsSchema|schema object} for the standard option in question. Note that once defined, subtrees will then inherit this value.
     * 4. If not defined by any of the above, the standard option remains undefined on the node.
     *
     * **Query Builder UI support:** If your app wants to make use of the generated UI, you are responsible for inserting the top-level `.el` into the DOM. (Otherwise just ignore it.)
     *
     * @param {FilterTreeOptionsObject} [options] - The node state; or an options object possibly containing `state` among other options. Although you can instantiate a filter without any options, this is generally not useful. See *Instantiating a filter* in the {@link http://joneit.github.io/filter-tree/index.html|readme} for a practical discussion of minimum options.
     *
     * * @memberOf FilterNode#
     */
    initialize: function(options) {
        options = options || {};

        /** @summary Reference to this node's parent node.
         * @desc When this property is undefined, this node is the root node.
         * @type {FilterNode}
         * @memberOf FilterNode#
         */
        var parent = this.parent = this.parent || options.parent,
            root = parent && parent.root;

        if (!root) {
            root = this;

            this.stylesheet = this.stylesheet ||
                cssInjector(options.cssStylesheetReferenceElement);

            this.conditionals = new Conditionals(options); // .sqlIdQts

            this.ParserSQL = new ParserSQL(options); // .schema, .caseSensitiveColumnNames, .resolveAliases

            var keys = ['name'];
            if (options.resolveAliases) {
                keys.push('alias');
            }

            this.findOptions = {
                caseSensitive: options.caseSensitiveColumnNames,
                keys: keys
            };
        }

        /** @summary Convenience reference to the root node.
         * @name root
         * @type {FilterNode}
         * @memberOf FilterNode#
         */
        this.root = root;

        this.dontPersist = {}; // hash of truthy values

        this.setState(options.state, options);
    },

    /** Insert each subtree into its parent node along with a "delete" button.
     *
     * NOTE: The root tree (which has no parent) must be inserted into the DOM by the instantiating code (without a delete button).
     * @memberOf FilterNode#
     */
    render: function() {
        if (this.parent) {
            var newListItem = document.createElement(CHILD_TAG);

            if (this.notesEl) {
                newListItem.appendChild(this.notesEl);
            }

            if (!this.keep) {
                var el = this.templates.get('removeButton');
                el.addEventListener('click', this.remove.bind(this));
                newListItem.appendChild(el);
            }

            newListItem.appendChild(this.el);

            this.parent.el.querySelector(CHILDREN_TAG).appendChild(newListItem);
        }
    },

    /**
     *
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options]
     * @memberOf FilterNode#
     */
    setState: function(state, options) {
        var oldEl = this.el;

        state = this.parseStateString(state, options);

        this.mixInStandardOptions(state, options);
        this.mixInNonstandardOptions(options);
        this.createView(state);
        this.loadState(state);
        this.render();

        if (oldEl) {
            var newEl = this.el;
            if (this.parent && oldEl.parentElement.tagName === 'LI') {
                oldEl = oldEl.parentNode;
                newEl = newEl.parentNode;
            }
            oldEl.parentNode.replaceChild(newEl, oldEl);
        }
    },

    /**
     * @summary Convert a string to a state object.
     *
     * @desc They string's syntax is inferred as follows:
     * 1. If state is undefined or already an object, return as is.
     * 2. If `options.context` is defined, `state` is assumed to be a CSS selector string (auto-detected) pointing to an HTML form control with a `value` property, such as a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement HTMLInputElement} or a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement HTMLTextAreaElement}. The element is selected and if found, its value is fetched from the DOM and assigned to `state`.
     * 3. If `options.syntax` is `'auto'`, JSON syntax is detected if `state` begins _and_ ends with either `[` and `]` _or_ `{` and `}` (ignoring leading and trailing white space).
     * 4. If JSON syntax, parse the string into an actual `FilterTreeStateObject` using {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse|JSON.parse} and throw an error if unparsable.
     * 5. If not JSON, parse the string as SQL into an actual `FilterTreeStateObject` using parser-SQL's {@link ParserSQL#parser|parser} and throw an error if unparsable.
     *
     * @param {FilterTreeStateObject} [state]
     * @param {FilterTreeSetStateOptionsObject} [options]
     *
     * @returns {FilterTreeStateObject} The unmolested `state` parameter. Throws an error if `state` is unknown or invalid syntax.
     *
     * @memberOf FilterNode#
     * @inner
     */
    parseStateString: function(state, options) {
        if (state) {
            if (typeof state === 'string') {
                var context = options && options.context,
                    syntax = options && options.syntax || 'auto'; // default is 'auto'

                if (context) {
                    state = context.querySelector(state).value;
                }

                if (syntax === 'auto') {
                    syntax = reJSON.test(state) ? 'JSON' : 'SQL';
                }

                switch (syntax) {
                    case 'JSON':
                        try {
                            state = JSON.parse(state);
                        } catch (error) {
                            throw new FilterTreeError('JSON parser: ' + error);
                        }
                        break;
                    case 'SQL':
                        try {
                            state = this.root.ParserSQL.parse(state);
                        } catch (error) {
                            throw new FilterTreeError('SQL WHERE clause parser: ' + error);
                        }
                        break;
                }
            }

            if (typeof state !== 'object') {
                throw new FilterTreeError('Unexpected input state.');
            }
        }

        return state;
    },

    /**
     * Create each standard option from when found on the `options` or `state` objects, respectively; or if not an "own" option, on the `parent` object or from the options schema default (if any)
     * @param state
     * @param options
     */
    mixInStandardOptions: function(state, options) {
        var node = this;

        _(FilterNode.optionsSchema).each(function(optionSchema, key) {
            if (!optionSchema.ignore && (this !== this.root || optionSchema.rootBound)) {
                var option;

                node.dontPersist[key] = // truthy if from `options` or `default`
                    (option = options && options[key]) !== undefined ||
                    (option = state && state[key]) === undefined &&
                    !(optionSchema.own || node.hasOwnProperty(key) && option !== null) &&
                    !(option = node.parent && node.parent[key]) &&
                    (option = optionSchema.default);

                if (option === null) {
                    delete node[key];
                    node.dontPersist[key] = false;
                } else if (option) {
                    if (key === 'schema' && !option.walk) {
                        // attach the `walk` and `find` convenience methods to the `schema` array
                        option.walk = popMenu.walk.bind(option);
                        option.lookup = popMenu.lookup.bind(option, node.root.findOptions);
                    }
                    node[key] = option;
                }
            }
        });
    },

    /**
     * @param options
     */
    mixInNonstandardOptions: function(options) {
        var node = this;

        // copy all remaining options directly to the new instance, overriding prototype members of the same name
        _(options).each(function(value, key) {
            if (!FilterNode.optionsSchema[key]) {
                node[key] = value;
            }
        });
    },

    /** Remove both:
     * * `this` filter node from it's `parent`'s `children` collection; and
     * * `this` filter node's `el`'s container (always a `<li>` element) from its parent element.
     * @memberOf FilterNode#
     */
    remove: function() {
        var avert,
            parent = this.parent;

        if (parent) {
            if (this.eventHandler) {
                this.eventHandler.call(parent, {
                    type: 'delete',
                    preventDefault: function() { avert = true; }
                });
            }
            if (!avert) {
                if (
                    parent.keep || // never "prune" (remove if empty) this particular subexpression
                    parent.children.length > 1 // this node has siblings so will not be empty after this remove
                ) {
                    // proceed with remove
                    this.el.parentNode.remove(); // the parent is always the containing <li> tag
                    parent.children.splice(parent.children.indexOf(this), 1);
                } else {
                    // recurse to prune entire subexpression because it's prune-able and would end up empty (childless)
                    parent.remove();
                }
            }
        }
    },

    /**
     * Work-around for `this.el.querySelector(':scope>' + selector)` because `:scope` not supported in IE11.
     * @param {string} selector
     */
    firstChildOfType: function(selector) {
        var el = this.el.querySelector(selector);
        if (el && el.parentElement !== this.el) {
            el = null;
        }
        return el;
    },

    Error: FilterTreeError,

    templates: new Templates()
});

/** @typedef optionsSchemaObject
 * @summary Standard option schema
 * @desc Standard options are automatically added to nodes. Data sources for standard options include `options`, `state`, `parent` and `default` (in that order). Describes standard options through various properties:
 * @property {boolean} [ignore] - Do not automatically add to nodes (processed elsewhere).
 * @property {boolean} [own] - Do not automatically add from `parent` or `default`.
 * @property {boolean} [rootBound] - Automatically add to root node only.
 * @property {*} [default] - This is the default data source when all other strategies fail.
 */

/**
 * @summary Defines the standard options available to a node.
 * @desc The following properties bear the same names as the node options they define.
 * @type {object}
 * @memberOf FilterNode
 */
FilterNode.optionsSchema = {

    state: { ignore: true },

    cssStylesheetReferenceElement: { ignore: true },

    /** @summary Default column schema for column drop-downs of direct descendant leaf nodes only.
     * @memberOf FilterNode#
     * @type {string[]}
     */
    ownSchema: { own: true },

    /** @summary Column schema for column drop-downs of all descendant nodes. Pertains to leaf nodes only.
     * @memberOf FilterNode#
     * @type {menuItem[]}
     */
    schema: {},

    /** @summary Filter editor for user interface.
     * @desc Name of filter editor used by this and all descendant nodes. Pertains to leaf nodes only.
     * @default 'Default'
     * @memberOf FilterNode#
     * @type {string}
     */
    editor: {},

    /** @summary Event handler for UI events.
     * @desc See *Events* in the {@link http://joneit.github.io/filter-tree/index.html|readme} for more information.
     * @memberOf FilterNode#
     * @type {function}
     */
    eventHandler: {},

    /** @summary Fields data type.
     * @memberOf FilterNode#
     * @type {string}
     */
    type: { own: true },

    /** @summary Undeleteable node.
     * @desc Truthy means don't render a delete button next to the filter editor for this node.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    keep: { own: true },

    /** @summary Override operator list at any node.
     * @desc The default is applied to the root node and any other node without an operator menu.
     * @default {@link Conditionals.defaultOpMenu}.
     * @memberOf FilterNode#
     * @type {menuItem[]}
     */
    opMenu: { default: Conditionals.defaultOpMenu },

    /** @summary Truthy considers op valid only if in menu.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    opMustBeInMenu: {},

    /** @summary Dictionary of operator menus for specific data types.
     * @memberOf FilterNode#
     * @type {object}
     * @desc A hash of type names. Each member thus defined contains a specific operator menu for all descendant leaf nodes that:
     * 1. do not have their own operator menu (`opMenu` property) of their own; and
     * 2. whose columns resolve to that type.
     *
     * The type is determined by (in priority order):
     * 1. the `type` property of the {@link FilterLeaf}; or
     * 2. the `type` property of the element in the nearest node (including the leaf node itself) that has a defined `ownSchema` or `schema` array property with an element having a matching column name.
     */
    typeOpMap: { rootBound: true },

    /** @summary Truthy will sort the column menus.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    sortColumnMenu: {}
};

FilterNode.setWarningClass = function(el, value) {
    if (arguments.length < 2) {
        value = el.value;
    }
    el.classList[value ? 'remove' : 'add']('filter-tree-warning');
    return value;
};

FilterNode.clickIn = function(el) {
    if (el) {
        if (el.tagName === 'SELECT') {
            setTimeout(function() { el.dispatchEvent(new MouseEvent('mousedown')); }, 0);
        } else {
            el.focus();
        }
    }
};

module.exports = FilterNode;

},{"./Conditionals":12,"./Templates":16,"./parser-SQL":18,"./stylesheet":19,"extend-me":9,"object-iterators":21,"pop-menu":23}],15:[function(require,module,exports){
/* eslint-env browser */

// This is the main file, usable as is, such as by /test/index.js.

// For npm: require this file
// For CDN: gulpfile.js browserifies this file with sourcemap to /build/filter-tree.js and uglified without sourcemap to /build/filter-tree.min.js. The CDN is https://joneit.github.io/filter-tree.

'use strict';

var popMenu = require('pop-menu');
var unstrungify = require('unstrungify');

var _ = require('object-iterators');
var FilterNode = require('./FilterNode');
var FilterLeaf = require('./FilterLeaf');
var operators = require('./tree-operators');


var ordinal = 0;

/** @constructor
 * @summary An object that represents the root node or a branch node in a filter tree.
 * @desc A node representing a subexpression in the filter expression. May be thought of as a parenthesized subexpression in algebraic expression syntax. As discussed under {@link FilterNode}, a `FilterTree` instance's child nodes may be either:
 * * Other (nested) `FilterTree` (or subclass thereof) nodes representing subexpressions.
 * * {@link FilterLeaf} (or subclass thereof) terminal nodes representing conditional expressions.
 *
 * The `FilterTree` object also has methods, some of which operate on a specific subtree instance, and some of which recurse through all the subtree's child nodes and all their descendants, _etc._
 *
 * The recursive methods are interesting. They all work similarly, looping through the list of child nodes, recursing when the child node is a nested subtree (which will recurse further when it has its own nested subtrees); and calling the polymorphic method when the child node is a `FilterLeaf` object, which is a terminal node. Such polymorphic methods include `setState()`, `getState()`, `invalid()`, and `test()`.
 *
 * For example, calling `test(dataRow)` on the root tree recurses through any subtrees eventually calling `test(dataRow)` on each of its leaf nodes and concatenating the results together using the subtree's `operator`. The subtree's `test(dataRow)` call then returns the result to it's parent's `test()` call, _etc.,_ eventually bubbling up to the root node's `test(dataRow)` call, which returns the final result to the original caller. This result determines if the given data row passed through the entire filter expression successfully (`true`) and should be displayed, or was blocked somewhere (`false`) and should not be displayed.
 *
 * Note that in practice:
 * 1. `children` may be empty. This represents a an empty subexpression. Normally pointless, empty subexpressions could be pruned. Filter-tree allows them however as harmless placeholders.
 * 1. `operator` may be omitted in which case it defaults to AND.
 * 1. A `false` result from a child node will short-stop an AND operation; a `true` result will short-stop an OR or NOR operation.
 *
 * Additional notes:
 * 1. A `FilterTree` may consist of a single leaf, in which case the concatenation `operator` is not needed and may be left undefined. However, if a second child is added and the operator is still undefined, it will be set to the default (`'op-and'`).
 * 2. The order of the children is undefined as all operators are commutative. For the '`op-or`' operator, evaluation ceases on the first positive result and for efficiency, all simple conditional expressions will be evaluated before any complex subexpressions.
 * 3. A nested `FilterTree` is distinguished (duck-typed) from a leaf node by the presence of a `children` member.
 * 4. Nesting a `FilterTree` containing a single child is valid (albeit pointless).
 *
 * **See also the properties of the superclass:** {@link FilterNode}
 *
 * @property {string} [operator='op-and'] - The operator that concatentates the test results from all the node's `children` (child nodes). Must be one of:
 * * `'op-and'`
 * * `'op-or'`
 * * `'op-nor'`
 *
 * Note that there is only one `operator` per subexpression. If you need to mix operators, create a subordinate subexpression as one of the child nodes.
 *
 * @property {FilterNode[]} children - A list of descendants of this node. As noted, these may be other `FilterTree` (or subclass thereof) nodes; or may be terminal `FilterLeaf` (or subclass thereof) nodes. May be any length including 0 (none; empty).
 *
 * @property {boolean} [keep=false] - Do not automatically prune when last child removed.
 *
 * @property {fieldItem[]} [ownSchema] - Column menu to be used only by leaf nodes that are children (direct descendants) of this node.
 *
 * @property {string} [type='subtree'] - Type of node, for rendering purposes; names the rendering template to use to generate the node's UI representation.
 */
var FilterTree = FilterNode.extend('FilterTree', {

    /**
     * Hash of constructors for objects that extend from {@link FilterLeaf}, which is the `Default` member here.
     *
     * Add additional editors to this object (in the prototype) prior to instantiating a leaf node that refers to it. This object exists in the prototype and additions to it will affect all nodes that don't have their an "own" hash.
     *
     * If you create an "own" hash in your instance be sure to include the default editor, for example: `{ Default: FilterTree.prototype.editors.Default, ... }`. (One way of overriding would be to include such an object in an `editors` member of the options object passed to the constructor on instantiation. This works because all miscellaneous members are simply copied to the new instance. Not to be confused with the standard option `editor` which is a string containing a key from this hash and tells the leaf node what type to use.)
     */
    editors: {
        Default: FilterLeaf
    },

    /**
     * An extension is a hash of prototype overrides (methods, properties) used to extend the default editor.
     * @param {string} [key='Default'] - Nme of the new extension given in `ext` or name of an existing extension in `FilterTree.extensions`. As a constructor, should have an initial capital. If omitted, replaces the default editor (FilterLeaf).
     * @param {object} [ext] An extension hash
     * @param {FilerLeaf} [BaseEditor=this.editors.Default] - Constructor to extend from.
     * @returns {FillterLeaf} A new class extended from `BaseEditor` -- which is initially `FilterLeaf` but may itself have been extended by a call to `.addEditor('Default', extension)`.
     */
    addEditor: function(key, ext, BaseEditor) {
        if (typeof key === 'object') {
            // `key` (string) was omitted
            BaseEditor = ext;
            ext = key;
            key = 'Default';
        }
        BaseEditor = BaseEditor || this.editors.Default;
        ext = ext || FilterTree.extensions[key];
        return (this.editors[key] = BaseEditor.extend(key, ext));
    },

    /**
     * @param {string} key - The name of the existing editor to remove.
     * @memberOf FilterTree#
     */
    removeEditor: function(key) {
        if (key === 'Default') {
            throw 'Cannot remove default editor.';
        }
        delete this.editors[key];
    },

    /**
     *
     * @memberOf FilterTree#
     */
    createView: function() {
        this.el = this.templates.get(
            this.type || 'subtree',
            ++ordinal,
            this.schema[0] && popMenu.formatItem(this.schema[0])
        );

        // Add the expression editors to the "add new" drop-down
        var addNewCtrl = this.firstChildOfType('select');
        if (addNewCtrl) {
            var submenu, optgroup,
                editors = this.editors;

            if (addNewCtrl.length === 1 && this.editors.length === 1) {
                // this editor is the only option besides the null prompt option
                // so make it th eonly item i the drop-down
                submenu = addNewCtrl;
            } else {
                // there are already options and/or multiple editors
                submenu = optgroup = document.createElement('optgroup');
                optgroup.label = 'Conditional Expressions';
            }
            Object.keys(editors).forEach(function(key) {
                var name = editors[key].prototype.name || key;
                submenu.appendChild(new Option(name, key));
            });
            if (optgroup) {
                addNewCtrl.add(optgroup);
            }
            this.el.addEventListener('change', onchange.bind(this));
        }

        this.el.addEventListener('click', onTreeOpClick.bind(this));
    },

    /**
     *
     * @memberOf FilterTree#
     */
    loadState: function(state) {
        this.operator = 'op-and';
        this.children = [];

        if (!state) {
            this.add();
        } else {
            // Validate `state.children` (required)
            if (!(state.children instanceof Array)) {
                throw new this.Error('Expected `children` property to be an array.');
            }

            // Validate `state.operator` (if given)
            if (state.operator) {
                if (!operators[state.operator]) {
                    throw new this.Error('Expected `operator` property to be one of: ' + Object.keys(operators));
                }

                this.operator = state.operator;
            }

            state.children.forEach(this.add.bind(this));
        }
    },

    /**
     *
     * @memberOf FilterTree#
     */
    render: function() {
        var radioButton = this.firstChildOfType('label > input[value=' + this.operator + ']'),
            addFilterLink = this.el.querySelector('.filter-tree-add-conditional');

        if (radioButton) {
            radioButton.checked = true;
            onTreeOpClick.call(this, {
                target: radioButton
            });
        }

        // when multiple filter editors available, simulate click on the new "add conditional" link
        if (addFilterLink && !this.children.length && Object.keys(this.editors).length > 1) {
            this['filter-tree-add-conditional']({
                target: addFilterLink
            });
        }

        // proceed with render
        FilterNode.prototype.render.call(this);
    },

    /**
     * @summary Create a new node as per `state`.
     *
     * @param {object} [options={state:{}}] - May be one of:
     *
     * * an `options` object containing a `state` property
     * * a `state` object (in which case there is no `options` object)
     *
     * In any case, resulting `state` object may be either...
     * * A new subtree (has a `children` property):
     *   Add a new `FilterTree` node.
     * * A new leaf (no `children` property): add a new `FilterLeaf` node:
     *   * If there is an `editor` property:
     *     Add leaf using `this.editors[state.editor]`.
     *   * Otherwise (including the case where `state` is undefined):
     *     Add leaf using `this.editors.Default`.
     *
     * @param {boolean} [options.focus=false] Call invalid() after inserting to focus on first blank control (if any).
     *
     * @returns {FilterNode} The new node.
     *
     * @memberOf FilterTree#
     */
    add: function(options) {
        var Constructor, newNode;

        options = options || {};

        if (!options.state) {
            options = { state: options };
        }

        if (options.state.children) {
            Constructor = this.constructor;
        } else {
            Constructor = this.editors[options.state.editor || 'Default'];
        }

        options.parent = this;
        newNode = new Constructor(options);
        this.children.push(newNode);

        if (options.focus) {
            // focus on blank control a beat after adding it
            setTimeout(function() { newNode.invalid(options); }, 750);
        }

        return newNode;
    },

    /** @typedef {object} FilterTreeValidationOptionsObject
     * @property {boolean} [throw=false] - Throw (do not catch) `FilterTreeError`s.
     * @property {boolean} [alert=false] - Announce error via window.alert() before returning.
     * @property {boolean} [focus=false] - Place the focus on the offending control and give it error color.
     */

    /**
     * @param {FilterTreeValidationOptionsObject} [options]
     * @returns {undefined|FilterTreeError} `undefined` if valid; or the caught `FilterTreeError` if error.
     * @memberOf FilterTree#
     */
    invalid: function(options) {
        options = options || {};

        var result, throwWas;

        throwWas = options.throw;
        options.throw = true;

        try {
            invalid.call(this, options);
        } catch (err) {
            result = err;

            // Throw when unexpected (not a filter tree error)
            if (!(err instanceof this.Error)) {
                throw err;
            }
        }

        options.throw = throwWas;

        // Alter and/or throw when requested
        if (result) {
            if (options.alert) {
                window.alert(result.message || result); // eslint-disable-line no-alert
            }
            if (options.throw) {
                throw result;
            }
        }

        return result;
    },

    /**
     *
     * @param dataRow
     * @returns {boolean}
     * @memberOf FilterTree#
     */
    test: function test(dataRow) {
        var operator = operators[this.operator],
            result = operator.seed,
            noChildrenDefined = true;

        this.children.find(function(child) {
            if (child) {
                noChildrenDefined = false;
                if (child instanceof FilterLeaf) {
                    result = operator.reduce(result, child.test(dataRow));
                } else if (child.children.length) {
                    result = operator.reduce(result, test.call(child, dataRow));
                }
                return result === operator.abort;
            }

            return false;
        });

        return noChildrenDefined || (operator.negate ? !result : result);
    },

    /**
     * @returns {number} Number of filters (terminal nodes) defined in this subtree.
     */
    filterCount: function filterCount() {
        var n = 0;

        this.children.forEach(function(child) {
            n += child instanceof FilterLeaf ? 1 : filterCount.call(child);
        });

        return n;
    },

    /** @typedef {object} FilterTreeGetStateOptionsObject
     *
     * @summary Object containing options for producing a state object.
     *
     * @desc State is commonly used for two purposes:
     * 1. To persist the filter state so that it can be reloaded later.
     * 2. To send a query to a database engine.
     *
     * @property {boolean} [syntax='object'] - A case-sensitive string indicating the expected type and format of a state object to be generated from a filter tree. One of:
     * * `'object'` (default) A raw state object produced by walking the tree using `{@link https://www.npmjs.com/package/unstrungify|unstrungify()}`, respecting `JSON.stringify()`'s "{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior|toJSON() behavior}," and returning a plain object suitable for resubmitting to {@link FilterNode#setState|setState}. This is an "essential" version of the actual node objects in the tree.
     * * `'JSON'` - A stringified state object produced by walking the tree using `{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior|JSON.stringify()}`, returning a JSON string by calling `toJSON` at every node. This is a string representation of the same "essential" object as that produced by the `'object'` option, but "stringified" and therefore suitable for text-based storage media.
     * * `'SQL'` - The subexpression in SQL conditional syntax produced by walking the tree and returning a SQL [search condition expression]{@link https://msdn.microsoft.com/en-us/library/ms173545.aspx}. Suitable for use in the WHERE clause of a SQL `SELECT` statement used to query a database for a filtered result set.
     *
     * @param {number|string} [space] - When `options.syntax === 'JSON'`, forwarded to `JSON.stringify` as the third parameter, `space` (see).
     *
     * NOTE: The SQL syntax result cannot accommodate node meta-data. While meta-data such as `type` typically comes from the column schema, meta-data can be installed directly on a node. Such meta-data will not be part of the resulting SQL expression. For this reason, SQL should not be used to persist filter state but rather its use should be limited to generating a filter query for a remote data server.
     */

    /**
     * @summary Get a representation of filter state.
     * @desc Calling this on the root will get the entire tree's state; calling this on any subtree will get just that subtree's state.
     *
     * Only _essential_ properties will be output:
     *
     * 1. `FilterTree` nodes will output at least 2 properties:
     *    * `operator`
     *    * `children`
     * 2. `FilterLeaf` nodes will output (via {@link FilterLeaf#getState|getState}) at least 3 properties, one property for each item in it's `view`:
     *    * `column`
     *    * `operator`
     *    * `operand`
     * 3. Additional node properties will be output when:
     *    1. When the property was **NOT** externally sourced:
     *       1. Did *not* come from the `options` object on node instantiation.
     *       2. Did *not* come from the options schema `default` object, if any.
     *    2. **AND** at least one of the following is true:
     *       1. When it's an "own" property.
     *       2. When its value differs from it's parent's.
     *       3. When this is the root node.
     *
     * @param {FilterTreeGetStateOptionsObject} [options]
     * @param {object} [options.sqlIdQts] - When `options.syntax === 'SQL'`, forwarded to `conditionals.pushSqlIdQts()`.
     * @returns {object|string} Returns object when `options.syntax === 'object'`; otherwise returns string.
     * @memberOf FilterTree#
     */
    getState: function getState(options) {
        var result = '',
            syntax = options && options.syntax || 'object';

        switch (syntax) {
            case 'object':
                result = unstrungify.call(this);
                break;

            case 'JSON':
                result = JSON.stringify(this, null, options && options.space) || '';
                break;

            case 'SQL':
                var lexeme = operators[this.operator].SQL;

                this.children.forEach(function(child, idx) {
                    var op = idx ? ' ' + lexeme.op + ' ' : '';
                    if (child instanceof FilterLeaf) {
                        result += op + child.getState(options);
                    } else if (child.children.length) {
                        result += op + getState.call(child, options);
                    }
                });

                if (result) {
                    result = lexeme.beg + result + lexeme.end;
                }
                break;

            default:
                throw new this.Error('Unknown syntax option "' + syntax + '"');
        }

        return result;
    },

    toJSON: function toJSON() {
        var self = this,
            state = {
                operator: this.operator,
                children: []
            };

        this.children.forEach(function(child) {
            state.children.push(child instanceof FilterLeaf ? child : toJSON.call(child));
        });

        _(FilterNode.optionsSchema).each(function(optionSchema, key) {
            if (
                self[key] && // there is a standard option on the node which may need to be output
                !self.dontPersist[key] && (
                    optionSchema.own || // output because it's an "own" option (belongs to the node)
                    !self.parent || // output because it's the root node
                    self[key] !== self.parent[key] // output because it differs from its parent's version
                )
            ) {
                state[key] = self[key];
            }
        });

        return state;
    },

    /**
     * @summary Set the case sensitivity of filter tests against data.
     * @desc Case sensitivity pertains to string compares only. This includes untyped columns, columns typed as strings, typed columns containing data that cannot be coerced to type or when the filter expression operand cannot be coerced.
     *
     * NOTE: This is a shared property and affects all filter-tree instances constructed by this code instance.
     * @param {boolean} isSensitive
     * @memberOf Filtertree#.prototype
     */
    set caseSensitiveData(isSensitive) {
        var toString = isSensitive ? toStringCaseSensitive : toStringCaseInsensitive;
        FilterLeaf.setToString(toString);
    }

});

function toStringCaseInsensitive(s) { return (s + '').toUpperCase(); }
function toStringCaseSensitive(s) { return s + ''; }

// Some event handlers bound to FilterTree object

function onchange(evt) { // called in context
    var ctrl = evt.target;
    if (ctrl.parentElement === this.el) {
        if (ctrl.value === 'subexp') {
            this.children.push(new FilterTree({
                parent: this
            }));
        } else {
            this.add({
                state: { editor: ctrl.value },
                focus: true
            });
        }
        ctrl.selectedIndex = 0;
    }
}

function onTreeOpClick(evt) { // called in context
    var ctrl = evt.target;

    if (ctrl.className === 'filter-tree-op-choice') {
        this.operator = ctrl.value;

        // display strike-through
        var radioButtons = this.el.querySelectorAll('label>input.filter-tree-op-choice[name=' + ctrl.name + ']');
        Array.prototype.forEach.call(radioButtons, function(ctrl) {
            ctrl.parentElement.style.textDecoration = ctrl.checked ? 'none' : 'line-through';
        });

        // display operator between filters by adding operator string as a CSS class of this tree
        for (var key in operators) {
            this.el.classList.remove(key);
        }
        this.el.classList.add(this.operator);
    }
}

/**
 * Throws error if invalid expression tree.
 * Caught by {@link FilterTree#invalid|FilterTree.prototype.invalid()}.
 * @param {boolean} [options.focus=false] - Move focus to offending control.
 * @returns {undefined} if valid
 * @private
 */
function invalid(options) { // called in context
    //if (this instanceof FilterTree && !this.children.length) {
    //    throw new this.Error('Empty subexpression (no filters).');
    //}

    this.children.forEach(function(child) {
        if (child instanceof FilterLeaf) {
            child.invalid(options);
        } else if (child.children.length) {
            invalid.call(child, options);
        }
    });
}

FilterTree.extensions = {
    Columns: require('./extensions/columns')
};

// module initialization
FilterTree.prototype.caseSensitiveData = true;  // default is case-sensitive which is more efficient; may be reset at will


module.exports = FilterTree;

},{"./FilterLeaf":13,"./FilterNode":14,"./extensions/columns":17,"./tree-operators":20,"object-iterators":21,"pop-menu":23,"unstrungify":26}],16:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var templex = require('templex');

var templates = require('../html');

var encoders = /\{(\d+)\:encode\}/g;

function Templates() {}
var constructor = Templates.prototype.constructor;
Templates.prototype = templates;
Templates.prototype.constructor = constructor; // restore it
Templates.prototype.get = function(templateName) { // mix it in
    var keys,
        matches = {},
        temp = document.createElement('div'),
        text = this[templateName],
        args = Array.prototype.slice.call(arguments, 1);

    encoders.lastIndex = 0;

    while ((keys = encoders.exec(text))) {
        matches[keys[1]] = true;
    }

    keys = Object.keys(matches);

    if (keys.length) {
        keys.forEach(function(key) {
            temp.textContent = args[key];
            args[key] = temp.innerHTML;
        });
        text = text.replace(encoders, '{$1}');
    }

    temp.innerHTML = templex.apply(this, [text].concat(args));

    // if only one HTMLElement, return it; otherwise entire list of nodes
    return temp.children.length === 1 && temp.childNodes.length === 1
        ? temp.firstChild
        : temp.childNodes;
};

module.exports = Templates;

},{"../html":10,"templex":25}],17:[function(require,module,exports){
'use strict';

var Conditionals = require('../Conditionals');
var FilterLeaf = require('../FilterLeaf');

/**
 * @summary Prototype additions object for extending {@link FilterLeaf}.
 * @desc Resulting object is similar to {@link FilterLeaf} except:
 * 1. The `operand` property names another column rather than contains a literal.
 * 2. Operators are limited to equality, inequalities, and sets (IN/NOT IN). Omitted are the string and pattern scans (BEGINS/NOT BEGINS, ENDS/NOT ENDS, CONTAINS/NOT CONTAINS, and LIKE/NOT LIKE).
 *
 * @extends FilterLeaf
 *
 * @property {string} identifier - Name of column (member of data row object) to compare against this column (member of data row object named by `column`).
 */
var ColumnLeaf = {
    name: 'column = column', // display string for drop-down

    createView: function() {
        // Create the `view` hash and insert the three default elements (`column`, `operator`, `operand`) into `.el`
        FilterLeaf.prototype.createView.call(this);

        // Replace the `operand` element from the `view` hash
        var oldOperand = this.view.operand,
            newOperand = this.view.operand = this.makeElement(this.root.schema, 'column', this.sortColumnMenu);

        // Replace the operand element with the new one. There are no event listeners to worry about.
        this.el.replaceChild(newOperand, oldOperand);
    },

    makeSqlOperand: function() {
        return this.root.conditionals.makeSqlIdentifier(this.operand);
    },

    opMenu: [
        Conditionals.groups.equality,
        Conditionals.groups.inequalities,
        Conditionals.groups.sets
    ],

    q: function(dataRow) {
        return this.valOrFunc.call(dataRow, this.operand);
    }
};

module.exports = ColumnLeaf;

},{"../Conditionals":12,"../FilterLeaf":13}],18:[function(require,module,exports){
'use strict';

var reOp = /^((=|>=?|<[>=]?)|(NOT )?(LIKE|IN)\b)/i, // match[1]
    reFloat = /^([+-]?(\d+(\.\d*)?|\d*\.\d+)(e[+-]\d+)?)[^\d]?/i,
    reLit = /^'(\d+)'/,
    reLitAnywhere = /'(\d+)'/,
    reIn = /^\((.*?)\)/,
    reBool = /^(AND|OR)\b/i,
    reGroup = /^(NOT ?)?\(/i;

var SQT = '\'';

var defaultIdQts = {
    beg: '"',
    end: '"'
};

function ParserSqlError(message) {
    this.message = message;
}
ParserSqlError.prototype = Object.create(Error.prototype);
ParserSqlError.prototype.name = 'ParserSqlError';

/** @typedef {object} sqlIdQtsObject
 * @desc On a practical level, the useful characters are:
 * * SQL-92 standard: "double quotes"
 * * SQL Server: "double quotes" or \[square brackets\]
 * * mySQL: \`tick marks\`
 * @property {string} beg - The open quote character.
 * @property {string} end - The close quote character.
 */

/**
 * @constructor
 * @summary Structured Query Language (SQL) parser
 * @author Jonathan Eiten <jonathan@openfin.com>
 * @desc This is a subset of SQL conditional expression syntax.
 *
 * @see {@link https://msdn.microsoft.com/en-us/library/ms173545.aspx SQL Search Condition}
 *
 * @param {menuItem[]} [options.schema] - Column schema for column name validation. Throws an error if name fails validation (but see `resolveAliases`). Omit to skip column name validation.
 * @param {boolean} [options.resolveAliases] - Validate column aliases against schema and use the associated column name in the returned expression state object. Requires `options.schema`. Throws error if no such column found.
 * @param {boolean} [options.caseSensitiveColumnNames] - Ignore case while validating column names and aliases.
 * @param {sqlIdQtsObject} [options.sqlIdQts={beg:'"',end:'"'}]
 */
function ParserSQL(options) {
    options = options || {};

    this.schema = options.schema;

    var idQts = options.sqlIdQts || defaultIdQts;
    this.reName = new RegExp('^(' + idQts.beg + '(.+?)' + idQts.end + '|([A-Z_][A-Z_@\\$#]*)\\b)', 'i'); // match[2] || match[3]
}

ParserSQL.prototype = {

    constructor: ParserSQL.prototype.constructor,

    /**
     * @param {string} sql
     * @returns {*}
     * @memberOf module:sqlSearchCondition
     */
    parse: function(sql) {
        var state;

        // reduce all runs of white space to a single space; then trim
        sql = sql.replace(/\s\s+/g, ' ').trim();

        sql = stripLiterals.call(this, sql);
        state = walk.call(this, sql);

        if (!state.children) {
            state = { children: [ state ] };
        }

        return state;
    }
};

function walk(t) {
    var m, name, op, operand, editor, bool, token, tokens = [];
    var i = 0;

    t = t.trim();

    while (i < t.length) {
        m = t.substr(i).match(reGroup);
        if (m) {
            var not = !!m[1];

            i += m[0].length;
            for (var j = i, v = 1; j < t.length && v; ++j) {
                if (t[j] === '(') {
                    ++v;
                } else if (t[j] === ')') {
                    --v;
                }
            }

            if (v) {
                throw new ParserSqlError('Expected ")"');
            }
            token = walk.call(this, t.substr(i, j - 1 - i));
            if (typeof token !== 'object') {
                return token;
            }

            if (not) {
                if (token.operator !== 'op-or') {
                    throw new ParserSqlError('Expected OR in NOT(...) subexpression but found ' + token.operator.substr(3).toUpperCase() + '.');
                }
                token.operator = 'op-nor';
            }

            i = j;
        } else {

            // column:

            m = t.substr(i).match(this.reName);
            if (!m) {
                throw new ParserSqlError('Expected identifier or quoted identifier.');
            }
            name = m[2] || m[3];
            if (!/^[A-Z_]/i.test(t[i])) { i += 2; }
            i += name.length;

            // operator:

            if (t[i] === ' ') { ++i; }
            m = t.substr(i).match(reOp);
            if (!m) {
                throw new ParserSqlError('Expected relational operator.');
            }
            op = m[1].toUpperCase();
            i += op.length;

            // operand:

            editor = undefined;
            if (t[i] === ' ') { ++i; }
            if (m[4] && m[4].toUpperCase() === 'IN') {
                m = t.substr(i).match(reIn);
                if (!m) {
                    throw new ParserSqlError('Expected parenthesized list.');
                }
                operand = m[1];
                i += operand.length + 2;
                while ((m = operand.match(reLitAnywhere))) {
                    operand = operand.replace(reLitAnywhere, this.literals[m[1]]);
                }
            } else if ((m = t.substr(i).match(reLit))) {
                operand = m[1];
                i += operand.length + 2;
                operand = this.literals[operand];
            } else if ((m = t.substr(i).match(reFloat))) {
                operand = m[1];
                i += operand.length;
            } else if ((m = t.substr(i).match(this.reName))) {
                operand = m[2] || m[3];
                i += operand.length;
                editor = 'Columns';
            } else {
                throw new ParserSqlError('Expected number or string literal or column.');
            }

            if (this.schema) {
                name = lookup.call(this, name);

                if (editor) {
                    operand = lookup.call(this, operand);
                }
            }

            token = {
                column: name,
                operator: op,
                operand: operand
            };

            if (editor) {
                token.editor = editor;
            }
        }

        tokens.push(token);

        if (i < t.length) {
            if (t[i] === ' ') { ++i; }
            m = t.substr(i).match(reBool);
            if (!m) {
                throw new ParserSqlError('Expected boolean operator.');
            }
            bool = m[1].toLowerCase();
            i += bool.length;
            bool = 'op-' + bool;
            if (tokens.operator && tokens.operator !== bool) {
                throw new ParserSqlError('Expected same boolean operator throughout subexpression.');
            }
            tokens.operator = bool;
        }

        if (t[i] === ' ') { ++i; }
    }

    return (
        tokens.length === 1 ? tokens[0] : {
            operator: tokens.operator,
            children: tokens
        }
    );
}

function lookup(name) {
    var item = this.schema.lookup(name);

    if (!item) {
        throw new ParserSqlError(this.resolveAliases
            ? 'Expected valid column name.'
            : 'Expected valid column name or alias.'
        );
    }

    return item.name;
}

function stripLiterals(t) {
    var i = 0, j = 0, k;

    this.literals = [];

    while ((j = t.indexOf(SQT, j)) >= 0) {
        k = j;
        do {
            k = t.indexOf(SQT, k + 1);
            if (k < 0) {
                throw new ParserSqlError('Expected ' + SQT + ' (single quote).');
            }
        } while (t[++k] === SQT);
        this.literals.push(t.slice(++j, --k).replace(/''/g, SQT));
        t = t.substr(0, j) + i + t.substr(k);
        j = j + 1 + (i + '').length + 1;
        i++;
    }

    return t;
}

module.exports = ParserSQL;

},{}],19:[function(require,module,exports){
'use strict';

var cssInjector = require('css-injector');

var css; // defined by code inserted by gulpfile between following comments
/* inject:css */
css = '.filter-tree{font-family:sans-serif;font-size:10pt;line-height:1.5em}.filter-tree label{font-weight:400}.filter-tree input[type=checkbox],.filter-tree input[type=radio]{margin-left:3px;margin-right:3px}.filter-tree ol{margin-top:0}.filter-tree>select{float:right;border:1px dotted grey;background-color:transparent;box-shadow:none}.filter-tree-remove-button{display:inline-block;width:15px;height:15px;border-radius:8px;background-color:#e88;font-size:11.5px;color:#fff;text-align:center;line-height:normal;font-style:normal;font-family:sans-serif;margin-right:4px;cursor:pointer}.filter-tree-remove-button:hover{background-color:transparent;color:#e88;font-weight:700;box-shadow:red 0 0 2px inset}.filter-tree-remove-button::before{content:\'\\d7\'}.filter-tree li::after{font-size:70%;font-style:italic;font-weight:700;color:#080}.filter-tree>ol>li:last-child::after{display:none}.op-and>ol,.op-nor>ol,.op-or>ol{padding-left:5px;margin-left:27px}.op-or>ol>li::after{margin-left:2.5em;content:\'— OR —\'}.op-and>ol>li::after{margin-left:2.5em;content:\'— AND —\'}.op-nor>ol>li::after{margin-left:2.5em;content:\'— NOR —\'}.filter-tree-editor>*{font-weight:700}.filter-tree-editor>span{font-size:smaller}.filter-tree-editor>input[type=text]{width:8em;padding:1px 5px 2px}.filter-tree-warning{background-color:#ffc!important;border-color:#edb!important;font-weight:400!important}.filter-tree-error{background-color:#fcc!important;border-color:#c99!important;font-weight:400!important}.filter-tree-default>:enabled{margin:0 .4em;background-color:#ddd;border:1px solid transparent}.filter-tree.filter-tree-type-column-filters>ol>li:not(:last-child){padding-bottom:.75em;border-bottom:3px double #080;margin-bottom:.75em}.filter-tree .footnotes{margin:0 0 6px;font-size:8pt;font-weight:400;line-height:normal;white-space:normal;color:#c00}.filter-tree .footnotes>p{margin:0}.filter-tree .footnotes>ul{margin:-3px 0 0;padding-left:17px;text-index:-6px}.filter-tree .footnotes>ul>li{margin:2px 0}.filter-tree .footnotes .field-name,.filter-tree .footnotes .field-value{font-weight:700;font-style:normal}.filter-tree .footnotes .field-value{font-family:monospace;color:#000;background-color:#ddd;padding:0 5px;margin:0 3px;border-radius:3px}';
/* endinject */

module.exports = cssInjector.bind(this, css, 'filter-tree-base');

},{"css-injector":8}],20:[function(require,module,exports){
'use strict';

/** @typedef {function} operationReducer
 * @param {boolean} p
 * @param {boolean} q
 * @returns {boolean} The result of applying the operator to the two parameters.
 */

/**
 * @private
 * @type {operationReducer}
 */
function AND(p, q) {
    return p && q;
}

/**
 * @private
 * @type {operationReducer}
 */
function OR(p, q) {
    return p || q;
}

/** @typedef {obejct} treeOperator
 * @desc Each `treeOperator` object describes two things:
 *
 * 1. How to take the test results of _n_ child nodes by applying the operator to all the results to "reduce" it down to a single result.
 * 2. How to generate SQL WHERE clause syntax that applies the operator to _n_ child nodes.
 *
 * @property {operationReducer} reduce
 * @property {boolean} seed -
 * @property {boolean} abort -
 * @property {boolean} negate -
 * @property {string} SQL.op -
 * @property {string} SQL.beg -
 * @property {string} SQL.end -
 */

/** A hash of {@link treeOperator} objects.
 * @type {object}
 */
var treeOperators = {
    'op-and': {
        reduce: AND,
        seed: true,
        abort: false,
        negate: false,
        SQL: {
            op: 'AND',
            beg: '(',
            end: ')'
        }
    },
    'op-or': {
        reduce: OR,
        seed: false,
        abort: true,
        negate: false,
        SQL: {
            op: 'OR',
            beg: '(',
            end: ')'
        }
    },
    'op-nor': {
        reduce: OR,
        seed: false,
        abort: true,
        negate: true,
        SQL: {
            op: 'OR',
            beg: 'NOT (',
            end: ')'
        }
    }
};

module.exports = treeOperators;

},{}],21:[function(require,module,exports){
/* object-iterators.js - Mini Underscore library
 * by Jonathan Eiten
 *
 * The methods below operate on objects (but not arrays) similarly
 * to Underscore (http://underscorejs.org/#collections).
 *
 * For more information:
 * https://github.com/joneit/object-iterators
 */

'use strict';

/**
 * @constructor
 * @summary Wrap an object for one method call.
 * @Desc Note that the `new` keyword is not necessary.
 * @param {object|null|undefined} object - `null` or `undefined` is treated as an empty plain object.
 * @return {Wrapper} The wrapped object.
 */
function Wrapper(object) {
    if (object instanceof Wrapper) {
        return object;
    }
    if (!(this instanceof Wrapper)) {
        return new Wrapper(object);
    }
    this.originalValue = object;
    this.o = object || {};
}

/**
 * @name Wrapper.chain
 * @summary Wrap an object for a chain of method calls.
 * @Desc Calls the constructor `Wrapper()` and modifies the wrapper for chaining.
 * @param {object} object
 * @return {Wrapper} The wrapped object.
 */
Wrapper.chain = function (object) {
    var wrapped = Wrapper(object); // eslint-disable-line new-cap
    wrapped.chaining = true;
    return wrapped;
};

Wrapper.prototype = {
    /**
     * Unwrap an object wrapped with {@link Wrapper.chain|Wrapper.chain()}.
     * @return {object|null|undefined} The value originally wrapped by the constructor.
     * @memberOf Wrapper.prototype
     */
    value: function () {
        return this.originalValue;
    },

    /**
     * @desc Mimics Underscore's [each](http://underscorejs.org/#each) method: Iterate over the members of the wrapped object, calling `iteratee()` with each.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function is undefined; an `.each` loop cannot be broken out of (use {@link Wrapper#find|.find} instead).
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `iteratee`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {Wrapper} The wrapped object for chaining.
     * @memberOf Wrapper.prototype
     */
    each: function (iteratee, context) {
        var o = this.o;
        Object.keys(o).forEach(function (key) {
            iteratee.call(this, o[key], key, o);
        }, context || o);
        return this;
    },

    /**
     * @desc Mimics Underscore's [find](http://underscorejs.org/#find) method: Look through each member of the wrapped object, returning the first one that passes a truth test (`predicate`), or `undefined` if no value passes the test. The function returns the value of the first acceptable member, and doesn't necessarily traverse the entire object.
     * @param {function} predicate - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function should be truthy if the member passes the test and falsy otherwise.
     * @param {object} [context] - If given, `predicate` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} The found property's value, or undefined if not found.
     * @memberOf Wrapper.prototype
     */
    find: function (predicate, context) {
        var o = this.o;
        var result;
        if (o) {
            result = Object.keys(o).find(function (key) {
                return predicate.call(this, o[key], key, o);
            }, context || o);
            if (result !== undefined) {
                result = o[result];
            }
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [filter](http://underscorejs.org/#filter) method: Look through each member of the wrapped object, returning the values of all members that pass a truth test (`predicate`), or empty array if no value passes the test. The function always traverses the entire object.
     * @param {function} predicate - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function should be truthy if the member passes the test and falsy otherwise.
     * @param {object} [context] - If given, `predicate` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} An array containing the filtered values.
     * @memberOf Wrapper.prototype
     */
    filter: function (predicate, context) {
        var o = this.o;
        var result = [];
        if (o) {
            Object.keys(o).forEach(function (key) {
                if (predicate.call(this, o[key], key, o)) {
                    result.push(o[key]);
                }
            }, context || o);
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [map](http://underscorejs.org/#map) method: Produces a new array of values by mapping each value in list through a transformation function (`iteratee`). The function always traverses the entire object.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function is concatenated to the end of the new array.
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} An array containing the filtered values.
     * @memberOf Wrapper.prototype
     */
    map: function (iteratee, context) {
        var o = this.o;
        var result = [];
        if (o) {
            Object.keys(o).forEach(function (key) {
                result.push(iteratee.call(this, o[key], key, o));
            }, context || o);
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [reduce](http://underscorejs.org/#reduce) method: Boil down the values of all the members of the wrapped object into a single value. `memo` is the initial state of the reduction, and each successive step of it should be returned by `iteratee()`.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with four arguments: `(memo, value, key, object)`. The return value of this function becomes the new value of `memo` for the next iteration.
     * @param {*} [memo] - If no memo is passed to the initial invocation of reduce, the iteratee is not invoked on the first element of the list. The first element is instead passed as the memo in the invocation of the iteratee on the next element in the list.
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `iteratee`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} The value of `memo` "reduced" as per `iteratee`.
     * @memberOf Wrapper.prototype
     */
    reduce: function (iteratee, memo, context) {
        var o = this.o;
        if (o) {
            Object.keys(o).forEach(function (key, idx) {
                memo = (!idx && memo === undefined) ? o[key] : iteratee(memo, o[key], key, o);
            }, context || o);
        }
        return memo;
    },

    /**
     * @desc Mimics Underscore's [extend](http://underscorejs.org/#extend) method: Copy all of the properties in each of the `source` object parameter(s) over to the (wrapped) destination object (thus mutating it). It's in-order, so the properties of the last `source` object will override properties with the same name in previous arguments or in the destination object.
     * > This method copies own members as well as members inherited from prototype chain.
     * @param {...object|null|undefined} source - Values of `null` or `undefined` are treated as empty plain objects.
     * @return {Wrapper|object} The wrapped destination object if chaining is in effect; otherwise the unwrapped destination object.
     * @memberOf Wrapper.prototype
     */
    extend: function (source) {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function (object) {
            if (object) {
                for (var key in object) {
                    o[key] = object[key];
                }
            }
        });
        return this.chaining ? this : o;
    },

    /**
     * @desc Mimics Underscore's [extendOwn](http://underscorejs.org/#extendOwn) method: Like {@link Wrapper#extend|extend}, but only copies its "own" properties over to the destination object.
     * @param {...object|null|undefined} source - Values of `null` or `undefined` are treated as empty plain objects.
     * @return {Wrapper|object} The wrapped destination object if chaining is in effect; otherwise the unwrapped destination object.
     * @memberOf Wrapper.prototype
     */
    extendOwn: function (source) {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function (object) {
            Wrapper(object).each(function (val, key) { // eslint-disable-line new-cap
                o[key] = val;
            });
        });
        return this.chaining ? this : o;
    }
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) { // eslint-disable-line no-extend-native
        if (this === null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}

module.exports = Wrapper;

},{}],22:[function(require,module,exports){
'use strict';

/** @module overrider */

/**
 * Mixes members of all `sources` into `target`, handling getters and setters properly.
 *
 * Any number of `sources` objects may be given and each is copied in turn.
 *
 * @example
 * var overrider = require('overrider');
 * var target = { a: 1 }, source1 = { b: 2 }, source2 = { c: 3 };
 * target === overrider(target, source1, source2); // true
 * // target object now has a, b, and c; source objects untouched
 *
 * @param {object} object - The target object to receive sources.
 * @param {...object} [sources] - Object(s) containing members to copy to `target`. (Omitting is a no-op.)
 * @returns {object} The target object (`target`)
 */
function overrider(target, sources) { // eslint-disable-line no-unused-vars
    for (var i = 1; i < arguments.length; ++i) {
        mixIn.call(target, arguments[i]);
    }

    return target;
}

/**
 * Mix `this` members into `target`.
 *
 * @example
 * // A. Simple usage (using .call):
 * var mixInTo = require('overrider').mixInTo;
 * var target = { a: 1 }, source = { b: 2 };
 * target === overrider.mixInTo.call(source, target); // true
 * // target object now has both a and b; source object untouched
 *
 * @example
 * // B. Semantic usage (when the source hosts the method):
 * var mixInTo = require('overrider').mixInTo;
 * var target = { a: 1 }, source = { b: 2, mixInTo: mixInTo };
 * target === source.mixInTo(target); // true
 * // target object now has both a and b; source object untouched
 *
 * @this {object} Target.
 * @param target
 * @returns {object} The target object (`target`)
 * @memberOf module:overrider
 */
function mixInTo(target) {
    var descriptor;
    for (var key in this) {
        if ((descriptor = Object.getOwnPropertyDescriptor(this, key))) {
            Object.defineProperty(target, key, descriptor);
        }
    }
    return target;
}

/**
 * Mix `source` members into `this`.
 *
 * @example
 * // A. Simple usage (using .call):
 * var mixIn = require('overrider').mixIn;
 * var target = { a: 1 }, source = { b: 2 };
 * target === overrider.mixIn.call(target, source) // true
 * // target object now has both a and b; source object untouched
 *
 * @example
 * // B. Semantic usage (when the target hosts the method):
 * var mixIn = require('overrider').mixIn;
 * var target = { a: 1, mixIn: mixIn }, source = { b: 2 };
 * target === target.mixIn(source) // true
 * // target now has both a and b (and mixIn); source untouched
 *
 * @param source
 * @returns {object} The target object (`this`)
 * @memberOf overrider
 * @memberOf module:overrider
 */
function mixIn(source) {
    var descriptor;
    for (var key in source) {
        if ((descriptor = Object.getOwnPropertyDescriptor(source, key))) {
            Object.defineProperty(this, key, descriptor);
        }
    }
    return this;
}

overrider.mixInTo = mixInTo;
overrider.mixIn = mixIn;

module.exports = overrider;

},{}],23:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var REGEXP_INDIRECTION = /^(\w+)\((\w+)\)$/;  // finds complete pattern a(b) where both a and b are regex "words"

/** @typedef {object} valueItem
 * You should supply both `name` and `alias` but you could omit one or the other and whichever you provide will be used for both.
 * > If you only give the `name` property, you might as well just give a string for {@link menuItem} rather than this object.
 * @property {string} [name=alias] - Value of `value` attribute of `<option>...</option>` element.
 * @property {string} [alias=name] - Text of `<option>...</option>` element.
 * @property {string} [type] One of the keys of `this.converters`. If not one of these (including `undefined`), field values will be tested with a string comparison.
 * @property {boolean} [hidden=false]
 */

/** @typedef {object|menuItem[]} submenuItem
 * @summary Hierarchical array of select list items.
 * @desc Data structure representing the list of `<option>...</option>` and `<optgroup>...</optgroup>` elements that make up a `<select>...</select>` element.
 *
 * > Alternate form: Instead of an object with a `menu` property containing an array, may itself be that array. Both forms have the optional `label` property.
 * @property {string} [label] - Defaults to a generated string of the form "Group n[.m]..." where each decimal position represents a level of the optgroup hierarchy.
 * @property {menuItem[]} submenu
 */

/** @typedef {string|valueItem|submenuItem} menuItem
 * May be one of three possible types that specify either an `<option>....</option>` element or an `<optgroup>....</optgroup>` element as follows:
 * * If a `string`, specifies the text of an `<option>....</option>` element with no `value` attribute. (In the absence of a `value` attribute, the `value` property of the element defaults to the text.)
 * * If shaped like a {@link valueItem} object, specifies both the text and value of an `<option....</option>` element.
 * * If shaped like a {@link submenuItem} object (or its alternate array form), specifies an `<optgroup>....</optgroup>` element.
 */

/**
 * @summary Builds a new menu pre-populated with items and groups.
 * @desc This function creates a new pop-up menu (a.k.a. "drop-down"). This is a `<select>...</select>` element, pre-populated with items (`<option>...</option>` elements) and groups (`<optgroup>...</optgroup>` elements).
 * > Bonus: This function also builds `input type=text` elements.
 * > NOTE: This function generates OPTGROUP elements for subtrees. However, note that HTML5 specifies that OPTGROUP elemnents made not nest! This function generates the markup for them but they are not rendered by most browsers, or not completely. Therefore, for now, do not specify more than one level subtrees. Future versions of HTML may support it. I also plan to add here options to avoid OPTGROUPS entirely either by indenting option text, or by creating alternate DOM nodes using `<li>` instead of `<select>`, or both.
 * @memberOf popMenu
 *
 * @param {Element|string} el - Must be one of (case-sensitive):
 * * text box - an `HTMLInputElement` to use an existing element or `'INPUT'` to create a new one
 * * drop-down - an `HTMLSelectElement` to use an existing element or `'SELECT'` to create a new one
 * * submenu - an `HTMLOptGroupElement` to use an existing element or `'OPTGROUP'` to create a new one (meant for internal use only)
 *
 * @param {menuItem[]} [menu] - Hierarchical list of strings to add as `<option>...</option>` or `<optgroup>....</optgroup>` elements. Omitting creates a text box.
 *
 * @param {null|string} [options.prompt=''] - Adds an initial `<option>...</option>` element to the drop-down with this value in parentheses as its `text`; and empty string as its `value`. Default is empty string, which creates a blank prompt; `null` suppresses prompt altogether.
 *
 * @param {boolean} [options.sort] - Whether to alpha sort or not. If truthy, sorts each optgroup on its `label`; and each select option on its text (its `alias` if given; or its `name` if not).
 *
 * @param {string[]} [options.blacklist] - Optional list of menu item names to be ignored.
 *
 * @param {number[]} [options.breadcrumbs] - List of option group section numbers (root is section 0). (For internal use.)
 *
 * @param {boolean} [options.append=false] - When `el` is an existing `<select>` Element, giving truthy value adds the new children without first removing existing children.
 *
 * @returns {Element} Either a `<select>` or `<optgroup>` element.
 */
function build(el, menu, options) {
    options = options || {};

    var prompt = options.prompt,
        blacklist = options.blacklist,
        sort = options.sort,
        breadcrumbs = options.breadcrumbs || [],
        path = breadcrumbs.length ? breadcrumbs.join('.') + '.' : '',
        subtreeName = popMenu.subtree,
        groupIndex = 0,
        tagName;

    if (el instanceof Element) {
        tagName = el.tagName;
        if (!options.append) {
            el.innerHTML = ''; // remove all <option> and <optgroup> elements
        }
    } else {
        tagName = el;
        el = document.createElement(tagName);
    }

    if (menu) {
        var add, newOption;
        if (tagName === 'SELECT') {
            add = el.add;
            if (prompt) {
                newOption = new Option(prompt, '');
                newOption.innerHTML += '&hellip;';
                el.add(newOption);
            } else if (prompt !== null) {
                el.add(new Option());
            }
        } else {
            add = el.appendChild;
            el.label = prompt;
        }

        if (sort) {
            menu = menu.slice().sort(itemComparator); // sorted clone
        }

        menu.forEach(function(item) {
            // if item is of form a(b) and there is an function a in options, then item = options.a(b)
            if (options && typeof item === 'string') {
                var indirection = item.match(REGEXP_INDIRECTION);
                if (indirection) {
                    var a = indirection[1],
                        b = indirection[2],
                        f = options[a];
                    if (typeof f === 'function') {
                        item = f(b);
                    } else {
                        throw 'build: Expected options.' + a + ' to be a function.';
                    }
                }
            }

            var subtree = item[subtreeName] || item;
            if (subtree instanceof Array) {

                var groupOptions = {
                    breadcrumbs: breadcrumbs.concat(++groupIndex),
                    prompt: item.label || 'Group ' + path + groupIndex,
                    options: sort,
                    blacklist: blacklist
                };

                var optgroup = build('OPTGROUP', subtree, groupOptions);

                if (optgroup.childElementCount) {
                    el.appendChild(optgroup);
                }

            } else if (typeof item !== 'object') {

                if (!(blacklist && blacklist.indexOf(item) >= 0)) {
                    add.call(el, new Option(item));
                }

            } else if (!item.hidden) {

                var name = item.name || item.alias;
                if (!(blacklist && blacklist.indexOf(name) >= 0)) {
                    add.call(el, new Option(
                        item.alias || item.name,
                        name
                    ));
                }

            }
        });
    } else {
        el.type = 'text';
    }

    return el;
}

function itemComparator(a, b) {
    a = a.alias || a.name || a.label || a;
    b = b.alias || b.name || b.label || b;
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @summary Recursively searches the context array of `menuItem`s for a named `item`.
 * @memberOf popMenu
 * @this Array
 * @param {object} [options]
 * @param {string} [options.keys=[popMenu.defaultKey]] - Properties to search each menuItem when it is an object.
 * @param {boolean} [options.caseSensitive=false] - Ignore case while searching.
 * @param {string} value - Value to search for.
 * @returns {undefined|menuItem} The found item or `undefined` if not found.
 */
function lookup(options, value) {
    if (arguments.length === 1) {
        value = options;
        options = undefined;
    }

    var shallow, deep, item, prop,
        keys = options && options.keys || [popMenu.defaultKey],
        caseSensitive = options && options.caseSensitive;

    value = toString(value, caseSensitive);

    shallow = this.find(function(item) {
        var subtree = item[popMenu.subtree] || item;

        if (subtree instanceof Array) {
            return (deep = lookup.call(subtree, options, value));
        }

        if (typeof item !== 'object') {
            return toString(item, caseSensitive) === value;
        } else {
            for (var i = 0; i < keys.length; ++i) {
                prop = item[keys[i]];
                if (prop && toString(prop, caseSensitive) === value) {
                    return true;
                }
            }
        }
    });

    item = deep || shallow;

    return item && (item.name ? item : { name: item });
}

function toString(s, caseSensitive) {
    var result = '';
    if (s) {
        result += s; // convert s to string
        if (!caseSensitive) {
            result = result.toUpperCase();
        }
    }
    return result;
}

/**
 * @summary Recursively walks the context array of `menuItem`s and calls `iteratee` on each item therein.
 * @desc `iteratee` is called with each item (terminal node) in the menu tree and a flat 0-based index. Recurses on member with name of `popMenu.subtree`.
 *
 * The node will always be a {@link valueItem} object; when a `string`, it is boxed for you.
 *
 * @memberOf popMenu
 *
 * @this Array
 *
 * @param {function} iteratee - For each item in the menu, `iteratee` is called with:
 * * the `valueItem` (if the item is a primative string, it is wrapped up for you)
 * * a 0-based `ordinal`
 *
 * The `iteratee` return value can be used to replace the item, as follows:
 * * `undefined` - do nothing
 * * `null` - splice out the item; resulting empty submenus are also spliced out (see note)
 * * anything else - replace the item with this value; if value is a subtree (i.e., an array) `iteratee` will then be called to walk it as well (see note)
 *
 * > Note: Returning anything (other than `undefined`) from `iteratee` will (deeply) mutate the original `menu` so you may want to copy it first (deeply, including all levels of array nesting but not the terminal node objects).
 *
 * @returns {number} Number of items (terminal nodes) in the menu tree.
 */
function walk(iteratee) {
    var menu = this,
        ordinal = 0,
        subtreeName = popMenu.subtree,
        i, item, subtree, newVal;

    for (i = menu.length - 1; i >= 0; --i) {
        item = menu[i];
        subtree = item[subtreeName] || item;

        if (!(subtree instanceof Array)) {
            subtree = undefined;
        }

        if (!subtree) {
            newVal = iteratee(item.name ? item : { name: item }, ordinal);
            ordinal += 1;

            if (newVal !== undefined) {
                if (newVal === null) {
                    menu.splice(i, 1);
                    ordinal -= 1;
                } else {
                    menu[i] = item = newVal;
                    subtree = item[subtreeName] || item;
                    if (!(subtree instanceof Array)) {
                        subtree = undefined;
                    }
                }
            }
        }

        if (subtree) {
            ordinal += walk.call(subtree, iteratee);
            if (subtree.length === 0) {
                menu.splice(i, 1);
                ordinal -= 1;
            }
        }
    }

    return ordinal;
}

/**
 * @summary Format item name with it's alias when available.
 * @memberOf popMenu
 * @param {string|valueItem} item
 * @returns {string} The formatted name and alias.
 */
function formatItem(item) {
    var result = item.name || item;
    if (item.alias) {
        result = '"' + item.alias + '" (' + result + ')';
    }
    return result;
}


function isGroupProxy(s) {
    return REGEXP_INDIRECTION.test(s);
}

/**
 * @namespace
 */
var popMenu = {
    build: build,
    walk: walk,
    lookup: lookup,
    formatItem: formatItem,
    isGroupProxy: isGroupProxy,
    subtree: 'submenu',
    defaultKey: 'name'
};

module.exports = popMenu;

},{}],24:[function(require,module,exports){
'use strict';

var // a regex search pattern that matches all the reserved chars of a regex search pattern
    reserved = /([\.\\\+\*\?\^\$\(\)\{\}\=\!\<\>\|\:\[\]])/g,

    // regex wildcard search patterns
    REGEXP_WILDCARD = '.*',
    REGEXP_WILDCHAR = '.',
    REGEXP_WILDCARD_MATCHER = '(' + REGEXP_WILDCARD + ')',

    // LIKE search patterns
    LIKE_WILDCHAR = '_',
    LIKE_WILDCARD = '%',

    // regex search patterns that match LIKE search patterns
    REGEXP_LIKE_PATTERN_MATCHER = new RegExp('(' + [
        LIKE_WILDCHAR,
        LIKE_WILDCARD,
        '\\[\\^?[^-\\]]+]', // matches a LIKE set (same syntax as a RegExp set)
        '\\[\\^?[^-\\]]\\-[^\\]]]' // matches a LIKE range (same syntax as a RegExp range)
    ].join('|') + ')', 'g');

function regExpLIKE(pattern, ignoreCase) {
    var i, parts;

    // Find all LIKE patterns
    parts = pattern.match(REGEXP_LIKE_PATTERN_MATCHER);

    if (parts) {
        // Translate found LIKE patterns to regex patterns, escaped intervening non-patterns, and interleave the two

        for (i = 0; i < parts.length; ++i) {
            // Escape left brackets (unpaired right brackets are OK)
            if (parts[i][0] === '[') {
                parts[i] = regExpLIKE.reserve(parts[i]);
            }

            // Make each found pattern matchable by enclosing in parentheses
            parts[i] = '(' + parts[i] + ')';
        }

        // Match these precise patterns again with their intervening non-patterns (i.e., text)
        parts = pattern.match(new RegExp(
            REGEXP_WILDCARD_MATCHER +
            parts.join(REGEXP_WILDCARD_MATCHER)  +
            REGEXP_WILDCARD_MATCHER
        ));

        // Discard first match of non-global search (which is the whole string)
        parts.shift();

        // For each re-found pattern part, translate % and _ to regex equivalent
        for (i = 1; i < parts.length; i += 2) {
            var part = parts[i];
            switch (part) {
                case LIKE_WILDCARD: part = REGEXP_WILDCARD; break;
                case LIKE_WILDCHAR: part = REGEXP_WILDCHAR; break;
                default:
                    var j = part[1] === '^' ? 2 : 1;
                    part = '[' + regExpLIKE.reserve(part.substr(j, part.length - (j + 1))) + ']';
            }
            parts[i] = part;
        }
    } else {
        parts = [pattern];
    }

    // For each surrounding text part, escape reserved regex chars
    for (i = 0; i < parts.length; i += 2) {
        parts[i] = regExpLIKE.reserve(parts[i]);
    }

    // Join all the interleaved parts
    parts = parts.join('');

    // Optimize or anchor the pattern at each end as needed
    if (parts.substr(0, 2) === REGEXP_WILDCARD) { parts = parts.substr(2); } else { parts = '^' + parts; }
    if (parts.substr(-2, 2) === REGEXP_WILDCARD) { parts = parts.substr(0, parts.length - 2); } else { parts += '$'; }

    // Return the new regex
    return new RegExp(parts, ignoreCase ? 'i' : undefined);
}

regExpLIKE.reserve = function (s) {
    return s.replace(reserved, '\\$1');
};

var cache, size;

/**
 * @summary Delete a pattern from the cache; or clear the whole cache.
 * @param {string} [pattern] - The LIKE pattern to remove from the cache. Fails silently if not found in the cache. If pattern omitted, clears whole cache.
 */
(regExpLIKE.clearCache = function (pattern) {
    if (!pattern) {
        cache = {};
        size = 0;
    } else if (cache[pattern]) {
        delete cache[pattern];
        size--;
    }
    return size;
})(); // init the cache

regExpLIKE.getCacheSize = function () { return size; };

/**
 * @summary Cached version of `regExpLIKE()`.
 * @desc Cached entries are subject to garbage collection if `keep` is `undefined` or `false` on insertion or `false` on most recent reference. Garbage collection will occur iff `regExpLIKE.cacheMax` is defined and it equals the number of cached patterns. The garbage collector sorts the patterns based on most recent reference; the oldest 10% of the entries are deleted. Alternatively, you can manage the cache yourself to a limited extent (see {@link regeExpLIKE.clearCache|clearCache}).
 * @param pattern - the LIKE pattern (to be) converted to a RegExp
 * @param [keep] - If given, changes the keep status for this pattern as follows:
 * * `true` permanently caches the pattern (not subject to garbage collection) until `false` is given on a subsequent call
 * * `false` allows garbage collection on the cached pattern
 * * `undefined` no change to keep status
 * @returns {RegExp}
 */
regExpLIKE.cached = function (keep, pattern, ignoreCase) {
    if (typeof keep === 'string') {
        ignoreCase = pattern;
        pattern = keep;
        keep = false;
    }
    var patternAndCase = pattern + (ignoreCase ? 'i' : 'c'),
        item = cache[patternAndCase];
    if (item) {
        item.when = new Date().getTime();
        if (keep !== undefined) {
            item.keep = keep;
        }
    } else {
        if (size === regExpLIKE.cacheMax) {
            var age = [], ages = 0, key, i;
            for (key in cache) {
                item = cache[key];
                if (!item.keep) {
                    for (i = 0; i < ages; ++i) {
                        if (item.when < age[i].item.when) {
                            break;
                        }
                    }
                    age.splice(i, 0, { key: key, item: item });
                    ages++;
                }
            }
            if (!age.length) {
                return regExpLIKE(pattern, ignoreCase); // cache is full!
            }
            i = Math.ceil(age.length / 10); // will always be at least 1
            size -= i;
            while (i--) {
                delete cache[age[i].key];
            }
        }
        item = cache[patternAndCase] = {
            regex: regExpLIKE(pattern, ignoreCase),
            keep: keep,
            when: new Date().getTime()
        };
        size++;
    }
    return item.regex;
};

module.exports = regExpLIKE;

},{}],25:[function(require,module,exports){
// templex node module
// https://github.com/joneit/templex

/* eslint-env node */

/**
 * Merges values of execution context properties named in template by {prop1},
 * {prop2}, etc., or any javascript expression incorporating such prop names.
 * The context always includes the global object. In addition you can specify a single
 * context or an array of contexts to search (in the order given) before finally
 * searching the global context.
 *
 * Merge expressions consisting of simple numeric terms, such as {0}, {1}, etc., deref
 * the first context given, which is assumed to be an array. As a convenience feature,
 * if additional args are given after `template`, `arguments` is unshifted onto the context
 * array, thus making first additional arg available as {1}, second as {2}, etc., as in
 * `templex('Hello, {1}!', 'World')`. ({0} is the template so consider this to be 1-based.)
 *
 * If you prefer something other than braces, redefine `templex.regexp`.
 *
 * See tests for examples.
 *
 * @param {string} template
 * @param {...string} [args]
 */
function templex(template) {
    var contexts = this instanceof Array ? this : [this];
    if (arguments.length > 1) { contexts.unshift(arguments); }
    return template.replace(templex.regexp, templex.merger.bind(contexts));
}

templex.regexp = /\{(.*?)\}/g;

templex.with = function (i, s) {
    return 'with(this[' + i + ']){' + s + '}';
};

templex.cache = [];

templex.deref = function (key) {
    if (!(this.length in templex.cache)) {
        var code = 'return eval(expr)';

        for (var i = 0; i < this.length; ++i) {
            code = templex.with(i, code);
        }

        templex.cache[this.length] = eval('(function(expr){' + code + '})'); // eslint-disable-line no-eval
    }
    return templex.cache[this.length].call(this, key);
};

templex.merger = function (match, key) {
    // Advanced features: Context can be a list of contexts which are searched in order.
    var replacement;

    try {
        replacement = isNaN(key) ? templex.deref.call(this, key) : this[0][key];
    } catch (e) {
        replacement = '{' + key + '}';
    }

    return replacement;
};

// this interface consists solely of the templex function (and it's properties)
module.exports = templex;

},{}],26:[function(require,module,exports){
// Created by Jonathan Eiten on 1/7/16.

'use strict';

/**
 * Very fast array test.
 * For cross-frame scripting; use `crossFramesIsArray` instead.
 * @param {*} arr - The object to test.
 * @returns {boolean}
 */
unstrungify.isArray = function(arr) { return arr.constructor === Array; };

/**
 * @summary Walk a hierarchical object as JSON.stringify does but without serializing.
 *
 * @desc Usage:
 * * var myDistilledObject = unstrungify.call(myObject);
 * * var myDistilledObject = myApi.getState(); // where myApi.prototype.getState = unstrungify
 *
 * Result equivalent to `JSON.parse(JSON.stringify(this))`.
 *
 * > Do not use this function to get a JSON string; use `JSON.stringify(this)` instead.
 *
 * @this {*|object|*[]} - Object to walk; typically an object or array.
 *
 * @param {boolean} [options.nullElements==false] - Preserve undefined array elements as `null`s.
 * Use this when precise index matters (not merely the order of the elements).
 *
 * @param {boolean} [options.nullProperties==false] - Preserve undefined object properties as `null`s.
 *
 * @returns {object} - Distilled object.
 */
function unstrungify(options) {
    var clone, preserve,
        object = (typeof this.toJSON === 'function') ? this.toJSON() : this;

    if (unstrungify.isArray(object)) {
        clone = [];
        preserve = options && options.nullElements;
        object.forEach(function(obj) {
            var value = unstrungify.call(obj);
            if (value !== undefined) {
                clone.push(value);
            } else if (preserve) {
                clone.push(null); // undefined not a valid JSON value
            }
        });
    } else  if (typeof object === 'object') {
        clone = {};
        preserve = options && options.nullProperties;
        Object.keys(object).forEach(function(key) {
            var value = object[key];
            if (value !== undefined) {
                value = unstrungify.call(object[key]);
            }
            if (value !== undefined) {
                clone[key] = value;
            } else if (preserve) {
                clone[key] = null; // undefined not a valid JSON value
            }
        });
    } else {
        clone = object;
    }

    return clone;
}

/**
 * Very slow array test. Suitable for cross-frame scripting.
 *
 * Suggestion: If you need this and have jQuery loaded, use `jQuery.isArray` instead which is reasonably fast.
 *
 * @param {*} arr - The object to test.
 * @returns {boolean}
 */
unstrungify.crossFramesIsArray = function(arr) { return toString.call(arr) === arrString; }; // eslint-disable-line no-unused-vars

var toString = Object.prototype.toString, arrString = '[object Array]';

module.exports = unstrungify;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvZmFrZV9lNDc0OGIzYi5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvQ29sdW1uU2NoZW1hRmFjdG9yeS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvRGVmYXVsdEZpbHRlci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvcGFyc2VyLUNRTC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvbWl4LWlucy9kYXRhTW9kZWwuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL21peC1pbnMvZ3JpZC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Nzcy1pbmplY3Rvci9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2V4dGVuZC1tZS9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2h0bWwvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL0NvbmRpdGlvbmFscy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL0ZpbHRlckxlYWYuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9GaWx0ZXJOb2RlLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvRmlsdGVyVHJlZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL1RlbXBsYXRlcy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL2V4dGVuc2lvbnMvY29sdW1ucy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL3BhcnNlci1TUUwuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9zdHlsZXNoZWV0LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvdHJlZS1vcGVyYXRvcnMuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9vYmplY3QtaXRlcmF0b3JzL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvb3ZlcnJpZGVyL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL3RlbXAvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvcG9wLW1lbnUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9yZWdleHAtbGlrZS9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy90ZW1wL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL3RlbXBsZXgvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvdGVtcC9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy91bnN0cnVuZ2lmeS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9mQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9UQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIERlZmF1bHRGaWx0ZXIgPSByZXF1aXJlKCcuL2pzL0RlZmF1bHRGaWx0ZXInKTtcbnZhciBDb2x1bW5TY2hlbWFGYWN0b3J5ID0gcmVxdWlyZSgnLi9qcy9Db2x1bW5TY2hlbWFGYWN0b3J5Jyk7XG5cbi8qKlxuICogQHBhcmFtIHtIeXBlcmdyaWR9IGdyaWRcbiAqIEBwYXJhbSB7b2JqZWN0fSBbdGFyZ2V0c10gLSBIYXNoIG9mIG1peGluIHRhcmdldHMuIFRoZXNlIGFyZSB0eXBpY2FsbHkgcHJvdG90eXBlIG9iamVjdHMuIElmIG5vdCBnaXZlbiBvciBhbnkgdGFyZ2V0cyBhcmUgbWlzc2luZywgZGVmYXVsdHMgdG8gY3VycmVudCBncmlkJ3MgdmFyaW91cyBwcm90b3R5cGVzLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEh5cGVyZmlsdGVyKGdyaWQsIHRhcmdldHMpIHtcbiAgICB0aGlzLmdyaWQgPSBncmlkO1xuICAgIHRhcmdldHMgPSB0YXJnZXRzIHx8IHt9O1xuXG4gICAgbWl4SW5UbygnSHlwZXJncmlkJywgZ3JpZCwgcmVxdWlyZSgnLi9taXgtaW5zL2dyaWQnKSk7XG4gICAgbWl4SW5UbygnQmVoYXZpb3InLCBncmlkLmJlaGF2aW9yLCByZXF1aXJlKCcuL21peC1pbnMvYmVoYXZpb3InKSk7XG4gICAgbWl4SW5UbygnRGF0YU1vZGVsJywgZ3JpZC5iZWhhdmlvci5kYXRhTW9kZWwsIHJlcXVpcmUoJy4vbWl4LWlucy9kYXRhTW9kZWwnKSk7XG5cbiAgICBmdW5jdGlvbiBtaXhJblRvKHRhcmdldCwgaW5zdGFuY2UsIG1peGluKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0YXJnZXRzW3RhcmdldF07XG4gICAgICAgIHZhciBwcm90b3R5cGUgPSBvYmplY3QgJiYgb2JqZWN0LnByb3RvdHlwZSB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YoaW5zdGFuY2UpO1xuXG4gICAgICAgIHByb3RvdHlwZS5taXhJbihtaXhpbik7XG4gICAgfVxufVxuXG5IeXBlcmZpbHRlci5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IEh5cGVyZmlsdGVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgICQkQ0xBU1NfTkFNRTogJ0h5cGVyZmlsdGVyJyxcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGNhc2VTZW5zaXRpdmVEYXRhOiB0cnVlLFxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzOiB0cnVlLFxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgcmVzb2x2ZUFsaWFzZXM6IGZhbHNlLFxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBkZWZhdWx0Q29sdW1uRmlsdGVyT3BlcmF0b3I6ICcnLCAvLyBibGFuayBtZWFucyB1c2UgZGVmYXVsdCAoJz0nKVxuXG4gICAgLyoqXG4gICAgICogQ2FsbCB0aGlzIGJlZm9yZSBjYWxsaW5nIGBjcmVhdGVgIGlmIHlvdSB3YW50IHRvIG9yZ2FuaXplIGFuZC9vciBzb3J0IHlvdXIgc2NoZW1hLlxuICAgICAqL1xuICAgIGRlcml2ZVNjaGVtYTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZmFjdG9yeSA9IG5ldyBDb2x1bW5TY2hlbWFGYWN0b3J5KHRoaXMuZ3JpZC5iZWhhdmlvci5jb2x1bW5zKTtcbiAgICB9LFxuICAgIG9yZ2FuaXplU2NoZW1hOiBmdW5jdGlvbihjb2x1bW5Hcm91cHNSZWdleCwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmZhY3Rvcnkub3JnYW5pemUoY29sdW1uR3JvdXBzUmVnZXgsIG9wdGlvbnMpO1xuICAgIH0sXG4gICAgc29ydFNjaGVtYTogZnVuY3Rpb24oc3VibWVudVBsYWNlbWVudCkge1xuICAgICAgICB0aGlzLmZhY3Rvcnkuc29ydChzdWJtZW51UGxhY2VtZW50KTtcbiAgICB9LFxuICAgIGxvb2t1cEluU2NoZW1hOiBmdW5jdGlvbihmaW5kT3B0aW9ucywgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmFjdG9yeS5sb29rdXAoZmluZE9wdGlvbnMsIHZhbHVlKTtcbiAgICB9LFxuICAgIHdhbGtTY2hlbWE6IGZ1bmN0aW9uKGl0ZXJhdGVlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZhY3Rvcnkud2FsayhpdGVyYXRlZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bWVudUl0ZW1bXX0gW3NjaGVtYV0gLSBJZiBvbWl0dGVkLCB1c2UgZGVyaXZlZCBzY2hlbWEuIElmIG5vIGRlcml2ZWQgc2NoZW1hLCBkZXJpdmUgaXQgbm93LlxuICAgICAqL1xuICAgIGNyZWF0ZTogZnVuY3Rpb24oc2NoZW1hKSB7XG4gICAgICAgIGlmICghc2NoZW1hKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZmFjdG9yeSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVyaXZlU2NoZW1hKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzY2hlbWEgPSB0aGlzLmZhY3Rvcnkuc2NoZW1hO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZmFjdG9yeTsgLy8gZm9yY2UgbmV3IHNjaGVtYSBlYWNoIGNhbGwgdG8gY3JlYXRlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBEZWZhdWx0RmlsdGVyKHtcbiAgICAgICAgICAgIHNjaGVtYTogc2NoZW1hLFxuICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZURhdGE6IHRoaXMuY2FzZVNlbnNpdGl2ZURhdGEsXG4gICAgICAgICAgICBjYXNlU2Vuc2l0aXZlQ29sdW1uTmFtZXM6IHRoaXMuY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzLFxuICAgICAgICAgICAgcmVzb2x2ZUFsaWFzZXM6IHRoaXMucmVzb2x2ZUFsaWFzZXMsXG4gICAgICAgICAgICBkZWZhdWx0Q29sdW1uRmlsdGVyT3BlcmF0b3I6IHRoaXMuZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSHlwZXJmaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBwb3BNZW51ID0gcmVxdWlyZSgncG9wLW1lbnUnKTtcblxuLyoqXG4gKiBAY2xhc3NkZXNjIEJ1aWxkLCBvcmdhbml6ZSwgYW5kIHNvcnQgYSBjb2x1bW4gc2NoZW1hIGxpc3QgZnJvbSBhIGxpc3Qgb2YgY29sdW1ucy5cbiAqXG4gKiBGaWx0ZXJUcmVlIHJlcXVpcmVzIGEgY29sdW1uIHNjaGVtYS4gQXMgYSBmYWxsYmFjayB3aGVuIHlvdSBkb24ndCBoYXZlIGEgY29sdW1uIHNjaGVtYSBvZiB5b3VyIG93biwgdGhlIHN0cmluZyBhcnJheSByZXR1cm5lZCBieSBiZWhhdmlvci5kYXRhTW9kZWwuZ2V0RmllbGRzKCkgd291bGQgd29yayBhcyBpcy4gVGhpcyBmYWN0b3J5IG9iamVjdCB3aWxsIGRvIGEgbGl0dGxlIGJldHRlciB0aGFuIHRoYXQsIHRha2luZyBIeXBlcmdyaWQncyBjb2x1bW4gYXJyYXkgYW5kIGNyZWF0aW5nIGEgbW9yZSB0ZXh0dXJlZCBjb2x1bW4gc2NoZW1hLCBpbmNsdWRpbmcgY29sdW1uIGFsaWFzZXMgYW5kIHR5cGVzLlxuICpcbiAqIENBVkVBVDogU2V0IHVwIHRoZSBzY2hlbWEgY29tcGxldGVseSBiZWZvcmUgaW5zdGFudGlhdGluZyB5b3VyIGZpbHRlciBzdGF0ZS4gRmlsdGVyLXRyZWUgdXNlcyB0aGUgc2NoZW1hIChpbiBwYXJ0KSB0byBnZW5lcmF0ZSBjb2x1bW4gc2VsZWN0aW9uIGRyb3AtZG93bnMgYXMgcGFydCBvZiBpdHMgXCJxdWVyeSBidWlsZGVyXCIgVUkuIE5vdGUgdGhhdCB0aGUgVUkgaXMgKm5vdCogYXV0b21hdGljYWxseSB1cGRhdGVkIGlmIHlvdSBjaGFuZ2UgdGhlIHNjaGVtYSBsYXRlci5cbiAqXG4gKiBAcGFyYW0ge0NvbHVtbltdfSBjb2x1bW5zXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gQ29sdW1uU2NoZW1hRmFjdG9yeShjb2x1bW5zKSB7XG4gICAgLyoqXG4gICAgICogVGhpcyBpcyB0aGUgb3V0cHV0IHByb2R1Y2VkIGJ5IHRoZSBmYWN0b3J5LlxuICAgICAqIEB0eXBlIHttZW51SXRlbVtdfVxuICAgICAqL1xuICAgIHRoaXMuc2NoZW1hID0gY29sdW1ucy5tYXAoZnVuY3Rpb24oY29sdW1uKSB7XG4gICAgICAgIHZhciBpdGVtID0ge1xuICAgICAgICAgICAgbmFtZTogY29sdW1uLm5hbWUsXG4gICAgICAgICAgICBhbGlhczogY29sdW1uLmhlYWRlcixcbiAgICAgICAgICAgIHR5cGU6IGNvbHVtbi5nZXRUeXBlKClcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoY29sdW1uLmNhbGN1bGF0b3IpIHtcbiAgICAgICAgICAgIGl0ZW0uY2FsY3VsYXRvciA9IGNvbHVtbi5jYWxjdWxhdG9yO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfSk7XG59XG5cbnZhciBwbGFjZW1lbnRQcmVmaXhNYXAgPSB7XG4gICAgdG9wOiAnXFx1MDAwMCcsXG4gICAgYm90dG9tOiAnXFx1ZmZmZicsXG4gICAgdW5kZWZpbmVkOiAnJ1xufTtcblxuQ29sdW1uU2NoZW1hRmFjdG9yeS5wcm90b3R5cGUgPSB7XG5cbiAgICBjb25zdHJ1Y3RvcjogQ29sdW1uU2NoZW1hRmFjdG9yeS5wcm90b3R5cGUuY29uc3RydWN0b3IsXG5cbiAgICAvKipcbiAgICAgKiBPcmdhbml6ZSBzY2hlbWEgaW50byBzdWJtZW51cy5cbiAgICAgKiBAcGFyYW0ge1JlZ0V4cH0gY29sdW1uR3JvdXBzUmVnZXggLSBTY2hlbWEgbmFtZXMgb3IgYWxpYXNlcyB0aGF0IG1hdGNoIHRoaXMgYXJlIHB1dCBpbnRvIGEgc3VibWVudS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMua2V5PSduYW1lJ10gLSBNdXN0IGJlIGVpdGhlciAnbmFtZScgb3IgJ2FsaWFzJy5cbiAgICAgKi9cbiAgICBvcmdhbml6ZTogZnVuY3Rpb24oY29sdW1uR3JvdXBzUmVnZXgsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGtleSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5rZXkgfHwgJ25hbWUnLFxuICAgICAgICAgICAgc3VibWVudXMgPSB7fSxcbiAgICAgICAgICAgIG1lbnUgPSBbXTtcblxuICAgICAgICB0aGlzLnNjaGVtYS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGl0ZW1ba2V5XSxcbiAgICAgICAgICAgICAgICBncm91cCA9IHZhbHVlLm1hdGNoKGNvbHVtbkdyb3Vwc1JlZ2V4KTtcbiAgICAgICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgICAgIGdyb3VwID0gZ3JvdXBbMF07XG4gICAgICAgICAgICAgICAgaWYgKCEoZ3JvdXAgaW4gc3VibWVudXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Ym1lbnVzW2dyb3VwXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBncm91cC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWVudTogW11cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3VibWVudXNbZ3JvdXBdLnN1Ym1lbnUucHVzaChpdGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVudS5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKHZhciBzdWJtZW51TmFtZSBpbiBzdWJtZW51cykge1xuICAgICAgICAgICAgbWVudS5wdXNoKHN1Ym1lbnVzW3N1Ym1lbnVOYW1lXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNjaGVtYSA9IG1lbnU7XG4gICAgfSxcblxuICAgIGxvb2t1cDogZnVuY3Rpb24oZmluZE9wdGlvbnMsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBwb3BNZW51Lmxvb2t1cC5hcHBseSh0aGlzLnNjaGVtYSwgYXJndW1lbnRzKTtcbiAgICB9LFxuXG4gICAgd2FsazogZnVuY3Rpb24oaXRlcmF0ZWUpIHtcbiAgICAgICAgcmV0dXJuIHBvcE1lbnUud2Fsay5hcHBseSh0aGlzLnNjaGVtYSwgYXJndW1lbnRzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU29ydCB0aGUgc2NoZW1hLlxuICAgICAqIEBkZXNjIFdhbGsgdGhlIG1lbnUgc3RydWN0dXJlLCBzb3J0aW5nIGVhY2ggc3VibWVudSB1bnRpbCBmaW5hbGx5IHRoZSB0b3AtbGV2ZWwgbWVudSBpcyBzb3J0ZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc3VibWVudVBsYWNlbWVudF0gLSBPbmUgb2Y6XG4gICAgICogKiBgJ3RvcCdgIC0gUGxhY2UgYWxsIHRoZSBzdWJtZW51cyBhdCB0aGUgdG9wIG9mIGVhY2ggZW5jbG9zaW5nIHN1Ym1lbnUuXG4gICAgICogKiBgJ2JvdHRvbSdgIC0gUGxhY2UgYWxsIHRoZSBzdWJtZW51cyBhdCB0aGUgYm90dG9tIG9mIGVhY2ggZW5jbG9zaW5nIHN1Ym1lbnUuXG4gICAgICogKiBgdW5kZWZpbmVkYCAob3Igb21pdHRlZCkgLSBHaXZlIG5vIHNwZWNpYWwgdHJlYXRtZW50IHRvIHN1Ym1lbnVzLlxuICAgICAqL1xuICAgIHNvcnQ6IGZ1bmN0aW9uKHN1Ym1lbnVQbGFjZW1lbnQpIHtcbiAgICAgICAgdmFyIHByZWZpeCA9IHBsYWNlbWVudFByZWZpeE1hcFtzdWJtZW51UGxhY2VtZW50XTtcblxuICAgICAgICB0aGlzLnNjaGVtYS5zb3J0KGZ1bmN0aW9uIHJlY3Vyc2UoYSwgYikge1xuICAgICAgICAgICAgaWYgKGEubGFiZWwgJiYgIWEuc29ydGVkKSB7XG4gICAgICAgICAgICAgICAgYS5zdWJtZW51LnNvcnQocmVjdXJzZSk7XG4gICAgICAgICAgICAgICAgYS5zb3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYSA9IGEubGFiZWwgPyBwcmVmaXggKyBhLmxhYmVsIDogYS5hbGlhcyB8fCBhLm5hbWUgfHwgYTtcbiAgICAgICAgICAgIGIgPSBiLmxhYmVsID8gcHJlZml4ICsgYi5sYWJlbCA6IGIuYWxpYXMgfHwgYi5uYW1lIHx8IGI7XG4gICAgICAgICAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sdW1uU2NoZW1hRmFjdG9yeTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG5cbnZhciBGaWx0ZXJUcmVlID0gcmVxdWlyZSgnZmlsdGVyLXRyZWUnKTtcbnZhciBQYXJzZXJDUUwgPSByZXF1aXJlKCcuL3BhcnNlci1DUUwnKTtcblxuLy8gQWRkIGEgcHJvcGVydHkgYG1lbnVNb2Rlc2AgdG8gdGggZSB0cmVlLCBkZWZhdWx0aW5nIHRvIGBvcGVyYXRvcnNgIGFzIHRoZSBvbmx5IGFjdGl2ZSBtb2RlXG5GaWx0ZXJUcmVlLk5vZGUub3B0aW9uc1NjaGVtYS5tZW51TW9kZXMgPSB7XG4gICAgZGVmYXVsdDoge1xuICAgICAgICBvcGVyYXRvcnM6IDFcbiAgICB9XG59O1xuXG4vLyBBZGQgYG9wTWVudUdyb3Vwc2AgdG8gcHJvdG90eXBlIGJlY2F1c2UgbmVlZGVkIGJ5IEZpbHRlckJveC5cbkZpbHRlclRyZWUuTm9kZS5wcm90b3R5cGUub3BNZW51R3JvdXBzID0gRmlsdGVyVHJlZS5Db25kaXRpb25hbHMuZ3JvdXBzO1xuXG5mdW5jdGlvbiBxdW90ZSh0ZXh0KSB7XG4gICAgdmFyIHF0ID0gUGFyc2VyQ1FMLnF0O1xuICAgIHJldHVybiBxdCArIHRleHQucmVwbGFjZShuZXcgUmVnRXhwKHF0LCAnZycpLCBxdCArIHF0KSArIHF0O1xufVxuXG52YXIgbGlrZURyZXNzZXMgPSBbXG4gICAgeyByZWdleDogL14oTk9UICk/TElLRSAlKC4rKSUkL2ksIG9wZXJhdG9yOiAnY29udGFpbnMnIH0sXG4gICAgeyByZWdleDogL14oTk9UICk/TElLRSAoLispJSQvaSwgb3BlcmF0b3I6ICdiZWdpbnMnIH0sXG4gICAgeyByZWdleDogL14oTk9UICk/TElLRSAlKC4rKSQvaSwgb3BlcmF0b3I6ICdlbmRzJyB9XG5dO1xudmFyIHJlZ2V4RXNjYXBlZExpa2VQYXR0ZXJuQ2hhcnMgPSAvXFxbKFtfXFxbXFxdJV0pXFxdL2c7IC8vIGNhcHR1cmUgYWxsIF8sIFssIF0sIGFuZCAlIGNoYXJzIGVuY2xvc2VkIGluIFtdXG52YXIgcmVnZXhMaWtlUGF0dGVybkNoYXIgPSAvW19cXFtcXF0lXS87IC8vIGZpbmQgYW55IF8sIFssIF0sIGFuZCAlIGNoYXJzIE5PVCBlbmNsb3NlZCBpbiBbXVxuXG4vLyBjb252ZXJ0IGNlcnRhaW4gTElLRSBleHByZXNzaW9ucyB0byBCRUdJTlMsIEVORFMsIENPTlRBSU5TXG5mdW5jdGlvbiBjb252ZXJ0TGlrZVRvUHNldWRvT3AocmVzdWx0KSB7XG4gICAgbGlrZURyZXNzZXMuZmluZChmdW5jdGlvbihkcmVzcykge1xuICAgICAgICB2YXIgbWF0Y2ggPSByZXN1bHQubWF0Y2goZHJlc3MucmVnZXgpO1xuXG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgLy8gdW5lc2NhcGUgYWxsIExJS0UgcGF0dGVybiBjaGFycyBlc2NhcGVkIHdpdGggYnJhY2tldHNcbiAgICAgICAgICAgIHZhciBub3QgPSAobWF0Y2hbMV0gfHwgJycpLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgb3BlcmF0b3IgPSBkcmVzcy5vcGVyYXRvcixcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbWF0Y2hbMl0sXG4gICAgICAgICAgICAgICAgb3BlcmFuZFdpdGhvdXRFc2NhcGVkQ2hhcnMgPSBvcGVyYW5kLnJlcGxhY2UocmVnZXhFc2NhcGVkTGlrZVBhdHRlcm5DaGFycywgJycpO1xuXG4gICAgICAgICAgICAvLyBpZiByZXN1bHQgaGFzIG5vIGFjdHVhIHJlbWFpbmluZyBMSUtFIHBhdHRlcm4gY2hhcnMsIGdvIHdpdGggdGhlIGNvbnZlcnNpb25cbiAgICAgICAgICAgIGlmICghcmVnZXhMaWtlUGF0dGVybkNoYXIudGVzdChvcGVyYW5kV2l0aG91dEVzY2FwZWRDaGFycykpIHtcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gb3BlcmFuZC5yZXBsYWNlKHJlZ2V4RXNjYXBlZExpa2VQYXR0ZXJuQ2hhcnMsICckMScpOyAvLyB1bmVzY2FwZSB0aGUgZXNjYXBlZCBjaGFyc1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5vdCArIG9wZXJhdG9yICsgJyAnICsgb3BlcmFuZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbnZhciBjb25kaXRpb25hbHNDUUwgPSBuZXcgRmlsdGVyVHJlZS5Db25kaXRpb25hbHMoKTtcbmNvbmRpdGlvbmFsc0NRTC5tYWtlTElLRSA9IGZ1bmN0aW9uKGJlZywgZW5kLCBvcCwgb3JpZ2luYWxPcCwgYykge1xuICAgIG9wID0gb3JpZ2luYWxPcC50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBvcCArICcgJyArIHF1b3RlKGMub3BlcmFuZCk7XG59O1xuY29uZGl0aW9uYWxzQ1FMLm1ha2VJTiA9IGZ1bmN0aW9uKG9wLCBjKSB7XG4gICAgcmV0dXJuIG9wLnRvTG93ZXJDYXNlKCkgKyAnICgnICsgYy5vcGVyYW5kLnJlcGxhY2UoL1xccyosXFxzKi9nLCAnLCAnKSArICcpJztcbn07XG5jb25kaXRpb25hbHNDUUwubWFrZSA9IGZ1bmN0aW9uKG9wLCBjKSB7XG4gICAgdmFyIG51bWVyaWNPcGVyYW5kO1xuICAgIG9wID0gb3AudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoL1xcdy8udGVzdChvcCkpIHsgb3AgKz0gJyAnOyB9XG4gICAgb3AgKz0gYy5nZXRUeXBlKCkgPT09ICdudW1iZXInICYmICFpc05hTihudW1lcmljT3BlcmFuZCA9IE51bWJlcihjLm9wZXJhbmQpKVxuICAgICAgICA/IG51bWVyaWNPcGVyYW5kXG4gICAgICAgIDogcXVvdGUoYy5vcGVyYW5kKTtcbiAgICByZXR1cm4gb3A7XG59O1xuXG4vLyByZXBsYWNlIHRoZSBkZWZhdWx0IGZpbHRlciB0cmVlIHRlcm1pbmFsIG5vZGUgY29uc3RydWN0b3Igd2l0aCBhbiBleHRlbnNpb24gb2Ygc2FtZVxudmFyIEN1c3RvbUZpbHRlckxlYWYgPSBGaWx0ZXJUcmVlLnByb3RvdHlwZS5hZGRFZGl0b3Ioe1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4O1xuXG4gICAgICAgIGlmIChzeW50YXggPT09ICdDUUwnKSB7XG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLmdldFN5bnRheChjb25kaXRpb25hbHNDUUwpO1xuICAgICAgICAgICAgcmVzdWx0ID0gY29udmVydExpa2VUb1BzZXVkb09wKHJlc3VsdCk7XG4gICAgICAgICAgICB2YXIgZGVmYXVsdE9wID0gdGhpcy5zY2hlbWEubG9va3VwKHRoaXMuY29sdW1uKS5kZWZhdWx0T3AgfHwgdGhpcy5yb290LnBhcnNlckNRTC5kZWZhdWx0T3A7IC8vIG1pbWljcyBsb2dpYyBpbiBwYXJzZXItQ1FMLmpzLCBsaW5lIDExMFxuICAgICAgICAgICAgaWYgKHJlc3VsdC50b1VwcGVyQ2FzZSgpLmluZGV4T2YoZGVmYXVsdE9wKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5zdWJzdHIoZGVmYXVsdE9wLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBGaWx0ZXJUcmVlLkxlYWYucHJvdG90eXBlLmdldFN0YXRlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJUcmVlLnByb3RvdHlwZS5hZGRFZGl0b3IoJ0NvbHVtbnMnKTtcblxuLy8gQWRkIHNvbWUgbm9kZSB0ZW1wbGF0ZXMgYnkgdXBkYXRpbmcgc2hhcmVkIGluc3RhbmNlIG9mIEZpbHRlck5vZGUncyB0ZW1wbGF0ZXMuIChPSyB0byBtdXRhdGUgc2hhcmVkIGluc3RhbmNlOyBmaWx0ZXItdHJlZSBub3QgYmVpbmcgdXNlZCBmb3IgYW55dGhpbmcgZWxzZSBoZXJlLiBBbHRlcm5hdGl2ZWx5LCB3ZSBjb3VsZCBoYXZlIGluc3RhbnRpYXRlZCBhIG5ldyBUZW1wbGF0ZXMgb2JqZWN0IGZvciBvdXIgRGVmYXVsdEZpbHRlciBwcm90b3R5cGUsIGFsdGhvdWdoIHRoaXMgd291bGQgb25seSBhZmZlY3QgdHJlZSBub2Rlcywgbm90IGxlYWYgbm9kZXMsIGJ1dCB0aGF0IHdvdWxkIGJlIG9rIGluIHRoaXMgY2FzZSBzaW5jZSB0aGUgYWRkaXRpb25zIGJlbG93IGFyZSB0cmVlIG5vZGUgdGVtcGxhdGVzLilcbl8oRmlsdGVyVHJlZS5Ob2RlLnByb3RvdHlwZS50ZW1wbGF0ZXMpLmV4dGVuZE93bih7XG4gICAgY29sdW1uRmlsdGVyOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbiAgICAgICAgJyAgIDxzdHJvbmc+PHNwYW4+ezJ9IDwvc3Bhbj48L3N0cm9uZz48YnI+JyxcbiAgICAgICAgJyAgIE1hdGNoJyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1hbmRcIj5hbGw8L2xhYmVsPicsXG4gICAgICAgICcgICA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3Atbm9yXCI+bm9uZTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIG9mIHRoZSBmb2xsb3dpbmc6JyxcbiAgICAgICAgJyAgIDxzZWxlY3Q+JyxcbiAgICAgICAgJyAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4gICAgICAgICcgICA8L3NlbGVjdD4nLFxuICAgICAgICAnICAgPG9sPjwvb2w+JyxcbiAgICAgICAgJzwvc3Bhbj4nXG4gICAgXVxuICAgICAgICAuam9pbignXFxuJyksXG5cbiAgICBjb2x1bW5GaWx0ZXJzOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlIGZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnNcIj4nLFxuICAgICAgICAnICAgTWF0Y2ggPHN0cm9uZz5hbGw8L3N0cm9uZz4gb2YgdGhlIGZvbGxvd2luZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb25zOicsXG4gICAgICAgICcgICA8b2w+PC9vbD4nLFxuICAgICAgICAnPC9zcGFuPidcbiAgICBdXG4gICAgICAgIC5qb2luKCdcXG4nKVxufSk7XG5cbi8qKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAZGVzYyBUaGlzIGV4dGVuc2lvbiBvZiBGaWx0ZXJUcmVlIGZvcmNlcyBhIHNwZWNpZmljIHRyZWUgc3RydWN0dXJlLlxuICogU2VlIHtAbGluayBtYWtlTmV3Um9vdH0gZm9yIGEgZGVzY3JpcHRpb24uXG4gKlxuICogU2VlIGFsc28ge0B0dXRvcmlhbCBmaWx0ZXItYXBpfS5cbiAqXG4gKiBAcGFyYW0ge0ZpbHRlclRyZWVPcHRpb25zT2JqZWN0fSBvcHRpb25zIC0gWW91IHNob3VsZCBwcm92aWRlIGEgY29sdW1uIHNjaGVtYS4gVGhlIGVhc2llc3QgYXBwcm9hY2ggaXMgdG8gcHJvdmlkZSBhIHNjaGVtYSBmb3IgdGhlIGVudGlyZSBmaWx0ZXIgdHJlZSB0aHJvdWdoIGBvcHRpb25zLnNjaGVtYWAuXG4gKlxuICogQWx0aG91Z2ggbm90IHJlY29tbWVuZGVkLCB0aGUgY29sdW1uIHNjaGVtYSBjYW4gYWxzbyBiZSBlbWJlZGRlZCBpbiB0aGUgc3RhdGUgb2JqZWN0LCBlaXRoZXIgYXQgdGhlIHJvb3QsIGBvcHRpb25zLnN0YXRlLnNjaGVtYWAsIG9yIGZvciBhbnkgZGVzY2VuZGFudCBub2RlLiBGb3IgZXhhbXBsZSwgYSBzZXBhcmF0ZSBzY2hlbWEgY291bGQgYmUgcHJvdmlkZWQgZm9yIGVhY2ggZXhwcmVzc2lvbiBvciBzdWJleHByZXNzaW9uIHRoYXQgbmVlZCB0byByZW5kZXIgY29sdW1uIGxpc3QgZHJvcC1kb3ducy5cbiAqXG4gKiBOT1RFOiBJZiBgb3B0aW9ucy5zdGF0ZWAgaXMgdW5kZWZpbmVkLCBpdCBpcyBkZWZpbmVkIGluIGBwcmVJbml0aWFsaXplKClgIGFzIGEgbmV3IGVtcHR5IHN0YXRlIHNjYWZmb2xkIChzZWUge0BsaW5rIG1ha2VOZXdSb290fSkgd2l0aCB0aGUgdHdvIHRydW5rcyB0byBob2xkIGEgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycy4gRXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGNhbiBiZSBhZGRlZCB0byB0aGlzIGVtcHR5IHNjYWZmb2xkIGVpdGhlciBwcm9ncmFtbWF0aWNhbGx5IG9yIHRocm91Z2ggdGhlIFF1ZXJ5IEJ1aWxkZXIgVUkuXG4gKi9cbnZhciBEZWZhdWx0RmlsdGVyID0gRmlsdGVyVHJlZS5leHRlbmQoJ0RlZmF1bHRGaWx0ZXInLCB7XG4gICAgcHJlSW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGRlZmF1bHQgXCJIeXBlcmZpbHRlclwiIHByb2ZpbGUgKHNlZSBmdW5jdGlvbiBjb21tZW50cylcbiAgICAgICAgdmFyIHN0YXRlID0gb3B0aW9ucy5zdGF0ZSA9IG9wdGlvbnMuc3RhdGUgfHwgdGhpcy5tYWtlTmV3Um9vdCgpO1xuXG4gICAgICAgIC8vIFVwb24gY3JlYXRpb24gb2YgYSAnY29sdW1uRmlsdGVyJyBub2RlLCBmb3JjZSB0aGUgc2NoZW1hIHRvIHRoZSBvbmUgY29sdW1uXG4gICAgICAgIGlmICgob3B0aW9ucy50eXBlIHx8IHN0YXRlICYmIHN0YXRlLnR5cGUpID09PSAnY29sdW1uRmlsdGVyJykge1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBbXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnQucm9vdC5zY2hlbWEubG9va3VwKHN0YXRlLmNoaWxkcmVuWzBdLmNvbHVtbilcbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW29wdGlvbnNdO1xuICAgIH0sXG5cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcblxuICAgICAgICBpZiAoIXRoaXMucGFyZW50KSB7XG4gICAgICAgICAgICB0aGlzLmV4dHJhY3RTdWJ0cmVlcygpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHBvc3RJbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGlmICh0aGlzID09PSB0aGlzLnJvb3QgJiYgIXRoaXMucGFyc2VyQ1FMKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlckNRTCA9IG5ldyBQYXJzZXJDUUwodGhpcy5jb25kaXRpb25hbHMub3BzLCB7XG4gICAgICAgICAgICAgICAgc2NoZW1hOiB0aGlzLnNjaGVtYSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0T3A6IG9wdGlvbnMuZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09ICdjb2x1bW5GaWx0ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmRvbnRQZXJzaXN0LnNjaGVtYSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGNvbnZlbmllbmNlIHZhcnMgdG8gcmVmZXJlbmNlIHRoZSAyIHJvb3QgXCJIeXBlcmZpbHRlclwiIG5vZGVzXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZXh0cmFjdFN1YnRyZWVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJvb3ROb2RlcyA9IHRoaXMucm9vdC5jaGlsZHJlbjtcbiAgICAgICAgdGhpcy50YWJsZUZpbHRlciA9IHJvb3ROb2Rlc1swXTtcbiAgICAgICAgdGhpcy5jb2x1bW5GaWx0ZXJzID0gcm9vdE5vZGVzWzFdO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBNYWtlIGEgbmV3IGVtcHR5IEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZSBzdGF0ZSBvYmplY3QuXG4gICAgICogQGRlc2MgVGhpcyBmdW5jdGlvbiBtYWtlcyBhIG5ldyBkZWZhdWx0IHN0YXRlIG9iamVjdCBhcyB1c2VkIGJ5IEh5cGVyZ3JpZCwgYSByb290IHdpdGggZXhhY3RseSB0d28gXCJ0cnVua3MuXCJcbiAgICAgKlxuICAgICAqID4gKipEZWZpbml0aW9uOioqIEEgKnRydW5rKiBpcyBkZWZpbmVkIGFzIGEgY2hpbGQgbm9kZSB3aXRoIGEgdHJ1dGh5IGBrZWVwYCBwcm9wZXJ0eSwgbWFraW5nIHRoaXMgbm9kZSBpbW11bmUgdG8gdGhlIHVzdWFsIHBydW5pbmcgdGhhdCB3b3VsZCBvY2N1ciB3aGVuIGl0IGhhcyBubyBjaGlsZCBub2RlcyBvZiBpdHMgb3duLiBUbyBiZSBhIHRydWUgdHJ1bmssIGFsbCBhbmNlc3RvciBub2RlcyB0byBiZSB0cnVua3MgYXMgd2VsbC4gTm90ZSB0aGF0IHRoZSByb290IGlzIGEgbmF0dXJhbCB0cnVuazsgaXQgZG9lcyBub3QgcmVxdWlyZSBhIGBrZWVwYCBwcm9wZXJ0eS5cbiAgICAgKlxuICAgICAqIFRoZSB0d28gdHJ1bmtzIG9mIHRoZSBIeXBlcmdyaWQgZmlsdGVyIGFyZTpcbiAgICAgKiAqIFRoZSAqKlRhYmxlIEZpbHRlcioqIChsZWZ0IHRydW5rLCBvciBgY2hpbGRyZW5bMF1gKSwgYSBoaWVyYXJjaHkgb2YgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucy5cbiAgICAgKiAqIFRoZSAqKkNvbHVtbiBGaWx0ZXJzKiogKHJpZ2h0IHRydW5rLCBvciBgY2hpbGRyZW5bMV1gKSwgYSBzZXJpZXMgb2Ygc3ViZXhwcmVzc2lvbnMsIG9uZSBwZXIgYWN0aXZlIGNvbHVtbiBmaWx0ZXIuIEVhY2ggc3ViZXhwcmVzc2lvbiBjb250YWlucyBhbnkgbnVtYmVyIG9mIGV4cHJlc3Npb25zIGJvdW5kIHRvIHRoYXQgY29sdW1uIGJ1dCBubyBmdXJ0aGVyIHN1YmV4cHJlc3Npb25zLlxuICAgICAqXG4gICAgICogVGhlIGBvcGVyYXRvcmAgcHJvcGVydGllcyBmb3IgYWxsIHN1YmV4cHJlc3Npb25zIGRlZmF1bHQgdG8gYCdvcC1hbmQnYCwgd2hpY2ggbWVhbnM6XG4gICAgICogKiBBbGwgdGFibGUgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIGlzIGp1c3QgdGhlIGRlZmF1bHQgYW5kIG1heSBiZSBjaGFuZ2VkIGZyb20gdGhlIFVJLilcbiAgICAgKiAqIEFsbCBleHByZXNzaW9ucyB3aXRoaW4gYSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBpcyBqdXN0IHRoZSBkZWZhdWx0IGFuZCBtYXkgYmUgY2hhbmdlZCBmcm9tIHRoZSBVSS4pXG4gICAgICogKiBBbGwgY29sdW1uIEZpbHRlcnMgc3ViZXhwcmVzc2lvbnMgYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBtYXkgbm90IGJlIGNoYW5nZWQgZnJvbSBVSS4pXG4gICAgICogKiBGaW5hbGx5LCB0aGUgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIG1heSBub3QgYmUgY2hhbmdlZCBmcm9tIFVJLilcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEEgcGxhaW4gb2JqZWN0IHRvIHNlcnZlIGFzIGEgZmlsdGVyLXRyZWUgc3RhdGUgb2JqZWN0IHJlcHJlc2VudGluZyBhIG5ldyBIeXBlcmdyaWQgZmlsdGVyLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFrZU5ld1Jvb3Q6IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHRoaXMudGFibGVGaWx0ZXIgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyB0YWJsZSBmaWx0ZXIgZXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGdvIGhlcmVcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnMgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcnMnLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyBzdWJleHByZXNzaW9ucyB3aXRoIHR5cGUgJ2NvbHVtbkZpbHRlcicgZ28gaGVyZSwgb25lIGZvciBlYWNoIGFjdGl2ZSBjb2x1bW4gZmlsdGVyXG4gICAgICAgICAgICBdXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGZpbHRlciA9IHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUZpbHRlcixcbiAgICAgICAgICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnNcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gZmlsdGVyO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBub2RlLlxuICAgICAqIEBkZXNjIEVhY2ggY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIG5vZGUgaXMgYSBjaGlsZCBub2RlIG9mIHRoZSBgY29sdW1uRmlsdGVyc2AgdHJ1bmsgb2YgdGhlIEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZS5cbiAgICAgKiBFYWNoIHN1Y2ggbm9kZSBjb250YWlucyBhbGwgdGhlIGNvbHVtbiBmaWx0ZXIgZXhwcmVzc2lvbnMgZm9yIHRoZSBuYW1lZCBjb2x1bW4uIEl0IHdpbGwgbmV2ZXIgYmUgZW1wdHk7IGlmIHRoZXJlIGlzIG5vIGNvbHVtbiBmaWx0ZXIgZm9yIHRoZSBuYW1lZCBjb2x1bW4sIGl0IHdvbid0IGV4aXN0IGluIGBjb2x1bW5GaWx0ZXJzYC5cbiAgICAgKlxuICAgICAqIENBVVRJT046IFRoaXMgaXMgdGhlIGFjdHVhbCBub2RlIG9iamVjdC4gRG8gbm90IGNvbmZ1c2UgaXQgd2l0aCB0aGUgY29sdW1uIGZpbHRlciBfc3RhdGVfIG9iamVjdCAoZm9yIHdoaWNoIHNlZSB0aGUge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0Q29sdW1uRmlsdGVyU3RhdGV8Z2V0Q29sdW1uRmlsdGVyU3RhdGUoKX0gbWV0aG9kKS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RGVmYXVsdEZpbHRlcn0gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiB0aGUgY29sdW1uIGZpbHRlciBkb2VzIG5vdCBleGlzdC5cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbk5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sdW1uRmlsdGVycy5jaGlsZHJlbi5maW5kKGZ1bmN0aW9uKGNvbHVtbkZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbkZpbHRlci5jaGlsZHJlbi5sZW5ndGggJiYgY29sdW1uRmlsdGVyLmNoaWxkcmVuWzBdLmNvbHVtbiA9PT0gY29sdW1uTmFtZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gICAgICogU2VlIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdHx0eXBlIGRlZmluaXRpb259IGluIHRoZSBmaWx0ZXItdHJlZSBkb2N1bWVudGF0aW9uLlxuICAgICAqL1xuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3RcbiAgICAgKiBTZWUgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fHR5cGUgZGVmaW5pdGlvbn0gaW4gdGhlIGZpbHRlci10cmVlIGRvY3VtZW50YXRpb24uXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXJTdGF0ZTogZnVuY3Rpb24ocmF3Q29sdW1uTmFtZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSk7XG5cbiAgICAgICAgaWYgKGNvbHVtblNjaGVtYSkge1xuICAgICAgICAgICAgdmFyIHN1YmV4cHJlc3Npb24gPSB0aGlzLmdldENvbHVtbkZpbHRlcihjb2x1bW5TY2hlbWEubmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChzdWJleHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuc3ludGF4ID0gJ0NRTCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHN1YmV4cHJlc3Npb24uZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZGRzIENRTCBzdXBwb3J0IHRvIHRoaXMuZ2V0U3RhdGUoKS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgcGFyc2VyIGVycm9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGB0aGlzLnJvb3QuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldENvbHVtbkZpbHRlclN0YXRlYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0Q29sdW1uRmlsdGVyU3RhdGU6IGZ1bmN0aW9uKHJhd0NvbHVtbk5hbWUsIHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcixcbiAgICAgICAgICAgIHN1YmV4cHJlc3Npb247XG5cbiAgICAgICAgdmFyIGNvbHVtbk5hbWUgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSkubmFtZTtcblxuICAgICAgICBpZiAoIWNvbHVtbk5hbWUpIHtcbiAgICAgICAgICAgIHRocm93ICdVbmtub3duIGNvbHVtbiBuYW1lIFwiJyArIHJhd0NvbHVtbk5hbWUgKyAnXCInO1xuICAgICAgICB9XG5cbiAgICAgICAgc3ViZXhwcmVzc2lvbiA9IHRoaXMuZ2V0Q29sdW1uRmlsdGVyKGNvbHVtbk5hbWUpO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IF8oe30pLmV4dGVuZChvcHRpb25zKTsgLy8gY2xvbmUgaXQgYmVjYXVzZSB3ZSBtYXkgbXV0YXRlIGl0IGJlbG93XG4gICAgICAgICAgICBvcHRpb25zLnN5bnRheCA9IG9wdGlvbnMuc3ludGF4IHx8ICdDUUwnO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5zeW50YXggPT09ICdDUUwnKSB7XG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBzb21lIENRTCBzdGF0ZSBzeW50YXggaW50byBhIGZpbHRlciB0cmVlIHN0YXRlIG9iamVjdC5cbiAgICAgICAgICAgICAgICAvLyBUaGVyZSBtdXN0IGJlIGF0IGxlYXN0IG9uZSBjb21wbGV0ZSBleHByZXNzaW9uIG9yIGBzdGF0ZWAgd2lsbCBiZWNvbWUgdW5kZWZpbmVkLlxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5yb290LnBhcnNlckNRTC5wYXJzZShzdGF0ZSwgY29sdW1uTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5zeW50YXggPSAnb2JqZWN0JztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdEZWZhdWx0RmlsdGVyOiBObyBjb21wbGV0ZSBleHByZXNzaW9uLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvciA9IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWVycm9yKSB7IC8vIHBhcnNlIHN1Y2Nlc3NmdWxcbiAgICAgICAgICAgICAgICBpZiAoc3ViZXhwcmVzc2lvbikgeyAvLyBzdWJleHByZXNzaW9uIGFscmVhZHkgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlcGxhY2Ugc3ViZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhpcyBjb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgc3ViZXhwcmVzc2lvbi5zZXRTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGEgbmV3IHN1YmV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoaXMgY29sdW1uXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5wYXJzZVN0YXRlU3RyaW5nKHN0YXRlLCBvcHRpb25zKTsgLy8gYmVjYXVzZSAuYWRkKCkgb25seSB0YWtlcyBvYmplY3Qgc3ludGF4XG4gICAgICAgICAgICAgICAgICAgIHN1YmV4cHJlc3Npb24gPSB0aGlzLmNvbHVtbkZpbHRlcnMuYWRkKHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlcnJvciA9IHN1YmV4cHJlc3Npb24uaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdWJleHByZXNzaW9uICYmICghc3RhdGUgfHwgZXJyb3IpKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgc3ViZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhpcyBjb2x1bW5cbiAgICAgICAgICAgIHN1YmV4cHJlc3Npb24ucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEdldCBzdGF0ZSBvZiBhbGwgY29sdW1uIGZpbHRlcnMuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXJzU3RhdGU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggPT09ICdDUUwnKSB7XG4gICAgICAgICAgICB0aHJvdyAnVGhlIENRTCBzeW50YXggaXMgaW50ZW5kZWQgZm9yIHVzZSBvbiBhIHNpbmdsZSBjb2x1bW4gZmlsdGVyIG9ubHkuIEl0IGRvZXMgbm90IHN1cHBvcnQgbXVsdGlwbGUgY29sdW1ucyBvciBzdWJleHByZXNzaW9ucy4nO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QuY29sdW1uRmlsdGVycy5nZXRTdGF0ZShvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IHN0YXRlIG9mIGFsbCBjb2x1bW4gZmlsdGVycy5cbiAgICAgKiBAZGVzYyBOb3RlIHRoYXQgdGhlIGNvbHVtbiBmaWx0ZXJzIGltcGxlbWVudGF0aW9uIGRlcGVuZHMgb24gdGhlIG5vZGVzIGhhdmluZyBjZXJ0YWluIG1ldGEtZGF0YTsgeW91IHNob3VsZCBub3QgYmUgY2FsbGluZyB0aGlzIHdpdGhvdXQgdGhlc2UgbWV0YS1kYXRhIGJlaW5nIGluIHBsYWNlLiBTcGVjaWZpY2FsbHkgYHR5cGUgPSAnY29sdW1uRmlsdGVycydgIGFuZCAgYGtlZXAgPSB0cnVlYCBmb3IgdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgYW5kYHR5cGUgPSAnY29sdW1uRmlsdGVyJ2AgZm9yIGVhY2ggaW5kaXZpZHVhbCBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24uIEluIGFkZGl0aW9uIHRoZSBzdWJ0cmVlIG9wZXJhdG9ycyBzaG91bGQgYWx3YXlzIGJlIGAnb3AtYW5kJ2AuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0Q29sdW1uRmlsdGVyc1N0YXRlOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgZXJyb3I7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3QuY29sdW1uRmlsdGVycy5zZXRTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBlcnJvciA9IHRoaXMucm9vdC5jb2x1bW5GaWx0ZXJzLmludmFsaWQob3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0VGFibGVGaWx0ZXJTdGF0ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCA9PT0gJ0NRTCcpIHtcbiAgICAgICAgICAgIHRocm93ICdUaGUgQ1FMIHN5bnRheCBpcyBpbnRlbmRlZCBmb3IgdXNlIG9uIGEgc2luZ2xlIGNvbHVtbiBmaWx0ZXIgb25seS4gSXQgZG9lcyBub3Qgc3VwcG9ydCBtdWx0aXBsZSBjb2x1bW5zIG9yIHN1YmV4cHJlc3Npb25zLic7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC50YWJsZUZpbHRlci5nZXRTdGF0ZShvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUYWJsZUZpbHRlclN0YXRlOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgZXJyb3I7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3QudGFibGVGaWx0ZXIuc2V0U3RhdGUoc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgZXJyb3IgPSB0aGlzLnJvb3QudGFibGVGaWx0ZXIuaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucm9vdC50YWJsZUZpbHRlci5jaGlsZHJlbi5sZW5ndGggPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBUaGUgQ1FMIHN5bnRheCBzaG91bGQgb25seSBiZSByZXF1ZXN0ZWQgZm9yIGEgc3VidHJlZSBjb250YWluaW5nIGhvbW9nZW5lb3VzIGNvbHVtbiBuYW1lcyBhbmQgbm8gc3ViZXhwcmVzc2lvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuc3ludGF4PSdvYmplY3QnXSAtIElmIGAnQ1FMJ2AsIHdhbGtzIHRoZSB0cmVlLCByZXR1cm5pbmcgYSBzdHJpbmcgc3VpdGFibGUgZm9yIGEgSHlwZXJncmlkIGZpbHRlciBjZWxsLiBBbGwgb3RoZXIgdmFsdWVzIGFyZSBmb3J3YXJkZWQgdG8gdGhlIHByb3RvdHlwZSdzIGBnZXRTdGF0ZWAgbWV0aG9kIGZvciBmdXJ0aGVyIGludGVycHJldGF0aW9uLlxuICAgICAqXG4gICAgICogTk9URTogQ1FMIGlzIG5vdCBpbnRlbmRlZCB0byBiZSB1c2VkIG91dHNpZGUgdGhlIGNvbnRleHQgb2YgYSBgY29sdW1uRmlsdGVyc2Agc3ViZXhwcmVzc2lvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0LFxuICAgICAgICAgICAgc3ludGF4ID0gb3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheDtcblxuICAgICAgICBpZiAoc3ludGF4ID09PSAnQ1FMJykge1xuICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gdGhpcy5vcGVyYXRvci5zdWJzdHIoMyk7IC8vIHJlbW92ZSB0aGUgJ29wLScgcHJlZml4XG4gICAgICAgICAgICByZXN1bHQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCwgaWR4KSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEN1c3RvbUZpbHRlckxlYWYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gJyAnICsgb3BlcmF0b3IgKyAnICc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gY2hpbGQuZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0RlZmF1bHRGaWx0ZXI6IEV4cGVjdGVkIGEgY29uZGl0aW9uYWwgYnV0IGZvdW5kIGEgc3ViZXhwcmVzc2lvbi4gU3ViZXhwcmVzc2lvbnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gQ1FMIChDb2x1bW4gUXVlcnkgTGFuZ3VhZ2UsIHRoZSBmaWx0ZXIgY2VsbCBzeW50YXgpLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBGaWx0ZXJUcmVlLnByb3RvdHlwZS5nZXRTdGF0ZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IExpc3Qgb2YgZmlsdGVyIHByb3BlcnRpZXMgdG8gYmUgdHJlYXRlZCBhcyBmaXJzdCBjbGFzcyBvYmplY3RzLlxuICAgICAqIEBkZXNjIE9uIGZpbHRlciBwcm9wZXJ0eSBzZXQsIGZvciBhIHByb3BlcnR5IHZhbHVlIHRoYXQgaXMgYSBmdW5jdGlvbjpcbiAgICAgKiAqIElmIGxpc3RlZCBoZXJlLCBmdW5jdGlvbiBpdCBzZWxmIGlzIGFzc2lnbmVkIHRvIHByb3BlcnR5LlxuICAgICAqICogSWYgX25vdF8gbGlzdGVkIGhlcmUsIGZ1bmN0aW9uIHdpbGwgYmUgZXhlY3V0ZWQgdG8gZ2V0IHZhbHVlIHRvIGFzc2lnbiB0byBwcm9wZXJ0eS5cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBmaXJzdENsYXNzUHJvcGVydGllczoge1xuICAgICAgICBjYWxjdWxhdG9yOiB0cnVlXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBpbXBsZW1lbnRzIGRhdGFTb3VyY2VIZWxwZXJBUEkjcHJvcGVydGllc1xuICAgICAqIEBkZXNjIE5vdGVzIHJlZ2FyZGluZyBzcGVjaWZpYyBwcm9wZXJ0aWVzOlxuICAgICAqICogYGNhc2VTZW5zaXRpdmVEYXRhYCAocm9vdCBwcm9wZXJ0eSkgcGVydGFpbnMgdG8gc3RyaW5nIGNvbXBhcmVzIG9ubHkuIFRoaXMgaW5jbHVkZXMgdW50eXBlZCBjb2x1bW5zLCBjb2x1bW5zIHR5cGVkIGFzIHN0cmluZ3MsIHR5cGVkIGNvbHVtbnMgY29udGFpbmluZyBkYXRhIHRoYXQgY2Fubm90IGJlIGNvZXJjZWQgdG8gdHlwZSBvciB3aGVuIHRoZSBmaWx0ZXIgZXhwcmVzc2lvbiBvcGVyYW5kIGNhbm5vdCBiZSBjb2VyY2VkLiBUaGlzIGlzIGEgc2hhcmVkIHByb3BlcnR5IGFuZCBhZmZlY3RzIGFsbCBncmlkcyBtYW5hZ2VkIGJ5IHRoaXMgaW5zdGFuY2Ugb2YgdGhlIGFwcC5cbiAgICAgKiAqIGBjYWxjdWxhdG9yYCAoY29sdW1uIHByb3BlcnR5KSBDb21wdXRlZCBjb2x1bW4gY2FsY3VsYXRvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIE9uZSBvZjpcbiAgICAgKiAqICoqR2V0dGVyKiogdHlwZSBjYWxsOiBWYWx1ZSBvZiByZXF1ZXN0ZWQgcHJvcGVydHkgb3IgYG51bGxgIGlmIHVuZGVmaW5lZC5cbiAgICAgKiAqICoqU2V0dGVyKiogdHlwZSBjYWxsOiBgdW5kZWZpbmVkYFxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgcHJvcGVydGllczogZnVuY3Rpb24ocHJvcGVydGllcykge1xuICAgICAgICB2YXIgcmVzdWx0LCB2YWx1ZSxcbiAgICAgICAgICAgIG9iamVjdCA9IHByb3BlcnRpZXMgJiYgcHJvcGVydGllcy5jb2x1bW5cbiAgICAgICAgICAgICAgICA/IHRoaXMuc2NoZW1hLmxvb2t1cChwcm9wZXJ0aWVzLmNvbHVtbi5uYW1lKVxuICAgICAgICAgICAgICAgIDogdGhpcy5yb290O1xuXG4gICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMuZ2V0UHJvcE5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBvYmplY3RbcHJvcGVydGllcy5nZXRQcm9wTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgIXRoaXMuZmlyc3RDbGFzc1Byb3BlcnRpZXNba2V5XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBEZWZhdWx0RmlsdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgXyA9IHJlcXVpcmUoJ29iamVjdC1pdGVyYXRvcnMnKTtcblxudmFyIFJFR0VYUF9CT09MUyA9IC9cXGIoQU5EfE9SfE5PUilcXGIvZ2ksXG4gICAgRVhQID0gJyguKj8pJywgQlIgPSAnXFxcXGInLFxuICAgIFBSRUZJWCA9ICdeJyArIEVYUCArIEJSLFxuICAgIElORklYID0gQlIgKyBFWFAgKyBCUixcbiAgICBQT1NURklYID0gQlIgKyBFWFAgKyAnJCc7XG5cbmZ1bmN0aW9uIFBhcnNlckNxbEVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuUGFyc2VyQ3FsRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuUGFyc2VyQ3FsRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnUGFyc2VyQ3FsRXJyb3InO1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICpcbiAqIEBzdW1tYXJ5IENvbHVtbiBRdWVyeSBMYW5ndWFnZSAoQ1FMKSBwYXJzZXJcbiAqXG4gKiBAYXV0aG9yIEpvbmF0aGFuIEVpdGVuIGpvbmF0aGFuQG9wZW5maW4uY29tXG4gKlxuICogQGRlc2MgU2VlIHtAdHV0b3JpYWwgQ1FMfSBmb3IgdGhlIGdyYW1tYXIuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9wZXJhdG9yc0hhc2ggLSBIYXNoIG9mIHZhbGlkIG9wZXJhdG9ycy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7bWVudUl0ZW1bXX0gW29wdGlvbnMuc2NoZW1hXSAtIENvbHVtbiBzY2hlbWEgZm9yIGNvbHVtbiBuYW1lL2FsaWFzIHZhbGlkYXRpb24uIFRocm93cyBhbiBlcnJvciBpZiBuYW1lIGZhaWxzIHZhbGlkYXRpb24gKGJ1dCBzZWUgYHJlc29sdmVBbGlhc2VzYCkuIE9taXQgdG8gc2tpcCBjb2x1bW4gbmFtZSB2YWxpZGF0aW9uLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZWZhdWx0T3A9Jz0nXSAtIERlZmF1bHQgb3BlcmF0b3IgZm9yIGNvbHVtbiB3aGVuIG5vdCBkZWZpbmVkIGluIGNvbHVtbiBzY2hlbWEuXG4gKi9cbmZ1bmN0aW9uIFBhcnNlckNRTChvcGVyYXRvcnNIYXNoLCBvcHRpb25zKSB7XG4gICAgdmFyIG9wZXJhdG9ycyA9IFtdO1xuXG4gICAgdGhpcy5zY2hlbWEgPSBvcHRpb25zICYmIG9wdGlvbnMuc2NoZW1hO1xuICAgIHRoaXMuZGVmYXVsdE9wID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZWZhdWx0T3AgfHwgJz0nKS50b1VwcGVyQ2FzZSgpO1xuXG4gICAgXyhvcGVyYXRvcnNIYXNoKS5lYWNoKGZ1bmN0aW9uKHByb3BzLCBvcCkge1xuICAgICAgICBpZiAob3AgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvcGVyYXRvcnMucHVzaChvcCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFB1dCBsYXJnZXIgb25lcyBmaXJzdCBzbyB0aGF0IGluIGNhc2UgYSBzbWFsbGVyIG9uZSBpcyBhIHN1YnN0cmluZyBvZiBhIGxhcmdlciBvbmUgKHN1Y2ggYXMgJzwnIGlzIHRvICc8PScpLCBsYXJnZXIgb25lIHdpbGwgYmUgbWF0Y2hlZCBmaXJzdC5cbiAgICBvcGVyYXRvcnMgPSBvcGVyYXRvcnMuc29ydChkZXNjZW5kaW5nQnlMZW5ndGgpO1xuXG4gICAgLy8gRXNjYXBlIGFsbCBzeW1ib2xpYyAobm9uIGFscGhhKSBvcGVyYXRvcnMuXG4gICAgb3BlcmF0b3JzID0gb3BlcmF0b3JzLm1hcChmdW5jdGlvbihvcCkge1xuICAgICAgICBpZiAoL15bXkEtWl0vLnRlc3Qob3ApKSB7XG4gICAgICAgICAgICBvcCA9ICdcXFxcJyArIG9wLnNwbGl0KCcnKS5qb2luKCdcXFxcJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9wO1xuICAgIH0pO1xuXG4gICAgdmFyIHN5bWJvbGljT3BlcmF0b3JzID0gb3BlcmF0b3JzLmZpbHRlcihmdW5jdGlvbihvcCkgeyByZXR1cm4gb3BbMF0gPT09ICdcXFxcJzsgfSksXG4gICAgICAgIGFscGhhT3BlcmF0b3JzID0gb3BlcmF0b3JzLmZpbHRlcihmdW5jdGlvbihvcCkgeyByZXR1cm4gb3BbMF0gIT09ICdcXFxcJzsgfSkuam9pbignfCcpO1xuXG4gICAgaWYgKGFscGhhT3BlcmF0b3JzKSB7XG4gICAgICAgIGFscGhhT3BlcmF0b3JzID0gJ1xcXFxiKCcgKyBhbHBoYU9wZXJhdG9ycyArICcpXFxcXGInO1xuICAgIH1cbiAgICAvKiogQHN1bW1hcnkgUmVnZXggdG8gbWF0Y2ggYW55IG9wZXJhdG9yLlxuICAgICAqIEBkZXNjIE1hdGNoZXMgc3ltYm9saWMgb3BlcmF0b3JzIChtYWRlIHVwIG9mIG5vbi1hbHBoYSBjaGFyYWN0ZXJzKSBvciBpZGVudGlmaWVyIG9wZXJhdG9ycyAod29yZC1ib3VuZGFyeS1pc29sYXRlZCBydW5zIG9mIGFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzKS5cbiAgICAgKiBAdHlwZSB7UmVnRXhwfVxuICAgICAqL1xuICAgIHRoaXMuUkVHRVhfT1BFUkFUT1IgPSBuZXcgUmVnRXhwKHN5bWJvbGljT3BlcmF0b3JzLmNvbmNhdChhbHBoYU9wZXJhdG9ycykuam9pbignfCcpLCAnaWcnKTtcblxuICAgIG9wZXJhdG9ycyA9IG9wZXJhdG9ycy5qb2luKCd8JykgLy8gcGlwZSB0aGVtXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICdcXFxccysnKTsgLy8gYXJiaXRyYXJ5IHN0cmluZyBvZiB3aGl0ZXNwYWNlIGNoYXJzIC0+IHdoaXRlc3BhY2UgcmVnZXggbWF0Y2hlclxuXG4gICAgLyoqIEBzdW1tYXJ5IFJlZ2V4IHRvIG1hdGNoIGFuIG9wZXJhdG9yICsgb3B0aW9uYWwgb3BlcmF0b3JcbiAgICAgKiBAZGVzYyBUSGUgb3BlcmF0b3IgaXMgb3B0aW9uYWwuIFRoZSBvcGVyYW5kIG1heSAob3IgbWF5IG5vdCkgYmUgZW5jbG9zZWQgaW4gcGFyZW50aGVzZXMuXG4gICAgICogQGRlc2MgTWF0Y2ggbGlzdDpcbiAgICAgKiAwLiBfaW5wdXQgc3RyaW5nX1xuICAgICAqIDEuIG9wZXJhdG9yXG4gICAgICogMi4gb3V0ZXIgb3BlcmFuZCAobWF5IGluY2x1ZGUgcGFyZW50aGVzZXMpXG4gICAgICogMy4gaW5uZXIgb3BlcmFuZCB3aXRob3V0IHBhcmVudGhlc2VzICh3aGVuIGFuIG9wZXJhbmQgd2FzIGdpdmVuIHdpdGggcGFyZW50aGVzZXMpXG4gICAgICogNC4gaW5uZXIgb3BlcmFuZCAod2hlbiBhbiBvcGVyYW5kIHdhcyBnaXZlbiB3aXRob3V0IHBhcmVudGhlc2VzKVxuICAgICAqIEB0eXBlIHtSZWdFeHB9XG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAbWVtYmVyT2YgUGFyc2VyQ1FMLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHRoaXMuUkVHRVhfRVhQUkVTU0lPTiA9IG5ldyBSZWdFeHAoJ15cXFxccyooJyArIG9wZXJhdG9ycyArICcpP1xcXFxzKihcXFxcKFxcXFxzKiguKz8pXFxcXHMqXFxcXCl8KC4rPykpXFxcXHMqJCcsICdpJyk7XG5cbiAgICB0aGlzLlJFR0VYX0xJVEVSQUxfVE9LRU5TID0gbmV3IFJlZ0V4cCgnXFxcXCcgKyBQYXJzZXJDUUwucXQgKyAnKFxcXFxkKyknICsgJ1xcXFwnICsgUGFyc2VyQ1FMLnF0LCAnZycpO1xuXG59XG5cbi8qKiBAc3VtbWFyeSBPcGVyYW5kIHF1b3RhdGlvbiBtYXJrIGNoYXJhY3Rlci5cbiAqIEBkZXNjIFNob3VsZCBiZSBhIHNpbmdsZSBjaGFyYWN0ZXIgKGxlbmd0aCA9PT0gMSkuXG4gKiBAZGVmYXVsdCAnXCInXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5QYXJzZXJDUUwucXQgPSAnXCInO1xuXG5QYXJzZXJDUUwucHJvdG90eXBlID0ge1xuXG4gICAgY29uc3RydWN0b3I6IFBhcnNlckNRTC5wcm90b3R5cGUuY29uc3RydWN0b3IsXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBFeHRyYWN0IHRoZSBib29sZWFuIG9wZXJhdG9ycyBmcm9tIGFuIGV4cHJlc3Npb24gY2hhaW4uXG4gICAgICogQGRlc2MgUmV0dXJucyBsaXN0IG9mIGhvbW9nZW5lb3VzIG9wZXJhdG9ycyB0cmFuc2Zvcm1lZCB0byBsb3dlciBjYXNlLlxuICAgICAqXG4gICAgICogVGhyb3dzIGFuIGVycm9yIGlmIGFsbCB0aGUgYm9vbGVhbiBvcGVyYXRvcnMgaW4gdGhlIGNoYWluIGFyZSBub3QgaWRlbnRpY2FsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjcWxcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119XG4gICAgICovXG4gICAgY2FwdHVyZUJvb2xlYW5zOiBmdW5jdGlvbihjcWwpIHtcbiAgICAgICAgdmFyIGJvb2xlYW5zID0gY3FsLm1hdGNoKFJFR0VYUF9CT09MUyk7XG4gICAgICAgIHJldHVybiBib29sZWFucyAmJiBib29sZWFucy5tYXAoZnVuY3Rpb24oYm9vbCkge1xuICAgICAgICAgICAgcmV0dXJuIGJvb2wudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIHZhbGlkYXRlQm9vbGVhbnM6IGZ1bmN0aW9uKGJvb2xlYW5zKSB7XG4gICAgICAgIGlmIChib29sZWFucykge1xuICAgICAgICAgICAgdmFyIGhldGVyb2dlbmVvdXNPcGVyYXRvciA9IGJvb2xlYW5zLmZpbmQoZnVuY3Rpb24ob3AsIGkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYm9vbGVhbnNbaV0gIT09IGJvb2xlYW5zWzBdO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChoZXRlcm9nZW5lb3VzT3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyQ3FsRXJyb3IoJ0V4cGVjdGVkIGhvbW9nZW5lb3VzIGJvb2xlYW4gb3BlcmF0b3JzLiBZb3UgY2Fubm90IG1peCBBTkQsIE9SLCBhbmQgTk9SIG9wZXJhdG9ycyBoZXJlIGJlY2F1c2UgdGhlIG9yZGVyIG9mIG9wZXJhdGlvbnMgaXMgYW1iaWd1b3VzLlxcblRpcDogSW4gTWFuYWdlIEZpbHRlcnMsIHlvdSBjYW4gZ3JvdXAgb3BlcmF0aW9ucyB3aXRoIHN1YmV4cHJlc3Npb25zIGluIHRoZSBRdWVyeSBCdWlsZGVyIHRhYiBvciBieSB1c2luZyBwYXJlbnRoZXNlcyBpbiB0aGUgU1FMIHRhYi4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYm9vbGVhbnM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEJyZWFrIGFuIGV4cHJlc3Npb24gY2hhaW4gaW50byBhIGxpc3Qgb2YgZXhwcmVzc2lvbnMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNxbFxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGJvb2xlYW5zXG4gICAgICogQHJldHVybnMge3N0cmluZ1tdfVxuICAgICAqL1xuICAgIGNhcHR1cmVFeHByZXNzaW9uczogZnVuY3Rpb24oY3FsLCBib29sZWFucykge1xuICAgICAgICB2YXIgZXhwcmVzc2lvbnMsIHJlO1xuXG4gICAgICAgIGlmIChib29sZWFucykge1xuICAgICAgICAgICAgcmUgPSBuZXcgUmVnRXhwKFBSRUZJWCArIGJvb2xlYW5zLmpvaW4oSU5GSVgpICsgUE9TVEZJWCwgJ2knKTtcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gY3FsLm1hdGNoKHJlKTtcbiAgICAgICAgICAgIGV4cHJlc3Npb25zLnNoaWZ0KCk7IC8vIGRpc2NhcmQgWzBdIChpbnB1dClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gW2NxbF07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbnM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IE1ha2UgYSBsaXN0IG9mIGNoaWxkcmVuIG91dCBvZiBhIGxpc3Qgb2YgZXhwcmVzc2lvbnMuXG4gICAgICogQGRlc2MgVXNlcyBvbmx5IF9jb21wbGV0ZV8gZXhwcmVzc2lvbnMgKGEgdmFsdWUgT1IgYW4gb3BlcmF0b3IgKyBhIHZhbHVlKS5cbiAgICAgKlxuICAgICAqIElnbm9yZXMgX2luY29tcGxldGVfIGV4cHJlc3Npb25zIChlbXB0eSBzdHJpbmcgT1IgYW4gb3BlcmF0b3IgLSBhIHZhbHVlKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gZXhwcmVzc2lvbnNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBsaXRlcmFscyAtIGxpc3Qgb2YgbGl0ZXJhbHMgaW5kZXhlZCBieSB0b2tlblxuICAgICAqXG4gICAgICogQHJldHVybnMge2V4cHJlc3Npb25TdGF0ZVtdfSB3aGVyZSBgZXhwcmVzc2lvblN0YXRlYCBpcyBvbmUgb2Y6XG4gICAgICogKiBge2NvbHVtbjogc3RyaW5nLCBvcGVyYXRvcjogc3RyaW5nLCBvcGVyYW5kOiBzdHJpbmd9YFxuICAgICAqICogYHtjb2x1bW46IHN0cmluZywgb3BlcmF0b3I6IHN0cmluZywgb3BlcmFuZDogc3RyaW5nLCBlZGl0b3I6ICdDb2x1bW5zJ31gXG4gICAgICovXG4gICAgbWFrZUNoaWxkcmVuOiBmdW5jdGlvbihjb2x1bW5OYW1lLCBleHByZXNzaW9ucywgbGl0ZXJhbHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbnMucmVkdWNlKGZ1bmN0aW9uKGNoaWxkcmVuLCBleHApIHtcbiAgICAgICAgICAgIGlmIChleHApIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFydHMgPSBleHAubWF0Y2goc2VsZi5SRUdFWF9FWFBSRVNTSU9OKTtcbiAgICAgICAgICAgICAgICBpZiAocGFydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9wID0gcGFydHNbMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRlckxpdGVyYWwgPSBwYXJ0c1syXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlubmVyTGl0ZXJhbCA9IHBhcnRzLnNsaWNlKDMpLmZpbmQoZnVuY3Rpb24ocGFydCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0ICE9PSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBvcCA9IChvcCB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKS50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBwYXJlbnRoZXNpemVkID0gL15cXCguKlxcKSQvLnRlc3Qob3V0ZXJMaXRlcmFsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlubmVyT3BlcmF0b3JzID0gaW5uZXJMaXRlcmFsLm1hdGNoKHNlbGYuUkVHRVhfT1BFUkFUT1IpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyZW50aGVzaXplZCAmJiBpbm5lck9wZXJhdG9ycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wID09PSAnJyAmJiBvdXRlckxpdGVyYWwgPT09IGlubmVyT3BlcmF0b3JzWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlckNxbEVycm9yKCdFeHBlY3RlZCBhbiBvcGVyYW5kLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyQ3FsRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0V4cGVjdGVkIG9wZXJhbmQgYnV0IGZvdW5kIGFkZGl0aW9uYWwgb3BlcmF0b3Iocyk6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlubmVyT3BlcmF0b3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b1N0cmluZygpIC8vIGNvbnZlcnQgdG8gY29tbWEtc2VwYXJhdGVkIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvVXBwZXJDYXNlKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLywvZywgJywgJykgLy8gYWRkIHNwYWNlcyBhZnRlciB0aGUgY29tbWFzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9eKFteLF0rKSwgKFteLF0rKSQvLCAnJDEgYW5kICQyJykgLy8gcmVwbGFjZSBvbmx5IGNvbW1hIHdpdGggXCJhbmRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKC4rLC4rKSwgKFteLF0rKSQvLCAnJDEsIGFuZCAkMicpIC8vIGFkZCBcImFuZFwiIGFmdGVyIGxhc3Qgb2Ygc2V2ZXJhbCBjb21tYXNcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvcCA9IG9wIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNjaGVtYSAmJiBzZWxmLnNjaGVtYS5sb29rdXAoY29sdW1uTmFtZSkuZGVmYXVsdE9wIHx8IC8vIGNvbHVtbidzIGRlZmF1bHQgb3BlcmF0b3IgZnJvbSBzY2hlbWFcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZGVmYXVsdE9wOyAvLyBncmlkJ3MgZGVmYXVsdCBvcGVyYXRvclxuXG4gICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogY29sdW1uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yOiBvcFxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBmaWVsZE5hbWUgPSBzZWxmLnNjaGVtYSAmJiBzZWxmLnNjaGVtYS5sb29rdXAoaW5uZXJMaXRlcmFsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQub3BlcmFuZCA9IGZpZWxkTmFtZS5uYW1lIHx8IGZpZWxkTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkLmVkaXRvciA9ICdDb2x1bW5zJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYW5kIGV4cGFuZCBhbGwgY29sbGFwc2VkIGxpdGVyYWxzLlxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQub3BlcmFuZCA9IGlubmVyTGl0ZXJhbC5yZXBsYWNlKHNlbGYuUkVHRVhfTElURVJBTF9UT0tFTlMsIGZ1bmN0aW9uKG1hdGNoLCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXRlcmFsc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgW10pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUaGUgcG9zaXRpb24gb2YgdGhlIG9wZXJhdG9yIG9mIHRoZSBleHByZXNzaW9uIHVuZGVyIHRoZSBjdXJzb3IuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNxbCAtIENRTCBleHByZXNzaW9uIHVuZGVyIGNvbnN0cnVjdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3Vyc29yIC0gQ3VycmVudCBjdXJzb3IncyBzdGFydGluZyBwb3NpdGlvbiAoYGlucHV0LnN0YXJ0U2VsZWN0aW9uYClcbiAgICAgKiBAcmV0dXJucyB7e3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyfX1cbiAgICAgKi9cbiAgICBnZXRPcGVyYXRvclBvc2l0aW9uOiBmdW5jdGlvbihjcWwsIGN1cnNvcikge1xuICAgICAgICAvLyBmaXJzdCB0b2tlbml6ZSBsaXRlcmFscyBpbiBjYXNlIHRoZXkgY29udGFpbiBib29sZWFucy4uLlxuICAgICAgICB2YXIgbGl0ZXJhbHMgPSBbXTtcbiAgICAgICAgY3FsID0gdG9rZW5pemVMaXRlcmFscyhjcWwsIFBhcnNlckNRTC5xdCwgbGl0ZXJhbHMpO1xuXG4gICAgICAgIC8vIC4uLnRoZW4gZXhwYW5kIHRva2VucyBidXQgd2l0aCB4J3MganVzdCBmb3IgbGVuZ3RoXG4gICAgICAgIGNxbCA9IGNxbC5yZXBsYWNlKHRoaXMuUkVHRVhfTElURVJBTF9UT0tFTlMsIGZ1bmN0aW9uKG1hdGNoLCBpbmRleCkge1xuICAgICAgICAgICAgdmFyIGxlbmd0aCA9IDEgKyBsaXRlcmFsc1tpbmRleF0ubGVuZ3RoICsgMTsgLy8gYWRkIHF1b3RlIGNoYXJzXG4gICAgICAgICAgICByZXR1cm4gQXJyYXkobGVuZ3RoICsgMSkuam9pbigneCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgYm9vbGVhbnMsIGV4cHJlc3Npb25zLCBwb3NpdGlvbiwgdGFicywgZW5kLCB0YWIsIGV4cHJlc3Npb24sIG9sZE9wZXJhdG9yLCBvbGRPcGVyYXRvck9mZnNldDtcblxuICAgICAgICBpZiAoKGJvb2xlYW5zID0gdGhpcy5jYXB0dXJlQm9vbGVhbnMoY3FsKSkpIHtcbiAgICAgICAgICAgIC8vIGJvb2xlYW4ocykgZm91bmQgc28gY29uY2F0ZW5hdGVkIGV4cHJlc3Npb25zXG4gICAgICAgICAgICBleHByZXNzaW9ucyA9IHRoaXMuY2FwdHVyZUV4cHJlc3Npb25zKGNxbCwgYm9vbGVhbnMpO1xuICAgICAgICAgICAgcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgdGFicyA9IGV4cHJlc3Npb25zLm1hcChmdW5jdGlvbihleHByLCBpZHgpIHsgLy8gZ2V0IHN0YXJ0aW5nIHBvc2l0aW9uIG9mIGVhY2ggZXhwcmVzc2lvblxuICAgICAgICAgICAgICAgIHZhciBib29sID0gYm9vbGVhbnNbaWR4IC0gMV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgcG9zaXRpb24gKz0gZXhwci5sZW5ndGggKyBib29sLmxlbmd0aDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9zaXRpb247XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gZmluZCBiZWdpbm5pbmcgb2YgZXhwcmVzc2lvbiB1bmRlciBjdXJzb3IgcG9zaXRpb25cbiAgICAgICAgICAgIHRhYnMuZmluZChmdW5jdGlvbih0aWNrLCBpZHgpIHtcbiAgICAgICAgICAgICAgICB0YWIgPSBpZHg7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnNvciA8PSB0aWNrO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGN1cnNvciA9IHRhYnNbdGFiIC0gMV0gfHwgMDtcbiAgICAgICAgICAgIGVuZCA9IGN1cnNvciArPSAoYm9vbGVhbnNbdGFiIC0gMV0gfHwgJycpLmxlbmd0aDtcblxuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IGV4cHJlc3Npb25zW3RhYl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBib29sZWFucyBub3QgZm91bmQgc28gc2luZ2xlIGV4cHJlc3Npb25cbiAgICAgICAgICAgIGN1cnNvciA9IDA7XG4gICAgICAgICAgICBlbmQgPSBjcWwubGVuZ3RoO1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IGNxbDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9sZE9wZXJhdG9yT2Zmc2V0ID0gZXhwcmVzc2lvbi5zZWFyY2godGhpcy5SRUdFWF9PUEVSQVRPUik7XG4gICAgICAgIGlmIChvbGRPcGVyYXRvck9mZnNldCA+PSAwKSB7XG4gICAgICAgICAgICBvbGRPcGVyYXRvciA9IGV4cHJlc3Npb24ubWF0Y2godGhpcy5SRUdFWF9PUEVSQVRPUilbMF07XG4gICAgICAgICAgICBjdXJzb3IgKz0gb2xkT3BlcmF0b3JPZmZzZXQ7XG4gICAgICAgICAgICBlbmQgPSBjdXJzb3IgKyBvbGRPcGVyYXRvci5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhcnQ6IGN1cnNvcixcbiAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgIH07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IE1ha2UgYSBcImxvY2tlZFwiIHN1YmV4cHJlc3Npb24gZGVmaW5pdGlvbiBvYmplY3QgZnJvbSBhbiBleHByZXNzaW9uIGNoYWluLlxuICAgICAqIEBkZXNjIF9Mb2NrZWRfIG1lYW5zIGl0IGlzIGxvY2tlZCB0byBhIHNpbmdsZSBmaWVsZC5cbiAgICAgKlxuICAgICAqIFdoZW4gdGhlcmUgaXMgb25seSBhIHNpbmdsZSBleHByZXNzaW9uIGluIHRoZSBjaGFpbiwgdGhlIGBvcGVyYXRvcmAgaXMgb21pdHRlZCAoZGVmYXVsdHMgdG8gYCdvcC1hbmQnYCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY3FsIC0gQSBjb21wb3VuZCBDUUwgZXhwcmVzc2lvbiwgY29uc2lzdGluZyBvZiBvbmUgb3IgbW9yZSBzaW1wbGUgZXhwcmVzc2lvbnMgYWxsIHNlcGFyYXRlZCBieSB0aGUgc2FtZSBsb2dpY2FsIG9wZXJhdG9yKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfHtvcGVyYXRvcjogc3RyaW5nLCBjaGlsZHJlbjogc3RyaW5nW10sIHNjaGVtYTogc3RyaW5nW119fVxuICAgICAqIGB1bmRlZmluZWRgIHdoZW4gdGhlcmUgYXJlIG5vIGNvbXBsZXRlIGV4cHJlc3Npb25zXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgbW9kdWxlOkNRTFxuICAgICAqL1xuICAgIHBhcnNlOiBmdW5jdGlvbihjcWwsIGNvbHVtbk5hbWUpIHtcbiAgICAgICAgLy8gcmVkdWNlIGFsbCBydW5zIG9mIHdoaXRlIHNwYWNlIHRvIGEgc2luZ2xlIHNwYWNlOyB0aGVuIHRyaW1cbiAgICAgICAgY3FsID0gY3FsLnJlcGxhY2UoL1xcc1xccysvZywgJyAnKS50cmltKCk7XG5cbiAgICAgICAgdmFyIGxpdGVyYWxzID0gW107XG4gICAgICAgIGNxbCA9IHRva2VuaXplTGl0ZXJhbHMoY3FsLCBQYXJzZXJDUUwucXQsIGxpdGVyYWxzKTtcblxuICAgICAgICB2YXIgYm9vbGVhbnMgPSB0aGlzLnZhbGlkYXRlQm9vbGVhbnModGhpcy5jYXB0dXJlQm9vbGVhbnMoY3FsKSksXG4gICAgICAgICAgICBleHByZXNzaW9ucyA9IHRoaXMuY2FwdHVyZUV4cHJlc3Npb25zKGNxbCwgYm9vbGVhbnMpLFxuICAgICAgICAgICAgY2hpbGRyZW4gPSB0aGlzLm1ha2VDaGlsZHJlbihjb2x1bW5OYW1lLCBleHByZXNzaW9ucywgbGl0ZXJhbHMpLFxuICAgICAgICAgICAgb3BlcmF0b3IgPSBib29sZWFucyAmJiBib29sZWFuc1swXSxcbiAgICAgICAgICAgIHN0YXRlO1xuXG4gICAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIHN0YXRlID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdjb2x1bW5GaWx0ZXInLFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKG9wZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUub3BlcmF0b3IgPSAnb3AtJyArIG9wZXJhdG9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIGRlc2NlbmRpbmdCeUxlbmd0aChhLCBiKSB7XG4gICAgcmV0dXJuIGIubGVuZ3RoIC0gYS5sZW5ndGg7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgQ29sbGFwc2UgbGl0ZXJhbHMuXG4gKiBAZGVzYyBBbGxvd3MgcmVzZXJ2ZWQgd29yZHMgdG8gZXhpc3QgaW5zaWRlIGEgcXVvdGVkIHN0cmluZy5cbiAqIExpdGVyYWxzIGFyZSBjb2xsYXBzZWQgdG8gYSBxdW90ZWQgbnVtZXJpY2FsIGluZGV4IGludG8gdGhlIGBsaXRlcmFsc2AgYXJyYXkuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9IHF0XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBsaXRlcmFscyAtIEVtcHR5IGFycmF5IGluIHdoaWNoIHRvIHJldHVybiBleHRyYWN0ZWQgbGl0ZXJhbHMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxuICogQG1lbWJlck9mIFBhcnNlckNRTFxuICogQGlubmVyXG4gKi9cbmZ1bmN0aW9uIHRva2VuaXplTGl0ZXJhbHModGV4dCwgcXQsIGxpdGVyYWxzKSB7XG4gICAgbGl0ZXJhbHMubGVuZ3RoID0gMDtcblxuICAgIGZvciAoXG4gICAgICAgIHZhciBpID0gMCwgaiA9IDAsIGssIGlubmVyTGl0ZXJhbDtcbiAgICAgICAgKGogPSB0ZXh0LmluZGV4T2YocXQsIGopKSA+PSAwO1xuICAgICAgICBqICs9IDEgKyAoaSArICcnKS5sZW5ndGggKyAxLCBpKytcbiAgICApIHtcbiAgICAgICAgayA9IGo7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGsgPSB0ZXh0LmluZGV4T2YocXQsIGsgKyAxKTtcbiAgICAgICAgICAgIGlmIChrIDwgMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJDcWxFcnJvcignUXVvdGF0aW9uIG1hcmtzIG11c3QgYmUgcGFpcmVkOyBuZXN0ZWQgcXVvdGF0aW9uIG1hcmtzIG11c3QgYmUgZG91YmxlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSB3aGlsZSAodGV4dFsrK2tdID09PSBxdCk7XG5cbiAgICAgICAgaW5uZXJMaXRlcmFsID0gdGV4dFxuICAgICAgICAgICAgLnNsaWNlKCsraiwgLS1rKSAvLyBleHRyYWN0XG4gICAgICAgICAgICAucmVwbGFjZShuZXcgUmVnRXhwKHF0ICsgcXQsICdnJyksIHF0KTsgLy8gdW5lc2NhcGUgZXNjYXBlZCBxdW90YXRpb24gbWFya3NcblxuICAgICAgICBsaXRlcmFscy5wdXNoKGlubmVyTGl0ZXJhbCk7XG5cbiAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyKDAsIGopICsgaSArIHRleHQuc3Vic3RyKGspOyAvLyBjb2xsYXBzZVxuICAgIH1cblxuICAgIHJldHVybiB0ZXh0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlckNRTDtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IGNvbHVtbkluZGV4T3JOYW1lIC0gVGhlIF9jb2x1bW4gZmlsdGVyXyB0byBzZXQuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhTW9kZWwuZ2V0RmlsdGVyKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGEgcGFydGljdWxhciBjb2x1bW4gZmlsdGVyJ3Mgc3RhdGUuXG4gICAgICogQGRlc2MgQWZ0ZXIgc2V0dGluZyB0aGUgbmV3IGZpbHRlciBzdGF0ZSwgcmVhcHBsaWVzIHRoZSBmaWx0ZXIgdG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGBmaWx0ZXIuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBzZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC5zZXRGaWx0ZXIoY29sdW1uSW5kZXhPck5hbWUsIHN0YXRlLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhTW9kZWwuZ2V0RmlsdGVycyhvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0RmlsdGVyczogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kYXRhTW9kZWwuc2V0RmlsdGVycyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFNb2RlbC5nZXRUYWJsZUZpbHRlcihvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnNldFRhYmxlRmlsdGVyKHN0YXRlLCBvcHRpb25zKTtcbiAgICB9LFxuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEdldCBhIHBhcnRpY3VsYXIgY29sdW1uIGZpbHRlcidzIHN0YXRlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldEZpbHRlcjogZnVuY3Rpb24oY29sdW1uSW5kZXhPck5hbWUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGlzSW5kZXggPSAhaXNOYU4oTnVtYmVyKGNvbHVtbkluZGV4T3JOYW1lKSksXG4gICAgICAgICAgICBjb2x1bW5OYW1lID0gaXNJbmRleCA/IHRoaXMuc2NoZW1hW2NvbHVtbkluZGV4T3JOYW1lXS5uYW1lIDogY29sdW1uSW5kZXhPck5hbWU7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyLmdldENvbHVtbkZpbHRlclN0YXRlKGNvbHVtbk5hbWUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZnRlciBzZXR0aW5nIHRoZSBuZXcgZmlsdGVyIHN0YXRlLCByZWFwcGxpZXMgdGhlIGZpbHRlciB0byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gW3N0YXRlXSAtIEEgZmlsdGVyIHRyZWUgb2JqZWN0IG9yIGEgSlNPTiwgU1FMLCBvciBDUUwgc3ViZXhwcmVzc2lvbiBzdHJpbmcgdGhhdCBkZXNjcmliZXMgdGhlIGEgbmV3IHN0YXRlIGZvciB0aGUgbmFtZWQgY29sdW1uIGZpbHRlci4gVGhlIGV4aXN0aW5nIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBpcyByZXBsYWNlZCB3aXRoIGEgbmV3IG5vZGUgYmFzZWQgb24gdGhpcyBzdGF0ZS4gSWYgaXQgZG9lcyBub3QgZXhpc3QsIHRoZSBuZXcgc3ViZXhwcmVzc2lvbiBpcyBhZGRlZCB0byB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSAoYGZpbHRlci5jb2x1bW5GaWx0ZXJzYCkuXG4gICAgICpcbiAgICAgKiBJZiB1bmRlZmluZWQsIHJlbW92ZXMgdGhlIGVudGlyZSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gZnJvbSB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZS5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgaXNJbmRleCA9ICFpc05hTihOdW1iZXIoY29sdW1uSW5kZXhPck5hbWUpKSxcbiAgICAgICAgICAgIGNvbHVtbk5hbWUgPSBpc0luZGV4ID8gdGhpcy5zY2hlbWFbY29sdW1uSW5kZXhPck5hbWVdLm5hbWUgOiBjb2x1bW5JbmRleE9yTmFtZTtcblxuICAgICAgICB0aGlzLmZpbHRlci5zZXRDb2x1bW5GaWx0ZXJTdGF0ZShjb2x1bW5OYW1lLCBzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuZ3JpZC5maXJlU3ludGhldGljRmlsdGVyQXBwbGllZEV2ZW50KCk7XG4gICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2V0Q29sdW1uRmlsdGVyc1N0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0RmlsdGVyczogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5maWx0ZXIuc2V0Q29sdW1uRmlsdGVyc1N0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5ncmlkLmZpcmVTeW50aGV0aWNGaWx0ZXJBcHBsaWVkRXZlbnQoKTtcbiAgICAgICAgdGhpcy5yZWluZGV4KCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2V0VGFibGVGaWx0ZXJTdGF0ZShvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGEgdGhlIHRhYmxlIGZpbHRlciBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZmlsdGVyLnNldFRhYmxlRmlsdGVyU3RhdGUoc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmdyaWQuZmlyZVN5bnRoZXRpY0ZpbHRlckFwcGxpZWRFdmVudCgpO1xuICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICB9LFxuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYGdldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5iZWhhdmlvci5nZXRGaWx0ZXIoY29sdW1uSW5kZXhPck5hbWUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZnRlciBzZXR0aW5nIHRoZSBuZXcgZmlsdGVyIHN0YXRlOlxuICAgICAqICogUmVhcHBsaWVzIHRoZSBmaWx0ZXIgdG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAqICogQ2FsbHMgYGJlaGF2aW9yQ2hhbmdlZCgpYCB0byB1cGRhdGUgdGhlIGdyaWQgY2FudmFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGBmaWx0ZXIuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBzZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2VsbEVkaXRvcikge1xuICAgICAgICAgICAgdGhpcy5jZWxsRWRpdG9yLmhpZGVFZGl0b3IoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmJlaGF2aW9yLnNldEZpbHRlcihjb2x1bW5JbmRleE9yTmFtZSwgc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmJlaGF2aW9yQ2hhbmdlZCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5iZWhhdmlvci5nZXRGaWx0ZXJzKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0RmlsdGVyczogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2VsbEVkaXRvcikge1xuICAgICAgICAgICAgdGhpcy5jZWxsRWRpdG9yLmhpZGVFZGl0b3IoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmJlaGF2aW9yLnNldEZpbHRlcnMoc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmJlaGF2aW9yQ2hhbmdlZCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmVoYXZpb3IuZ2V0VGFibGVGaWx0ZXIob3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBzdGF0ZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5iZWhhdmlvci5zZXRUYWJsZUZpbHRlcihzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3JDaGFuZ2VkKCk7XG4gICAgfSxcblxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbi8qKiBAbmFtZXNwYWNlIGNzc0luamVjdG9yICovXG5cbi8qKlxuICogQHN1bW1hcnkgSW5zZXJ0IGJhc2Ugc3R5bGVzaGVldCBpbnRvIERPTVxuICpcbiAqIEBkZXNjIENyZWF0ZXMgYSBuZXcgYDxzdHlsZT4uLi48L3N0eWxlPmAgZWxlbWVudCBmcm9tIHRoZSBuYW1lZCB0ZXh0IHN0cmluZyhzKSBhbmQgaW5zZXJ0cyBpdCBidXQgb25seSBpZiBpdCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0IGluIHRoZSBzcGVjaWZpZWQgY29udGFpbmVyIGFzIHBlciBgcmVmZXJlbmNlRWxlbWVudGAuXG4gKlxuICogPiBDYXZlYXQ6IElmIHN0eWxlc2hlZXQgaXMgZm9yIHVzZSBpbiBhIHNoYWRvdyBET00sIHlvdSBtdXN0IHNwZWNpZnkgYSBsb2NhbCBgcmVmZXJlbmNlRWxlbWVudGAuXG4gKlxuICogQHJldHVybnMgQSByZWZlcmVuY2UgdG8gdGhlIG5ld2x5IGNyZWF0ZWQgYDxzdHlsZT4uLi48L3N0eWxlPmAgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gY3NzUnVsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBbSURdXG4gKiBAcGFyYW0ge3VuZGVmaW5lZHxudWxsfEVsZW1lbnR8c3RyaW5nfSBbcmVmZXJlbmNlRWxlbWVudF0gLSBDb250YWluZXIgZm9yIGluc2VydGlvbi4gT3ZlcmxvYWRzOlxuICogKiBgdW5kZWZpbmVkYCB0eXBlIChvciBvbWl0dGVkKTogaW5qZWN0cyBzdHlsZXNoZWV0IGF0IHRvcCBvZiBgPGhlYWQ+Li4uPC9oZWFkPmAgZWxlbWVudFxuICogKiBgbnVsbGAgdmFsdWU6IGluamVjdHMgc3R5bGVzaGVldCBhdCBib3R0b20gb2YgYDxoZWFkPi4uLjwvaGVhZD5gIGVsZW1lbnRcbiAqICogYEVsZW1lbnRgIHR5cGU6IGluamVjdHMgc3R5bGVzaGVldCBpbW1lZGlhdGVseSBiZWZvcmUgZ2l2ZW4gZWxlbWVudCwgd2hlcmV2ZXIgaXQgaXMgZm91bmQuXG4gKiAqIGBzdHJpbmdgIHR5cGU6IGluamVjdHMgc3R5bGVzaGVldCBpbW1lZGlhdGVseSBiZWZvcmUgZ2l2ZW4gZmlyc3QgZWxlbWVudCBmb3VuZCB0aGF0IG1hdGNoZXMgdGhlIGdpdmVuIGNzcyBzZWxlY3Rvci5cbiAqXG4gKiBAbWVtYmVyT2YgY3NzSW5qZWN0b3JcbiAqL1xuZnVuY3Rpb24gY3NzSW5qZWN0b3IoY3NzUnVsZXMsIElELCByZWZlcmVuY2VFbGVtZW50KSB7XG4gICAgaWYgKHR5cGVvZiByZWZlcmVuY2VFbGVtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZWZlcmVuY2VFbGVtZW50KTtcbiAgICAgICAgaWYgKCFyZWZlcmVuY2VFbGVtZW50KSB7XG4gICAgICAgICAgICB0aHJvdyAnQ2Fubm90IGZpbmQgcmVmZXJlbmNlIGVsZW1lbnQgZm9yIENTUyBpbmplY3Rpb24uJztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocmVmZXJlbmNlRWxlbWVudCAmJiAhKHJlZmVyZW5jZUVsZW1lbnQgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgICB0aHJvdyAnR2l2ZW4gdmFsdWUgbm90IGEgcmVmZXJlbmNlIGVsZW1lbnQuJztcbiAgICB9XG5cbiAgICB2YXIgY29udGFpbmVyID0gcmVmZXJlbmNlRWxlbWVudCAmJiByZWZlcmVuY2VFbGVtZW50LnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xuXG4gICAgaWYgKElEKSB7XG4gICAgICAgIElEID0gY3NzSW5qZWN0b3IuaWRQcmVmaXggKyBJRDtcblxuICAgICAgICBpZiAoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJyMnICsgSUQpKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIHN0eWxlc2hlZXQgYWxyZWFkeSBpbiBET01cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7XG4gICAgaWYgKElEKSB7XG4gICAgICAgIHN0eWxlLmlkID0gSUQ7XG4gICAgfVxuICAgIGlmIChjc3NSdWxlcyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGNzc1J1bGVzID0gY3NzUnVsZXMuam9pbignXFxuJyk7XG4gICAgfVxuICAgIGNzc1J1bGVzID0gJ1xcbicgKyBjc3NSdWxlcyArICdcXG4nO1xuICAgIGlmIChzdHlsZS5zdHlsZVNoZWV0KSB7XG4gICAgICAgIHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1J1bGVzO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzc1J1bGVzKSk7XG4gICAgfVxuXG4gICAgaWYgKHJlZmVyZW5jZUVsZW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gY29udGFpbmVyLmZpcnN0Q2hpbGQ7XG4gICAgfVxuXG4gICAgY29udGFpbmVyLmluc2VydEJlZm9yZShzdHlsZSwgcmVmZXJlbmNlRWxlbWVudCk7XG5cbiAgICByZXR1cm4gc3R5bGU7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgT3B0aW9uYWwgcHJlZml4IGZvciBgPHN0eWxlPmAgdGFnIElEcy5cbiAqIEBkZXNjIERlZmF1bHRzIHRvIGAnaW5qZWN0ZWQtc3R5bGVzaGVldC0nYC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAbWVtYmVyT2YgY3NzSW5qZWN0b3JcbiAqL1xuY3NzSW5qZWN0b3IuaWRQcmVmaXggPSAnaW5qZWN0ZWQtc3R5bGVzaGVldC0nO1xuXG4vLyBJbnRlcmZhY2Vcbm1vZHVsZS5leHBvcnRzID0gY3NzSW5qZWN0b3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBvdmVycmlkZXIgPSByZXF1aXJlKCdvdmVycmlkZXInKTtcblxuLyoqIEBuYW1lc3BhY2UgZXh0ZW5kLW1lICoqL1xuXG4vKiogQHN1bW1hcnkgRXh0ZW5kcyBhbiBleGlzdGluZyBjb25zdHJ1Y3RvciBpbnRvIGEgbmV3IGNvbnN0cnVjdG9yLlxuICpcbiAqIEByZXR1cm5zIHtDaGlsZENvbnN0cnVjdG9yfSBBIG5ldyBjb25zdHJ1Y3RvciwgZXh0ZW5kZWQgZnJvbSB0aGUgZ2l2ZW4gY29udGV4dCwgcG9zc2libHkgd2l0aCBzb21lIHByb3RvdHlwZSBhZGRpdGlvbnMuXG4gKlxuICogQGRlc2MgRXh0ZW5kcyBcIm9iamVjdHNcIiAoY29uc3RydWN0b3JzKSwgd2l0aCBvcHRpb25hbCBhZGRpdGlvbmFsIGNvZGUsIG9wdGlvbmFsIHByb3RvdHlwZSBhZGRpdGlvbnMsIGFuZCBvcHRpb25hbCBwcm90b3R5cGUgbWVtYmVyIGFsaWFzZXMuXG4gKlxuICogPiBDQVZFQVQ6IE5vdCB0byBiZSBjb25mdXNlZCB3aXRoIFVuZGVyc2NvcmUtc3R5bGUgLmV4dGVuZCgpIHdoaWNoIGlzIHNvbWV0aGluZyBlbHNlIGVudGlyZWx5LiBJJ3ZlIHVzZWQgdGhlIG5hbWUgXCJleHRlbmRcIiBoZXJlIGJlY2F1c2Ugb3RoZXIgcGFja2FnZXMgKGxpa2UgQmFja2JvbmUuanMpIHVzZSBpdCB0aGlzIHdheS4gWW91IGFyZSBmcmVlIHRvIGNhbGwgaXQgd2hhdGV2ZXIgeW91IHdhbnQgd2hlbiB5b3UgXCJyZXF1aXJlXCIgaXQsIHN1Y2ggYXMgYHZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2V4dGVuZCcpYC5cbiAqXG4gKiBQcm92aWRlIGEgY29uc3RydWN0b3IgYXMgdGhlIGNvbnRleHQgYW5kIGFueSBwcm90b3R5cGUgYWRkaXRpb25zIHlvdSByZXF1aXJlIGluIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgaWYgeW91IHdpc2ggdG8gYmUgYWJsZSB0byBleHRlbmQgYEJhc2VDb25zdHJ1Y3RvcmAgdG8gYSBuZXcgY29uc3RydWN0b3Igd2l0aCBwcm90b3R5cGUgb3ZlcnJpZGVzIGFuZC9vciBhZGRpdGlvbnMsIGJhc2ljIHVzYWdlIGlzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBCYXNlID0gcmVxdWlyZSgnZXh0ZW5kLW1lJykuQmFzZTtcbiAqIHZhciBCYXNlQ29uc3RydWN0b3IgPSBCYXNlLmV4dGVuZChiYXNlUHJvdG90eXBlKTsgLy8gbWl4ZXMgaW4gLmV4dGVuZFxuICogdmFyIENoaWxkQ29uc3RydWN0b3IgPSBCYXNlQ29uc3RydWN0b3IuZXh0ZW5kKGNoaWxkUHJvdG90eXBlT3ZlcnJpZGVzQW5kQWRkaXRpb25zKTtcbiAqIHZhciBHcmFuZGNoaWxkQ29uc3RydWN0b3IgPSBDaGlsZENvbnN0cnVjdG9yLmV4dGVuZChncmFuZGNoaWxkUHJvdG90eXBlT3ZlcnJpZGVzQW5kQWRkaXRpb25zKTtcbiAqIGBgYFxuICpcbiAqIFRoaXMgZnVuY3Rpb24gKGBleHRlbmQoKWApIGlzIGFkZGVkIHRvIHRoZSBuZXcgZXh0ZW5kZWQgb2JqZWN0IGNvbnN0cnVjdG9yIGFzIGEgcHJvcGVydHkgYC5leHRlbmRgLCBlc3NlbnRpYWxseSBtYWtpbmcgdGhlIG9iamVjdCBjb25zdHJ1Y3RvciBpdHNlbGYgZWFzaWx5IFwiZXh0ZW5kYWJsZS5cIiAoTm90ZTogVGhpcyBpcyBhIHByb3BlcnR5IG9mIGVhY2ggY29uc3RydWN0b3IgYW5kIG5vdCBhIG1ldGhvZCBvZiBpdHMgcHJvdG90eXBlISlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gW2V4dGVuZGVkQ2xhc3NOYW1lXSAtIFRoaXMgaXMgc2ltcGx5IGFkZGVkIHRvIHRoZSBwcm90b3R5cGUgYXMgJCRDTEFTU19OQU1FLiBVc2VmdWwgZm9yIGRlYnVnZ2luZyBiZWNhdXNlIGFsbCBkZXJpdmVkIGNvbnN0cnVjdG9ycyBhcHBlYXIgdG8gaGF2ZSB0aGUgc2FtZSBuYW1lIChcIkNvbnN0cnVjdG9yXCIpIGluIHRoZSBkZWJ1Z2dlci5cbiAqXG4gKiBAcGFyYW0ge2V4dGVuZGVkUHJvdG90eXBlQWRkaXRpb25zT2JqZWN0fSBbcHJvdG90eXBlQWRkaXRpb25zXSAtIE9iamVjdCB3aXRoIG1lbWJlcnMgdG8gY29weSB0byBuZXcgY29uc3RydWN0b3IncyBwcm90b3R5cGUuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbZGVidWddIC0gU2VlIHBhcmFtZXRlciBgZXh0ZW5kZWRDbGFzc05hbWVgIF8oYWJvdmUpXy5cbiAqXG4gKiBAcHJvcGVydHkge29iamVjdH0gQmFzZSAtIEEgY29udmVuaWVudCBiYXNlIGNsYXNzIGZyb20gd2hpY2ggYWxsIG90aGVyIGNsYXNzZXMgY2FuIGJlIGV4dGVuZGVkLlxuICpcbiAqIEBtZW1iZXJPZiBleHRlbmQtbWVcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKGV4dGVuZGVkQ2xhc3NOYW1lLCBwcm90b3R5cGVBZGRpdGlvbnMpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgcHJvdG90eXBlQWRkaXRpb25zID0ge307XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgZXh0ZW5kZWRDbGFzc05hbWUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMgPSBleHRlbmRlZENsYXNzTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5kZWRDbGFzc05hbWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgICAgIHByb3RvdHlwZUFkZGl0aW9ucyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyAnU2luZ2xlLXBhcmFtZXRlciBvdmVybG9hZCBtdXN0IGJlIGVpdGhlciBzdHJpbmcgb3Igb2JqZWN0Lic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHRlbmRlZENsYXNzTmFtZSAhPT0gJ3N0cmluZycgfHwgdHlwZW9mIHByb3RvdHlwZUFkZGl0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnVHdvLXBhcmFtZXRlciBvdmVybG9hZCBtdXN0IGJlIHN0cmluZywgb2JqZWN0Lic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93ICdUb28gbWFueSBwYXJhbWV0ZXJzJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBDb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgaWYgKHByb3RvdHlwZUFkZGl0aW9ucy5wcmVJbml0aWFsaXplKSB7XG4gICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMucHJlSW5pdGlhbGl6ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5pdGlhbGl6ZVByb3RvdHlwZUNoYWluLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgaWYgKHByb3RvdHlwZUFkZGl0aW9ucy5wb3N0SW5pdGlhbGl6ZSkge1xuICAgICAgICAgICAgcHJvdG90eXBlQWRkaXRpb25zLnBvc3RJbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBDb25zdHJ1Y3Rvci5leHRlbmQgPSBleHRlbmQ7XG5cbiAgICB2YXIgcHJvdG90eXBlID0gQ29uc3RydWN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSh0aGlzLnByb3RvdHlwZSk7XG4gICAgcHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG5cbiAgICBpZiAoZXh0ZW5kZWRDbGFzc05hbWUpIHtcbiAgICAgICAgcHJvdG90eXBlLiQkQ0xBU1NfTkFNRSA9IGV4dGVuZGVkQ2xhc3NOYW1lO1xuICAgIH1cblxuICAgIG92ZXJyaWRlcihwcm90b3R5cGUsIHByb3RvdHlwZUFkZGl0aW9ucyk7XG5cbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG59XG5cbmZ1bmN0aW9uIEJhc2UoKSB7fVxuQmFzZS5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IEJhc2UucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuICAgIGdldCBzdXBlcigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZihPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykpO1xuICAgIH1cbn07XG5CYXNlLmV4dGVuZCA9IGV4dGVuZDtcbmV4dGVuZC5CYXNlID0gQmFzZTtcblxuLyoqIEB0eXBlZGVmIHtmdW5jdGlvbn0gZXh0ZW5kZWRDb25zdHJ1Y3RvclxuICogQHByb3BlcnR5IHByb3RvdHlwZS5zdXBlciAtIEEgcmVmZXJlbmNlIHRvIHRoZSBwcm90b3R5cGUgdGhpcyBjb25zdHJ1Y3RvciB3YXMgZXh0ZW5kZWQgZnJvbS5cbiAqIEBwcm9wZXJ0eSBbZXh0ZW5kXSAtIElmIGBwcm90b3R5cGVBZGRpdGlvbnMuZXh0ZW5kYWJsZWAgd2FzIHRydXRoeSwgdGhpcyB3aWxsIGJlIGEgcmVmZXJlbmNlIHRvIHtAbGluayBleHRlbmQuZXh0ZW5kfGV4dGVuZH0uXG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IGV4dGVuZGVkUHJvdG90eXBlQWRkaXRpb25zT2JqZWN0XG4gKiBAZGVzYyBBbGwgbWVtYmVycyBhcmUgY29waWVkIHRvIHRoZSBuZXcgb2JqZWN0LiBUaGUgZm9sbG93aW5nIGhhdmUgc3BlY2lhbCBtZWFuaW5nLlxuICogQHByb3BlcnR5IHtmdW5jdGlvbn0gW2luaXRpYWxpemVdIC0gQWRkaXRpb25hbCBjb25zdHJ1Y3RvciBjb2RlIGZvciBuZXcgb2JqZWN0LiBUaGlzIG1ldGhvZCBpcyBhZGRlZCB0byB0aGUgbmV3IGNvbnN0cnVjdG9yJ3MgcHJvdG90eXBlLiBHZXRzIHBhc3NlZCBuZXcgb2JqZWN0IGFzIGNvbnRleHQgKyBzYW1lIGFyZ3MgYXMgY29uc3RydWN0b3IgaXRzZWxmLiBDYWxsZWQgb24gaW5zdGFudGlhdGlvbiBhZnRlciBzaW1pbGFyIGZ1bmN0aW9uIGluIGFsbCBhbmNlc3RvcnMgY2FsbGVkIHdpdGggc2FtZSBzaWduYXR1cmUuXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSBbcHJlSW5pdGlhbGl6ZV0gLSBDYWxsZWQgYmVmb3JlIHRoZSBgaW5pdGlhbGl6ZWAgY2FzY2FkZS4gR2V0cyBwYXNzZWQgbmV3IG9iamVjdCBhcyBjb250ZXh0ICsgc2FtZSBhcmdzIGFzIGNvbnN0cnVjdG9yIGl0c2VsZi5cbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IFtwb3N0SW5pdGlhbGl6ZV0gLSBDYWxsZWQgYWZ0ZXIgdGhlIGBpbml0aWFsaXplYCBjYXNjYWRlLiBHZXRzIHBhc3NlZCBuZXcgb2JqZWN0IGFzIGNvbnRleHQgKyBzYW1lIGFyZ3MgYXMgY29uc3RydWN0b3IgaXRzZWxmLlxuICovXG5cbi8qKiBAc3VtbWFyeSBDYWxsIGFsbCBgaW5pdGlhbGl6ZWAgbWV0aG9kcyBmb3VuZCBpbiBwcm90b3R5cGUgY2hhaW4sIGJlZ2lubmluZyB3aXRoIHRoZSBtb3N0IHNlbmlvciBhbmNlc3RvcidzIGZpcnN0LlxuICogQGRlc2MgVGhpcyByZWN1cnNpdmUgcm91dGluZSBpcyBjYWxsZWQgYnkgdGhlIGNvbnN0cnVjdG9yLlxuICogMS4gV2Fsa3MgYmFjayB0aGUgcHJvdG90eXBlIGNoYWluIHRvIGBPYmplY3RgJ3MgcHJvdG90eXBlXG4gKiAyLiBXYWxrcyBmb3J3YXJkIHRvIG5ldyBvYmplY3QsIGNhbGxpbmcgYW55IGBpbml0aWFsaXplYCBtZXRob2RzIGl0IGZpbmRzIGFsb25nIHRoZSB3YXkgd2l0aCB0aGUgc2FtZSBjb250ZXh0IGFuZCBhcmd1bWVudHMgd2l0aCB3aGljaCB0aGUgY29uc3RydWN0b3Igd2FzIGNhbGxlZC5cbiAqIEBwcml2YXRlXG4gKiBAbWVtYmVyT2YgZXh0ZW5kLW1lXG4gKi9cbmZ1bmN0aW9uIGluaXRpYWxpemVQcm90b3R5cGVDaGFpbigpIHtcbiAgICB2YXIgdGVybSA9IHRoaXMsXG4gICAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgcmVjdXIodGVybSk7XG5cbiAgICBmdW5jdGlvbiByZWN1cihvYmopIHtcbiAgICAgICAgdmFyIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaik7XG4gICAgICAgIGlmIChwcm90by5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0KSB7XG4gICAgICAgICAgICByZWN1cihwcm90byk7XG4gICAgICAgICAgICBpZiAocHJvdG8uaGFzT3duUHJvcGVydHkoJ2luaXRpYWxpemUnKSkge1xuICAgICAgICAgICAgICAgIHByb3RvLmluaXRpYWxpemUuYXBwbHkodGVybSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzWydjb2x1bW4tQ1FMLXN5bnRheCddID0gW1xuJzxsaT4nLFxuJ1x0PGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb3B5XCI+PC9idXR0b24+JyxcbidcdDxkaXYgY2xhc3M9XCJmaWx0ZXItdHJlZS1yZW1vdmUtYnV0dG9uXCIgdGl0bGU9XCJkZWxldGUgY29uZGl0aW9uYWxcIj48L2Rpdj4nLFxuJ1x0ezF9OicsXG4nXHQ8aW5wdXQgbmFtZT1cInsyfVwiIGNsYXNzPVwiezR9XCIgdmFsdWU9XCJ7MzplbmNvZGV9XCI+Jyxcbic8L2xpPidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHNbJ2NvbHVtbi1TUUwtc3ludGF4J10gPSBbXG4nPGxpPicsXG4nXHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNvcHlcIj48L2J1dHRvbj4nLFxuJ1x0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2PicsXG4nXHR7MX06JyxcbidcdDx0ZXh0YXJlYSBuYW1lPVwiezJ9XCIgcm93cz1cIjFcIiBjbGFzcz1cIns0fVwiPnszOmVuY29kZX08L3RleHRhcmVhPicsXG4nPC9saT4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLmNvbHVtbkZpbHRlciA9IFtcbic8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbidcdCA8c3Ryb25nPjxzcGFuPnsyfSA8L3NwYW4+Y29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uOjwvc3Ryb25nPjxicj4nLFxuJ1x0IE1hdGNoJyxcbidcdCA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3Atb3JcIj5hbnk8L2xhYmVsPicsXG4nXHQgPGxhYmVsPjxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImZpbHRlci10cmVlLW9wLWNob2ljZVwiIG5hbWU9XCJ0cmVlT3B7MX1cIiB2YWx1ZT1cIm9wLWFuZFwiPmFsbDwvbGFiZWw+JyxcbidcdCA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3Atbm9yXCI+bm9uZTwvbGFiZWw+JyxcbidcdCBvZiB0aGUgZm9sbG93aW5nOicsXG4nXHQgPHNlbGVjdD4nLFxuJ1x0XHQgPG9wdGlvbiB2YWx1ZT1cIlwiPk5ldyBleHByZXNzaW9uJmhlbGxpcDs8L29wdGlvbj4nLFxuJ1x0IDwvc2VsZWN0PicsXG4nXHQgPG9sPjwvb2w+JyxcbicgPC9zcGFuPidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMuY29sdW1uRmlsdGVycyA9IFtcbic8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlIGZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnNcIj4nLFxuJ1x0IE1hdGNoIDxzdHJvbmc+YWxsPC9zdHJvbmc+IG9mIHRoZSBmb2xsb3dpbmcgY29sdW1uIGZpbHRlcnM6JyxcbidcdCA8b2w+PC9vbD4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5sb2NrZWRDb2x1bW4gPSBbXG4nPHNwYW4+JyxcbidcdCB7MTplbmNvZGV9JyxcbidcdCA8aW5wdXQgdHlwZT1cImhpZGRlblwiIHZhbHVlPVwiezJ9XCI+JyxcbicgPC9zcGFuPidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMubm90ZSA9IFtcbic8ZGl2IGNsYXNzPVwiZm9vdG5vdGVzXCI+JyxcbidcdDxkaXYgY2xhc3M9XCJmb290bm90ZVwiPjwvZGl2PicsXG4nXHQ8cD5TZWxlY3QgYSBuZXcgdmFsdWUgb3IgZGVsZXRlIHRoZSBleHByZXNzaW9uIGFsdG9nZXRoZXIuPC9wPicsXG4nPC9kaXY+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5ub3RlcyA9IFtcbic8ZGl2IGNsYXNzPVwiZm9vdG5vdGVzXCI+JyxcbidcdDxwPk5vdGUgdGhlIGZvbGxvd2luZyBlcnJvciBjb25kaXRpb25zOjwvcD4nLFxuJ1x0PHVsIGNsYXNzPVwiZm9vdG5vdGVcIj48L3VsPicsXG4nXHQ8cD5TZWxlY3QgbmV3IHZhbHVlcyBvciBkZWxldGUgdGhlIGV4cHJlc3Npb24gYWx0b2dldGhlci48L3A+Jyxcbic8L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLm9wdGlvbk1pc3NpbmcgPSBbXG4nVGhlIHJlcXVlc3RlZCB2YWx1ZSBvZiA8c3BhbiBjbGFzcz1cImZpZWxkLW5hbWVcIj57MTplbmNvZGV9PC9zcGFuPicsXG4nKDxzcGFuIGNsYXNzPVwiZmllbGQtdmFsdWVcIj57MjplbmNvZGV9PC9zcGFuPikgaXMgbm90IHZhbGlkLidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMucmVtb3ZlQnV0dG9uID0gW1xuJzxkaXYgY2xhc3M9XCJmaWx0ZXItdHJlZS1yZW1vdmUtYnV0dG9uXCIgdGl0bGU9XCJkZWxldGUgY29uZGl0aW9uYWxcIj48L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLnN1YnRyZWUgPSBbXG4nPHNwYW4gY2xhc3M9XCJmaWx0ZXItdHJlZVwiPicsXG4nXHQgTWF0Y2gnLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbidcdCA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3AtYW5kXCI+YWxsPC9sYWJlbD4nLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1ub3JcIj5ub25lPC9sYWJlbD4nLFxuJ1x0IG9mIHRoZSBmb2xsb3dpbmc6JyxcbidcdCA8c2VsZWN0PicsXG4nXHRcdCA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4nXHRcdCA8b3B0aW9uIHZhbHVlPVwic3ViZXhwXCIgc3R5bGU9XCJib3JkZXItYm90dG9tOjFweCBzb2xpZCBibGFja1wiPlN1YmV4cHJlc3Npb248L29wdGlvbj4nLFxuJ1x0IDwvc2VsZWN0PicsXG4nXHQgPG9sPjwvb2w+JyxcbicgPC9zcGFuPidcbl0uam9pbignXFxuJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xudmFyIHBvcE1lbnUgPSByZXF1aXJlKCdwb3AtbWVudScpO1xuXG52YXIgRmlsdGVyVHJlZSA9IHJlcXVpcmUoJy4vanMvRmlsdGVyVHJlZScpO1xuRmlsdGVyVHJlZS5Ob2RlID0gcmVxdWlyZSgnLi9qcy9GaWx0ZXJOb2RlJyk7IC8vIGFrYTogT2JqZWN0LmdldFByb3RvdHlwZU9mKEZpbHRlclRyZWUucHJvdG90eXBlKS5jb25zdHJ1Y3RvclxuRmlsdGVyVHJlZS5MZWFmID0gcmVxdWlyZSgnLi9qcy9GaWx0ZXJMZWFmJyk7IC8vIGFrYTogRmlsdGVyVHJlZS5wcm90b3R5cGUuZWRpdG9ycy5EZWZhdWx0XG5cbi8vIGV4cG9zZSBzb21lIG9iamVjdHMgZm9yIHBsdWctaW4gYWNjZXNzXG5cbkZpbHRlclRyZWUuQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi9qcy9Db25kaXRpb25hbHMnKTtcblxuLy8gRk9MTE9XSU5HIFBST1BFUlRJRVMgQVJFICoqKiBURU1QT1JBUlkgKioqLFxuLy8gRk9SIFRIRSBERU1PIFRPIEFDQ0VTUyBUSEVTRSBOT0RFIE1PRFVMRVMuXG5cbkZpbHRlclRyZWUuXyA9IF87XG5GaWx0ZXJUcmVlLnBvcE1lbnUgPSBwb3BNZW51O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyVHJlZTtcbiIsIi8qKiBAbW9kdWxlIGNvbmRpdGlvbmFscyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBCYXNlID0gcmVxdWlyZSgnZXh0ZW5kLW1lJykuQmFzZTtcbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xudmFyIHJlZ0V4cExJS0UgPSByZXF1aXJlKCdyZWdleHAtbGlrZScpO1xuXG52YXIgSU4gPSAnSU4nLFxuICAgIE5PVF9JTiA9ICdOT1QgJyArIElOLFxuICAgIExJS0UgPSAnTElLRScsXG4gICAgTk9UX0xJS0UgPSAnTk9UICcgKyBMSUtFLFxuICAgIExJS0VfV0lMRF9DQVJEID0gJyUnLFxuICAgIE5JTCA9ICcnO1xuXG52YXIgdG9TdHJpbmc7XG5cbnZhciBkZWZhdWx0SWRRdHMgPSB7XG4gICAgYmVnOiAnXCInLFxuICAgIGVuZDogJ1wiJ1xufTtcblxuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgQ29uZGl0aW9uYWxzID0gQmFzZS5leHRlbmQoe1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3FsSWRRdHNPYmplY3R9IFtvcHRpb25zLnNxbElkUXRzPXtiZWc6J1wiJyxlbmQ6J1wiJ31dXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBpZFF0cyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zcWxJZFF0cztcbiAgICAgICAgaWYgKGlkUXRzKSB7XG4gICAgICAgICAgICB0aGlzLnNxbElkUXRzID0gaWRRdHM7IC8vIG9ubHkgb3ZlcnJpZGUgaWYgZGVmaW5lZFxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHNxbElkUXRzOiBkZWZhdWx0SWRRdHMsXG4gICAgLyoqXG4gICAgICogQHBhcmFtIGlkXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIG1ha2VTcWxJZGVudGlmaWVyOiBmdW5jdGlvbihpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zcWxJZFF0cy5iZWcgKyBpZCArIHRoaXMuc3FsSWRRdHMuZW5kO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gc3RyaW5nXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIG1ha2VTcWxTdHJpbmc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICByZXR1cm4gJ1xcJycgKyBzcUVzYyhzdHJpbmcpICsgJ1xcJyc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZUxJS0U6IGZ1bmN0aW9uKGJlZywgZW5kLCBvcCwgb3JpZ2luYWxPcCwgYykge1xuICAgICAgICB2YXIgZXNjYXBlZCA9IGMub3BlcmFuZC5yZXBsYWNlKC8oW19cXFtcXF0lXSkvZywgJ1skMV0nKTsgLy8gZXNjYXBlIGFsbCBMSUtFIHJlc2VydmVkIGNoYXJzXG4gICAgICAgIHJldHVybiB0aGlzLm1ha2VTcWxJZGVudGlmaWVyKGMuY29sdW1uKSArXG4gICAgICAgICAgICAnICcgKyBvcCArXG4gICAgICAgICAgICAnICcgKyB0aGlzLm1ha2VTcWxTdHJpbmcoYmVnICsgZXNjYXBlZCArIGVuZCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZUlOOiBmdW5jdGlvbihvcCwgYykge1xuICAgICAgICByZXR1cm4gdGhpcy5tYWtlU3FsSWRlbnRpZmllcihjLmNvbHVtbikgK1xuICAgICAgICAgICAgJyAnICsgb3AgK1xuICAgICAgICAgICAgJyAnICsgJyhcXCcnICsgc3FFc2MoYy5vcGVyYW5kKS5yZXBsYWNlKC9cXHMqLFxccyovZywgJ1xcJywgXFwnJykgKyAnXFwnKSc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZTogZnVuY3Rpb24ob3AsIGMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWFrZVNxbElkZW50aWZpZXIoYy5jb2x1bW4pICtcbiAgICAgICAgICAgICcgJyArIG9wICtcbiAgICAgICAgICAgICcgJyArIGMubWFrZVNxbE9wZXJhbmQoKTtcbiAgICB9XG59KTtcblxudmFyIG9wcyA9IENvbmRpdGlvbmFscy5wcm90b3R5cGUub3BzID0ge1xuICAgIHVuZGVmaW5lZDoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKCkgeyByZXR1cm4gJyc7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnPCc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA8IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZSgnPCcsIGMpOyB9XG4gICAgfSxcbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc8PSc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA8PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJzw9JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnPSc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA9PT0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKCc9JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnPj0nOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGEgPj0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKCc+PScsIGMpOyB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJz4nOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGEgPiBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJz4nLCBjKTsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc8Pic6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSAhPT0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKCc8PicsIGMpOyB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgTElLRToge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiByZWdFeHBMSUtFLmNhY2hlZChiLCB0cnVlKS50ZXN0KGEpOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoTElLRSwgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBMSUtFJzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiAhcmVnRXhwTElLRS5jYWNoZWQoYiwgdHJ1ZSkudGVzdChhKTsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKE5PVF9MSUtFLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBJTjogeyAvLyBUT0RPOiBjdXJyZW50bHkgZm9yY2luZyBzdHJpbmcgdHlwaW5nOyByZXdvcmsgY2FsbGluZyBjb2RlIHRvIHJlc3BlY3QgY29sdW1uIHR5cGVcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gaW5PcChhLCBiKSA+PSAwOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VJTihJTiwgYyk7IH0sXG4gICAgICAgIG9wZXJhbmRMaXN0OiB0cnVlLFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICdOT1QgSU4nOiB7IC8vIFRPRE86IGN1cnJlbnRseSBmb3JjaW5nIHN0cmluZyB0eXBpbmc7IHJld29yayBjYWxsaW5nIGNvZGUgdG8gcmVzcGVjdCBjb2x1bW4gdHlwZVxuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBpbk9wKGEsIGIpIDwgMDsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlSU4oTk9UX0lOLCBjKTsgfSxcbiAgICAgICAgb3BlcmFuZExpc3Q6IHRydWUsXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgQ09OVEFJTlM6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gY29udGFpbnNPcChhLCBiKSA+PSAwOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VMSUtFKExJS0VfV0lMRF9DQVJELCBMSUtFX1dJTERfQ0FSRCwgTElLRSwgJ0NPTlRBSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBDT05UQUlOUyc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gY29udGFpbnNPcChhLCBiKSA8IDA7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIExJS0VfV0lMRF9DQVJELCBOT1RfTElLRSwgJ05PVCBDT05UQUlOUycsIGMpOyB9LFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIEJFR0lOUzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IGIgPSB0b1N0cmluZyhiKTsgcmV0dXJuIGJlZ2luc09wKGEsIGIubGVuZ3RoKSA9PT0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlTElLRShOSUwsIExJS0VfV0lMRF9DQVJELCBMSUtFLCAnQkVHSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBCRUdJTlMnOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgYiA9IHRvU3RyaW5nKGIpOyByZXR1cm4gYmVnaW5zT3AoYSwgYi5sZW5ndGgpICE9PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VMSUtFKE5JTCwgTElLRV9XSUxEX0NBUkQsIE5PVF9MSUtFLCAnTk9UIEJFR0lOUycsIGMpOyB9LFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIEVORFM6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyBiID0gdG9TdHJpbmcoYik7IHJldHVybiBlbmRzT3AoYSwgYi5sZW5ndGgpID09PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VMSUtFKExJS0VfV0lMRF9DQVJELCBOSUwsIExJS0UsICdFTkRTJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBFTkRTJzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IGIgPSB0b1N0cmluZyhiKTsgcmV0dXJuIGVuZHNPcChhLCBiLmxlbmd0aCkgIT09IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIE5JTCwgTk9UX0xJS0UsICdOT1QgRU5EUycsIGMpOyB9LFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH1cbn07XG5cbi8vIHNvbWUgc3lub255bXNcbm9wc1snXFx1MjI2NCddID0gb3BzWyc8PSddOyAgLy8gVU5JQ09ERSAnTEVTUy1USEFOIE9SIEVRVUFMIFRPJ1xub3BzWydcXHUyMjY1J10gPSBvcHNbJz49J107ICAvLyBVTklDT0RFICdHUkVBVEVSLVRIQU4gT1IgRVFVQUwgVE8nXG5vcHNbJ1xcdTIyNjAnXSA9IG9wc1snPD4nXTsgIC8vIFVOSUNPREUgJ05PVCBFUVVBTCBUTydcblxuZnVuY3Rpb24gaW5PcChhLCBiKSB7XG4gICAgcmV0dXJuIGJcbiAgICAgICAgLnRyaW0oKSAvLyByZW1vdmUgbGVhZGluZyBhbmQgdHJhaWxpbmcgc3BhY2UgY2hhcnNcbiAgICAgICAgLnJlcGxhY2UoL1xccyosXFxzKi9nLCAnLCcpIC8vIHJlbW92ZSBhbnkgd2hpdGUtc3BhY2UgY2hhcnMgZnJvbSBhcm91bmQgY29tbWFzXG4gICAgICAgIC5zcGxpdCgnLCcpIC8vIHB1dCBpbiBhbiBhcnJheVxuICAgICAgICAuaW5kZXhPZigoYSArICcnKSk7IC8vIHNlYXJjaCBhcnJheSB3aG9sZSBtYXRjaGVzXG59XG5cbmZ1bmN0aW9uIGNvbnRhaW5zT3AoYSwgYikge1xuICAgIHJldHVybiB0b1N0cmluZyhhKS5pbmRleE9mKHRvU3RyaW5nKGIpKTtcbn1cblxuZnVuY3Rpb24gYmVnaW5zT3AoYSwgbGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nKGEpLnN1YnN0cigwLCBsZW5ndGgpO1xufVxuXG5mdW5jdGlvbiBlbmRzT3AoYSwgbGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nKGEpLnN1YnN0cigtbGVuZ3RoLCBsZW5ndGgpO1xufVxuXG5mdW5jdGlvbiBzcUVzYyhzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLycvZywgJ1xcJ1xcJycpO1xufVxuXG52YXIgZ3JvdXBzID0ge1xuICAgIGVxdWFsaXR5OiB7XG4gICAgICAgIGxhYmVsOiAnRXF1YWxpdHknLFxuICAgICAgICBzdWJtZW51OiBbJz0nXVxuICAgIH0sXG4gICAgaW5lcXVhbGl0aWVzOiB7XG4gICAgICAgIGxhYmVsOiAnSW5lcXVhbGl0aWVzJyxcbiAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAgJzwnLFxuICAgICAgICAgICAgJ1xcdTIyNjQnLCAvLyBVTklDT0RFICdMRVNTLVRIQU4gT1IgRVFVQUwgVE8nOyBvbiBhIE1hYywgdHlwZSBvcHRpb24tY29tbWEgKOKJpClcbiAgICAgICAgICAgICdcXHUyMjYwJywgLy8gVU5JQ09ERSAnTk9UIEVRVUFMUyc7IG9uIGEgTWFjLCB0eXBlIG9wdGlvbi1lcXVhbHMgKOKJoClcbiAgICAgICAgICAgICdcXHUyMjY1JywgLy8gVU5JQ09ERSAnR1JFQVRFUi1USEFOIE9SIEVRVUFMIFRPJzsgb24gYSBNYWMsIHR5cGUgb3B0aW9uLXBlcmlvZCAo4omlKVxuICAgICAgICAgICAgJz4nXG4gICAgICAgIF1cbiAgICB9LFxuICAgIHNldHM6IHtcbiAgICAgICAgbGFiZWw6ICdTZXQgc2NhbnMnLFxuICAgICAgICBzdWJtZW51OiBbJ0lOJywgJ05PVCBJTiddXG4gICAgfSxcbiAgICBzdHJpbmdzOiB7XG4gICAgICAgIGxhYmVsOiAnU3RyaW5nIHNjYW5zJyxcbiAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAgJ0NPTlRBSU5TJywgJ05PVCBDT05UQUlOUycsXG4gICAgICAgICAgICAnQkVHSU5TJywgJ05PVCBCRUdJTlMnLFxuICAgICAgICAgICAgJ0VORFMnLCAnTk9UIEVORFMnXG4gICAgICAgIF1cbiAgICB9LFxuICAgIHBhdHRlcm5zOiB7XG4gICAgICAgIGxhYmVsOiAnUGF0dGVybiBzY2FucycsXG4gICAgICAgIHN1Ym1lbnU6IFsnTElLRScsICdOT1QgTElLRSddXG4gICAgfVxufTtcblxuLy8gYWRkIGEgYG5hbWVgIHByb3AgdG8gZWFjaCBncm91cFxuXyhncm91cHMpLmVhY2goZnVuY3Rpb24oZ3JvdXAsIGtleSkgeyBncm91cC5uYW1lID0ga2V5OyB9KTtcblxuLyoqXG4gKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzXG4gKi9cbkNvbmRpdGlvbmFscy5ncm91cHMgPSBncm91cHM7XG5cbi8qKiBEZWZhdWx0IG9wZXJhdG9yIG1lbnUgd2hlbiBjb25zaXN0aW5nIG9mIGFsbCBvZiB0aGUgZ3JvdXBzIGluIHtAbGluayBtb2R1bGU6Y29uZGl0aW9uYWxzLmdyb3Vwc3xncm91cHN9LiBUaGlzIG1lbnUgaXMgdXNlZCB3aGVuIG5vbmUgb2YgdGhlIGZvbGxvd2luZyBpcyBvdGhlcndpc2UgZGVmaW5lZDpcbiAqICogVGhlIGBvcE1lbnVgIHByb3BlcnR5IG9mIHRoZSBjb2x1bW4gc2NoZW1hLlxuICogKiBUaGUgZW50cnkgaW4gdGhlIG5vZGUncyBgdHlwZU9wTWFwYCBoYXNoIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGB0eXBlYCBwcm9wZXJ0eSBvZiB0aGUgY29sdW1uIHNjaGVtYS5cbiAqICogVGhlIG5vZGUncyBgdHJlZU9wTWVudWAgb2JqZWN0LlxuICogQHR5cGUge21lbnVJdGVtW119XG4gKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzXG4gKi9cbkNvbmRpdGlvbmFscy5kZWZhdWx0T3BNZW51ID0gWyAvLyBoaWVyYXJjaGljYWwgbWVudSBvZiByZWxhdGlvbmFsIG9wZXJhdG9yc1xuICAgIGdyb3Vwcy5lcXVhbGl0eSxcbiAgICBncm91cHMuaW5lcXVhbGl0aWVzLFxuICAgIGdyb3Vwcy5zZXRzLFxuICAgIGdyb3Vwcy5zdHJpbmdzLFxuICAgIGdyb3Vwcy5wYXR0ZXJuc1xuXTtcblxuXG4vLyBNZWFudCB0byBiZSBjYWxsZWQgYnkgRmlsdGVyVHJlZS5wcm90b3R5cGUuc2V0U2Vuc2l0aXZpdHkgb25seVxuQ29uZGl0aW9uYWxzLnNldFRvU3RyaW5nID0gZnVuY3Rpb24oZm4pIHtcbiAgICByZXR1cm4gKHRvU3RyaW5nID0gZm4pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb25kaXRpb25hbHM7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cbi8qIGVzbGludC1kaXNhYmxlIGtleS1zcGFjaW5nICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHBvcE1lbnUgPSByZXF1aXJlKCdwb3AtbWVudScpO1xuXG52YXIgRmlsdGVyTm9kZSA9IHJlcXVpcmUoJy4vRmlsdGVyTm9kZScpO1xudmFyIENvbmRpdGlvbmFscyA9IHJlcXVpcmUoJy4vQ29uZGl0aW9uYWxzJyk7XG5cblxudmFyIHRvU3RyaW5nOyAvLyBzZXQgYnkgRmlsdGVyTGVhZi5zZXRUb1N0cmluZygpIGNhbGxlZCBmcm9tIC4uL2luZGV4LmpzXG5cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IGNvbnZlcnRlclxuICogQHByb3BlcnR5IHtmdW5jdGlvbn0gdG9UeXBlIC0gUmV0dXJucyBpbnB1dCB2YWx1ZSBjb252ZXJ0ZWQgdG8gdHlwZS4gRmFpbHMgc2lsZW50bHkuXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSBmYWlsZWQgLSBUZXN0cyBpbnB1dCB2YWx1ZSBhZ2FpbnN0IHR5cGUsIHJldHVybmluZyBgZmFsc2UgaWYgdHlwZSBvciBgdHJ1ZWAgaWYgbm90IHR5cGUuXG4gKi9cblxuLyoqIEB0eXBlIHtjb252ZXJ0ZXJ9ICovXG52YXIgbnVtYmVyQ29udmVydGVyID0ge1xuICAgIHRvVHlwZTogTnVtYmVyLFxuICAgIGZhaWxlZDogaXNOYU5cbn07XG5cbi8qKiBAdHlwZSB7Y29udmVydGVyfSAqL1xudmFyIGRhdGVDb252ZXJ0ZXIgPSB7XG4gICAgdG9UeXBlOiBmdW5jdGlvbihzKSB7IHJldHVybiBuZXcgRGF0ZShzKTsgfSxcbiAgICBmYWlsZWQ6IGlzTmFOXG59O1xuXG4vKipcbiAqIEB0eXBlZGVmIHtvYmplY3R9IGZpbHRlckxlYWZWaWV3T2JqZWN0XG4gKlxuICogQHByb3BlcnR5IHtIVE1MRWxlbWVudH0gY29sdW1uIC0gQSBkcm9wLWRvd24gd2l0aCBvcHRpb25zIGZyb20gdGhlIGBGaWx0ZXJMZWFmYCBpbnN0YW5jZSdzIHNjaGVtYS4gVmFsdWUgaXMgdGhlIG5hbWUgb2YgdGhlIGNvbHVtbiBiZWluZyB0ZXN0ZWQgKGkuZS4sIHRoZSBjb2x1bW4gdG8gd2hpY2ggdGhpcyBjb25kaXRpb25hbCBleHByZXNzaW9uIGFwcGxpZXMpLlxuICpcbiAqIEBwcm9wZXJ0eSBvcGVyYXRvciAtIEEgZHJvcC1kb3duIHdpdGggb3B0aW9ucyBmcm9tIHtAbGluayBjb2x1bW5PcE1lbnV9LCB7QGxpbmsgdHlwZU9wTWFwfSwgb3Ige0BsaW5rIHRyZWVPcE1lbnV9LiBWYWx1ZSBpcyB0aGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvcGVyYXRvci5cbiAqXG4gKiBAcHJvcGVydHkgb3BlcmFuZCAtIEFuIGlucHV0IGVsZW1lbnQsIHN1Y2ggYXMgYSBkcm9wLWRvd24gb3IgYSB0ZXh0IGJveC5cbiAqL1xuXG4vKiogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBBbiBvYmplY3QgdGhhdCByZXByZXNlbnRzIGEgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBub2RlIGluIGEgZmlsdGVyIHRyZWUuXG4gKiBAZGVzYyBUaGlzIG9iamVjdCByZXByZXNlbnRzIGEgY29uZGl0aW9uYWwgZXhwcmVzc2lvbi4gSXQgaXMgYWx3YXlzIGEgdGVybWluYWwgbm9kZSBpbiB0aGUgZmlsdGVyIHRyZWU7IGl0IGhhcyBubyBjaGlsZCBub2RlcyBvZiBpdHMgb3duLlxuICpcbiAqIEEgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBpcyBhIHNpbXBsZSBkeWFkaWMgZXhwcmVzc2lvbiB3aXRoIHRoZSBmb2xsb3dpbmcgc3ludGF4IGluIHRoZSBVSTpcbiAqXG4gKiA+IF9jb2x1bW4gb3BlcmF0b3Igb3BlcmFuZF9cbiAqXG4gKiB3aGVyZTpcbiAqICogX2NvbHVtbl8gaXMgdGhlIG5hbWUgb2YgYSBjb2x1bW4gZnJvbSB0aGUgZGF0YSByb3cgb2JqZWN0XG4gKiAqIF9vcGVyYXRvcl8gaXMgdGhlIG5hbWUgb2YgYW4gb3BlcmF0b3IgZnJvbSB0aGUgbm9kZSdzIG9wZXJhdG9yIGxpc3RcbiAqICogX29wZXJhbmRfIGlzIGEgbGl0ZXJhbCB2YWx1ZSB0byBjb21wYXJlIGFnYWluc3QgdGhlIHZhbHVlIGluIHRoZSBuYW1lZCBjb2x1bW5cbiAqXG4gKiAqKk5PVEU6KiogVGhlIHtAbGluayBDb2x1bW5MZWFmfSBleHRlbnNpb24gb2YgdGhpcyBvYmplY3QgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIF9vcGVyYW5kXyB3aGljaCBpczogVGhlIG5hbWUgb2YgYSBjb2x1bW4gZnJvbSB3aGljaCB0byBmZXRjaCB0aGUgY29tcGFyZSB2YWx1ZSAoZnJvbSB0aGUgc2FtZSBkYXRhIHJvdyBvYmplY3QpIHRvIGNvbXBhcmUgYWdhaW5zdCB0aGUgdmFsdWUgaW4gdGhlIG5hbWVkIGNvbHVtbi4gU2VlICpFeHRlbmRpbmcgdGhlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gb2JqZWN0KiBpbiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2luZGV4Lmh0bWx8cmVhZG1lfS5cbiAqXG4gKiBUaGUgdmFsdWVzIG9mIHRoZSB0ZXJtcyBvZiB0aGUgZXhwcmVzc2lvbiBhYm92ZSBhcmUgc3RvcmVkIGluIHRoZSBmaXJzdCB0aHJlZSBwcm9wZXJ0aWVzIGJlbG93LiBFYWNoIG9mIHRoZXNlIHRocmVlIHByb3BlcnRpZXMgaXMgc2V0IGVpdGhlciBieSBgc2V0U3RhdGUoKWAgb3IgYnkgdGhlIHVzZXIgdmlhIGEgY29udHJvbCBpbiBgZWxgLiBOb3RlIHRoYXQgdGhlc2UgcHJvcGVydGllcyBhcmUgbm90IGR5bmFtaWNhbGx5IGJvdW5kIHRvIHRoZSBVSSBjb250cm9sczsgdGhleSBhcmUgdXBkYXRlZCBieSB0aGUgdmFsaWRhdGlvbiBmdW5jdGlvbiwgYGludmFsaWQoKWAuXG4gKlxuICogKipTZWUgYWxzbyB0aGUgcHJvcGVydGllcyBvZiB0aGUgc3VwZXJjbGFzczoqKiB7QGxpbmsgRmlsdGVyTm9kZX1cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY29sdW1uIC0gTmFtZSBvZiB0aGUgbWVtYmVyIGluIHRoZSBkYXRhIHJvdyBvYmplY3RzIGFnYWluc3Qgd2hpY2ggYG9wZXJhbmRgIHdpbGwgYmUgY29tcGFyZWQuIFJlZmxlY3RzIHRoZSB2YWx1ZSBvZiB0aGUgYHZpZXcuY29sdW1uYCBjb250cm9sIGFmdGVyIHZhbGlkYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wZXJhdG9yIC0gT3BlcmF0b3Igc3ltYm9sLiBUaGlzIG11c3QgbWF0Y2ggYSBrZXkgaW4gdGhlIGB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm9wc2AgaGFzaC4gUmVmbGVjdHMgdGhlIHZhbHVlIG9mIHRoZSBgdmlldy5vcGVyYXRvcmAgY29udHJvbCBhZnRlciB2YWxpZGF0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBvcGVyYW5kIC0gVmFsdWUgdG8gY29tcGFyZSBhZ2FpbnN0IHRoZSB0aGUgbWVtYmVyIG9mIGRhdGEgcm93IG5hbWVkIGJ5IGBjb2x1bW5gLiBSZWZsZWN0cyB0aGUgdmFsdWUgb2YgdGhlIGB2aWV3Lm9wZXJhbmRgIGNvbnRyb2wsIGFmdGVyIHZhbGlkYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG5hbWUgLSBVc2VkIHRvIGRlc2NyaWJlIHRoZSBvYmplY3QgaW4gdGhlIFVJIHNvIHVzZXIgY2FuIHNlbGVjdCBhbiBleHByZXNzaW9uIGVkaXRvci5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3R5cGU9J3N0cmluZyddIC0gVGhlIGRhdGEgdHlwZSBvZiB0aGUgc3ViZXhwcmVzc2lvbiBpZiBuZWl0aGVyIHRoZSBvcGVyYXRvciBub3IgdGhlIGNvbHVtbiBzY2hlbWEgZGVmaW5lcyBhIHR5cGUuXG4gKlxuICogQHByb3BlcnR5IHtIVE1MRWxlbWVudH0gZWwgLSBBIGA8c3Bhbj4uLi48L3NwYW4+YCBlbGVtZW50IHRoYXQgY29udGFpbnMgdGhlIFVJIGNvbnRyb2xzLiBUaGlzIGVsZW1lbnQgaXMgYXV0b21hdGljYWxseSBhcHBlbmVkZWQgdG8gdGhlIHBhcmVudCBgRmlsdGVyVHJlZWAncyBgZWxgLiBHZW5lcmF0ZWQgYnkge0BsaW5rIEZpbHRlckxlYWYjY3JlYXRlVmlld3xjcmVhdGVWaWV3fS5cbiAqXG4gKiBAcHJvcGVydHkge2ZpbHRlckxlYWZWaWV3T2JqZWN0fSB2aWV3IC0gQSBoYXNoIGNvbnRhaW5pbmcgZGlyZWN0IHJlZmVyZW5jZXMgdG8gdGhlIGNvbnRyb2xzIGluIGBlbGAuIEFkZGVkIGJ5IHtAbGluayBGaWx0ZXJMZWFmI2NyZWF0ZVZpZXd8Y3JlYXRlVmlld30uXG4gKi9cbnZhciBGaWx0ZXJMZWFmID0gRmlsdGVyTm9kZS5leHRlbmQoJ0ZpbHRlckxlYWYnLCB7XG5cbiAgICBuYW1lOiAnY29sdW1uID0gdmFsdWUnLCAvLyBkaXNwbGF5IHN0cmluZyBmb3IgZHJvcC1kb3duXG5cbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMudmlldykge1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMudmlldykge1xuICAgICAgICAgICAgICAgIHRoaXMudmlld1trZXldLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMub25DaGFuZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBDcmVhdGUgYSBuZXcgdmlldy5cbiAgICAgKiBAZGVzYyBUaGlzIG5ldyBcInZpZXdcIiBpcyBhIGdyb3VwIG9mIEhUTUwgYEVsZW1lbnRgIGNvbnRyb2xzIHRoYXQgY29tcGxldGVseSBkZXNjcmliZSB0aGUgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiB0aGlzIG9iamVjdCByZXByZXNlbnRzLiBUaGlzIG1ldGhvZCBjcmVhdGVzIHRoZSB2aWV3LCBzZXR0aW5nIGB0aGlzLmVsYCB0byBwb2ludCB0byBpdCwgYW5kIHRoZSBtZW1iZXJzIG9mIGB0aGlzLnZpZXdgIHRvIHBvaW50IHRvIHRoZSBpbmRpdmlkdWFsIGNvbnRyb2xzIHRoZXJlaW4uXG4gICAgICogQG1lbWJlck9mIEZpbHRlckxlYWYjXG4gICAgICovXG4gICAgY3JlYXRlVmlldzogZnVuY3Rpb24oc3RhdGUpIHtcbiAgICAgICAgdmFyIGVsID0gdGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuICAgICAgICBlbC5jbGFzc05hbWUgPSAnZmlsdGVyLXRyZWUtZWRpdG9yIGZpbHRlci10cmVlLWRlZmF1bHQnO1xuXG4gICAgICAgIGlmIChzdGF0ZSAmJiBzdGF0ZS5jb2x1bW4pIHtcbiAgICAgICAgICAgIC8vIFN0YXRlIGluY2x1ZGVzIGNvbHVtbjpcbiAgICAgICAgICAgIC8vIE9wZXJhdG9yIG1lbnUgaXMgYnVpbHQgbGF0ZXIgaW4gbG9hZFN0YXRlOyB3ZSBkb24ndCBuZWVkIHRvIGJ1aWxkIGl0IG5vdy4gVGhlIGNhbGwgdG9cbiAgICAgICAgICAgIC8vIGdldE9wTWVudSBiZWxvdyB3aXRoIHVuZGVmaW5lZCBjb2x1bW5OYW1lIHJldHVybnMgW10gcmVzdWx0aW5nIGluIGFuIGVtcHR5IGRyb3AtZG93bi5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFdoZW4gc3RhdGUgZG9lcyBOT1QgaW5jbHVkZSBjb2x1bW4sIGl0J3MgYmVjYXVzZSBlaXRoZXI6XG4gICAgICAgICAgICAvLyBhLiBjb2x1bW4gaXMgdW5rbm93biBhbmQgb3AgbWVudSB3aWxsIGJlIGVtcHR5IHVudGlsIHVzZXIgY2hvb3NlcyBhIGNvbHVtbjsgb3JcbiAgICAgICAgICAgIC8vIGIuIGNvbHVtbiBpcyBoYXJkLWNvZGVkIHdoZW4gdGhlcmUncyBvbmx5IG9uZSBwb3NzaWJsZSBjb2x1bW4gYXMgaW5mZXJhYmxlIGZyb20gc2NoZW1hOlxuICAgICAgICAgICAgdmFyIHNjaGVtYSA9IHRoaXMuc2NoZW1hICYmIHRoaXMuc2NoZW1hLmxlbmd0aCA9PT0gMSAmJiB0aGlzLnNjaGVtYVswXSxcbiAgICAgICAgICAgICAgICBjb2x1bW5OYW1lID0gc2NoZW1hICYmIHNjaGVtYS5uYW1lIHx8IHNjaGVtYTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudmlldyA9IHtcbiAgICAgICAgICAgIGNvbHVtbjogdGhpcy5tYWtlRWxlbWVudCh0aGlzLnNjaGVtYSwgJ2NvbHVtbicsIHRoaXMuc29ydENvbHVtbk1lbnUpLFxuICAgICAgICAgICAgb3BlcmF0b3I6IHRoaXMubWFrZUVsZW1lbnQoZ2V0T3BNZW51LmNhbGwodGhpcywgY29sdW1uTmFtZSksICdvcGVyYXRvcicpLFxuICAgICAgICAgICAgb3BlcmFuZDogdGhpcy5tYWtlRWxlbWVudCgpXG4gICAgICAgIH07XG5cbiAgICAgICAgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnInKSk7XG4gICAgfSxcblxuICAgIGxvYWRTdGF0ZTogZnVuY3Rpb24oc3RhdGUpIHtcbiAgICAgICAgdmFyIHZhbHVlLCBlbCwgaSwgYiwgc2VsZWN0ZWQsIG9wcywgdGhpc09wLCBvcE1lbnUsIG5vdGVzO1xuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIG5vdGVzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gc3RhdGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIUZpbHRlck5vZGUub3B0aW9uc1NjaGVtYVtrZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpc1trZXldID0gc3RhdGVba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZWwgPSB0aGlzLnZpZXdba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChlbC50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdjaGVja2JveCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdyYWRpbyc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lPVxcJycgKyBlbC5uYW1lICsgJ1xcJ10nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxbaV0uY2hlY2tlZCA9IHZhbHVlLmluZGV4T2YoZWxbaV0udmFsdWUpID49IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnc2VsZWN0LW11bHRpcGxlJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGVsLm9wdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgYiA9IGZhbHNlOyBpIDwgZWwubGVuZ3RoOyBpKyssIGIgPSBiIHx8IHNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkID0gdmFsdWUuaW5kZXhPZihlbFtpXS52YWx1ZSkgPj0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxbaV0uc2VsZWN0ZWQgPSBzZWxlY3RlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwsIGIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbC52YWx1ZSA9PT0gJycgJiYga2V5ID09PSAnb3BlcmF0b3InKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wZXJhdG9yIG1heSBiZSBhIHN5bm9ueW0uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wcyA9IHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzT3AgPSBvcHNbdmFsdWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcE1lbnUgPSBnZXRPcE1lbnUuY2FsbCh0aGlzLCBzdGF0ZS5jb2x1bW4gfHwgdGhpcy5jb2x1bW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBlYWNoIG1lbnUgaXRlbSdzIG9wIG9iamVjdCBmb3IgZXF1aXZhbGVuY3kgdG8gcG9zc2libGUgc3lub255bSdzIG9wIG9iamVjdC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9wTWVudS53YWxrLmNhbGwob3BNZW51LCBlcXVpdik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGVzLnB1c2goeyBrZXk6IGtleSwgdmFsdWU6IHZhbHVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSAnY29sdW1uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYWtlT3BNZW51LmNhbGwodGhpcywgdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub3Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgbXVsdGlwbGUgPSBub3Rlcy5sZW5ndGggPiAxLFxuICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZXMgPSB0aGlzLnRlbXBsYXRlcyxcbiAgICAgICAgICAgICAgICAgICAgZm9vdG5vdGVzID0gdGVtcGxhdGVzLmdldChtdWx0aXBsZSA/ICdub3RlcycgOiAnbm90ZScpLFxuICAgICAgICAgICAgICAgICAgICBpbm5lciA9IGZvb3Rub3Rlcy5xdWVyeVNlbGVjdG9yKCcuZm9vdG5vdGUnKTtcbiAgICAgICAgICAgICAgICBub3Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZvb3Rub3RlID0gbXVsdGlwbGUgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpIDogaW5uZXI7XG4gICAgICAgICAgICAgICAgICAgIG5vdGUgPSB0ZW1wbGF0ZXMuZ2V0KCdvcHRpb25NaXNzaW5nJywgbm90ZS5rZXksIG5vdGUudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAobm90ZS5sZW5ndGgpIHsgZm9vdG5vdGUuYXBwZW5kQ2hpbGQobm90ZVswXSk7IH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG11bHRpcGxlKSB7IGlubmVyLmFwcGVuZENoaWxkKGZvb3Rub3RlKTsgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ub3Rlc0VsID0gZm9vdG5vdGVzO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGVxdWl2KG9wTWVudUl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBvcE5hbWUgPSBvcE1lbnVJdGVtLm5hbWUgfHwgb3BNZW51SXRlbTtcbiAgICAgICAgICAgIGlmIChvcHNbb3BOYW1lXSA9PT0gdGhpc09wKSB7XG4gICAgICAgICAgICAgICAgZWwudmFsdWUgPSBvcE5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IG51bWJlclxuICAgICAqIEBwcm9wZXJ0eSB7Y29udmVydGVyfSBpbnQgLSBzeW5vbnltIG9mIGBudW1iZXJgXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IGZsb2F0IC0gc3lub255bSBvZiBgbnVtYmVyYFxuICAgICAqIEBwcm9wZXJ0eSB7Y29udmVydGVyfSBkYXRlXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IHN0cmluZ1xuICAgICAqL1xuICAgIGNvbnZlcnRlcnM6IHtcbiAgICAgICAgbnVtYmVyOiBudW1iZXJDb252ZXJ0ZXIsXG4gICAgICAgIGludDogbnVtYmVyQ29udmVydGVyLFxuICAgICAgICBmbG9hdDogbnVtYmVyQ29udmVydGVyLFxuICAgICAgICBkYXRlOiBkYXRlQ29udmVydGVyXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBieSB0aGUgcGFyZW50IG5vZGUncyB7QGxpbmsgRmlsdGVyVHJlZSNpbnZhbGlkfGludmFsaWQoKX0gbWV0aG9kLCB3aGljaCBjYXRjaGVzIHRoZSBlcnJvciB0aHJvd24gd2hlbiBpbnZhbGlkLlxuICAgICAqXG4gICAgICogQWxzbyBwZXJmb3JtcyB0aGUgZm9sbG93aW5nIGNvbXBpbGF0aW9uIGFjdGlvbnM6XG4gICAgICogKiBDb3BpZXMgYWxsIGB0aGlzLnZpZXdgJyB2YWx1ZXMgZnJvbSB0aGUgRE9NIHRvIHNpbWlsYXJseSBuYW1lZCBwcm9wZXJ0aWVzIG9mIGB0aGlzYC5cbiAgICAgKiAqIFByZS1zZXRzIGB0aGlzLm9wYCBhbmQgYHRoaXMuY29udmVydGVyYCBmb3IgdXNlIGluIGB0ZXN0YCdzIHRyZWUgd2Fsay5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudGhyb3c9ZmFsc2VdIC0gVGhyb3cgYW4gZXJyb3IgaWYgbWlzc2luZyBvciBpbnZhbGlkIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZm9jdXM9ZmFsc2VdIC0gTW92ZSBmb2N1cyB0byBvZmZlbmRpbmcgY29udHJvbC5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfSBUaGlzIGlzIHRoZSBub3JtYWwgcmV0dXJuIHdoZW4gdmFsaWQ7IG90aGVyd2lzZSB0aHJvd3MgZXJyb3Igd2hlbiBpbnZhbGlkLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJMZWFmI1xuICAgICAqL1xuICAgIGludmFsaWQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGVsZW1lbnROYW1lLCB0eXBlLCBmb2N1c2VkO1xuXG4gICAgICAgIGZvciAoZWxlbWVudE5hbWUgaW4gdGhpcy52aWV3KSB7XG4gICAgICAgICAgICB2YXIgZWwgPSB0aGlzLnZpZXdbZWxlbWVudE5hbWVdLFxuICAgICAgICAgICAgICAgIHZhbHVlID0gY29udHJvbFZhbHVlKGVsKS50cmltKCk7XG5cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICB2YWx1ZSA9PT0gJycgJiYgZWxlbWVudE5hbWUgPT09ICdvcGVyYXRvcicgJiYgLy8gbm90IGluIG9wZXJhdG9yIG1lbnVcbiAgICAgICAgICAgICAgICB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm9wc1t0aGlzLm9wZXJhdG9yXSAmJiAvLyBidXQgdmFsaWQgaW4gb3BlcmF0b3IgaGFzaFxuICAgICAgICAgICAgICAgICFnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIHRoaXMuY29sdW1uLCAnb3BNdXN0QmVJbk1lbnUnKSAvLyBhbmQgaXMgZG9lc24ndCBoYXZlIHRvIGJlIGluIG1lbnUgdG8gYmUgdmFsaWRcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5vcGVyYXRvcjsgLy8gdXNlIGl0IGFzIGlzIHRoZW5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbHVlID09PSAnJykge1xuICAgICAgICAgICAgICAgIGlmICghZm9jdXNlZCAmJiBvcHRpb25zICYmIG9wdGlvbnMuZm9jdXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpY2tJbihlbCk7XG4gICAgICAgICAgICAgICAgICAgIGZvY3VzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRocm93KSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyB0aGlzLkVycm9yKCdNaXNzaW5nIG9yIGludmFsaWQgJyArIGVsZW1lbnROYW1lICsgJyBpbiBjb25kaXRpb25hbCBleHByZXNzaW9uLiBDb21wbGV0ZSB0aGUgZXhwcmVzc2lvbiBvciByZW1vdmUgaXQuJywgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBDb3B5IGVhY2ggY29udHJvbHMncyB2YWx1ZSBhcyBhIG5ldyBzaW1pbGFybHkgbmFtZWQgcHJvcGVydHkgb2YgdGhpcyBvYmplY3QuXG4gICAgICAgICAgICAgICAgdGhpc1tlbGVtZW50TmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub3AgPSB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm9wc1t0aGlzLm9wZXJhdG9yXTtcblxuICAgICAgICB0eXBlID0gdGhpcy5nZXRUeXBlKCk7XG5cbiAgICAgICAgdGhpcy5jb252ZXJ0ZXIgPSB0eXBlICYmIHR5cGUgIT09ICdzdHJpbmcnICYmIHRoaXMuY29udmVydGVyc1t0eXBlXTtcblxuICAgICAgICB0aGlzLmNhbGN1bGF0b3IgPSB0aGlzLmdldENhbGN1bGF0b3IoKTtcbiAgICB9LFxuXG4gICAgZ2V0VHlwZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wLnR5cGUgfHwgZ2V0UHJvcGVydHkuY2FsbCh0aGlzLCB0aGlzLmNvbHVtbiwgJ3R5cGUnKTtcbiAgICB9LFxuXG4gICAgZ2V0Q2FsY3VsYXRvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIHRoaXMuY29sdW1uLCAnY2FsY3VsYXRvcicpO1xuICAgIH0sXG5cbiAgICB2YWxPckZ1bmM6IGZ1bmN0aW9uKGNvbHVtbk5hbWUpIHtcbiAgICAgICAgdmFyIHJlc3VsdCwgY2FsY3VsYXRvcjtcbiAgICAgICAgaWYgKHRoaXMpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXNbY29sdW1uTmFtZV07XG4gICAgICAgICAgICBjYWxjdWxhdG9yID0gKHR5cGVvZiByZXN1bHQpWzBdID09PSAnZicgJiYgcmVzdWx0IHx8IHRoaXMuY2FsY3VsYXRvcjtcbiAgICAgICAgICAgIGlmIChjYWxjdWxhdG9yKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsY3VsYXRvci5jYWxsKHRoaXMsIGNvbHVtbk5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQgfHwgcmVzdWx0ID09PSAwIHx8IHJlc3VsdCA9PT0gZmFsc2UgPyByZXN1bHQgOiAnJztcbiAgICB9LFxuXG4gICAgcDogZnVuY3Rpb24oZGF0YVJvdykge1xuICAgICAgICByZXR1cm4gdGhpcy52YWxPckZ1bmMuY2FsbChkYXRhUm93LCB0aGlzLmNvbHVtbik7XG4gICAgfSxcblxuICAgIC8vIFRvIGJlIG92ZXJyaWRkZW4gd2hlbiBvcGVyYW5kIGlzIGEgY29sdW1uIG5hbWUgKHNlZSBjb2x1bW5zLmpzKS5cbiAgICBxOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3BlcmFuZDtcbiAgICB9LFxuXG4gICAgdGVzdDogZnVuY3Rpb24oZGF0YVJvdykge1xuICAgICAgICB2YXIgcCwgcSwgLy8gdW50eXBlZCB2ZXJzaW9ucyBvZiBhcmdzXG4gICAgICAgICAgICBQLCBRLCAvLyB0eXBlZCB2ZXJzaW9ucyBvZiBwIGFuZCBxXG4gICAgICAgICAgICBjb252ZXJ0ZXI7XG5cbiAgICAgICAgLy8gVE9ETzogSWYgYSBsaXRlcmFsIChpLmUuLCB3aGVuIHRoaXMucSBpcyBub3Qgb3ZlcnJpZGRlbiksIHEgb25seSBuZWVkcyB0byBiZSBmZXRjaGVkIE9OQ0UgZm9yIGFsbCByb3dzXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAocCA9IHRoaXMucChkYXRhUm93KSkgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgKHEgPSB0aGlzLnEoZGF0YVJvdykpID09PSB1bmRlZmluZWRcbiAgICAgICAgKVxuICAgICAgICAgICAgPyBmYWxzZSAvLyBkYXRhIGluYWNjZXNzaWJsZSBzbyBleGNsdWRlIHJvd1xuICAgICAgICAgICAgOiAoXG4gICAgICAgICAgICAgICAgKGNvbnZlcnRlciA9IHRoaXMuY29udmVydGVyKSAmJlxuICAgICAgICAgICAgICAgICFjb252ZXJ0ZXIuZmFpbGVkKFAgPSBjb252ZXJ0ZXIudG9UeXBlKHApKSAmJiAvLyBhdHRlbXB0IHRvIGNvbnZlcnQgZGF0YSB0byB0eXBlXG4gICAgICAgICAgICAgICAgIWNvbnZlcnRlci5mYWlsZWQoUSA9IGNvbnZlcnRlci50b1R5cGUocSkpXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgPyB0aGlzLm9wLnRlc3QoUCwgUSkgLy8gYm90aCBjb252ZXJzaW9ucyBzdWNjZXNzZnVsOiBjb21wYXJlIGFzIHR5cGVzXG4gICAgICAgICAgICAgICAgOiB0aGlzLm9wLnRlc3QodG9TdHJpbmcocCksIHRvU3RyaW5nKHEpKTsgLy8gb25lIG9yIGJvdGggY29udmVyc2lvbnMgZmFpbGVkOiBjb21wYXJlIGFzIHN0cmluZ3NcbiAgICB9LFxuXG4gICAgdG9KU09OOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXRlID0ge307XG4gICAgICAgIGlmICh0aGlzLmVkaXRvcikge1xuICAgICAgICAgICAgc3RhdGUuZWRpdG9yID0gdGhpcy5lZGl0b3I7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMudmlldykge1xuICAgICAgICAgICAgc3RhdGVba2V5XSA9IHRoaXNba2V5XTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zY2hlbWEgIT09IHRoaXMucGFyZW50LnNjaGVtYSkge1xuICAgICAgICAgICAgc3RhdGUuc2NoZW1hID0gdGhpcy5zY2hlbWE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGb3IgYCdvYmplY3QnYCBhbmQgYCdKU09OJ2Agbm90ZSB0aGF0IHRoZSBzdWJ0cmVlJ3MgdmVyc2lvbiBvZiBgZ2V0U3RhdGVgIHdpbGwgbm90IGNhbGwgdGhpcyBsZWFmIHZlcnNpb24gb2YgYGdldFN0YXRlYCBiZWNhdXNlIHRoZSBmb3JtZXIgdXNlcyBgdW5zdHJ1bmdpZnkoKWAgYW5kIGBKU09OLnN0cmluZ2lmeSgpYCwgcmVzcGVjdGl2ZWx5LCBib3RoIG9mIHdoaWNoIHJlY3Vyc2UgYW5kIGNhbGwgYHRvSlNPTigpYCBvbiB0aGVpciBvd24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnM9J29iamVjdCddIC0gU2VlIHRoZSBzdWJ0cmVlIHZlcnNpb24gb2Yge0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV8Z2V0U3RhdGV9IGZvciBtb3JlIGluZm8uXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTGVhZiNcbiAgICAgKi9cbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4IHx8ICdvYmplY3QnO1xuXG4gICAgICAgIHN3aXRjaCAoc3ludGF4KSB7XG4gICAgICAgICAgICBjYXNlICdvYmplY3QnOiAvLyBzZWUgbm90ZSBhYm92ZVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMudG9KU09OKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdKU09OJzogLy8gc2VlIG5vdGUgYWJvdmVcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeSh0aGlzLCBudWxsLCBvcHRpb25zICYmIG9wdGlvbnMuc3BhY2UpIHx8ICcnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnU1FMJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLmdldFN5bnRheCh0aGlzLnJvb3QuY29uZGl0aW9uYWxzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIG1ha2VTcWxPcGVyYW5kOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb25kaXRpb25hbHMubWFrZVNxbFN0cmluZyh0aGlzLm9wZXJhbmQpOyAvLyB0b2RvOiB0aGlzIHNob3VsZCBiZSBhIG51bWJlciBpZiB0eXBlIGlzIG51bWJlciBpbnN0ZWFkIG9mIGEgc3RyaW5nIC0tIGJ1dCB3ZSB3aWxsIGhhdmUgdG8gZW5zdXJlIGl0IGlzIG51bWVyaWMhXG4gICAgfSxcblxuICAgIGdldFN5bnRheDogZnVuY3Rpb24oY29uZGl0aW9uYWxzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm9wc1t0aGlzLm9wZXJhdG9yXS5tYWtlLmNhbGwoY29uZGl0aW9uYWxzLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IEhUTUwgZm9ybSBjb250cm9scyBmYWN0b3J5LlxuICAgICAqIEBkZXNjIENyZWF0ZXMgYW5kIGFwcGVuZHMgYSB0ZXh0IGJveCBvciBhIGRyb3AtZG93bi5cbiAgICAgKiA+IERlZmluZWQgb24gdGhlIEZpbHRlclRyZWUgcHJvdG90eXBlIGZvciBhY2Nlc3MgYnkgZGVyaXZlZCB0eXBlcyAoYWx0ZXJuYXRlIGZpbHRlciBlZGl0b3JzKS5cbiAgICAgKiBAcmV0dXJucyBUaGUgbmV3IGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHttZW51SXRlbVtdfSBbbWVudV0gLSBPdmVybG9hZHM6XG4gICAgICogKiBJZiBvbWl0dGVkLCB3aWxsIGNyZWF0ZSBhbiBgPGlucHV0Lz5gICh0ZXh0IGJveCkgZWxlbWVudC5cbiAgICAgKiAqIElmIGNvbnRhaW5zIG9ubHkgYSBzaW5nbGUgb3B0aW9uLCB3aWxsIGNyZWF0ZSBhIGA8c3Bhbj4uLi48L3NwYW4+YCBlbGVtZW50IGNvbnRhaW5pbmcgdGhlIHN0cmluZyBhbmQgYSBgPGlucHV0IHR5cGU9aGlkZGVuPmAgY29udGFpbmluZyB0aGUgdmFsdWUuXG4gICAgICogKiBPdGhlcndpc2UsIGNyZWF0ZXMgYSBgPHNlbGVjdD4uLi48L3NlbGVjdD5gIGVsZW1lbnQgd2l0aCB0aGVzZSBtZW51IGl0ZW1zLlxuICAgICAqIEBwYXJhbSB7bnVsbHxzdHJpbmd9IFtwcm9tcHQ9JyddIC0gQWRkcyBhbiBpbml0aWFsIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudCB0byB0aGUgZHJvcC1kb3duIHdpdGggdGhpcyB2YWx1ZSwgcGFyZW50aGVzaXplZCwgYXMgaXRzIGB0ZXh0YDsgYW5kIGVtcHR5IHN0cmluZyBhcyBpdHMgYHZhbHVlYC4gT21pdHRpbmcgY3JlYXRlcyBhIGJsYW5rIHByb21wdDsgYG51bGxgIHN1cHByZXNzZXMuXG4gICAgICogQHBhcmFtIFtzb3J0XVxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJMZWFmI1xuICAgICAqL1xuICAgIG1ha2VFbGVtZW50OiBmdW5jdGlvbihtZW51LCBwcm9tcHQsIHNvcnQpIHtcbiAgICAgICAgdmFyIGVsLCByZXN1bHQsIG9wdGlvbnMsXG4gICAgICAgICAgICBvcHRpb24gPSBtZW51LFxuICAgICAgICAgICAgdGFnTmFtZSA9IG1lbnUgPyAnU0VMRUNUJyA6ICdJTlBVVCc7XG5cbiAgICAgICAgLy8gZGV0ZXJtaW5lIGlmIHRoZXJlIHdvdWxkIGJlIG9ubHkgYSBzaW5nbGUgaXRlbSBpbiB0aGUgZHJvcGRvd25cbiAgICAgICAgd2hpbGUgKG9wdGlvbiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uLmxlbmd0aCA9PT0gMSAmJiAhcG9wTWVudS5pc0dyb3VwUHJveHkob3B0aW9uWzBdKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbiA9IG9wdGlvblswXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbikge1xuICAgICAgICAgICAgLy8gaGFyZCB0ZXh0IHdoZW4gc2luZ2xlIGl0ZW1cbiAgICAgICAgICAgIGVsID0gdGhpcy50ZW1wbGF0ZXMuZ2V0KFxuICAgICAgICAgICAgICAgICdsb2NrZWRDb2x1bW4nLFxuICAgICAgICAgICAgICAgIG9wdGlvbi5hbGlhcyB8fCBvcHRpb24ubmFtZSB8fCBvcHRpb24sXG4gICAgICAgICAgICAgICAgb3B0aW9uLm5hbWUgfHwgb3B0aW9uLmFsaWFzIHx8IG9wdGlvblxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHByb21wdDogcHJvbXB0LFxuICAgICAgICAgICAgICAgIHNvcnQ6IHNvcnQsXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGZ1bmN0aW9uKGdyb3VwTmFtZSkgeyByZXR1cm4gQ29uZGl0aW9uYWxzLmdyb3Vwc1tncm91cE5hbWVdOyB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBtYWtlIGFuIGVsZW1lbnRcbiAgICAgICAgICAgIGVsID0gcG9wTWVudS5idWlsZCh0YWdOYW1lLCBtZW51LCBvcHRpb25zKTtcblxuICAgICAgICAgICAgLy8gaWYgaXQncyBhIHRleHRib3gsIGxpc3RlbiBmb3Iga2V5dXAgZXZlbnRzXG4gICAgICAgICAgICBpZiAoZWwudHlwZSA9PT0gJ3RleHQnICYmIHRoaXMuZXZlbnRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIG9uY2hhbmdlIGV2ZW50c1xuICAgICAgICAgICAgdGhpcy5vbkNoYW5nZSA9IHRoaXMub25DaGFuZ2UgfHwgY2xlYW5VcEFuZE1vdmVPbi5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLm9uQ2hhbmdlKTtcblxuICAgICAgICAgICAgRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwpO1xuICAgICAgICAgICAgcmVzdWx0ID0gZWw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKGVsKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn0pO1xuXG4vKiogYGNoYW5nZWAgZXZlbnQgaGFuZGxlciBmb3IgYWxsIGZvcm0gY29udHJvbHMuXG4gKiBSZWJ1aWxkcyB0aGUgb3BlcmF0b3IgZHJvcC1kb3duIGFzIG5lZWRlZC5cbiAqIFJlbW92ZXMgZXJyb3IgQ1NTIGNsYXNzIGZyb20gY29udHJvbC5cbiAqIEFkZHMgd2FybmluZyBDU1MgY2xhc3MgZnJvbSBjb250cm9sIGlmIGJsYW5rOyByZW1vdmVzIGlmIG5vdCBibGFuay5cbiAqIEFkZHMgd2FybmluZyBDU1MgY2xhc3MgZnJvbSBjb250cm9sIGlmIGJsYW5rOyByZW1vdmVzIGlmIG5vdCBibGFuay5cbiAqIE1vdmVzIGZvY3VzIHRvIG5leHQgbm9uLWJsYW5rIHNpYmxpbmcgY29udHJvbC5cbiAqIEB0aGlzIHtGaWx0ZXJMZWFmfVxuICovXG5mdW5jdGlvbiBjbGVhblVwQW5kTW92ZU9uKGV2dCkge1xuICAgIHZhciBlbCA9IGV2dC50YXJnZXQ7XG5cbiAgICAvLyByZW1vdmUgYGVycm9yYCBDU1MgY2xhc3MsIHdoaWNoIG1heSBoYXZlIGJlZW4gYWRkZWQgYnkgYEZpbHRlckxlYWYucHJvdG90eXBlLmludmFsaWRgXG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZmlsdGVyLXRyZWUtZXJyb3InKTtcblxuICAgIC8vIHNldCBvciByZW1vdmUgJ3dhcm5pbmcnIENTUyBjbGFzcywgYXMgcGVyIGVsLnZhbHVlXG4gICAgRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwpO1xuXG4gICAgaWYgKGVsID09PSB0aGlzLnZpZXcuY29sdW1uKSB7XG4gICAgICAgIC8vIHJlYnVpbGQgb3BlcmF0b3IgbGlzdCBhY2NvcmRpbmcgdG8gc2VsZWN0ZWQgY29sdW1uIG5hbWUgb3IgdHlwZSwgcmVzdG9yaW5nIHNlbGVjdGVkIGl0ZW1cbiAgICAgICAgbWFrZU9wTWVudS5jYWxsKHRoaXMsIGVsLnZhbHVlKTtcbiAgICB9XG5cbiAgICBpZiAoZWwudmFsdWUpIHtcbiAgICAgICAgLy8gZmluZCBuZXh0IHNpYmxpbmcgY29udHJvbCwgaWYgYW55XG4gICAgICAgIGlmICghZWwubXVsdGlwbGUpIHtcbiAgICAgICAgICAgIHdoaWxlICgoZWwgPSBlbC5uZXh0RWxlbWVudFNpYmxpbmcpICYmICghKCduYW1lJyBpbiBlbCkgfHwgZWwudmFsdWUudHJpbSgpICE9PSAnJykpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGN1cmx5XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbmQgY2xpY2sgaW4gaXQgKG9wZW5zIHNlbGVjdCBsaXN0KVxuICAgICAgICBpZiAoZWwgJiYgZWwudmFsdWUudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgZWwudmFsdWUgPSAnJzsgLy8gcmlkIG9mIGFueSB3aGl0ZSBzcGFjZVxuICAgICAgICAgICAgRmlsdGVyTm9kZS5jbGlja0luKGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvcndhcmQgdGhlIGV2ZW50IHRvIHRoZSBhcHBsaWNhdGlvbidzIGV2ZW50IGhhbmRsZXJcbiAgICBpZiAodGhpcy5ldmVudEhhbmRsZXIpIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXIoZXZ0KTtcbiAgICB9XG59XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRoZSBub2RlIHByb3BlcnR5LlxuICogQGRlc2MgUHJpb3JpdHkgbGFkZGVyOlxuICogMS4gU2NoZW1hIHByb3BlcnR5LlxuICogMi4gTWl4aW4gKGlmIGdpdmVuKS5cbiAqIDMuIE5vZGUgcHJvcGVydHkgaXMgZmluYWwgcHJpb3JpdHkuXG4gKiBAdGhpcyB7RmlsdGVyTGVhZn1cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHlOYW1lXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufGJvb2xlYW59IFttaXhpbl0gLSBPcHRpb25hbCBmdW5jdGlvbiBvciB2YWx1ZSBpZiBzY2hlbWEgcHJvcGVydHkgdW5kZWZpbmVkLiBJZiBmdW5jdGlvbiwgY2FsbGVkIGluIGNvbnRleHQgd2l0aCBgcHJvcGVydHlOYW1lYCBhbmQgYGNvbHVtbk5hbWVgLlxuICogQHJldHVybnMge29iamVjdH1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHkoY29sdW1uTmFtZSwgcHJvcGVydHlOYW1lLCBtaXhpbikge1xuICAgIHZhciBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYS5sb29rdXAoY29sdW1uTmFtZSkgfHwge307XG4gICAgcmV0dXJuIChcbiAgICAgICAgY29sdW1uU2NoZW1hW3Byb3BlcnR5TmFtZV0gLy8gdGhlIGV4cHJlc3Npb24ncyBjb2x1bW4gc2NoZW1hIHByb3BlcnR5XG4gICAgICAgICAgICB8fFxuICAgICAgICB0eXBlb2YgbWl4aW4gPT09ICdmdW5jdGlvbicgJiYgbWl4aW4uY2FsbCh0aGlzLCBjb2x1bW5TY2hlbWEsIHByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgIHx8XG4gICAgICAgIHR5cGVvZiBtaXhpbiAhPT0gJ2Z1bmN0aW9uJyAmJiBtaXhpblxuICAgICAgICAgICAgfHxcbiAgICAgICAgdGhpc1twcm9wZXJ0eU5hbWVdIC8vIHRoZSBleHByZXNzaW9uIG5vZGUncyBwcm9wZXJ0eVxuICAgICk7XG59XG5cbi8qKlxuICogQHRoaXMge0ZpbHRlckxlYWZ9XG4gKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICogQHJldHVybnMge3VuZGVmaW5lZHxtZW51SXRlbVtdfVxuICovXG5mdW5jdGlvbiBnZXRPcE1lbnUoY29sdW1uTmFtZSkge1xuICAgIHJldHVybiBnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIGNvbHVtbk5hbWUsICdvcE1lbnUnLCBmdW5jdGlvbihjb2x1bW5TY2hlbWEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudHlwZU9wTWFwICYmIHRoaXMudHlwZU9wTWFwW2NvbHVtblNjaGVtYS50eXBlIHx8IHRoaXMudHlwZV07XG4gICAgfSk7XG59XG5cbi8qKlxuICogQHRoaXMge0ZpbHRlckxlYWZ9XG4gKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICovXG5mdW5jdGlvbiBtYWtlT3BNZW51KGNvbHVtbk5hbWUpIHtcbiAgICB2YXIgb3BNZW51ID0gZ2V0T3BNZW51LmNhbGwodGhpcywgY29sdW1uTmFtZSk7XG5cbiAgICBpZiAob3BNZW51ICE9PSB0aGlzLnJlbmRlcmVkT3BNZW51KSB7XG4gICAgICAgIHZhciBuZXdPcERyb3AgPSB0aGlzLm1ha2VFbGVtZW50KG9wTWVudSwgJ29wZXJhdG9yJyk7XG5cbiAgICAgICAgbmV3T3BEcm9wLnZhbHVlID0gdGhpcy52aWV3Lm9wZXJhdG9yLnZhbHVlO1xuICAgICAgICB0aGlzLmVsLnJlcGxhY2VDaGlsZChuZXdPcERyb3AsIHRoaXMudmlldy5vcGVyYXRvcik7XG4gICAgICAgIHRoaXMudmlldy5vcGVyYXRvciA9IG5ld09wRHJvcDtcblxuICAgICAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhuZXdPcERyb3ApO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZWRPcE1lbnUgPSBvcE1lbnU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGlja0luKGVsKSB7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZmlsdGVyLXRyZWUtZXJyb3InKTtcbiAgICAgICAgRmlsdGVyTm9kZS5jbGlja0luKGVsKTtcbiAgICB9LCAwKTtcbn1cblxuZnVuY3Rpb24gY29udHJvbFZhbHVlKGVsKSB7XG4gICAgdmFyIHZhbHVlLCBpO1xuXG4gICAgc3dpdGNoIChlbC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ2NoZWNrYm94JzpcbiAgICAgICAgY2FzZSAncmFkaW8nOlxuICAgICAgICAgICAgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lPVxcJycgKyBlbC5uYW1lICsgJ1xcJ106ZW5hYmxlZDpjaGVja2VkJyk7XG4gICAgICAgICAgICBmb3IgKHZhbHVlID0gW10sIGkgPSAwOyBpIDwgZWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YWx1ZS5wdXNoKGVsW2ldLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NlbGVjdC1tdWx0aXBsZSc6XG4gICAgICAgICAgICBlbCA9IGVsLm9wdGlvbnM7XG4gICAgICAgICAgICBmb3IgKHZhbHVlID0gW10sIGkgPSAwOyBpIDwgZWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVsLmRpc2FibGVkICYmIGVsLnNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLnB1c2goZWxbaV0udmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YWx1ZSA9IGVsLnZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuLy8gTWVhbnQgdG8gYmUgY2FsbGVkIGJ5IEZpbHRlclRyZWUucHJvdG90eXBlLnNldFNlbnNpdGl2aXR5IG9ubHlcbkZpbHRlckxlYWYuc2V0VG9TdHJpbmcgPSBmdW5jdGlvbihmbikge1xuICAgIHRvU3RyaW5nID0gZm47XG4gICAgcmV0dXJuIENvbmRpdGlvbmFscy5zZXRUb1N0cmluZyhmbik7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyTGVhZjtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZC1tZScpLCBCYXNlID0gZXh0ZW5kLkJhc2U7IGV4dGVuZC5kZWJ1ZyA9IHRydWU7XG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBjc3NJbmplY3RvciA9IHJlcXVpcmUoJy4vc3R5bGVzaGVldCcpO1xudmFyIFRlbXBsYXRlcyA9IHJlcXVpcmUoJy4vVGVtcGxhdGVzJyk7XG52YXIgQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi9Db25kaXRpb25hbHMnKTtcbnZhciBQYXJzZXJTUUwgPSByZXF1aXJlKCcuL3BhcnNlci1TUUwnKTtcblxuXG52YXIgQ0hJTERSRU5fVEFHID0gJ09MJyxcbiAgICBDSElMRF9UQUcgPSAnTEknO1xuXG4vLyBKU09OLWRldGVjdG9yOiBiZWdpbnMgX2FuZF8gZW5kcyB3aXRoIGVpdGhlciBbIGFuZCBdIF9vcl8geyBhbmQgfVxudmFyIHJlSlNPTiA9IC9eXFxzKigoXFxbW15dKlxcXSl8KFxce1teXSpcXH0pKVxccyokLztcblxuZnVuY3Rpb24gRmlsdGVyVHJlZUVycm9yKG1lc3NhZ2UsIG5vZGUpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG59XG5GaWx0ZXJUcmVlRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuRmlsdGVyVHJlZUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ZpbHRlclRyZWVFcnJvcic7XG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbc3ludGF4PSdhdXRvJ10gLSBTcGVjaWZ5IHBhcnNlciB0byB1c2Ugb24gYHN0YXRlYC4gT25lIG9mOlxuICogKiBgJ2F1dG8nYCAtIEF1dG8tZGV0ZWN0OyBzZWUge0BsaW5rIEZpbHRlck5vZGUjcGFyc2VTdGF0ZVN0cmluZ30gZm9yIGFsZ29yaXRobS5cbiAqICogYCdvYmplY3QnYCAtIEEgcmF3IHN0YXRlIG9iamVjdCBzdWNoIGFzIHRoYXQgcHJvZHVjZWQgYnkgdGhlIFtnZXRTdGF0ZSgpXXtAbGluayBGaWx0ZXJUcmVlI2dldFN0YXRlfSBtZXRob2QuXG4gKiAqIGAnSlNPTidgIC0gQSBKU09OIHN0cmluZyB2ZXJzaW9uIG9mIGEgc3RhdGUgb2JqZWN0IHN1Y2ggYXMgdGhhdCBwcm9kdWNlZCBieSB0aGUgW2dldFN0YXRlKClde0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV9IG1ldGhvZC5cbiAqICogYCdTUUwnYCAtIEEgU1FMIFtzZWFyY2ggY29uZGl0aW9uIGV4cHJlc3Npb25de0BsaW5rIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxNzM1NDUuYXNweH0gc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gW2NvbnRleHRdIElmIGRlZmluZWQsIHRoZSBwcm92aWRlZCBpbnB1dCBzdHJpbmcgaXMgdXNlZCBhcyBhIHNlbGVjdG9yIHRvIGFuIGBIVE1MRWxlbWVudGAgY29udGFpbmVkIGluIGBjb250ZXh0YC4gVGhlIGB2YWx1ZWAgcHJvcGVydHkgb2YgdGhpcyBlbGVtZW50IGlzIGZldGNoZWQgZnJvbSB0aGUgRE9NIGFuZCBpcyB1c2VkIGFzIHRoZSBpbnB1dCBzdGF0ZSBzdHJpbmc7IHByb2NlZWQgYXMgYWJvdmUuXG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVPcHRpb25zT2JqZWN0XG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbc2NoZW1hXSAtIEEgZGVmYXVsdCBsaXN0IG9mIGNvbHVtbiBuYW1lcyBmb3IgZmllbGQgZHJvcC1kb3ducyBvZiBhbGwgZGVzY2VuZGFudCB0ZXJtaW5hbCBub2Rlcy4gT3ZlcnJpZGVzIGBvcHRpb25zLnN0YXRlLnNjaGVtYWAgKHNlZSkuIE1heSBiZSBkZWZpbmVkIGZvciBhbnkgbm9kZSBhbmQgcGVydGFpbnMgdG8gYWxsIGRlc2NlbmRhbnRzIG9mIHRoYXQgbm9kZSAoaW5jbHVkaW5nIHRlcm1pbmFsIG5vZGVzKS4gSWYgb21pdHRlZCAoYW5kIG5vIGBvd25TY2hlbWFgKSwgd2lsbCB1c2UgdGhlIG5lYXJlc3QgYW5jZXN0b3IgYHNjaGVtYWAgZGVmaW5pdGlvbi4gSG93ZXZlciwgZGVzY2VuZGFudHMgd2l0aCB0aGVpciBvd24gZGVmaW5pdGlvbiBvZiBgdHlwZXNgIHdpbGwgb3ZlcnJpZGUgYW55IGFuY2VzdG9yIGRlZmluaXRpb24uXG4gKlxuICogPiBUeXBpY2FsbHkgb25seSB1c2VkIGJ5IHRoZSBjYWxsZXIgZm9yIHRoZSB0b3AtbGV2ZWwgKHJvb3QpIHRyZWUuXG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbb3duU2NoZW1hXSAtIEEgZGVmYXVsdCBsaXN0IG9mIGNvbHVtbiBuYW1lcyBmb3IgZmllbGQgZHJvcC1kb3ducyBvZiBpbW1lZGlhdGUgZGVzY2VuZGFudCB0ZXJtaW5hbCBub2RlcyBfb25seV8uIE92ZXJyaWRlcyBgb3B0aW9ucy5zdGF0ZS5vd25TY2hlbWFgIChzZWUpLlxuICpcbiAqIEFsdGhvdWdoIGJvdGggYG9wdGlvbnMuc2NoZW1hYCBhbmQgYG9wdGlvbnMub3duU2NoZW1hYCBhcmUgbm90YXRlZCBhcyBvcHRpb25hbCBoZXJlaW4sIGJ5IHRoZSB0aW1lIGEgdGVybWluYWwgbm9kZSB0cmllcyB0byByZW5kZXIgYSBzY2hlbWEgZHJvcC1kb3duLCBhIGBzY2hlbWFgIGxpc3Qgc2hvdWxkIGJlIGRlZmluZWQgdGhyb3VnaCAoaW4gb3JkZXIgb2YgcHJpb3JpdHkpOlxuICpcbiAqICogVGVybWluYWwgbm9kZSdzIG93biBgb3B0aW9ucy5zY2hlbWFgIChvciBgb3B0aW9ucy5zdGF0ZS5zY2hlbWFgKSBkZWZpbml0aW9uLlxuICogKiBUZXJtaW5hbCBub2RlJ3MgcGFyZW50IG5vZGUncyBgb3B0aW9uLm93blNjaGVtYWAgKG9yIGBvcHRpb24uc3RhdGUubm9kZXNGaWVsZHNgKSBkZWZpbml0aW9uLlxuICogKiBUZXJtaW5hbCBub2RlJ3MgcGFyZW50IChvciBhbnkgYW5jZXN0b3IpIG5vZGUncyBgb3B0aW9ucy5zY2hlbWFgIChvciBgb3B0aW9ucy5zdGF0ZS5zY2hlbWFgKSBkZWZpbml0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBbc3RhdGVdIC0gQSBkYXRhIHN0cnVjdHVyZSB0aGF0IGRlc2NyaWJlcyBhIHRyZWUsIHN1YnRyZWUsIG9yIGxlYWYgKHRlcm1pbmFsIG5vZGUpLiBJZiB1bmRlZmluZWQsIGxvYWRzIGFuIGVtcHR5IGZpbHRlciwgd2hpY2ggaXMgYSBgRmlsdGVyVHJlZWAgbm9kZSBjb25zaXN0aW5nIHRoZSBkZWZhdWx0IGBvcGVyYXRvcmAgdmFsdWUgKGAnb3AtYW5kJ2ApLlxuICpcbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IFtlZGl0b3I9J0RlZmF1bHQnXSAtIFRoZSBuYW1lIG9mIHRoZSBjb25kaXRpb25hbCBleHByZXNzaW9uJ3MgVUkgXCJlZGl0b3IuXCIgVGhpcyBuYW1lIG11c3QgYmUgcmVnaXN0ZXJlZCBpbiB0aGUgcGFyZW50IG5vZGUncyB7QGxpbmsgRmlsdGVyVHJlZSNlZGl0b3JzfGVkaXRvcnN9IGhhc2gsIHdoZXJlIGl0IG1hcHMgdG8gYSBsZWFmIGNvbnN0cnVjdG9yIChgRmlsdGVyTGVhZmAgb3IgYSBkZXNjZW5kYW50IHRoZXJlb2YpLiAoVXNlIHtAbGluayBGaWx0ZXJUcmVlI2FkZEVkaXRvcn0gdG8gcmVnaXN0ZXIgbmV3IGVkaXRvcnMuKVxuICpcbiAqIEBwcm9wZXJ0eSB7RmlsdGVyVHJlZX0gW3BhcmVudF0gLSBVc2VkIGludGVybmFsbHkgdG8gaW5zZXJ0IGVsZW1lbnQgd2hlbiBjcmVhdGluZyBuZXN0ZWQgc3VidHJlZXMuIFRoZSBvbmx5IHRpbWUgaXQgbWF5IGJlIChhbmQgbXVzdCBiZSkgb21pdHRlZCBpcyB3aGVuIGNyZWF0aW5nIHRoZSByb290IG5vZGUuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd8SFRNTEVsZW1lbnR9IFtjc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudF0gLSBwYXNzZWQgdG8gY3NzSW5zZXJ0XG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R8c3RyaW5nfSBGaWx0ZXJUcmVlU3RhdGVPYmplY3RcbiAqXG4gKiBAc3VtbWFyeSBTdGF0ZSB3aXRoIHdoaWNoIHRvIGNyZWF0ZSBhIG5ldyBub2RlIG9yIHJlcGxhY2UgYW4gZXhpc3Rpbmcgbm9kZS5cbiAqXG4gKiBAZGVzYyBBIHN0cmluZyBvciBwbGFpbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYSBmaWx0ZXItdHJlZSBub2RlLiBJZiBhIHN0cmluZywgaXQgaXMgcGFyc2VkIGludG8gYW4gb2JqZWN0IGJ5IHtAbGluayBGaWx0ZXJOb2RlfnBhcnNlU3RhdGVTdHJpbmd9LiAoU2VlLCBmb3IgYXZhaWxhYmxlIG92ZXJsb2Fkcy4pXG4gKlxuICogVGhlIHJlc3VsdGluZyBvYmplY3QgbWF5IGJlIGEgZmxhdCBvYmplY3QgdGhhdCBkZXNjcmliZXMgYSB0ZXJtaW5hbCBub2RlIG9yIGEgY2hpbGRsZXNzIHJvb3Qgb3IgYnJhbmNoIG5vZGU7IG9yIG1heSBiZSBhIGhpZXJhcmNoaWNhbCBvYmplY3QgdG8gZGVmaW5lIGFuIGVudGlyZSB0cmVlIG9yIHN1YnRyZWUuXG4gKlxuICogSW4gYW55IGNhc2UsIHRoZSByZXN1bHRpbmcgb2JqZWN0IG1heSBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbc2NoZW1hXSAtIFNlZSBgc2NoZW1hYCBwcm9wZXJ0eSBvZiB7QGxpbmsgRmlsdGVyVHJlZU9wdGlvbnNPYmplY3R9LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZWRpdG9yPSdEZWZhdWx0J10gLSBTZWUgYGVkaXRvcmAgcHJvcGVydHkgb2Yge0BsaW5rIEZpbHRlclRyZWVPcHRpb25zT2JqZWN0fS5cbiAqXG4gKiBAcHJvcGVydHkgbWlzYyAtIE90aGVyIG1pc2NlbGxhbmVvdXMgcHJvcGVydGllcyB3aWxsIGJlIGNvcGllZCBkaXJlY3RseSB0byB0aGUgbmV3IGBGaXRsZXJOb2RlYCBvYmplY3QuIChUaGUgbmFtZSBcIm1pc2NcIiBoZXJlIGlzIGp1c3QgYSBzdGFuZC1pbjsgdGhlcmUgaXMgbm8gc3BlY2lmaWMgcHJvcGVydHkgY2FsbGVkIFwibWlzY1wiLilcbiAqXG4gKiAqIE1heSBkZXNjcmliZSBhIG5vbi10ZXJtaW5hbCBub2RlIHdpdGggcHJvcGVydGllczpcbiAqICAgKiBgc2NoZW1hYCAtIE92ZXJyaWRkZW4gb24gaW5zdGFudGlhdGlvbiBieSBgb3B0aW9ucy5zY2hlbWFgLiBJZiBib3RoIHVuc3BlY2lmaWVkLCB1c2VzIHBhcmVudCdzIGRlZmluaXRpb24uXG4gKiAgICogYG9wZXJhdG9yYCAtIE9uZSBvZiB7QGxpbmsgdHJlZU9wZXJhdG9yc30uXG4gKiAgICogYGNoaWxkcmVuYCAtICBBcnJheSBjb250YWluaW5nIGFkZGl0aW9uYWwgdGVybWluYWwgYW5kIG5vbi10ZXJtaW5hbCBub2Rlcy5cbiAqXG4gKiBUaGUgY29uc3RydWN0b3IgYXV0by1kZXRlY3RzIGBzdGF0ZWAncyB0eXBlOlxuICogICogSlNPTiBzdHJpbmcgdG8gYmUgcGFyc2VkIGJ5IGBKU09OLnBhcnNlKClgIGludG8gYSBwbGFpbiBvYmplY3RcbiAqICAqIFNRTCBXSEVSRSBjbGF1c2Ugc3RyaW5nIHRvIGJlIHBhcnNlZCBpbnRvIGEgcGxhaW4gb2JqZWN0XG4gKiAgKiBDU1Mgc2VsZWN0b3Igb2YgYW4gRWxlbWVudCB3aG9zZSBgdmFsdWVgIGNvbnRhaW5zIG9uZSBvZiB0aGUgYWJvdmVcbiAqICAqIHBsYWluIG9iamVjdFxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHN1bW1hcnkgQSBub2RlIGluIGEgZmlsdGVyIHRyZWUuXG4gKlxuICogQGRlc2NyaXB0aW9uIEEgZmlsdGVyIHRyZWUgcmVwcmVzZW50cyBhIF9jb21wbGV4IGNvbmRpdGlvbmFsIGV4cHJlc3Npb25fIGFuZCBjb25zaXN0cyBvZiBhIHNpbmdsZSBpbnN0YW5jZSBvZiBhIHtAbGluayBGaWx0ZXJUcmVlfSBvYmplY3QgYXMgdGhlIF9yb290XyBvZiBhbiBfbl8tYXJ5IHRyZWUuXG4gKlxuICogRmlsdGVyIHRyZWVzIGFyZSBjb21wcmlzZWQgb2YgaW5zdGFuY2VzIG9mIGBGaWx0ZXJOb2RlYCBvYmplY3RzLiBIb3dldmVyLCB0aGUgYEZpbHRlck5vZGVgIGNvbnN0cnVjdG9yIGlzIGFuIFwiYWJzdHJhY3QgY2xhc3NcIjsgZmlsdGVyIG5vZGUgb2JqZWN0cyBhcmUgbmV2ZXIgaW5zdGFudGlhdGVkIGRpcmVjdGx5IGZyb20gdGhpcyBjb25zdHJ1Y3Rvci4gQSBmaWx0ZXIgdHJlZSBpcyBhY3R1YWxseSBjb21wcmlzZWQgb2YgaW5zdGFuY2VzIG9mIHR3byBcInN1YmNsYXNzZXNcIiBvZiBgRmlsdGVyTm9kZWAgb2JqZWN0czpcbiAqICoge0BsaW5rIEZpbHRlclRyZWV9IChvciBzdWJjbGFzcyB0aGVyZW9mKSBvYmplY3RzLCBpbnN0YW5jZXMgb2Ygd2hpY2ggcmVwcmVzZW50IHRoZSByb290IG5vZGUgYW5kIGFsbCB0aGUgYnJhbmNoIG5vZGVzOlxuICogICAqIFRoZXJlIGlzIGFsd2F5cyBleGFjdGx5IG9uZSByb290IG5vZGUsIGNvbnRhaW5pbmcgdGhlIHdob2xlIGZpbHRlciB0cmVlLCB3aGljaCByZXByZXNlbnRzIHRoZSBmaWx0ZXIgZXhwcmVzc2lvbiBpbiBpdHMgZW50aXJldHkuIFRoZSByb290IG5vZGUgaXMgZGlzdGluZ3Vpc2hlZCBieSBoYXZpbmcgbm8gcGFyZW50IG5vZGUuXG4gKiAgICogVGhlcmUgYXJlIHplcm8gb3IgbW9yZSBicmFuY2ggbm9kZXMsIG9yIHN1YnRyZWVzLCB3aGljaCBhcmUgY2hpbGQgbm9kZXMgb2YgdGhlIHJvb3Qgb3Igb3RoZXIgYnJhbmNoZXMgaGlnaGVyIHVwIGluIHRoZSB0cmVlLCByZXByZXNlbnRpbmcgc3ViZXhwcmVzc2lvbnMgd2l0aGluIHRoZSBsYXJnZXIgZmlsdGVyIGV4cHJlc3Npb24uIEVhY2ggYnJhbmNoIG5vZGUgaGFzIGV4YWN0bHkgb25lIHBhcmVudCBub2RlLlxuICogICAqIFRoZXNlIG5vZGVzIHBvaW50IHRvIHplcm8gb3IgbW9yZSBjaGlsZCBub2RlcyB3aGljaCBhcmUgZWl0aGVyIG5lc3RlZCBzdWJ0cmVlcywgb3I6XG4gKiAqIHtAbGluayBGaWx0ZXJMZWFmfSAob3Igc3ViY2xhc3MgdGhlcmVvZikgb2JqZWN0cywgZWFjaCBpbnN0YW5jZSBvZiB3aGljaCByZXByZXNlbnRzIGEgc2luZ2xlIHNpbXBsZSBjb25kaXRpb25hbCBleHByZXNzaW9uLiBUaGVzZSBhcmUgdGVybWluYWwgbm9kZXMsIGhhdmluZyBleGFjdGx5IG9uZSBwYXJlbnQgbm9kZSwgYW5kIG5vIGNoaWxkIG5vZGVzLlxuICpcbiAqIFRoZSBwcm9ncmFtbWVyIG1heSBleHRlbmQgdGhlIHNlbWFudGljcyBvZiBmaWx0ZXIgdHJlZXMgYnkgZXh0ZW5kaW5nIHRoZSBhYm92ZSBvYmplY3RzLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3FsSWRRdHNPYmplY3R9IFtzcWxJZFF0cz17YmVnOidcIicsZW5kOidcIid9XSAtIFF1b3RlIGNoYXJhY3RlcnMgZm9yIFNRTCBpZGVudGlmaWVycy4gVXNlZCBmb3IgYm90aCBwYXJzaW5nIGFuZCBnZW5lcmF0aW5nIFNRTC4gU2hvdWxkIGJlIHBsYWNlZCBvbiB0aGUgcm9vdCBub2RlLlxuICpcbiAqIEBwcm9wZXJ0eSB7SFRNTEVsZW1lbnR9IGVsIC0gVGhlIERPTSBlbGVtZW50IGNyZWF0ZWQgYnkgdGhlIGByZW5kZXJgIG1ldGhvZCB0byByZXByZXNlbnQgdGhpcyBub2RlLiBDb250YWlucyB0aGUgYGVsYHMgZm9yIGFsbCBjaGlsZCBub2RlcyAod2hpY2ggYXJlIHRoZW1zZWx2ZXMgcG9pbnRlZCB0byBieSB0aG9zZSBub2RlcykuIFRoaXMgaXMgYWx3YXlzIGdlbmVyYXRlZCBidXQgaXMgb25seSBpbiB0aGUgcGFnZSBET00gaWYgeW91IHB1dCBpdCB0aGVyZS5cbiAqL1xuXG52YXIgRmlsdGVyTm9kZSA9IEJhc2UuZXh0ZW5kKCdGaWx0ZXJOb2RlJywge1xuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ3JlYXRlIGEgbmV3IG5vZGUgb3Igc3VidHJlZS5cbiAgICAgKiBAZGVzYyBUeXBpY2FsbHkgdXNlZCBieSB0aGUgYXBwbGljYXRpb24gbGF5ZXIgdG8gY3JlYXRlIHRoZSBlbnRpcmUgZmlsdGVyIHRyZWU7IGFuZCBpbnRlcm5hbGx5LCByZWN1cnNpdmVseSwgdG8gY3JlYXRlIGVhY2ggbm9kZSBpbmNsdWRpbmcgYm90aCBzdWJ0cmVlcyBhbmQgbGVhdmVzLlxuICAgICAqXG4gICAgICogKipOb2RlIHByb3BlcnRpZXMgYW5kIG9wdGlvbnM6KiogTm9kZXMgYXJlIGluc3RhbnRpYXRlZCB3aXRoOlxuICAgICAqIDEuIENlcnRhaW4gKipyZXF1aXJlZCBwcm9wZXJ0aWVzKiogd2hpY2ggZGlmZmVyIGZvciBzdWJ0cmVlcyBhbmQgbGVhdmVzLlxuICAgICAqIDIuIEFyYml0cmFyeSAqKm5vbi1zdGFuZGFyZCBvcHRpb24gcHJvcGVydGllcyoqIGFyZSBkZWZpbmVkIG9uIHRoZSBgb3B0aW9uc2Agb2JqZWN0IChzbyBsb25nIGFzIHRoZWlyIG5hbWVzIGRvIG5vdCBjb25mbGljdCB3aXRoIGFueSBzdGFuZGFyZCBvcHRpb25zKSBhbmQgbmV2ZXIgcGVyc2lzdC5cbiAgICAgKiAzLiBDZXJ0YWluICoqc3RhbmRhcmQgb3B0aW9ucyBwcm9wZXJ0aWVzKiogYXMgZGVmaW5lZCBpbiB0aGUge0BsaW5rIEZpbHRlck5vZGV+b3B0aW9uc1NjaGVtYXxvcHRpb25zU2NoZW1hfSBoYXNoLCBjb21lIGZyb20gdmFyaW91cyBzb3VyY2VzLCBhcyBwcmlvcml0aXplZCBhcyBmb2xsb3dzOlxuICAgICAqICAgIDEuIGBvcHRpb25zYCBvYmplY3Q7IGRvZXMgbm90IHBlcnNpc3RcbiAgICAgKiAgICAyLiBgc3RhdGVgOyBvYmplY3Q7IHBlcnNpc3RzXG4gICAgICogICAgMy4gYHBhcmVudGAgb2JqZWN0OyBwZXJzaXN0c1xuICAgICAqICAgIDQuIGBkZWZhdWx0YCBvYmplY3Q7IGRvZXMgbm90IHBlcnNpc3RcbiAgICAgKlxuICAgICAqIE5vdGVzOlxuICAgICAqIDEuIFwiUGVyc2lzdHNcIiBtZWFucyBvdXRwdXQgYnkge0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV8Z2V0U3RhdGUoKX0uXG4gICAgICogMi4gVGhlIGBwYXJlbnRgIG9iamVjdCBpcyBnZW5lcmF0ZWQgaW50ZXJuYWxseSBmb3Igc3VidHJlZXMuIEl0IGFsbG93cyBzdGFuZGFyZCBvcHRpb25zIHRvIGluaGVyaXQgZnJvbSB0aGUgcGFyZW50IG5vZGUuXG4gICAgICogMy4gVGhlIGBkZWZhdWx0YCBvYmplY3QgY29tZXMgZnJvbSB0aGUgYGRlZmF1bHRgIHByb3BlcnR5LCBpZiBhbnksIG9mIHRoZSB7QGxpbmsgRmlsdGVyTm9kZX5vcHRpb25zU2NoZW1hfHNjaGVtYSBvYmplY3R9IGZvciB0aGUgc3RhbmRhcmQgb3B0aW9uIGluIHF1ZXN0aW9uLiBOb3RlIHRoYXQgb25jZSBkZWZpbmVkLCBzdWJ0cmVlcyB3aWxsIHRoZW4gaW5oZXJpdCB0aGlzIHZhbHVlLlxuICAgICAqIDQuIElmIG5vdCBkZWZpbmVkIGJ5IGFueSBvZiB0aGUgYWJvdmUsIHRoZSBzdGFuZGFyZCBvcHRpb24gcmVtYWlucyB1bmRlZmluZWQgb24gdGhlIG5vZGUuXG4gICAgICpcbiAgICAgKiAqKlF1ZXJ5IEJ1aWxkZXIgVUkgc3VwcG9ydDoqKiBJZiB5b3VyIGFwcCB3YW50cyB0byBtYWtlIHVzZSBvZiB0aGUgZ2VuZXJhdGVkIFVJLCB5b3UgYXJlIHJlc3BvbnNpYmxlIGZvciBpbnNlcnRpbmcgdGhlIHRvcC1sZXZlbCBgLmVsYCBpbnRvIHRoZSBET00uIChPdGhlcndpc2UganVzdCBpZ25vcmUgaXQuKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gVGhlIG5vZGUgc3RhdGU7IG9yIGFuIG9wdGlvbnMgb2JqZWN0IHBvc3NpYmx5IGNvbnRhaW5pbmcgYHN0YXRlYCBhbW9uZyBvdGhlciBvcHRpb25zLiBBbHRob3VnaCB5b3UgY2FuIGluc3RhbnRpYXRlIGEgZmlsdGVyIHdpdGhvdXQgYW55IG9wdGlvbnMsIHRoaXMgaXMgZ2VuZXJhbGx5IG5vdCB1c2VmdWwuIFNlZSAqSW5zdGFudGlhdGluZyBhIGZpbHRlciogaW4gdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9pbmRleC5odG1sfHJlYWRtZX0gZm9yIGEgcHJhY3RpY2FsIGRpc2N1c3Npb24gb2YgbWluaW11bSBvcHRpb25zLlxuICAgICAqXG4gICAgICogKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgIC8qKiBAc3VtbWFyeSBSZWZlcmVuY2UgdG8gdGhpcyBub2RlJ3MgcGFyZW50IG5vZGUuXG4gICAgICAgICAqIEBkZXNjIFdoZW4gdGhpcyBwcm9wZXJ0eSBpcyB1bmRlZmluZWQsIHRoaXMgbm9kZSBpcyB0aGUgcm9vdCBub2RlLlxuICAgICAgICAgKiBAdHlwZSB7RmlsdGVyTm9kZX1cbiAgICAgICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICAgICAqL1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCBvcHRpb25zLnBhcmVudCxcbiAgICAgICAgICAgIHJvb3QgPSBwYXJlbnQgJiYgcGFyZW50LnJvb3Q7XG5cbiAgICAgICAgaWYgKCFyb290KSB7XG4gICAgICAgICAgICByb290ID0gdGhpcztcblxuICAgICAgICAgICAgdGhpcy5zdHlsZXNoZWV0ID0gdGhpcy5zdHlsZXNoZWV0IHx8XG4gICAgICAgICAgICAgICAgY3NzSW5qZWN0b3Iob3B0aW9ucy5jc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudCk7XG5cbiAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxzID0gbmV3IENvbmRpdGlvbmFscyhvcHRpb25zKTsgLy8gLnNxbElkUXRzXG5cbiAgICAgICAgICAgIHRoaXMuUGFyc2VyU1FMID0gbmV3IFBhcnNlclNRTChvcHRpb25zKTsgLy8gLnNjaGVtYSwgLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lcywgLnJlc29sdmVBbGlhc2VzXG5cbiAgICAgICAgICAgIHZhciBrZXlzID0gWyduYW1lJ107XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZXNvbHZlQWxpYXNlcykge1xuICAgICAgICAgICAgICAgIGtleXMucHVzaCgnYWxpYXMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5maW5kT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBjYXNlU2Vuc2l0aXZlOiBvcHRpb25zLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lcyxcbiAgICAgICAgICAgICAgICBrZXlzOiBrZXlzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEBzdW1tYXJ5IENvbnZlbmllbmNlIHJlZmVyZW5jZSB0byB0aGUgcm9vdCBub2RlLlxuICAgICAgICAgKiBAbmFtZSByb290XG4gICAgICAgICAqIEB0eXBlIHtGaWx0ZXJOb2RlfVxuICAgICAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3Q7XG5cbiAgICAgICAgdGhpcy5kb250UGVyc2lzdCA9IHt9OyAvLyBoYXNoIG9mIHRydXRoeSB2YWx1ZXNcblxuICAgICAgICB0aGlzLnNldFN0YXRlKG9wdGlvbnMuc3RhdGUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKiogSW5zZXJ0IGVhY2ggc3VidHJlZSBpbnRvIGl0cyBwYXJlbnQgbm9kZSBhbG9uZyB3aXRoIGEgXCJkZWxldGVcIiBidXR0b24uXG4gICAgICpcbiAgICAgKiBOT1RFOiBUaGUgcm9vdCB0cmVlICh3aGljaCBoYXMgbm8gcGFyZW50KSBtdXN0IGJlIGluc2VydGVkIGludG8gdGhlIERPTSBieSB0aGUgaW5zdGFudGlhdGluZyBjb2RlICh3aXRob3V0IGEgZGVsZXRlIGJ1dHRvbikuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICovXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICAgICAgICB2YXIgbmV3TGlzdEl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KENISUxEX1RBRyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm5vdGVzRWwpIHtcbiAgICAgICAgICAgICAgICBuZXdMaXN0SXRlbS5hcHBlbmRDaGlsZCh0aGlzLm5vdGVzRWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMua2VlcCkge1xuICAgICAgICAgICAgICAgIHZhciBlbCA9IHRoaXMudGVtcGxhdGVzLmdldCgncmVtb3ZlQnV0dG9uJyk7XG4gICAgICAgICAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnJlbW92ZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICBuZXdMaXN0SXRlbS5hcHBlbmRDaGlsZChlbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ld0xpc3RJdGVtLmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5lbC5xdWVyeVNlbGVjdG9yKENISUxEUkVOX1RBRykuYXBwZW5kQ2hpbGQobmV3TGlzdEl0ZW0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc11cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICBzZXRTdGF0ZTogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG9sZEVsID0gdGhpcy5lbDtcblxuICAgICAgICBzdGF0ZSA9IHRoaXMucGFyc2VTdGF0ZVN0cmluZyhzdGF0ZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5taXhJblN0YW5kYXJkT3B0aW9ucyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMubWl4SW5Ob25zdGFuZGFyZE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuY3JlYXRlVmlldyhzdGF0ZSk7XG4gICAgICAgIHRoaXMubG9hZFN0YXRlKHN0YXRlKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoKTtcblxuICAgICAgICBpZiAob2xkRWwpIHtcbiAgICAgICAgICAgIHZhciBuZXdFbCA9IHRoaXMuZWw7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnQgJiYgb2xkRWwucGFyZW50RWxlbWVudC50YWdOYW1lID09PSAnTEknKSB7XG4gICAgICAgICAgICAgICAgb2xkRWwgPSBvbGRFbC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICAgIG5ld0VsID0gbmV3RWwucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9sZEVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld0VsLCBvbGRFbCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ29udmVydCBhIHN0cmluZyB0byBhIHN0YXRlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBkZXNjIFRoZXkgc3RyaW5nJ3Mgc3ludGF4IGlzIGluZmVycmVkIGFzIGZvbGxvd3M6XG4gICAgICogMS4gSWYgc3RhdGUgaXMgdW5kZWZpbmVkIG9yIGFscmVhZHkgYW4gb2JqZWN0LCByZXR1cm4gYXMgaXMuXG4gICAgICogMi4gSWYgYG9wdGlvbnMuY29udGV4dGAgaXMgZGVmaW5lZCwgYHN0YXRlYCBpcyBhc3N1bWVkIHRvIGJlIGEgQ1NTIHNlbGVjdG9yIHN0cmluZyAoYXV0by1kZXRlY3RlZCkgcG9pbnRpbmcgdG8gYW4gSFRNTCBmb3JtIGNvbnRyb2wgd2l0aCBhIGB2YWx1ZWAgcHJvcGVydHksIHN1Y2ggYXMgYSB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxJbnB1dEVsZW1lbnQgSFRNTElucHV0RWxlbWVudH0gb3IgYSB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxUZXh0QXJlYUVsZW1lbnQgSFRNTFRleHRBcmVhRWxlbWVudH0uIFRoZSBlbGVtZW50IGlzIHNlbGVjdGVkIGFuZCBpZiBmb3VuZCwgaXRzIHZhbHVlIGlzIGZldGNoZWQgZnJvbSB0aGUgRE9NIGFuZCBhc3NpZ25lZCB0byBgc3RhdGVgLlxuICAgICAqIDMuIElmIGBvcHRpb25zLnN5bnRheGAgaXMgYCdhdXRvJ2AsIEpTT04gc3ludGF4IGlzIGRldGVjdGVkIGlmIGBzdGF0ZWAgYmVnaW5zIF9hbmRfIGVuZHMgd2l0aCBlaXRoZXIgYFtgIGFuZCBgXWAgX29yXyBge2AgYW5kIGB9YCAoaWdub3JpbmcgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGUgc3BhY2UpLlxuICAgICAqIDQuIElmIEpTT04gc3ludGF4LCBwYXJzZSB0aGUgc3RyaW5nIGludG8gYW4gYWN0dWFsIGBGaWx0ZXJUcmVlU3RhdGVPYmplY3RgIHVzaW5nIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9KU09OL3BhcnNlfEpTT04ucGFyc2V9IGFuZCB0aHJvdyBhbiBlcnJvciBpZiB1bnBhcnNhYmxlLlxuICAgICAqIDUuIElmIG5vdCBKU09OLCBwYXJzZSB0aGUgc3RyaW5nIGFzIFNRTCBpbnRvIGFuIGFjdHVhbCBgRmlsdGVyVHJlZVN0YXRlT2JqZWN0YCB1c2luZyBwYXJzZXItU1FMJ3Mge0BsaW5rIFBhcnNlclNRTCNwYXJzZXJ8cGFyc2VyfSBhbmQgdGhyb3cgYW4gZXJyb3IgaWYgdW5wYXJzYWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBbc3RhdGVdXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc11cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IFRoZSB1bm1vbGVzdGVkIGBzdGF0ZWAgcGFyYW1ldGVyLiBUaHJvd3MgYW4gZXJyb3IgaWYgYHN0YXRlYCBpcyB1bmtub3duIG9yIGludmFsaWQgc3ludGF4LlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQGlubmVyXG4gICAgICovXG4gICAgcGFyc2VTdGF0ZVN0cmluZzogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhciBjb250ZXh0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIHN5bnRheCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggfHwgJ2F1dG8nOyAvLyBkZWZhdWx0IGlzICdhdXRvJ1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSBjb250ZXh0LnF1ZXJ5U2VsZWN0b3Ioc3RhdGUpLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzeW50YXggPT09ICdhdXRvJykge1xuICAgICAgICAgICAgICAgICAgICBzeW50YXggPSByZUpTT04udGVzdChzdGF0ZSkgPyAnSlNPTicgOiAnU1FMJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHN5bnRheCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdKU09OJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSBKU09OLnBhcnNlKHN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignSlNPTiBwYXJzZXI6ICcgKyBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnU1FMJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnJvb3QuUGFyc2VyU1FMLnBhcnNlKHN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignU1FMIFdIRVJFIGNsYXVzZSBwYXJzZXI6ICcgKyBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignVW5leHBlY3RlZCBpbnB1dCBzdGF0ZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGVhY2ggc3RhbmRhcmQgb3B0aW9uIGZyb20gd2hlbiBmb3VuZCBvbiB0aGUgYG9wdGlvbnNgIG9yIGBzdGF0ZWAgb2JqZWN0cywgcmVzcGVjdGl2ZWx5OyBvciBpZiBub3QgYW4gXCJvd25cIiBvcHRpb24sIG9uIHRoZSBgcGFyZW50YCBvYmplY3Qgb3IgZnJvbSB0aGUgb3B0aW9ucyBzY2hlbWEgZGVmYXVsdCAoaWYgYW55KVxuICAgICAqIEBwYXJhbSBzdGF0ZVxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICovXG4gICAgbWl4SW5TdGFuZGFyZE9wdGlvbnM6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBub2RlID0gdGhpcztcblxuICAgICAgICBfKEZpbHRlck5vZGUub3B0aW9uc1NjaGVtYSkuZWFjaChmdW5jdGlvbihvcHRpb25TY2hlbWEsIGtleSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25TY2hlbWEuaWdub3JlICYmICh0aGlzICE9PSB0aGlzLnJvb3QgfHwgb3B0aW9uU2NoZW1hLnJvb3RCb3VuZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgbm9kZS5kb250UGVyc2lzdFtrZXldID0gLy8gdHJ1dGh5IGlmIGZyb20gYG9wdGlvbnNgIG9yIGBkZWZhdWx0YFxuICAgICAgICAgICAgICAgICAgICAob3B0aW9uID0gb3B0aW9ucyAmJiBvcHRpb25zW2tleV0pICE9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgICAgICAgKG9wdGlvbiA9IHN0YXRlICYmIHN0YXRlW2tleV0pID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICAgICAgIShvcHRpb25TY2hlbWEub3duIHx8IG5vZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBvcHRpb24gIT09IG51bGwpICYmXG4gICAgICAgICAgICAgICAgICAgICEob3B0aW9uID0gbm9kZS5wYXJlbnQgJiYgbm9kZS5wYXJlbnRba2V5XSkgJiZcbiAgICAgICAgICAgICAgICAgICAgKG9wdGlvbiA9IG9wdGlvblNjaGVtYS5kZWZhdWx0KTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb24gPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG5vZGVba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5kb250UGVyc2lzdFtrZXldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gJ3NjaGVtYScgJiYgIW9wdGlvbi53YWxrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhdHRhY2ggdGhlIGB3YWxrYCBhbmQgYGZpbmRgIGNvbnZlbmllbmNlIG1ldGhvZHMgdG8gdGhlIGBzY2hlbWFgIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb24ud2FsayA9IHBvcE1lbnUud2Fsay5iaW5kKG9wdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb24ubG9va3VwID0gcG9wTWVudS5sb29rdXAuYmluZChvcHRpb24sIG5vZGUucm9vdC5maW5kT3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbm9kZVtrZXldID0gb3B0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICovXG4gICAgbWl4SW5Ob25zdGFuZGFyZE9wdGlvbnM6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzO1xuXG4gICAgICAgIC8vIGNvcHkgYWxsIHJlbWFpbmluZyBvcHRpb25zIGRpcmVjdGx5IHRvIHRoZSBuZXcgaW5zdGFuY2UsIG92ZXJyaWRpbmcgcHJvdG90eXBlIG1lbWJlcnMgb2YgdGhlIHNhbWUgbmFtZVxuICAgICAgICBfKG9wdGlvbnMpLmVhY2goZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICAgICAgaWYgKCFGaWx0ZXJOb2RlLm9wdGlvbnNTY2hlbWFba2V5XSkge1xuICAgICAgICAgICAgICAgIG5vZGVba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqIFJlbW92ZSBib3RoOlxuICAgICAqICogYHRoaXNgIGZpbHRlciBub2RlIGZyb20gaXQncyBgcGFyZW50YCdzIGBjaGlsZHJlbmAgY29sbGVjdGlvbjsgYW5kXG4gICAgICogKiBgdGhpc2AgZmlsdGVyIG5vZGUncyBgZWxgJ3MgY29udGFpbmVyIChhbHdheXMgYSBgPGxpPmAgZWxlbWVudCkgZnJvbSBpdHMgcGFyZW50IGVsZW1lbnQuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICovXG4gICAgcmVtb3ZlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGF2ZXJ0LFxuICAgICAgICAgICAgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG5cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXIuY2FsbChwYXJlbnQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2RlbGV0ZScsXG4gICAgICAgICAgICAgICAgICAgIHByZXZlbnREZWZhdWx0OiBmdW5jdGlvbigpIHsgYXZlcnQgPSB0cnVlOyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWF2ZXJ0KSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQua2VlcCB8fCAvLyBuZXZlciBcInBydW5lXCIgKHJlbW92ZSBpZiBlbXB0eSkgdGhpcyBwYXJ0aWN1bGFyIHN1YmV4cHJlc3Npb25cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuLmxlbmd0aCA+IDEgLy8gdGhpcyBub2RlIGhhcyBzaWJsaW5ncyBzbyB3aWxsIG5vdCBiZSBlbXB0eSBhZnRlciB0aGlzIHJlbW92ZVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcm9jZWVkIHdpdGggcmVtb3ZlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZWwucGFyZW50Tm9kZS5yZW1vdmUoKTsgLy8gdGhlIHBhcmVudCBpcyBhbHdheXMgdGhlIGNvbnRhaW5pbmcgPGxpPiB0YWdcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuLnNwbGljZShwYXJlbnQuY2hpbGRyZW4uaW5kZXhPZih0aGlzKSwgMSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVjdXJzZSB0byBwcnVuZSBlbnRpcmUgc3ViZXhwcmVzc2lvbiBiZWNhdXNlIGl0J3MgcHJ1bmUtYWJsZSBhbmQgd291bGQgZW5kIHVwIGVtcHR5IChjaGlsZGxlc3MpXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV29yay1hcm91bmQgZm9yIGB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3IoJzpzY29wZT4nICsgc2VsZWN0b3IpYCBiZWNhdXNlIGA6c2NvcGVgIG5vdCBzdXBwb3J0ZWQgaW4gSUUxMS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKi9cbiAgICBmaXJzdENoaWxkT2ZUeXBlOiBmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgICAgICBpZiAoZWwgJiYgZWwucGFyZW50RWxlbWVudCAhPT0gdGhpcy5lbCkge1xuICAgICAgICAgICAgZWwgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9LFxuXG4gICAgRXJyb3I6IEZpbHRlclRyZWVFcnJvcixcblxuICAgIHRlbXBsYXRlczogbmV3IFRlbXBsYXRlcygpXG59KTtcblxuLyoqIEB0eXBlZGVmIG9wdGlvbnNTY2hlbWFPYmplY3RcbiAqIEBzdW1tYXJ5IFN0YW5kYXJkIG9wdGlvbiBzY2hlbWFcbiAqIEBkZXNjIFN0YW5kYXJkIG9wdGlvbnMgYXJlIGF1dG9tYXRpY2FsbHkgYWRkZWQgdG8gbm9kZXMuIERhdGEgc291cmNlcyBmb3Igc3RhbmRhcmQgb3B0aW9ucyBpbmNsdWRlIGBvcHRpb25zYCwgYHN0YXRlYCwgYHBhcmVudGAgYW5kIGBkZWZhdWx0YCAoaW4gdGhhdCBvcmRlcikuIERlc2NyaWJlcyBzdGFuZGFyZCBvcHRpb25zIHRocm91Z2ggdmFyaW91cyBwcm9wZXJ0aWVzOlxuICogQHByb3BlcnR5IHtib29sZWFufSBbaWdub3JlXSAtIERvIG5vdCBhdXRvbWF0aWNhbGx5IGFkZCB0byBub2RlcyAocHJvY2Vzc2VkIGVsc2V3aGVyZSkuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtvd25dIC0gRG8gbm90IGF1dG9tYXRpY2FsbHkgYWRkIGZyb20gYHBhcmVudGAgb3IgYGRlZmF1bHRgLlxuICogQHByb3BlcnR5IHtib29sZWFufSBbcm9vdEJvdW5kXSAtIEF1dG9tYXRpY2FsbHkgYWRkIHRvIHJvb3Qgbm9kZSBvbmx5LlxuICogQHByb3BlcnR5IHsqfSBbZGVmYXVsdF0gLSBUaGlzIGlzIHRoZSBkZWZhdWx0IGRhdGEgc291cmNlIHdoZW4gYWxsIG90aGVyIHN0cmF0ZWdpZXMgZmFpbC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlZmluZXMgdGhlIHN0YW5kYXJkIG9wdGlvbnMgYXZhaWxhYmxlIHRvIGEgbm9kZS5cbiAqIEBkZXNjIFRoZSBmb2xsb3dpbmcgcHJvcGVydGllcyBiZWFyIHRoZSBzYW1lIG5hbWVzIGFzIHRoZSBub2RlIG9wdGlvbnMgdGhleSBkZWZpbmUuXG4gKiBAdHlwZSB7b2JqZWN0fVxuICogQG1lbWJlck9mIEZpbHRlck5vZGVcbiAqL1xuRmlsdGVyTm9kZS5vcHRpb25zU2NoZW1hID0ge1xuXG4gICAgc3RhdGU6IHsgaWdub3JlOiB0cnVlIH0sXG5cbiAgICBjc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudDogeyBpZ25vcmU6IHRydWUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBEZWZhdWx0IGNvbHVtbiBzY2hlbWEgZm9yIGNvbHVtbiBkcm9wLWRvd25zIG9mIGRpcmVjdCBkZXNjZW5kYW50IGxlYWYgbm9kZXMgb25seS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7c3RyaW5nW119XG4gICAgICovXG4gICAgb3duU2NoZW1hOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IENvbHVtbiBzY2hlbWEgZm9yIGNvbHVtbiBkcm9wLWRvd25zIG9mIGFsbCBkZXNjZW5kYW50IG5vZGVzLiBQZXJ0YWlucyB0byBsZWFmIG5vZGVzIG9ubHkuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge21lbnVJdGVtW119XG4gICAgICovXG4gICAgc2NoZW1hOiB7fSxcblxuICAgIC8qKiBAc3VtbWFyeSBGaWx0ZXIgZWRpdG9yIGZvciB1c2VyIGludGVyZmFjZS5cbiAgICAgKiBAZGVzYyBOYW1lIG9mIGZpbHRlciBlZGl0b3IgdXNlZCBieSB0aGlzIGFuZCBhbGwgZGVzY2VuZGFudCBub2Rlcy4gUGVydGFpbnMgdG8gbGVhZiBub2RlcyBvbmx5LlxuICAgICAqIEBkZWZhdWx0ICdEZWZhdWx0J1xuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZWRpdG9yOiB7fSxcblxuICAgIC8qKiBAc3VtbWFyeSBFdmVudCBoYW5kbGVyIGZvciBVSSBldmVudHMuXG4gICAgICogQGRlc2MgU2VlICpFdmVudHMqIGluIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvaW5kZXguaHRtbHxyZWFkbWV9IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKi9cbiAgICBldmVudEhhbmRsZXI6IHt9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IEZpZWxkcyBkYXRhIHR5cGUuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICB0eXBlOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IFVuZGVsZXRlYWJsZSBub2RlLlxuICAgICAqIEBkZXNjIFRydXRoeSBtZWFucyBkb24ndCByZW5kZXIgYSBkZWxldGUgYnV0dG9uIG5leHQgdG8gdGhlIGZpbHRlciBlZGl0b3IgZm9yIHRoaXMgbm9kZS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBrZWVwOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IE92ZXJyaWRlIG9wZXJhdG9yIGxpc3QgYXQgYW55IG5vZGUuXG4gICAgICogQGRlc2MgVGhlIGRlZmF1bHQgaXMgYXBwbGllZCB0byB0aGUgcm9vdCBub2RlIGFuZCBhbnkgb3RoZXIgbm9kZSB3aXRob3V0IGFuIG9wZXJhdG9yIG1lbnUuXG4gICAgICogQGRlZmF1bHQge0BsaW5rIENvbmRpdGlvbmFscy5kZWZhdWx0T3BNZW51fS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAgICAgKi9cbiAgICBvcE1lbnU6IHsgZGVmYXVsdDogQ29uZGl0aW9uYWxzLmRlZmF1bHRPcE1lbnUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBUcnV0aHkgY29uc2lkZXJzIG9wIHZhbGlkIG9ubHkgaWYgaW4gbWVudS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvcE11c3RCZUluTWVudToge30sXG5cbiAgICAvKiogQHN1bW1hcnkgRGljdGlvbmFyeSBvZiBvcGVyYXRvciBtZW51cyBmb3Igc3BlY2lmaWMgZGF0YSB0eXBlcy5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBkZXNjIEEgaGFzaCBvZiB0eXBlIG5hbWVzLiBFYWNoIG1lbWJlciB0aHVzIGRlZmluZWQgY29udGFpbnMgYSBzcGVjaWZpYyBvcGVyYXRvciBtZW51IGZvciBhbGwgZGVzY2VuZGFudCBsZWFmIG5vZGVzIHRoYXQ6XG4gICAgICogMS4gZG8gbm90IGhhdmUgdGhlaXIgb3duIG9wZXJhdG9yIG1lbnUgKGBvcE1lbnVgIHByb3BlcnR5KSBvZiB0aGVpciBvd247IGFuZFxuICAgICAqIDIuIHdob3NlIGNvbHVtbnMgcmVzb2x2ZSB0byB0aGF0IHR5cGUuXG4gICAgICpcbiAgICAgKiBUaGUgdHlwZSBpcyBkZXRlcm1pbmVkIGJ5IChpbiBwcmlvcml0eSBvcmRlcik6XG4gICAgICogMS4gdGhlIGB0eXBlYCBwcm9wZXJ0eSBvZiB0aGUge0BsaW5rIEZpbHRlckxlYWZ9OyBvclxuICAgICAqIDIuIHRoZSBgdHlwZWAgcHJvcGVydHkgb2YgdGhlIGVsZW1lbnQgaW4gdGhlIG5lYXJlc3Qgbm9kZSAoaW5jbHVkaW5nIHRoZSBsZWFmIG5vZGUgaXRzZWxmKSB0aGF0IGhhcyBhIGRlZmluZWQgYG93blNjaGVtYWAgb3IgYHNjaGVtYWAgYXJyYXkgcHJvcGVydHkgd2l0aCBhbiBlbGVtZW50IGhhdmluZyBhIG1hdGNoaW5nIGNvbHVtbiBuYW1lLlxuICAgICAqL1xuICAgIHR5cGVPcE1hcDogeyByb290Qm91bmQ6IHRydWUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBUcnV0aHkgd2lsbCBzb3J0IHRoZSBjb2x1bW4gbWVudXMuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc29ydENvbHVtbk1lbnU6IHt9XG59O1xuXG5GaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyA9IGZ1bmN0aW9uKGVsLCB2YWx1ZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgICB2YWx1ZSA9IGVsLnZhbHVlO1xuICAgIH1cbiAgICBlbC5jbGFzc0xpc3RbdmFsdWUgPyAncmVtb3ZlJyA6ICdhZGQnXSgnZmlsdGVyLXRyZWUtd2FybmluZycpO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkZpbHRlck5vZGUuY2xpY2tJbiA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgaWYgKGVsKSB7XG4gICAgICAgIGlmIChlbC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgZWwuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnbW91c2Vkb3duJykpOyB9LCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVsLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlck5vZGU7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuLy8gVGhpcyBpcyB0aGUgbWFpbiBmaWxlLCB1c2FibGUgYXMgaXMsIHN1Y2ggYXMgYnkgL3Rlc3QvaW5kZXguanMuXG5cbi8vIEZvciBucG06IHJlcXVpcmUgdGhpcyBmaWxlXG4vLyBGb3IgQ0ROOiBndWxwZmlsZS5qcyBicm93c2VyaWZpZXMgdGhpcyBmaWxlIHdpdGggc291cmNlbWFwIHRvIC9idWlsZC9maWx0ZXItdHJlZS5qcyBhbmQgdWdsaWZpZWQgd2l0aG91dCBzb3VyY2VtYXAgdG8gL2J1aWxkL2ZpbHRlci10cmVlLm1pbi5qcy4gVGhlIENETiBpcyBodHRwczovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHBvcE1lbnUgPSByZXF1aXJlKCdwb3AtbWVudScpO1xudmFyIHVuc3RydW5naWZ5ID0gcmVxdWlyZSgndW5zdHJ1bmdpZnknKTtcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgRmlsdGVyTm9kZSA9IHJlcXVpcmUoJy4vRmlsdGVyTm9kZScpO1xudmFyIEZpbHRlckxlYWYgPSByZXF1aXJlKCcuL0ZpbHRlckxlYWYnKTtcbnZhciBvcGVyYXRvcnMgPSByZXF1aXJlKCcuL3RyZWUtb3BlcmF0b3JzJyk7XG5cblxudmFyIG9yZGluYWwgPSAwO1xuXG4vKiogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBBbiBvYmplY3QgdGhhdCByZXByZXNlbnRzIHRoZSByb290IG5vZGUgb3IgYSBicmFuY2ggbm9kZSBpbiBhIGZpbHRlciB0cmVlLlxuICogQGRlc2MgQSBub2RlIHJlcHJlc2VudGluZyBhIHN1YmV4cHJlc3Npb24gaW4gdGhlIGZpbHRlciBleHByZXNzaW9uLiBNYXkgYmUgdGhvdWdodCBvZiBhcyBhIHBhcmVudGhlc2l6ZWQgc3ViZXhwcmVzc2lvbiBpbiBhbGdlYnJhaWMgZXhwcmVzc2lvbiBzeW50YXguIEFzIGRpc2N1c3NlZCB1bmRlciB7QGxpbmsgRmlsdGVyTm9kZX0sIGEgYEZpbHRlclRyZWVgIGluc3RhbmNlJ3MgY2hpbGQgbm9kZXMgbWF5IGJlIGVpdGhlcjpcbiAqICogT3RoZXIgKG5lc3RlZCkgYEZpbHRlclRyZWVgIChvciBzdWJjbGFzcyB0aGVyZW9mKSBub2RlcyByZXByZXNlbnRpbmcgc3ViZXhwcmVzc2lvbnMuXG4gKiAqIHtAbGluayBGaWx0ZXJMZWFmfSAob3Igc3ViY2xhc3MgdGhlcmVvZikgdGVybWluYWwgbm9kZXMgcmVwcmVzZW50aW5nIGNvbmRpdGlvbmFsIGV4cHJlc3Npb25zLlxuICpcbiAqIFRoZSBgRmlsdGVyVHJlZWAgb2JqZWN0IGFsc28gaGFzIG1ldGhvZHMsIHNvbWUgb2Ygd2hpY2ggb3BlcmF0ZSBvbiBhIHNwZWNpZmljIHN1YnRyZWUgaW5zdGFuY2UsIGFuZCBzb21lIG9mIHdoaWNoIHJlY3Vyc2UgdGhyb3VnaCBhbGwgdGhlIHN1YnRyZWUncyBjaGlsZCBub2RlcyBhbmQgYWxsIHRoZWlyIGRlc2NlbmRhbnRzLCBfZXRjLl9cbiAqXG4gKiBUaGUgcmVjdXJzaXZlIG1ldGhvZHMgYXJlIGludGVyZXN0aW5nLiBUaGV5IGFsbCB3b3JrIHNpbWlsYXJseSwgbG9vcGluZyB0aHJvdWdoIHRoZSBsaXN0IG9mIGNoaWxkIG5vZGVzLCByZWN1cnNpbmcgd2hlbiB0aGUgY2hpbGQgbm9kZSBpcyBhIG5lc3RlZCBzdWJ0cmVlICh3aGljaCB3aWxsIHJlY3Vyc2UgZnVydGhlciB3aGVuIGl0IGhhcyBpdHMgb3duIG5lc3RlZCBzdWJ0cmVlcyk7IGFuZCBjYWxsaW5nIHRoZSBwb2x5bW9ycGhpYyBtZXRob2Qgd2hlbiB0aGUgY2hpbGQgbm9kZSBpcyBhIGBGaWx0ZXJMZWFmYCBvYmplY3QsIHdoaWNoIGlzIGEgdGVybWluYWwgbm9kZS4gU3VjaCBwb2x5bW9ycGhpYyBtZXRob2RzIGluY2x1ZGUgYHNldFN0YXRlKClgLCBgZ2V0U3RhdGUoKWAsIGBpbnZhbGlkKClgLCBhbmQgYHRlc3QoKWAuXG4gKlxuICogRm9yIGV4YW1wbGUsIGNhbGxpbmcgYHRlc3QoZGF0YVJvdylgIG9uIHRoZSByb290IHRyZWUgcmVjdXJzZXMgdGhyb3VnaCBhbnkgc3VidHJlZXMgZXZlbnR1YWxseSBjYWxsaW5nIGB0ZXN0KGRhdGFSb3cpYCBvbiBlYWNoIG9mIGl0cyBsZWFmIG5vZGVzIGFuZCBjb25jYXRlbmF0aW5nIHRoZSByZXN1bHRzIHRvZ2V0aGVyIHVzaW5nIHRoZSBzdWJ0cmVlJ3MgYG9wZXJhdG9yYC4gVGhlIHN1YnRyZWUncyBgdGVzdChkYXRhUm93KWAgY2FsbCB0aGVuIHJldHVybnMgdGhlIHJlc3VsdCB0byBpdCdzIHBhcmVudCdzIGB0ZXN0KClgIGNhbGwsIF9ldGMuLF8gZXZlbnR1YWxseSBidWJibGluZyB1cCB0byB0aGUgcm9vdCBub2RlJ3MgYHRlc3QoZGF0YVJvdylgIGNhbGwsIHdoaWNoIHJldHVybnMgdGhlIGZpbmFsIHJlc3VsdCB0byB0aGUgb3JpZ2luYWwgY2FsbGVyLiBUaGlzIHJlc3VsdCBkZXRlcm1pbmVzIGlmIHRoZSBnaXZlbiBkYXRhIHJvdyBwYXNzZWQgdGhyb3VnaCB0aGUgZW50aXJlIGZpbHRlciBleHByZXNzaW9uIHN1Y2Nlc3NmdWxseSAoYHRydWVgKSBhbmQgc2hvdWxkIGJlIGRpc3BsYXllZCwgb3Igd2FzIGJsb2NrZWQgc29tZXdoZXJlIChgZmFsc2VgKSBhbmQgc2hvdWxkIG5vdCBiZSBkaXNwbGF5ZWQuXG4gKlxuICogTm90ZSB0aGF0IGluIHByYWN0aWNlOlxuICogMS4gYGNoaWxkcmVuYCBtYXkgYmUgZW1wdHkuIFRoaXMgcmVwcmVzZW50cyBhIGFuIGVtcHR5IHN1YmV4cHJlc3Npb24uIE5vcm1hbGx5IHBvaW50bGVzcywgZW1wdHkgc3ViZXhwcmVzc2lvbnMgY291bGQgYmUgcHJ1bmVkLiBGaWx0ZXItdHJlZSBhbGxvd3MgdGhlbSBob3dldmVyIGFzIGhhcm1sZXNzIHBsYWNlaG9sZGVycy5cbiAqIDEuIGBvcGVyYXRvcmAgbWF5IGJlIG9taXR0ZWQgaW4gd2hpY2ggY2FzZSBpdCBkZWZhdWx0cyB0byBBTkQuXG4gKiAxLiBBIGBmYWxzZWAgcmVzdWx0IGZyb20gYSBjaGlsZCBub2RlIHdpbGwgc2hvcnQtc3RvcCBhbiBBTkQgb3BlcmF0aW9uOyBhIGB0cnVlYCByZXN1bHQgd2lsbCBzaG9ydC1zdG9wIGFuIE9SIG9yIE5PUiBvcGVyYXRpb24uXG4gKlxuICogQWRkaXRpb25hbCBub3RlczpcbiAqIDEuIEEgYEZpbHRlclRyZWVgIG1heSBjb25zaXN0IG9mIGEgc2luZ2xlIGxlYWYsIGluIHdoaWNoIGNhc2UgdGhlIGNvbmNhdGVuYXRpb24gYG9wZXJhdG9yYCBpcyBub3QgbmVlZGVkIGFuZCBtYXkgYmUgbGVmdCB1bmRlZmluZWQuIEhvd2V2ZXIsIGlmIGEgc2Vjb25kIGNoaWxkIGlzIGFkZGVkIGFuZCB0aGUgb3BlcmF0b3IgaXMgc3RpbGwgdW5kZWZpbmVkLCBpdCB3aWxsIGJlIHNldCB0byB0aGUgZGVmYXVsdCAoYCdvcC1hbmQnYCkuXG4gKiAyLiBUaGUgb3JkZXIgb2YgdGhlIGNoaWxkcmVuIGlzIHVuZGVmaW5lZCBhcyBhbGwgb3BlcmF0b3JzIGFyZSBjb21tdXRhdGl2ZS4gRm9yIHRoZSAnYG9wLW9yYCcgb3BlcmF0b3IsIGV2YWx1YXRpb24gY2Vhc2VzIG9uIHRoZSBmaXJzdCBwb3NpdGl2ZSByZXN1bHQgYW5kIGZvciBlZmZpY2llbmN5LCBhbGwgc2ltcGxlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb25zIHdpbGwgYmUgZXZhbHVhdGVkIGJlZm9yZSBhbnkgY29tcGxleCBzdWJleHByZXNzaW9ucy5cbiAqIDMuIEEgbmVzdGVkIGBGaWx0ZXJUcmVlYCBpcyBkaXN0aW5ndWlzaGVkIChkdWNrLXR5cGVkKSBmcm9tIGEgbGVhZiBub2RlIGJ5IHRoZSBwcmVzZW5jZSBvZiBhIGBjaGlsZHJlbmAgbWVtYmVyLlxuICogNC4gTmVzdGluZyBhIGBGaWx0ZXJUcmVlYCBjb250YWluaW5nIGEgc2luZ2xlIGNoaWxkIGlzIHZhbGlkIChhbGJlaXQgcG9pbnRsZXNzKS5cbiAqXG4gKiAqKlNlZSBhbHNvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzdXBlcmNsYXNzOioqIHtAbGluayBGaWx0ZXJOb2RlfVxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbb3BlcmF0b3I9J29wLWFuZCddIC0gVGhlIG9wZXJhdG9yIHRoYXQgY29uY2F0ZW50YXRlcyB0aGUgdGVzdCByZXN1bHRzIGZyb20gYWxsIHRoZSBub2RlJ3MgYGNoaWxkcmVuYCAoY2hpbGQgbm9kZXMpLiBNdXN0IGJlIG9uZSBvZjpcbiAqICogYCdvcC1hbmQnYFxuICogKiBgJ29wLW9yJ2BcbiAqICogYCdvcC1ub3InYFxuICpcbiAqIE5vdGUgdGhhdCB0aGVyZSBpcyBvbmx5IG9uZSBgb3BlcmF0b3JgIHBlciBzdWJleHByZXNzaW9uLiBJZiB5b3UgbmVlZCB0byBtaXggb3BlcmF0b3JzLCBjcmVhdGUgYSBzdWJvcmRpbmF0ZSBzdWJleHByZXNzaW9uIGFzIG9uZSBvZiB0aGUgY2hpbGQgbm9kZXMuXG4gKlxuICogQHByb3BlcnR5IHtGaWx0ZXJOb2RlW119IGNoaWxkcmVuIC0gQSBsaXN0IG9mIGRlc2NlbmRhbnRzIG9mIHRoaXMgbm9kZS4gQXMgbm90ZWQsIHRoZXNlIG1heSBiZSBvdGhlciBgRmlsdGVyVHJlZWAgKG9yIHN1YmNsYXNzIHRoZXJlb2YpIG5vZGVzOyBvciBtYXkgYmUgdGVybWluYWwgYEZpbHRlckxlYWZgIChvciBzdWJjbGFzcyB0aGVyZW9mKSBub2Rlcy4gTWF5IGJlIGFueSBsZW5ndGggaW5jbHVkaW5nIDAgKG5vbmU7IGVtcHR5KS5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtrZWVwPWZhbHNlXSAtIERvIG5vdCBhdXRvbWF0aWNhbGx5IHBydW5lIHdoZW4gbGFzdCBjaGlsZCByZW1vdmVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7ZmllbGRJdGVtW119IFtvd25TY2hlbWFdIC0gQ29sdW1uIG1lbnUgdG8gYmUgdXNlZCBvbmx5IGJ5IGxlYWYgbm9kZXMgdGhhdCBhcmUgY2hpbGRyZW4gKGRpcmVjdCBkZXNjZW5kYW50cykgb2YgdGhpcyBub2RlLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZT0nc3VidHJlZSddIC0gVHlwZSBvZiBub2RlLCBmb3IgcmVuZGVyaW5nIHB1cnBvc2VzOyBuYW1lcyB0aGUgcmVuZGVyaW5nIHRlbXBsYXRlIHRvIHVzZSB0byBnZW5lcmF0ZSB0aGUgbm9kZSdzIFVJIHJlcHJlc2VudGF0aW9uLlxuICovXG52YXIgRmlsdGVyVHJlZSA9IEZpbHRlck5vZGUuZXh0ZW5kKCdGaWx0ZXJUcmVlJywge1xuXG4gICAgLyoqXG4gICAgICogSGFzaCBvZiBjb25zdHJ1Y3RvcnMgZm9yIG9iamVjdHMgdGhhdCBleHRlbmQgZnJvbSB7QGxpbmsgRmlsdGVyTGVhZn0sIHdoaWNoIGlzIHRoZSBgRGVmYXVsdGAgbWVtYmVyIGhlcmUuXG4gICAgICpcbiAgICAgKiBBZGQgYWRkaXRpb25hbCBlZGl0b3JzIHRvIHRoaXMgb2JqZWN0IChpbiB0aGUgcHJvdG90eXBlKSBwcmlvciB0byBpbnN0YW50aWF0aW5nIGEgbGVhZiBub2RlIHRoYXQgcmVmZXJzIHRvIGl0LiBUaGlzIG9iamVjdCBleGlzdHMgaW4gdGhlIHByb3RvdHlwZSBhbmQgYWRkaXRpb25zIHRvIGl0IHdpbGwgYWZmZWN0IGFsbCBub2RlcyB0aGF0IGRvbid0IGhhdmUgdGhlaXIgYW4gXCJvd25cIiBoYXNoLlxuICAgICAqXG4gICAgICogSWYgeW91IGNyZWF0ZSBhbiBcIm93blwiIGhhc2ggaW4geW91ciBpbnN0YW5jZSBiZSBzdXJlIHRvIGluY2x1ZGUgdGhlIGRlZmF1bHQgZWRpdG9yLCBmb3IgZXhhbXBsZTogYHsgRGVmYXVsdDogRmlsdGVyVHJlZS5wcm90b3R5cGUuZWRpdG9ycy5EZWZhdWx0LCAuLi4gfWAuIChPbmUgd2F5IG9mIG92ZXJyaWRpbmcgd291bGQgYmUgdG8gaW5jbHVkZSBzdWNoIGFuIG9iamVjdCBpbiBhbiBgZWRpdG9yc2AgbWVtYmVyIG9mIHRoZSBvcHRpb25zIG9iamVjdCBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yIG9uIGluc3RhbnRpYXRpb24uIFRoaXMgd29ya3MgYmVjYXVzZSBhbGwgbWlzY2VsbGFuZW91cyBtZW1iZXJzIGFyZSBzaW1wbHkgY29waWVkIHRvIHRoZSBuZXcgaW5zdGFuY2UuIE5vdCB0byBiZSBjb25mdXNlZCB3aXRoIHRoZSBzdGFuZGFyZCBvcHRpb24gYGVkaXRvcmAgd2hpY2ggaXMgYSBzdHJpbmcgY29udGFpbmluZyBhIGtleSBmcm9tIHRoaXMgaGFzaCBhbmQgdGVsbHMgdGhlIGxlYWYgbm9kZSB3aGF0IHR5cGUgdG8gdXNlLilcbiAgICAgKi9cbiAgICBlZGl0b3JzOiB7XG4gICAgICAgIERlZmF1bHQ6IEZpbHRlckxlYWZcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQW4gZXh0ZW5zaW9uIGlzIGEgaGFzaCBvZiBwcm90b3R5cGUgb3ZlcnJpZGVzIChtZXRob2RzLCBwcm9wZXJ0aWVzKSB1c2VkIHRvIGV4dGVuZCB0aGUgZGVmYXVsdCBlZGl0b3IuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtrZXk9J0RlZmF1bHQnXSAtIE5tZSBvZiB0aGUgbmV3IGV4dGVuc2lvbiBnaXZlbiBpbiBgZXh0YCBvciBuYW1lIG9mIGFuIGV4aXN0aW5nIGV4dGVuc2lvbiBpbiBgRmlsdGVyVHJlZS5leHRlbnNpb25zYC4gQXMgYSBjb25zdHJ1Y3Rvciwgc2hvdWxkIGhhdmUgYW4gaW5pdGlhbCBjYXBpdGFsLiBJZiBvbWl0dGVkLCByZXBsYWNlcyB0aGUgZGVmYXVsdCBlZGl0b3IgKEZpbHRlckxlYWYpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbZXh0XSBBbiBleHRlbnNpb24gaGFzaFxuICAgICAqIEBwYXJhbSB7RmlsZXJMZWFmfSBbQmFzZUVkaXRvcj10aGlzLmVkaXRvcnMuRGVmYXVsdF0gLSBDb25zdHJ1Y3RvciB0byBleHRlbmQgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7RmlsbHRlckxlYWZ9IEEgbmV3IGNsYXNzIGV4dGVuZGVkIGZyb20gYEJhc2VFZGl0b3JgIC0tIHdoaWNoIGlzIGluaXRpYWxseSBgRmlsdGVyTGVhZmAgYnV0IG1heSBpdHNlbGYgaGF2ZSBiZWVuIGV4dGVuZGVkIGJ5IGEgY2FsbCB0byBgLmFkZEVkaXRvcignRGVmYXVsdCcsIGV4dGVuc2lvbilgLlxuICAgICAqL1xuICAgIGFkZEVkaXRvcjogZnVuY3Rpb24oa2V5LCBleHQsIEJhc2VFZGl0b3IpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBga2V5YCAoc3RyaW5nKSB3YXMgb21pdHRlZFxuICAgICAgICAgICAgQmFzZUVkaXRvciA9IGV4dDtcbiAgICAgICAgICAgIGV4dCA9IGtleTtcbiAgICAgICAgICAgIGtleSA9ICdEZWZhdWx0JztcbiAgICAgICAgfVxuICAgICAgICBCYXNlRWRpdG9yID0gQmFzZUVkaXRvciB8fCB0aGlzLmVkaXRvcnMuRGVmYXVsdDtcbiAgICAgICAgZXh0ID0gZXh0IHx8IEZpbHRlclRyZWUuZXh0ZW5zaW9uc1trZXldO1xuICAgICAgICByZXR1cm4gKHRoaXMuZWRpdG9yc1trZXldID0gQmFzZUVkaXRvci5leHRlbmQoa2V5LCBleHQpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFRoZSBuYW1lIG9mIHRoZSBleGlzdGluZyBlZGl0b3IgdG8gcmVtb3ZlLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIHJlbW92ZUVkaXRvcjogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdEZWZhdWx0Jykge1xuICAgICAgICAgICAgdGhyb3cgJ0Nhbm5vdCByZW1vdmUgZGVmYXVsdCBlZGl0b3IuJztcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgdGhpcy5lZGl0b3JzW2tleV07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgY3JlYXRlVmlldzogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZWwgPSB0aGlzLnRlbXBsYXRlcy5nZXQoXG4gICAgICAgICAgICB0aGlzLnR5cGUgfHwgJ3N1YnRyZWUnLFxuICAgICAgICAgICAgKytvcmRpbmFsLFxuICAgICAgICAgICAgdGhpcy5zY2hlbWFbMF0gJiYgcG9wTWVudS5mb3JtYXRJdGVtKHRoaXMuc2NoZW1hWzBdKVxuICAgICAgICApO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgZXhwcmVzc2lvbiBlZGl0b3JzIHRvIHRoZSBcImFkZCBuZXdcIiBkcm9wLWRvd25cbiAgICAgICAgdmFyIGFkZE5ld0N0cmwgPSB0aGlzLmZpcnN0Q2hpbGRPZlR5cGUoJ3NlbGVjdCcpO1xuICAgICAgICBpZiAoYWRkTmV3Q3RybCkge1xuICAgICAgICAgICAgdmFyIHN1Ym1lbnUsIG9wdGdyb3VwLFxuICAgICAgICAgICAgICAgIGVkaXRvcnMgPSB0aGlzLmVkaXRvcnM7XG5cbiAgICAgICAgICAgIGlmIChhZGROZXdDdHJsLmxlbmd0aCA9PT0gMSAmJiB0aGlzLmVkaXRvcnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gdGhpcyBlZGl0b3IgaXMgdGhlIG9ubHkgb3B0aW9uIGJlc2lkZXMgdGhlIG51bGwgcHJvbXB0IG9wdGlvblxuICAgICAgICAgICAgICAgIC8vIHNvIG1ha2UgaXQgdGggZW9ubHkgaXRlbSBpIHRoZSBkcm9wLWRvd25cbiAgICAgICAgICAgICAgICBzdWJtZW51ID0gYWRkTmV3Q3RybDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGFscmVhZHkgb3B0aW9ucyBhbmQvb3IgbXVsdGlwbGUgZWRpdG9yc1xuICAgICAgICAgICAgICAgIHN1Ym1lbnUgPSBvcHRncm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGdyb3VwJyk7XG4gICAgICAgICAgICAgICAgb3B0Z3JvdXAubGFiZWwgPSAnQ29uZGl0aW9uYWwgRXhwcmVzc2lvbnMnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoZWRpdG9ycykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IGVkaXRvcnNba2V5XS5wcm90b3R5cGUubmFtZSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgc3VibWVudS5hcHBlbmRDaGlsZChuZXcgT3B0aW9uKG5hbWUsIGtleSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAob3B0Z3JvdXApIHtcbiAgICAgICAgICAgICAgICBhZGROZXdDdHJsLmFkZChvcHRncm91cCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG9uY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uVHJlZU9wQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgbG9hZFN0YXRlOiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB0aGlzLm9wZXJhdG9yID0gJ29wLWFuZCc7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcblxuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmFkZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVmFsaWRhdGUgYHN0YXRlLmNoaWxkcmVuYCAocmVxdWlyZWQpXG4gICAgICAgICAgICBpZiAoIShzdGF0ZS5jaGlsZHJlbiBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyB0aGlzLkVycm9yKCdFeHBlY3RlZCBgY2hpbGRyZW5gIHByb3BlcnR5IHRvIGJlIGFuIGFycmF5LicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSBgc3RhdGUub3BlcmF0b3JgIChpZiBnaXZlbilcbiAgICAgICAgICAgIGlmIChzdGF0ZS5vcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIGlmICghb3BlcmF0b3JzW3N0YXRlLm9wZXJhdG9yXSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgdGhpcy5FcnJvcignRXhwZWN0ZWQgYG9wZXJhdG9yYCBwcm9wZXJ0eSB0byBiZSBvbmUgb2Y6ICcgKyBPYmplY3Qua2V5cyhvcGVyYXRvcnMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLm9wZXJhdG9yID0gc3RhdGUub3BlcmF0b3I7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN0YXRlLmNoaWxkcmVuLmZvckVhY2godGhpcy5hZGQuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmFkaW9CdXR0b24gPSB0aGlzLmZpcnN0Q2hpbGRPZlR5cGUoJ2xhYmVsID4gaW5wdXRbdmFsdWU9JyArIHRoaXMub3BlcmF0b3IgKyAnXScpLFxuICAgICAgICAgICAgYWRkRmlsdGVyTGluayA9IHRoaXMuZWwucXVlcnlTZWxlY3RvcignLmZpbHRlci10cmVlLWFkZC1jb25kaXRpb25hbCcpO1xuXG4gICAgICAgIGlmIChyYWRpb0J1dHRvbikge1xuICAgICAgICAgICAgcmFkaW9CdXR0b24uY2hlY2tlZCA9IHRydWU7XG4gICAgICAgICAgICBvblRyZWVPcENsaWNrLmNhbGwodGhpcywge1xuICAgICAgICAgICAgICAgIHRhcmdldDogcmFkaW9CdXR0b25cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2hlbiBtdWx0aXBsZSBmaWx0ZXIgZWRpdG9ycyBhdmFpbGFibGUsIHNpbXVsYXRlIGNsaWNrIG9uIHRoZSBuZXcgXCJhZGQgY29uZGl0aW9uYWxcIiBsaW5rXG4gICAgICAgIGlmIChhZGRGaWx0ZXJMaW5rICYmICF0aGlzLmNoaWxkcmVuLmxlbmd0aCAmJiBPYmplY3Qua2V5cyh0aGlzLmVkaXRvcnMpLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHRoaXNbJ2ZpbHRlci10cmVlLWFkZC1jb25kaXRpb25hbCddKHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGFkZEZpbHRlckxpbmtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvY2VlZCB3aXRoIHJlbmRlclxuICAgICAgICBGaWx0ZXJOb2RlLnByb3RvdHlwZS5yZW5kZXIuY2FsbCh0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ3JlYXRlIGEgbmV3IG5vZGUgYXMgcGVyIGBzdGF0ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnM9e3N0YXRlOnt9fV0gLSBNYXkgYmUgb25lIG9mOlxuICAgICAqXG4gICAgICogKiBhbiBgb3B0aW9uc2Agb2JqZWN0IGNvbnRhaW5pbmcgYSBgc3RhdGVgIHByb3BlcnR5XG4gICAgICogKiBhIGBzdGF0ZWAgb2JqZWN0IChpbiB3aGljaCBjYXNlIHRoZXJlIGlzIG5vIGBvcHRpb25zYCBvYmplY3QpXG4gICAgICpcbiAgICAgKiBJbiBhbnkgY2FzZSwgcmVzdWx0aW5nIGBzdGF0ZWAgb2JqZWN0IG1heSBiZSBlaXRoZXIuLi5cbiAgICAgKiAqIEEgbmV3IHN1YnRyZWUgKGhhcyBhIGBjaGlsZHJlbmAgcHJvcGVydHkpOlxuICAgICAqICAgQWRkIGEgbmV3IGBGaWx0ZXJUcmVlYCBub2RlLlxuICAgICAqICogQSBuZXcgbGVhZiAobm8gYGNoaWxkcmVuYCBwcm9wZXJ0eSk6IGFkZCBhIG5ldyBgRmlsdGVyTGVhZmAgbm9kZTpcbiAgICAgKiAgICogSWYgdGhlcmUgaXMgYW4gYGVkaXRvcmAgcHJvcGVydHk6XG4gICAgICogICAgIEFkZCBsZWFmIHVzaW5nIGB0aGlzLmVkaXRvcnNbc3RhdGUuZWRpdG9yXWAuXG4gICAgICogICAqIE90aGVyd2lzZSAoaW5jbHVkaW5nIHRoZSBjYXNlIHdoZXJlIGBzdGF0ZWAgaXMgdW5kZWZpbmVkKTpcbiAgICAgKiAgICAgQWRkIGxlYWYgdXNpbmcgYHRoaXMuZWRpdG9ycy5EZWZhdWx0YC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZm9jdXM9ZmFsc2VdIENhbGwgaW52YWxpZCgpIGFmdGVyIGluc2VydGluZyB0byBmb2N1cyBvbiBmaXJzdCBibGFuayBjb250cm9sIChpZiBhbnkpLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlck5vZGV9IFRoZSBuZXcgbm9kZS5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIGFkZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgQ29uc3RydWN0b3IsIG5ld05vZGU7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnN0YXRlKSB7XG4gICAgICAgICAgICBvcHRpb25zID0geyBzdGF0ZTogb3B0aW9ucyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3RhdGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIENvbnN0cnVjdG9yID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIENvbnN0cnVjdG9yID0gdGhpcy5lZGl0b3JzW29wdGlvbnMuc3RhdGUuZWRpdG9yIHx8ICdEZWZhdWx0J107XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zLnBhcmVudCA9IHRoaXM7XG4gICAgICAgIG5ld05vZGUgPSBuZXcgQ29uc3RydWN0b3Iob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXdOb2RlKTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mb2N1cykge1xuICAgICAgICAgICAgLy8gZm9jdXMgb24gYmxhbmsgY29udHJvbCBhIGJlYXQgYWZ0ZXIgYWRkaW5nIGl0XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBuZXdOb2RlLmludmFsaWQob3B0aW9ucyk7IH0sIDc1MCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdFxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW3Rocm93PWZhbHNlXSAtIFRocm93IChkbyBub3QgY2F0Y2gpIGBGaWx0ZXJUcmVlRXJyb3Jgcy5cbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IFthbGVydD1mYWxzZV0gLSBBbm5vdW5jZSBlcnJvciB2aWEgd2luZG93LmFsZXJ0KCkgYmVmb3JlIHJldHVybmluZy5cbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IFtmb2N1cz1mYWxzZV0gLSBQbGFjZSB0aGUgZm9jdXMgb24gdGhlIG9mZmVuZGluZyBjb250cm9sIGFuZCBnaXZlIGl0IGVycm9yIGNvbG9yLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RmlsdGVyVHJlZUVycm9yfSBgdW5kZWZpbmVkYCBpZiB2YWxpZDsgb3IgdGhlIGNhdWdodCBgRmlsdGVyVHJlZUVycm9yYCBpZiBlcnJvci5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBpbnZhbGlkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgIHZhciByZXN1bHQsIHRocm93V2FzO1xuXG4gICAgICAgIHRocm93V2FzID0gb3B0aW9ucy50aHJvdztcbiAgICAgICAgb3B0aW9ucy50aHJvdyA9IHRydWU7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGludmFsaWQuY2FsbCh0aGlzLCBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBlcnI7XG5cbiAgICAgICAgICAgIC8vIFRocm93IHdoZW4gdW5leHBlY3RlZCAobm90IGEgZmlsdGVyIHRyZWUgZXJyb3IpXG4gICAgICAgICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiB0aGlzLkVycm9yKSkge1xuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMudGhyb3cgPSB0aHJvd1dhcztcblxuICAgICAgICAvLyBBbHRlciBhbmQvb3IgdGhyb3cgd2hlbiByZXF1ZXN0ZWRcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxlcnQpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cuYWxlcnQocmVzdWx0Lm1lc3NhZ2UgfHwgcmVzdWx0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudGhyb3cpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhUm93XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgdGVzdDogZnVuY3Rpb24gdGVzdChkYXRhUm93KSB7XG4gICAgICAgIHZhciBvcGVyYXRvciA9IG9wZXJhdG9yc1t0aGlzLm9wZXJhdG9yXSxcbiAgICAgICAgICAgIHJlc3VsdCA9IG9wZXJhdG9yLnNlZWQsXG4gICAgICAgICAgICBub0NoaWxkcmVuRGVmaW5lZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5maW5kKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICBub0NoaWxkcmVuRGVmaW5lZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEZpbHRlckxlYWYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gb3BlcmF0b3IucmVkdWNlKHJlc3VsdCwgY2hpbGQudGVzdChkYXRhUm93KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gb3BlcmF0b3IucmVkdWNlKHJlc3VsdCwgdGVzdC5jYWxsKGNoaWxkLCBkYXRhUm93KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQgPT09IG9wZXJhdG9yLmFib3J0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBub0NoaWxkcmVuRGVmaW5lZCB8fCAob3BlcmF0b3IubmVnYXRlID8gIXJlc3VsdCA6IHJlc3VsdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IE51bWJlciBvZiBmaWx0ZXJzICh0ZXJtaW5hbCBub2RlcykgZGVmaW5lZCBpbiB0aGlzIHN1YnRyZWUuXG4gICAgICovXG4gICAgZmlsdGVyQ291bnQ6IGZ1bmN0aW9uIGZpbHRlckNvdW50KCkge1xuICAgICAgICB2YXIgbiA9IDA7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBuICs9IGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZiA/IDEgOiBmaWx0ZXJDb3VudC5jYWxsKGNoaWxkKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIG47XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gICAgICpcbiAgICAgKiBAc3VtbWFyeSBPYmplY3QgY29udGFpbmluZyBvcHRpb25zIGZvciBwcm9kdWNpbmcgYSBzdGF0ZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAZGVzYyBTdGF0ZSBpcyBjb21tb25seSB1c2VkIGZvciB0d28gcHVycG9zZXM6XG4gICAgICogMS4gVG8gcGVyc2lzdCB0aGUgZmlsdGVyIHN0YXRlIHNvIHRoYXQgaXQgY2FuIGJlIHJlbG9hZGVkIGxhdGVyLlxuICAgICAqIDIuIFRvIHNlbmQgYSBxdWVyeSB0byBhIGRhdGFiYXNlIGVuZ2luZS5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW3N5bnRheD0nb2JqZWN0J10gLSBBIGNhc2Utc2Vuc2l0aXZlIHN0cmluZyBpbmRpY2F0aW5nIHRoZSBleHBlY3RlZCB0eXBlIGFuZCBmb3JtYXQgb2YgYSBzdGF0ZSBvYmplY3QgdG8gYmUgZ2VuZXJhdGVkIGZyb20gYSBmaWx0ZXIgdHJlZS4gT25lIG9mOlxuICAgICAqICogYCdvYmplY3QnYCAoZGVmYXVsdCkgQSByYXcgc3RhdGUgb2JqZWN0IHByb2R1Y2VkIGJ5IHdhbGtpbmcgdGhlIHRyZWUgdXNpbmcgYHtAbGluayBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS91bnN0cnVuZ2lmeXx1bnN0cnVuZ2lmeSgpfWAsIHJlc3BlY3RpbmcgYEpTT04uc3RyaW5naWZ5KClgJ3MgXCJ7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSlNPTi9zdHJpbmdpZnkjdG9KU09OKClfYmVoYXZpb3J8dG9KU09OKCkgYmVoYXZpb3J9LFwiIGFuZCByZXR1cm5pbmcgYSBwbGFpbiBvYmplY3Qgc3VpdGFibGUgZm9yIHJlc3VibWl0dGluZyB0byB7QGxpbmsgRmlsdGVyTm9kZSNzZXRTdGF0ZXxzZXRTdGF0ZX0uIFRoaXMgaXMgYW4gXCJlc3NlbnRpYWxcIiB2ZXJzaW9uIG9mIHRoZSBhY3R1YWwgbm9kZSBvYmplY3RzIGluIHRoZSB0cmVlLlxuICAgICAqICogYCdKU09OJ2AgLSBBIHN0cmluZ2lmaWVkIHN0YXRlIG9iamVjdCBwcm9kdWNlZCBieSB3YWxraW5nIHRoZSB0cmVlIHVzaW5nIGB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSlNPTi9zdHJpbmdpZnkjdG9KU09OKClfYmVoYXZpb3J8SlNPTi5zdHJpbmdpZnkoKX1gLCByZXR1cm5pbmcgYSBKU09OIHN0cmluZyBieSBjYWxsaW5nIGB0b0pTT05gIGF0IGV2ZXJ5IG5vZGUuIFRoaXMgaXMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIHNhbWUgXCJlc3NlbnRpYWxcIiBvYmplY3QgYXMgdGhhdCBwcm9kdWNlZCBieSB0aGUgYCdvYmplY3QnYCBvcHRpb24sIGJ1dCBcInN0cmluZ2lmaWVkXCIgYW5kIHRoZXJlZm9yZSBzdWl0YWJsZSBmb3IgdGV4dC1iYXNlZCBzdG9yYWdlIG1lZGlhLlxuICAgICAqICogYCdTUUwnYCAtIFRoZSBzdWJleHByZXNzaW9uIGluIFNRTCBjb25kaXRpb25hbCBzeW50YXggcHJvZHVjZWQgYnkgd2Fsa2luZyB0aGUgdHJlZSBhbmQgcmV0dXJuaW5nIGEgU1FMIFtzZWFyY2ggY29uZGl0aW9uIGV4cHJlc3Npb25de0BsaW5rIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxNzM1NDUuYXNweH0uIFN1aXRhYmxlIGZvciB1c2UgaW4gdGhlIFdIRVJFIGNsYXVzZSBvZiBhIFNRTCBgU0VMRUNUYCBzdGF0ZW1lbnQgdXNlZCB0byBxdWVyeSBhIGRhdGFiYXNlIGZvciBhIGZpbHRlcmVkIHJlc3VsdCBzZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IFtzcGFjZV0gLSBXaGVuIGBvcHRpb25zLnN5bnRheCA9PT0gJ0pTT04nYCwgZm9yd2FyZGVkIHRvIGBKU09OLnN0cmluZ2lmeWAgYXMgdGhlIHRoaXJkIHBhcmFtZXRlciwgYHNwYWNlYCAoc2VlKS5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoZSBTUUwgc3ludGF4IHJlc3VsdCBjYW5ub3QgYWNjb21tb2RhdGUgbm9kZSBtZXRhLWRhdGEuIFdoaWxlIG1ldGEtZGF0YSBzdWNoIGFzIGB0eXBlYCB0eXBpY2FsbHkgY29tZXMgZnJvbSB0aGUgY29sdW1uIHNjaGVtYSwgbWV0YS1kYXRhIGNhbiBiZSBpbnN0YWxsZWQgZGlyZWN0bHkgb24gYSBub2RlLiBTdWNoIG1ldGEtZGF0YSB3aWxsIG5vdCBiZSBwYXJ0IG9mIHRoZSByZXN1bHRpbmcgU1FMIGV4cHJlc3Npb24uIEZvciB0aGlzIHJlYXNvbiwgU1FMIHNob3VsZCBub3QgYmUgdXNlZCB0byBwZXJzaXN0IGZpbHRlciBzdGF0ZSBidXQgcmF0aGVyIGl0cyB1c2Ugc2hvdWxkIGJlIGxpbWl0ZWQgdG8gZ2VuZXJhdGluZyBhIGZpbHRlciBxdWVyeSBmb3IgYSByZW1vdGUgZGF0YSBzZXJ2ZXIuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSByZXByZXNlbnRhdGlvbiBvZiBmaWx0ZXIgc3RhdGUuXG4gICAgICogQGRlc2MgQ2FsbGluZyB0aGlzIG9uIHRoZSByb290IHdpbGwgZ2V0IHRoZSBlbnRpcmUgdHJlZSdzIHN0YXRlOyBjYWxsaW5nIHRoaXMgb24gYW55IHN1YnRyZWUgd2lsbCBnZXQganVzdCB0aGF0IHN1YnRyZWUncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIE9ubHkgX2Vzc2VudGlhbF8gcHJvcGVydGllcyB3aWxsIGJlIG91dHB1dDpcbiAgICAgKlxuICAgICAqIDEuIGBGaWx0ZXJUcmVlYCBub2RlcyB3aWxsIG91dHB1dCBhdCBsZWFzdCAyIHByb3BlcnRpZXM6XG4gICAgICogICAgKiBgb3BlcmF0b3JgXG4gICAgICogICAgKiBgY2hpbGRyZW5gXG4gICAgICogMi4gYEZpbHRlckxlYWZgIG5vZGVzIHdpbGwgb3V0cHV0ICh2aWEge0BsaW5rIEZpbHRlckxlYWYjZ2V0U3RhdGV8Z2V0U3RhdGV9KSBhdCBsZWFzdCAzIHByb3BlcnRpZXMsIG9uZSBwcm9wZXJ0eSBmb3IgZWFjaCBpdGVtIGluIGl0J3MgYHZpZXdgOlxuICAgICAqICAgICogYGNvbHVtbmBcbiAgICAgKiAgICAqIGBvcGVyYXRvcmBcbiAgICAgKiAgICAqIGBvcGVyYW5kYFxuICAgICAqIDMuIEFkZGl0aW9uYWwgbm9kZSBwcm9wZXJ0aWVzIHdpbGwgYmUgb3V0cHV0IHdoZW46XG4gICAgICogICAgMS4gV2hlbiB0aGUgcHJvcGVydHkgd2FzICoqTk9UKiogZXh0ZXJuYWxseSBzb3VyY2VkOlxuICAgICAqICAgICAgIDEuIERpZCAqbm90KiBjb21lIGZyb20gdGhlIGBvcHRpb25zYCBvYmplY3Qgb24gbm9kZSBpbnN0YW50aWF0aW9uLlxuICAgICAqICAgICAgIDIuIERpZCAqbm90KiBjb21lIGZyb20gdGhlIG9wdGlvbnMgc2NoZW1hIGBkZWZhdWx0YCBvYmplY3QsIGlmIGFueS5cbiAgICAgKiAgICAyLiAqKkFORCoqIGF0IGxlYXN0IG9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIHRydWU6XG4gICAgICogICAgICAgMS4gV2hlbiBpdCdzIGFuIFwib3duXCIgcHJvcGVydHkuXG4gICAgICogICAgICAgMi4gV2hlbiBpdHMgdmFsdWUgZGlmZmVycyBmcm9tIGl0J3MgcGFyZW50J3MuXG4gICAgICogICAgICAgMy4gV2hlbiB0aGlzIGlzIHRoZSByb290IG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5zcWxJZFF0c10gLSBXaGVuIGBvcHRpb25zLnN5bnRheCA9PT0gJ1NRTCdgLCBmb3J3YXJkZWQgdG8gYGNvbmRpdGlvbmFscy5wdXNoU3FsSWRRdHMoKWAuXG4gICAgICogQHJldHVybnMge29iamVjdHxzdHJpbmd9IFJldHVybnMgb2JqZWN0IHdoZW4gYG9wdGlvbnMuc3ludGF4ID09PSAnb2JqZWN0J2A7IG90aGVyd2lzZSByZXR1cm5zIHN0cmluZy5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4IHx8ICdvYmplY3QnO1xuXG4gICAgICAgIHN3aXRjaCAoc3ludGF4KSB7XG4gICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHVuc3RydW5naWZ5LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ0pTT04nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIG9wdGlvbnMgJiYgb3B0aW9ucy5zcGFjZSkgfHwgJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ1NRTCc6XG4gICAgICAgICAgICAgICAgdmFyIGxleGVtZSA9IG9wZXJhdG9yc1t0aGlzLm9wZXJhdG9yXS5TUUw7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQsIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3AgPSBpZHggPyAnICcgKyBsZXhlbWUub3AgKyAnICcgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IG9wICsgY2hpbGQuZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gb3AgKyBnZXRTdGF0ZS5jYWxsKGNoaWxkLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBsZXhlbWUuYmVnICsgcmVzdWx0ICsgbGV4ZW1lLmVuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuRXJyb3IoJ1Vua25vd24gc3ludGF4IG9wdGlvbiBcIicgKyBzeW50YXggKyAnXCInKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHRvSlNPTjogZnVuY3Rpb24gdG9KU09OKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogdGhpcy5vcGVyYXRvcixcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBzdGF0ZS5jaGlsZHJlbi5wdXNoKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZiA/IGNoaWxkIDogdG9KU09OLmNhbGwoY2hpbGQpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXyhGaWx0ZXJOb2RlLm9wdGlvbnNTY2hlbWEpLmVhY2goZnVuY3Rpb24ob3B0aW9uU2NoZW1hLCBrZXkpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBzZWxmW2tleV0gJiYgLy8gdGhlcmUgaXMgYSBzdGFuZGFyZCBvcHRpb24gb24gdGhlIG5vZGUgd2hpY2ggbWF5IG5lZWQgdG8gYmUgb3V0cHV0XG4gICAgICAgICAgICAgICAgIXNlbGYuZG9udFBlcnNpc3Rba2V5XSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvblNjaGVtYS5vd24gfHwgLy8gb3V0cHV0IGJlY2F1c2UgaXQncyBhbiBcIm93blwiIG9wdGlvbiAoYmVsb25ncyB0byB0aGUgbm9kZSlcbiAgICAgICAgICAgICAgICAgICAgIXNlbGYucGFyZW50IHx8IC8vIG91dHB1dCBiZWNhdXNlIGl0J3MgdGhlIHJvb3Qgbm9kZVxuICAgICAgICAgICAgICAgICAgICBzZWxmW2tleV0gIT09IHNlbGYucGFyZW50W2tleV0gLy8gb3V0cHV0IGJlY2F1c2UgaXQgZGlmZmVycyBmcm9tIGl0cyBwYXJlbnQncyB2ZXJzaW9uXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGVba2V5XSA9IHNlbGZba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgdGhlIGNhc2Ugc2Vuc2l0aXZpdHkgb2YgZmlsdGVyIHRlc3RzIGFnYWluc3QgZGF0YS5cbiAgICAgKiBAZGVzYyBDYXNlIHNlbnNpdGl2aXR5IHBlcnRhaW5zIHRvIHN0cmluZyBjb21wYXJlcyBvbmx5LiBUaGlzIGluY2x1ZGVzIHVudHlwZWQgY29sdW1ucywgY29sdW1ucyB0eXBlZCBhcyBzdHJpbmdzLCB0eXBlZCBjb2x1bW5zIGNvbnRhaW5pbmcgZGF0YSB0aGF0IGNhbm5vdCBiZSBjb2VyY2VkIHRvIHR5cGUgb3Igd2hlbiB0aGUgZmlsdGVyIGV4cHJlc3Npb24gb3BlcmFuZCBjYW5ub3QgYmUgY29lcmNlZC5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoaXMgaXMgYSBzaGFyZWQgcHJvcGVydHkgYW5kIGFmZmVjdHMgYWxsIGZpbHRlci10cmVlIGluc3RhbmNlcyBjb25zdHJ1Y3RlZCBieSB0aGlzIGNvZGUgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc1NlbnNpdGl2ZVxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJ0cmVlIy5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXQgY2FzZVNlbnNpdGl2ZURhdGEoaXNTZW5zaXRpdmUpIHtcbiAgICAgICAgdmFyIHRvU3RyaW5nID0gaXNTZW5zaXRpdmUgPyB0b1N0cmluZ0Nhc2VTZW5zaXRpdmUgOiB0b1N0cmluZ0Nhc2VJbnNlbnNpdGl2ZTtcbiAgICAgICAgRmlsdGVyTGVhZi5zZXRUb1N0cmluZyh0b1N0cmluZyk7XG4gICAgfVxuXG59KTtcblxuZnVuY3Rpb24gdG9TdHJpbmdDYXNlSW5zZW5zaXRpdmUocykgeyByZXR1cm4gKHMgKyAnJykudG9VcHBlckNhc2UoKTsgfVxuZnVuY3Rpb24gdG9TdHJpbmdDYXNlU2Vuc2l0aXZlKHMpIHsgcmV0dXJuIHMgKyAnJzsgfVxuXG4vLyBTb21lIGV2ZW50IGhhbmRsZXJzIGJvdW5kIHRvIEZpbHRlclRyZWUgb2JqZWN0XG5cbmZ1bmN0aW9uIG9uY2hhbmdlKGV2dCkgeyAvLyBjYWxsZWQgaW4gY29udGV4dFxuICAgIHZhciBjdHJsID0gZXZ0LnRhcmdldDtcbiAgICBpZiAoY3RybC5wYXJlbnRFbGVtZW50ID09PSB0aGlzLmVsKSB7XG4gICAgICAgIGlmIChjdHJsLnZhbHVlID09PSAnc3ViZXhwJykge1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ldyBGaWx0ZXJUcmVlKHtcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHRoaXNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkKHtcbiAgICAgICAgICAgICAgICBzdGF0ZTogeyBlZGl0b3I6IGN0cmwudmFsdWUgfSxcbiAgICAgICAgICAgICAgICBmb2N1czogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY3RybC5zZWxlY3RlZEluZGV4ID0gMDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uVHJlZU9wQ2xpY2soZXZ0KSB7IC8vIGNhbGxlZCBpbiBjb250ZXh0XG4gICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0O1xuXG4gICAgaWYgKGN0cmwuY2xhc3NOYW1lID09PSAnZmlsdGVyLXRyZWUtb3AtY2hvaWNlJykge1xuICAgICAgICB0aGlzLm9wZXJhdG9yID0gY3RybC52YWx1ZTtcblxuICAgICAgICAvLyBkaXNwbGF5IHN0cmlrZS10aHJvdWdoXG4gICAgICAgIHZhciByYWRpb0J1dHRvbnMgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ2xhYmVsPmlucHV0LmZpbHRlci10cmVlLW9wLWNob2ljZVtuYW1lPScgKyBjdHJsLm5hbWUgKyAnXScpO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHJhZGlvQnV0dG9ucywgZnVuY3Rpb24oY3RybCkge1xuICAgICAgICAgICAgY3RybC5wYXJlbnRFbGVtZW50LnN0eWxlLnRleHREZWNvcmF0aW9uID0gY3RybC5jaGVja2VkID8gJ25vbmUnIDogJ2xpbmUtdGhyb3VnaCc7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGRpc3BsYXkgb3BlcmF0b3IgYmV0d2VlbiBmaWx0ZXJzIGJ5IGFkZGluZyBvcGVyYXRvciBzdHJpbmcgYXMgYSBDU1MgY2xhc3Mgb2YgdGhpcyB0cmVlXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvcGVyYXRvcnMpIHtcbiAgICAgICAgICAgIHRoaXMuZWwuY2xhc3NMaXN0LnJlbW92ZShrZXkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCh0aGlzLm9wZXJhdG9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogVGhyb3dzIGVycm9yIGlmIGludmFsaWQgZXhwcmVzc2lvbiB0cmVlLlxuICogQ2F1Z2h0IGJ5IHtAbGluayBGaWx0ZXJUcmVlI2ludmFsaWR8RmlsdGVyVHJlZS5wcm90b3R5cGUuaW52YWxpZCgpfS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZm9jdXM9ZmFsc2VdIC0gTW92ZSBmb2N1cyB0byBvZmZlbmRpbmcgY29udHJvbC5cbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9IGlmIHZhbGlkXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBpbnZhbGlkKG9wdGlvbnMpIHsgLy8gY2FsbGVkIGluIGNvbnRleHRcbiAgICAvL2lmICh0aGlzIGluc3RhbmNlb2YgRmlsdGVyVHJlZSAmJiAhdGhpcy5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAvLyAgICB0aHJvdyBuZXcgdGhpcy5FcnJvcignRW1wdHkgc3ViZXhwcmVzc2lvbiAobm8gZmlsdGVycykuJyk7XG4gICAgLy99XG5cbiAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgY2hpbGQuaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGludmFsaWQuY2FsbChjaGlsZCwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuRmlsdGVyVHJlZS5leHRlbnNpb25zID0ge1xuICAgIENvbHVtbnM6IHJlcXVpcmUoJy4vZXh0ZW5zaW9ucy9jb2x1bW5zJylcbn07XG5cbi8vIG1vZHVsZSBpbml0aWFsaXphdGlvblxuRmlsdGVyVHJlZS5wcm90b3R5cGUuY2FzZVNlbnNpdGl2ZURhdGEgPSB0cnVlOyAgLy8gZGVmYXVsdCBpcyBjYXNlLXNlbnNpdGl2ZSB3aGljaCBpcyBtb3JlIGVmZmljaWVudDsgbWF5IGJlIHJlc2V0IGF0IHdpbGxcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlclRyZWU7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGVtcGxleCA9IHJlcXVpcmUoJ3RlbXBsZXgnKTtcblxudmFyIHRlbXBsYXRlcyA9IHJlcXVpcmUoJy4uL2h0bWwnKTtcblxudmFyIGVuY29kZXJzID0gL1xceyhcXGQrKVxcOmVuY29kZVxcfS9nO1xuXG5mdW5jdGlvbiBUZW1wbGF0ZXMoKSB7fVxudmFyIGNvbnN0cnVjdG9yID0gVGVtcGxhdGVzLnByb3RvdHlwZS5jb25zdHJ1Y3RvcjtcblRlbXBsYXRlcy5wcm90b3R5cGUgPSB0ZW1wbGF0ZXM7XG5UZW1wbGF0ZXMucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7IC8vIHJlc3RvcmUgaXRcblRlbXBsYXRlcy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24odGVtcGxhdGVOYW1lKSB7IC8vIG1peCBpdCBpblxuICAgIHZhciBrZXlzLFxuICAgICAgICBtYXRjaGVzID0ge30sXG4gICAgICAgIHRlbXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgICAgdGV4dCA9IHRoaXNbdGVtcGxhdGVOYW1lXSxcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBlbmNvZGVycy5sYXN0SW5kZXggPSAwO1xuXG4gICAgd2hpbGUgKChrZXlzID0gZW5jb2RlcnMuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgbWF0Y2hlc1trZXlzWzFdXSA9IHRydWU7XG4gICAgfVxuXG4gICAga2V5cyA9IE9iamVjdC5rZXlzKG1hdGNoZXMpO1xuXG4gICAgaWYgKGtleXMubGVuZ3RoKSB7XG4gICAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHRlbXAudGV4dENvbnRlbnQgPSBhcmdzW2tleV07XG4gICAgICAgICAgICBhcmdzW2tleV0gPSB0ZW1wLmlubmVySFRNTDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoZW5jb2RlcnMsICd7JDF9Jyk7XG4gICAgfVxuXG4gICAgdGVtcC5pbm5lckhUTUwgPSB0ZW1wbGV4LmFwcGx5KHRoaXMsIFt0ZXh0XS5jb25jYXQoYXJncykpO1xuXG4gICAgLy8gaWYgb25seSBvbmUgSFRNTEVsZW1lbnQsIHJldHVybiBpdDsgb3RoZXJ3aXNlIGVudGlyZSBsaXN0IG9mIG5vZGVzXG4gICAgcmV0dXJuIHRlbXAuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggPT09IDFcbiAgICAgICAgPyB0ZW1wLmZpcnN0Q2hpbGRcbiAgICAgICAgOiB0ZW1wLmNoaWxkTm9kZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIENvbmRpdGlvbmFscyA9IHJlcXVpcmUoJy4uL0NvbmRpdGlvbmFscycpO1xudmFyIEZpbHRlckxlYWYgPSByZXF1aXJlKCcuLi9GaWx0ZXJMZWFmJyk7XG5cbi8qKlxuICogQHN1bW1hcnkgUHJvdG90eXBlIGFkZGl0aW9ucyBvYmplY3QgZm9yIGV4dGVuZGluZyB7QGxpbmsgRmlsdGVyTGVhZn0uXG4gKiBAZGVzYyBSZXN1bHRpbmcgb2JqZWN0IGlzIHNpbWlsYXIgdG8ge0BsaW5rIEZpbHRlckxlYWZ9IGV4Y2VwdDpcbiAqIDEuIFRoZSBgb3BlcmFuZGAgcHJvcGVydHkgbmFtZXMgYW5vdGhlciBjb2x1bW4gcmF0aGVyIHRoYW4gY29udGFpbnMgYSBsaXRlcmFsLlxuICogMi4gT3BlcmF0b3JzIGFyZSBsaW1pdGVkIHRvIGVxdWFsaXR5LCBpbmVxdWFsaXRpZXMsIGFuZCBzZXRzIChJTi9OT1QgSU4pLiBPbWl0dGVkIGFyZSB0aGUgc3RyaW5nIGFuZCBwYXR0ZXJuIHNjYW5zIChCRUdJTlMvTk9UIEJFR0lOUywgRU5EUy9OT1QgRU5EUywgQ09OVEFJTlMvTk9UIENPTlRBSU5TLCBhbmQgTElLRS9OT1QgTElLRSkuXG4gKlxuICogQGV4dGVuZHMgRmlsdGVyTGVhZlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpZGVudGlmaWVyIC0gTmFtZSBvZiBjb2x1bW4gKG1lbWJlciBvZiBkYXRhIHJvdyBvYmplY3QpIHRvIGNvbXBhcmUgYWdhaW5zdCB0aGlzIGNvbHVtbiAobWVtYmVyIG9mIGRhdGEgcm93IG9iamVjdCBuYW1lZCBieSBgY29sdW1uYCkuXG4gKi9cbnZhciBDb2x1bW5MZWFmID0ge1xuICAgIG5hbWU6ICdjb2x1bW4gPSBjb2x1bW4nLCAvLyBkaXNwbGF5IHN0cmluZyBmb3IgZHJvcC1kb3duXG5cbiAgICBjcmVhdGVWaWV3OiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBgdmlld2AgaGFzaCBhbmQgaW5zZXJ0IHRoZSB0aHJlZSBkZWZhdWx0IGVsZW1lbnRzIChgY29sdW1uYCwgYG9wZXJhdG9yYCwgYG9wZXJhbmRgKSBpbnRvIGAuZWxgXG4gICAgICAgIEZpbHRlckxlYWYucHJvdG90eXBlLmNyZWF0ZVZpZXcuY2FsbCh0aGlzKTtcblxuICAgICAgICAvLyBSZXBsYWNlIHRoZSBgb3BlcmFuZGAgZWxlbWVudCBmcm9tIHRoZSBgdmlld2AgaGFzaFxuICAgICAgICB2YXIgb2xkT3BlcmFuZCA9IHRoaXMudmlldy5vcGVyYW5kLFxuICAgICAgICAgICAgbmV3T3BlcmFuZCA9IHRoaXMudmlldy5vcGVyYW5kID0gdGhpcy5tYWtlRWxlbWVudCh0aGlzLnJvb3Quc2NoZW1hLCAnY29sdW1uJywgdGhpcy5zb3J0Q29sdW1uTWVudSk7XG5cbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgb3BlcmFuZCBlbGVtZW50IHdpdGggdGhlIG5ldyBvbmUuIFRoZXJlIGFyZSBubyBldmVudCBsaXN0ZW5lcnMgdG8gd29ycnkgYWJvdXQuXG4gICAgICAgIHRoaXMuZWwucmVwbGFjZUNoaWxkKG5ld09wZXJhbmQsIG9sZE9wZXJhbmQpO1xuICAgIH0sXG5cbiAgICBtYWtlU3FsT3BlcmFuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm1ha2VTcWxJZGVudGlmaWVyKHRoaXMub3BlcmFuZCk7XG4gICAgfSxcblxuICAgIG9wTWVudTogW1xuICAgICAgICBDb25kaXRpb25hbHMuZ3JvdXBzLmVxdWFsaXR5LFxuICAgICAgICBDb25kaXRpb25hbHMuZ3JvdXBzLmluZXF1YWxpdGllcyxcbiAgICAgICAgQ29uZGl0aW9uYWxzLmdyb3Vwcy5zZXRzXG4gICAgXSxcblxuICAgIHE6IGZ1bmN0aW9uKGRhdGFSb3cpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsT3JGdW5jLmNhbGwoZGF0YVJvdywgdGhpcy5vcGVyYW5kKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbHVtbkxlYWY7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByZU9wID0gL14oKD18Pj0/fDxbPj1dPyl8KE5PVCApPyhMSUtFfElOKVxcYikvaSwgLy8gbWF0Y2hbMV1cbiAgICByZUZsb2F0ID0gL14oWystXT8oXFxkKyhcXC5cXGQqKT98XFxkKlxcLlxcZCspKGVbKy1dXFxkKyk/KVteXFxkXT8vaSxcbiAgICByZUxpdCA9IC9eJyhcXGQrKScvLFxuICAgIHJlTGl0QW55d2hlcmUgPSAvJyhcXGQrKScvLFxuICAgIHJlSW4gPSAvXlxcKCguKj8pXFwpLyxcbiAgICByZUJvb2wgPSAvXihBTkR8T1IpXFxiL2ksXG4gICAgcmVHcm91cCA9IC9eKE5PVCA/KT9cXCgvaTtcblxudmFyIFNRVCA9ICdcXCcnO1xuXG52YXIgZGVmYXVsdElkUXRzID0ge1xuICAgIGJlZzogJ1wiJyxcbiAgICBlbmQ6ICdcIidcbn07XG5cbmZ1bmN0aW9uIFBhcnNlclNxbEVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuUGFyc2VyU3FsRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuUGFyc2VyU3FsRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnUGFyc2VyU3FsRXJyb3InO1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gc3FsSWRRdHNPYmplY3RcbiAqIEBkZXNjIE9uIGEgcHJhY3RpY2FsIGxldmVsLCB0aGUgdXNlZnVsIGNoYXJhY3RlcnMgYXJlOlxuICogKiBTUUwtOTIgc3RhbmRhcmQ6IFwiZG91YmxlIHF1b3Rlc1wiXG4gKiAqIFNRTCBTZXJ2ZXI6IFwiZG91YmxlIHF1b3Rlc1wiIG9yIFxcW3NxdWFyZSBicmFja2V0c1xcXVxuICogKiBteVNRTDogXFxgdGljayBtYXJrc1xcYFxuICogQHByb3BlcnR5IHtzdHJpbmd9IGJlZyAtIFRoZSBvcGVuIHF1b3RlIGNoYXJhY3Rlci5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbmQgLSBUaGUgY2xvc2UgcXVvdGUgY2hhcmFjdGVyLlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBTdHJ1Y3R1cmVkIFF1ZXJ5IExhbmd1YWdlIChTUUwpIHBhcnNlclxuICogQGF1dGhvciBKb25hdGhhbiBFaXRlbiA8am9uYXRoYW5Ab3BlbmZpbi5jb20+XG4gKiBAZGVzYyBUaGlzIGlzIGEgc3Vic2V0IG9mIFNRTCBjb25kaXRpb25hbCBleHByZXNzaW9uIHN5bnRheC5cbiAqXG4gKiBAc2VlIHtAbGluayBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L21zMTczNTQ1LmFzcHggU1FMIFNlYXJjaCBDb25kaXRpb259XG4gKlxuICogQHBhcmFtIHttZW51SXRlbVtdfSBbb3B0aW9ucy5zY2hlbWFdIC0gQ29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIG5hbWUgdmFsaWRhdGlvbi4gVGhyb3dzIGFuIGVycm9yIGlmIG5hbWUgZmFpbHMgdmFsaWRhdGlvbiAoYnV0IHNlZSBgcmVzb2x2ZUFsaWFzZXNgKS4gT21pdCB0byBza2lwIGNvbHVtbiBuYW1lIHZhbGlkYXRpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlc29sdmVBbGlhc2VzXSAtIFZhbGlkYXRlIGNvbHVtbiBhbGlhc2VzIGFnYWluc3Qgc2NoZW1hIGFuZCB1c2UgdGhlIGFzc29jaWF0ZWQgY29sdW1uIG5hbWUgaW4gdGhlIHJldHVybmVkIGV4cHJlc3Npb24gc3RhdGUgb2JqZWN0LiBSZXF1aXJlcyBgb3B0aW9ucy5zY2hlbWFgLiBUaHJvd3MgZXJyb3IgaWYgbm8gc3VjaCBjb2x1bW4gZm91bmQuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lc10gLSBJZ25vcmUgY2FzZSB3aGlsZSB2YWxpZGF0aW5nIGNvbHVtbiBuYW1lcyBhbmQgYWxpYXNlcy5cbiAqIEBwYXJhbSB7c3FsSWRRdHNPYmplY3R9IFtvcHRpb25zLnNxbElkUXRzPXtiZWc6J1wiJyxlbmQ6J1wiJ31dXG4gKi9cbmZ1bmN0aW9uIFBhcnNlclNRTChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICB0aGlzLnNjaGVtYSA9IG9wdGlvbnMuc2NoZW1hO1xuXG4gICAgdmFyIGlkUXRzID0gb3B0aW9ucy5zcWxJZFF0cyB8fCBkZWZhdWx0SWRRdHM7XG4gICAgdGhpcy5yZU5hbWUgPSBuZXcgUmVnRXhwKCdeKCcgKyBpZFF0cy5iZWcgKyAnKC4rPyknICsgaWRRdHMuZW5kICsgJ3woW0EtWl9dW0EtWl9AXFxcXCQjXSopXFxcXGIpJywgJ2knKTsgLy8gbWF0Y2hbMl0gfHwgbWF0Y2hbM11cbn1cblxuUGFyc2VyU1FMLnByb3RvdHlwZSA9IHtcblxuICAgIGNvbnN0cnVjdG9yOiBQYXJzZXJTUUwucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNxbFxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqIEBtZW1iZXJPZiBtb2R1bGU6c3FsU2VhcmNoQ29uZGl0aW9uXG4gICAgICovXG4gICAgcGFyc2U6IGZ1bmN0aW9uKHNxbCkge1xuICAgICAgICB2YXIgc3RhdGU7XG5cbiAgICAgICAgLy8gcmVkdWNlIGFsbCBydW5zIG9mIHdoaXRlIHNwYWNlIHRvIGEgc2luZ2xlIHNwYWNlOyB0aGVuIHRyaW1cbiAgICAgICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcc1xccysvZywgJyAnKS50cmltKCk7XG5cbiAgICAgICAgc3FsID0gc3RyaXBMaXRlcmFscy5jYWxsKHRoaXMsIHNxbCk7XG4gICAgICAgIHN0YXRlID0gd2Fsay5jYWxsKHRoaXMsIHNxbCk7XG5cbiAgICAgICAgaWYgKCFzdGF0ZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgc3RhdGUgPSB7IGNoaWxkcmVuOiBbIHN0YXRlIF0gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB3YWxrKHQpIHtcbiAgICB2YXIgbSwgbmFtZSwgb3AsIG9wZXJhbmQsIGVkaXRvciwgYm9vbCwgdG9rZW4sIHRva2VucyA9IFtdO1xuICAgIHZhciBpID0gMDtcblxuICAgIHQgPSB0LnRyaW0oKTtcblxuICAgIHdoaWxlIChpIDwgdC5sZW5ndGgpIHtcbiAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlR3JvdXApO1xuICAgICAgICBpZiAobSkge1xuICAgICAgICAgICAgdmFyIG5vdCA9ICEhbVsxXTtcblxuICAgICAgICAgICAgaSArPSBtWzBdLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSBpLCB2ID0gMTsgaiA8IHQubGVuZ3RoICYmIHY7ICsraikge1xuICAgICAgICAgICAgICAgIGlmICh0W2pdID09PSAnKCcpIHtcbiAgICAgICAgICAgICAgICAgICAgKyt2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodFtqXSA9PT0gJyknKSB7XG4gICAgICAgICAgICAgICAgICAgIC0tdjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBcIilcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB3YWxrLmNhbGwodGhpcywgdC5zdWJzdHIoaSwgaiAtIDEgLSBpKSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRva2VuICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vdCkge1xuICAgICAgICAgICAgICAgIGlmICh0b2tlbi5vcGVyYXRvciAhPT0gJ29wLW9yJykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIE9SIGluIE5PVCguLi4pIHN1YmV4cHJlc3Npb24gYnV0IGZvdW5kICcgKyB0b2tlbi5vcGVyYXRvci5zdWJzdHIoMykudG9VcHBlckNhc2UoKSArICcuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRva2VuLm9wZXJhdG9yID0gJ29wLW5vcic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGkgPSBqO1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBjb2x1bW46XG5cbiAgICAgICAgICAgIG0gPSB0LnN1YnN0cihpKS5tYXRjaCh0aGlzLnJlTmFtZSk7XG4gICAgICAgICAgICBpZiAoIW0pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIGlkZW50aWZpZXIgb3IgcXVvdGVkIGlkZW50aWZpZXIuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuYW1lID0gbVsyXSB8fCBtWzNdO1xuICAgICAgICAgICAgaWYgKCEvXltBLVpfXS9pLnRlc3QodFtpXSkpIHsgaSArPSAyOyB9XG4gICAgICAgICAgICBpICs9IG5hbWUubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBvcGVyYXRvcjpcblxuICAgICAgICAgICAgaWYgKHRbaV0gPT09ICcgJykgeyArK2k7IH1cbiAgICAgICAgICAgIG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZU9wKTtcbiAgICAgICAgICAgIGlmICghbSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgcmVsYXRpb25hbCBvcGVyYXRvci4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9wID0gbVsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgaSArPSBvcC5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIG9wZXJhbmQ6XG5cbiAgICAgICAgICAgIGVkaXRvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICh0W2ldID09PSAnICcpIHsgKytpOyB9XG4gICAgICAgICAgICBpZiAobVs0XSAmJiBtWzRdLnRvVXBwZXJDYXNlKCkgPT09ICdJTicpIHtcbiAgICAgICAgICAgICAgICBtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVJbik7XG4gICAgICAgICAgICAgICAgaWYgKCFtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgcGFyZW50aGVzaXplZCBsaXN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbVsxXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoICsgMjtcbiAgICAgICAgICAgICAgICB3aGlsZSAoKG0gPSBvcGVyYW5kLm1hdGNoKHJlTGl0QW55d2hlcmUpKSkge1xuICAgICAgICAgICAgICAgICAgICBvcGVyYW5kID0gb3BlcmFuZC5yZXBsYWNlKHJlTGl0QW55d2hlcmUsIHRoaXMubGl0ZXJhbHNbbVsxXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZUxpdCkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMV07XG4gICAgICAgICAgICAgICAgaSArPSBvcGVyYW5kLmxlbmd0aCArIDI7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IHRoaXMubGl0ZXJhbHNbb3BlcmFuZF07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKChtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVGbG9hdCkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMV07XG4gICAgICAgICAgICAgICAgaSArPSBvcGVyYW5kLmxlbmd0aDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKG0gPSB0LnN1YnN0cihpKS5tYXRjaCh0aGlzLnJlTmFtZSkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMl0gfHwgbVszXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGVkaXRvciA9ICdDb2x1bW5zJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBudW1iZXIgb3Igc3RyaW5nIGxpdGVyYWwgb3IgY29sdW1uLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEpIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gbG9va3VwLmNhbGwodGhpcywgbmFtZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wZXJhbmQgPSBsb29rdXAuY2FsbCh0aGlzLCBvcGVyYW5kKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRva2VuID0ge1xuICAgICAgICAgICAgICAgIGNvbHVtbjogbmFtZSxcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogb3AsXG4gICAgICAgICAgICAgICAgb3BlcmFuZDogb3BlcmFuZFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGVkaXRvcikge1xuICAgICAgICAgICAgICAgIHRva2VuLmVkaXRvciA9IGVkaXRvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgICBpZiAoaSA8IHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAodFtpXSA9PT0gJyAnKSB7ICsraTsgfVxuICAgICAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlQm9vbCk7XG4gICAgICAgICAgICBpZiAoIW0pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIGJvb2xlYW4gb3BlcmF0b3IuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib29sID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaSArPSBib29sLmxlbmd0aDtcbiAgICAgICAgICAgIGJvb2wgPSAnb3AtJyArIGJvb2w7XG4gICAgICAgICAgICBpZiAodG9rZW5zLm9wZXJhdG9yICYmIHRva2Vucy5vcGVyYXRvciAhPT0gYm9vbCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgc2FtZSBib29sZWFuIG9wZXJhdG9yIHRocm91Z2hvdXQgc3ViZXhwcmVzc2lvbi4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2Vucy5vcGVyYXRvciA9IGJvb2w7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodFtpXSA9PT0gJyAnKSB7ICsraTsgfVxuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICAgIHRva2Vucy5sZW5ndGggPT09IDEgPyB0b2tlbnNbMF0gOiB7XG4gICAgICAgICAgICBvcGVyYXRvcjogdG9rZW5zLm9wZXJhdG9yLFxuICAgICAgICAgICAgY2hpbGRyZW46IHRva2Vuc1xuICAgICAgICB9XG4gICAgKTtcbn1cblxuZnVuY3Rpb24gbG9va3VwKG5hbWUpIHtcbiAgICB2YXIgaXRlbSA9IHRoaXMuc2NoZW1hLmxvb2t1cChuYW1lKTtcblxuICAgIGlmICghaXRlbSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IodGhpcy5yZXNvbHZlQWxpYXNlc1xuICAgICAgICAgICAgPyAnRXhwZWN0ZWQgdmFsaWQgY29sdW1uIG5hbWUuJ1xuICAgICAgICAgICAgOiAnRXhwZWN0ZWQgdmFsaWQgY29sdW1uIG5hbWUgb3IgYWxpYXMuJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtLm5hbWU7XG59XG5cbmZ1bmN0aW9uIHN0cmlwTGl0ZXJhbHModCkge1xuICAgIHZhciBpID0gMCwgaiA9IDAsIGs7XG5cbiAgICB0aGlzLmxpdGVyYWxzID0gW107XG5cbiAgICB3aGlsZSAoKGogPSB0LmluZGV4T2YoU1FULCBqKSkgPj0gMCkge1xuICAgICAgICBrID0gajtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgayA9IHQuaW5kZXhPZihTUVQsIGsgKyAxKTtcbiAgICAgICAgICAgIGlmIChrIDwgMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgJyArIFNRVCArICcgKHNpbmdsZSBxdW90ZSkuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gd2hpbGUgKHRbKytrXSA9PT0gU1FUKTtcbiAgICAgICAgdGhpcy5saXRlcmFscy5wdXNoKHQuc2xpY2UoKytqLCAtLWspLnJlcGxhY2UoLycnL2csIFNRVCkpO1xuICAgICAgICB0ID0gdC5zdWJzdHIoMCwgaikgKyBpICsgdC5zdWJzdHIoayk7XG4gICAgICAgIGogPSBqICsgMSArIChpICsgJycpLmxlbmd0aCArIDE7XG4gICAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQYXJzZXJTUUw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjc3NJbmplY3RvciA9IHJlcXVpcmUoJ2Nzcy1pbmplY3RvcicpO1xuXG52YXIgY3NzOyAvLyBkZWZpbmVkIGJ5IGNvZGUgaW5zZXJ0ZWQgYnkgZ3VscGZpbGUgYmV0d2VlbiBmb2xsb3dpbmcgY29tbWVudHNcbi8qIGluamVjdDpjc3MgKi9cbmNzcyA9ICcuZmlsdGVyLXRyZWV7Zm9udC1mYW1pbHk6c2Fucy1zZXJpZjtmb250LXNpemU6MTBwdDtsaW5lLWhlaWdodDoxLjVlbX0uZmlsdGVyLXRyZWUgbGFiZWx7Zm9udC13ZWlnaHQ6NDAwfS5maWx0ZXItdHJlZSBpbnB1dFt0eXBlPWNoZWNrYm94XSwuZmlsdGVyLXRyZWUgaW5wdXRbdHlwZT1yYWRpb117bWFyZ2luLWxlZnQ6M3B4O21hcmdpbi1yaWdodDozcHh9LmZpbHRlci10cmVlIG9se21hcmdpbi10b3A6MH0uZmlsdGVyLXRyZWU+c2VsZWN0e2Zsb2F0OnJpZ2h0O2JvcmRlcjoxcHggZG90dGVkIGdyZXk7YmFja2dyb3VuZC1jb2xvcjp0cmFuc3BhcmVudDtib3gtc2hhZG93Om5vbmV9LmZpbHRlci10cmVlLXJlbW92ZS1idXR0b257ZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MTVweDtoZWlnaHQ6MTVweDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kLWNvbG9yOiNlODg7Zm9udC1zaXplOjExLjVweDtjb2xvcjojZmZmO3RleHQtYWxpZ246Y2VudGVyO2xpbmUtaGVpZ2h0Om5vcm1hbDtmb250LXN0eWxlOm5vcm1hbDtmb250LWZhbWlseTpzYW5zLXNlcmlmO21hcmdpbi1yaWdodDo0cHg7Y3Vyc29yOnBvaW50ZXJ9LmZpbHRlci10cmVlLXJlbW92ZS1idXR0b246aG92ZXJ7YmFja2dyb3VuZC1jb2xvcjp0cmFuc3BhcmVudDtjb2xvcjojZTg4O2ZvbnQtd2VpZ2h0OjcwMDtib3gtc2hhZG93OnJlZCAwIDAgMnB4IGluc2V0fS5maWx0ZXItdHJlZS1yZW1vdmUtYnV0dG9uOjpiZWZvcmV7Y29udGVudDpcXCdcXFxcZDdcXCd9LmZpbHRlci10cmVlIGxpOjphZnRlcntmb250LXNpemU6NzAlO2ZvbnQtc3R5bGU6aXRhbGljO2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMDgwfS5maWx0ZXItdHJlZT5vbD5saTpsYXN0LWNoaWxkOjphZnRlcntkaXNwbGF5Om5vbmV9Lm9wLWFuZD5vbCwub3Atbm9yPm9sLC5vcC1vcj5vbHtwYWRkaW5nLWxlZnQ6NXB4O21hcmdpbi1sZWZ0OjI3cHh9Lm9wLW9yPm9sPmxpOjphZnRlcnttYXJnaW4tbGVmdDoyLjVlbTtjb250ZW50OlxcJ+KAlCBPUiDigJRcXCd9Lm9wLWFuZD5vbD5saTo6YWZ0ZXJ7bWFyZ2luLWxlZnQ6Mi41ZW07Y29udGVudDpcXCfigJQgQU5EIOKAlFxcJ30ub3Atbm9yPm9sPmxpOjphZnRlcnttYXJnaW4tbGVmdDoyLjVlbTtjb250ZW50OlxcJ+KAlCBOT1Ig4oCUXFwnfS5maWx0ZXItdHJlZS1lZGl0b3I+Kntmb250LXdlaWdodDo3MDB9LmZpbHRlci10cmVlLWVkaXRvcj5zcGFue2ZvbnQtc2l6ZTpzbWFsbGVyfS5maWx0ZXItdHJlZS1lZGl0b3I+aW5wdXRbdHlwZT10ZXh0XXt3aWR0aDo4ZW07cGFkZGluZzoxcHggNXB4IDJweH0uZmlsdGVyLXRyZWUtd2FybmluZ3tiYWNrZ3JvdW5kLWNvbG9yOiNmZmMhaW1wb3J0YW50O2JvcmRlci1jb2xvcjojZWRiIWltcG9ydGFudDtmb250LXdlaWdodDo0MDAhaW1wb3J0YW50fS5maWx0ZXItdHJlZS1lcnJvcntiYWNrZ3JvdW5kLWNvbG9yOiNmY2MhaW1wb3J0YW50O2JvcmRlci1jb2xvcjojYzk5IWltcG9ydGFudDtmb250LXdlaWdodDo0MDAhaW1wb3J0YW50fS5maWx0ZXItdHJlZS1kZWZhdWx0PjplbmFibGVke21hcmdpbjowIC40ZW07YmFja2dyb3VuZC1jb2xvcjojZGRkO2JvcmRlcjoxcHggc29saWQgdHJhbnNwYXJlbnR9LmZpbHRlci10cmVlLmZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnM+b2w+bGk6bm90KDpsYXN0LWNoaWxkKXtwYWRkaW5nLWJvdHRvbTouNzVlbTtib3JkZXItYm90dG9tOjNweCBkb3VibGUgIzA4MDttYXJnaW4tYm90dG9tOi43NWVtfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVze21hcmdpbjowIDAgNnB4O2ZvbnQtc2l6ZTo4cHQ7Zm9udC13ZWlnaHQ6NDAwO2xpbmUtaGVpZ2h0Om5vcm1hbDt3aGl0ZS1zcGFjZTpub3JtYWw7Y29sb3I6I2MwMH0uZmlsdGVyLXRyZWUgLmZvb3Rub3Rlcz5we21hcmdpbjowfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVzPnVse21hcmdpbjotM3B4IDAgMDtwYWRkaW5nLWxlZnQ6MTdweDt0ZXh0LWluZGV4Oi02cHh9LmZpbHRlci10cmVlIC5mb290bm90ZXM+dWw+bGl7bWFyZ2luOjJweCAwfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVzIC5maWVsZC1uYW1lLC5maWx0ZXItdHJlZSAuZm9vdG5vdGVzIC5maWVsZC12YWx1ZXtmb250LXdlaWdodDo3MDA7Zm9udC1zdHlsZTpub3JtYWx9LmZpbHRlci10cmVlIC5mb290bm90ZXMgLmZpZWxkLXZhbHVle2ZvbnQtZmFtaWx5Om1vbm9zcGFjZTtjb2xvcjojMDAwO2JhY2tncm91bmQtY29sb3I6I2RkZDtwYWRkaW5nOjAgNXB4O21hcmdpbjowIDNweDtib3JkZXItcmFkaXVzOjNweH0nO1xuLyogZW5kaW5qZWN0ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY3NzSW5qZWN0b3IuYmluZCh0aGlzLCBjc3MsICdmaWx0ZXItdHJlZS1iYXNlJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKiBAdHlwZWRlZiB7ZnVuY3Rpb259IG9wZXJhdGlvblJlZHVjZXJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcFxuICogQHBhcmFtIHtib29sZWFufSBxXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVGhlIHJlc3VsdCBvZiBhcHBseWluZyB0aGUgb3BlcmF0b3IgdG8gdGhlIHR3byBwYXJhbWV0ZXJzLlxuICovXG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtvcGVyYXRpb25SZWR1Y2VyfVxuICovXG5mdW5jdGlvbiBBTkQocCwgcSkge1xuICAgIHJldHVybiBwICYmIHE7XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtvcGVyYXRpb25SZWR1Y2VyfVxuICovXG5mdW5jdGlvbiBPUihwLCBxKSB7XG4gICAgcmV0dXJuIHAgfHwgcTtcbn1cblxuLyoqIEB0eXBlZGVmIHtvYmVqY3R9IHRyZWVPcGVyYXRvclxuICogQGRlc2MgRWFjaCBgdHJlZU9wZXJhdG9yYCBvYmplY3QgZGVzY3JpYmVzIHR3byB0aGluZ3M6XG4gKlxuICogMS4gSG93IHRvIHRha2UgdGhlIHRlc3QgcmVzdWx0cyBvZiBfbl8gY2hpbGQgbm9kZXMgYnkgYXBwbHlpbmcgdGhlIG9wZXJhdG9yIHRvIGFsbCB0aGUgcmVzdWx0cyB0byBcInJlZHVjZVwiIGl0IGRvd24gdG8gYSBzaW5nbGUgcmVzdWx0LlxuICogMi4gSG93IHRvIGdlbmVyYXRlIFNRTCBXSEVSRSBjbGF1c2Ugc3ludGF4IHRoYXQgYXBwbGllcyB0aGUgb3BlcmF0b3IgdG8gX25fIGNoaWxkIG5vZGVzLlxuICpcbiAqIEBwcm9wZXJ0eSB7b3BlcmF0aW9uUmVkdWNlcn0gcmVkdWNlXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNlZWQgLVxuICogQHByb3BlcnR5IHtib29sZWFufSBhYm9ydCAtXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG5lZ2F0ZSAtXG4gKiBAcHJvcGVydHkge3N0cmluZ30gU1FMLm9wIC1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTUUwuYmVnIC1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTUUwuZW5kIC1cbiAqL1xuXG4vKiogQSBoYXNoIG9mIHtAbGluayB0cmVlT3BlcmF0b3J9IG9iamVjdHMuXG4gKiBAdHlwZSB7b2JqZWN0fVxuICovXG52YXIgdHJlZU9wZXJhdG9ycyA9IHtcbiAgICAnb3AtYW5kJzoge1xuICAgICAgICByZWR1Y2U6IEFORCxcbiAgICAgICAgc2VlZDogdHJ1ZSxcbiAgICAgICAgYWJvcnQ6IGZhbHNlLFxuICAgICAgICBuZWdhdGU6IGZhbHNlLFxuICAgICAgICBTUUw6IHtcbiAgICAgICAgICAgIG9wOiAnQU5EJyxcbiAgICAgICAgICAgIGJlZzogJygnLFxuICAgICAgICAgICAgZW5kOiAnKSdcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ29wLW9yJzoge1xuICAgICAgICByZWR1Y2U6IE9SLFxuICAgICAgICBzZWVkOiBmYWxzZSxcbiAgICAgICAgYWJvcnQ6IHRydWUsXG4gICAgICAgIG5lZ2F0ZTogZmFsc2UsXG4gICAgICAgIFNRTDoge1xuICAgICAgICAgICAgb3A6ICdPUicsXG4gICAgICAgICAgICBiZWc6ICcoJyxcbiAgICAgICAgICAgIGVuZDogJyknXG4gICAgICAgIH1cbiAgICB9LFxuICAgICdvcC1ub3InOiB7XG4gICAgICAgIHJlZHVjZTogT1IsXG4gICAgICAgIHNlZWQ6IGZhbHNlLFxuICAgICAgICBhYm9ydDogdHJ1ZSxcbiAgICAgICAgbmVnYXRlOiB0cnVlLFxuICAgICAgICBTUUw6IHtcbiAgICAgICAgICAgIG9wOiAnT1InLFxuICAgICAgICAgICAgYmVnOiAnTk9UICgnLFxuICAgICAgICAgICAgZW5kOiAnKSdcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdHJlZU9wZXJhdG9ycztcbiIsIi8qIG9iamVjdC1pdGVyYXRvcnMuanMgLSBNaW5pIFVuZGVyc2NvcmUgbGlicmFyeVxuICogYnkgSm9uYXRoYW4gRWl0ZW5cbiAqXG4gKiBUaGUgbWV0aG9kcyBiZWxvdyBvcGVyYXRlIG9uIG9iamVjdHMgKGJ1dCBub3QgYXJyYXlzKSBzaW1pbGFybHlcbiAqIHRvIFVuZGVyc2NvcmUgKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNjb2xsZWN0aW9ucykuXG4gKlxuICogRm9yIG1vcmUgaW5mb3JtYXRpb246XG4gKiBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L29iamVjdC1pdGVyYXRvcnNcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3Igb25lIG1ldGhvZCBjYWxsLlxuICogQERlc2MgTm90ZSB0aGF0IHRoZSBgbmV3YCBrZXl3b3JkIGlzIG5vdCBuZWNlc3NhcnkuXG4gKiBAcGFyYW0ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gb2JqZWN0IC0gYG51bGxgIG9yIGB1bmRlZmluZWRgIGlzIHRyZWF0ZWQgYXMgYW4gZW1wdHkgcGxhaW4gb2JqZWN0LlxuICogQHJldHVybiB7V3JhcHBlcn0gVGhlIHdyYXBwZWQgb2JqZWN0LlxuICovXG5mdW5jdGlvbiBXcmFwcGVyKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBXcmFwcGVyKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBXcmFwcGVyKSkge1xuICAgICAgICByZXR1cm4gbmV3IFdyYXBwZXIob2JqZWN0KTtcbiAgICB9XG4gICAgdGhpcy5vcmlnaW5hbFZhbHVlID0gb2JqZWN0O1xuICAgIHRoaXMubyA9IG9iamVjdCB8fCB7fTtcbn1cblxuLyoqXG4gKiBAbmFtZSBXcmFwcGVyLmNoYWluXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3IgYSBjaGFpbiBvZiBtZXRob2QgY2FsbHMuXG4gKiBARGVzYyBDYWxscyB0aGUgY29uc3RydWN0b3IgYFdyYXBwZXIoKWAgYW5kIG1vZGlmaWVzIHRoZSB3cmFwcGVyIGZvciBjaGFpbmluZy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm4ge1dyYXBwZXJ9IFRoZSB3cmFwcGVkIG9iamVjdC5cbiAqL1xuV3JhcHBlci5jaGFpbiA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIgd3JhcHBlZCA9IFdyYXBwZXIob2JqZWN0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgd3JhcHBlZC5jaGFpbmluZyA9IHRydWU7XG4gICAgcmV0dXJuIHdyYXBwZWQ7XG59O1xuXG5XcmFwcGVyLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBVbndyYXAgYW4gb2JqZWN0IHdyYXBwZWQgd2l0aCB7QGxpbmsgV3JhcHBlci5jaGFpbnxXcmFwcGVyLmNoYWluKCl9LlxuICAgICAqIEByZXR1cm4ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gVGhlIHZhbHVlIG9yaWdpbmFsbHkgd3JhcHBlZCBieSB0aGUgY29uc3RydWN0b3IuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3JpZ2luYWxWYWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbZWFjaF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2VhY2gpIG1ldGhvZDogSXRlcmF0ZSBvdmVyIHRoZSBtZW1iZXJzIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgY2FsbGluZyBgaXRlcmF0ZWUoKWAgd2l0aCBlYWNoLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6IGAodmFsdWUsIGtleSwgb2JqZWN0KWAuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyB1bmRlZmluZWQ7IGFuIGAuZWFjaGAgbG9vcCBjYW5ub3QgYmUgYnJva2VuIG91dCBvZiAodXNlIHtAbGluayBXcmFwcGVyI2ZpbmR8LmZpbmR9IGluc3RlYWQpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHtXcmFwcGVyfSBUaGUgd3JhcHBlZCBvYmplY3QgZm9yIGNoYWluaW5nLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGVhY2g6IGZ1bmN0aW9uIChpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpdGVyYXRlZS5jYWxsKHRoaXMsIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2ZpbmRdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaW5kKSBtZXRob2Q6IExvb2sgdGhyb3VnaCBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHJldHVybmluZyB0aGUgZmlyc3Qgb25lIHRoYXQgcGFzc2VzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBgdW5kZWZpbmVkYCBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiByZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgYWNjZXB0YWJsZSBtZW1iZXIsIGFuZCBkb2Vzbid0IG5lY2Vzc2FyaWx5IHRyYXZlcnNlIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IFRoZSBmb3VuZCBwcm9wZXJ0eSdzIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpbmQ6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBPYmplY3Qua2V5cyhvKS5maW5kKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlZGljYXRlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pO1xuICAgICAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG9bcmVzdWx0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtmaWx0ZXJdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaWx0ZXIpIG1ldGhvZDogTG9vayB0aHJvdWdoIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgcmV0dXJuaW5nIHRoZSB2YWx1ZXMgb2YgYWxsIG1lbWJlcnMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBlbXB0eSBhcnJheSBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiBhbHdheXMgdHJhdmVyc2VzIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGZpbHRlcmVkIHZhbHVlcy5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBmaWx0ZXI6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChwcmVkaWNhdGUuY2FsbCh0aGlzLCBvW2tleV0sIGtleSwgbykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gob1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjb250ZXh0IHx8IG8pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW21hcF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI21hcCkgbWV0aG9kOiBQcm9kdWNlcyBhIG5ldyBhcnJheSBvZiB2YWx1ZXMgYnkgbWFwcGluZyBlYWNoIHZhbHVlIGluIGxpc3QgdGhyb3VnaCBhIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIChgaXRlcmF0ZWVgKS4gVGhlIGZ1bmN0aW9uIGFsd2F5cyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gaXRlcmF0ZWUgLSBGb3IgZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRocmVlIGFyZ3VtZW50czogYCh2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbmNhdGVuYXRlZCB0byB0aGUgZW5kIG9mIHRoZSBuZXcgYXJyYXkuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIHRoaXMgb2JqZWN0LiBJbiBvdGhlciB3b3JkcywgdGhpcyBvYmplY3QgYmVjb21lcyB0aGUgYHRoaXNgIHZhbHVlIGluIHRoZSBjYWxscyB0byBgcHJlZGljYXRlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFwOiBmdW5jdGlvbiAoaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGl0ZXJhdGVlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbcmVkdWNlXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jcmVkdWNlKSBtZXRob2Q6IEJvaWwgZG93biB0aGUgdmFsdWVzIG9mIGFsbCB0aGUgbWVtYmVycyBvZiB0aGUgd3JhcHBlZCBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZS4gYG1lbW9gIGlzIHRoZSBpbml0aWFsIHN0YXRlIG9mIHRoZSByZWR1Y3Rpb24sIGFuZCBlYWNoIHN1Y2Nlc3NpdmUgc3RlcCBvZiBpdCBzaG91bGQgYmUgcmV0dXJuZWQgYnkgYGl0ZXJhdGVlKClgLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBmb3VyIGFyZ3VtZW50czogYChtZW1vLCB2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGJlY29tZXMgdGhlIG5ldyB2YWx1ZSBvZiBgbWVtb2AgZm9yIHRoZSBuZXh0IGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFttZW1vXSAtIElmIG5vIG1lbW8gaXMgcGFzc2VkIHRvIHRoZSBpbml0aWFsIGludm9jYXRpb24gb2YgcmVkdWNlLCB0aGUgaXRlcmF0ZWUgaXMgbm90IGludm9rZWQgb24gdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGxpc3QuIFRoZSBmaXJzdCBlbGVtZW50IGlzIGluc3RlYWQgcGFzc2VkIGFzIHRoZSBtZW1vIGluIHRoZSBpbnZvY2F0aW9uIG9mIHRoZSBpdGVyYXRlZSBvbiB0aGUgbmV4dCBlbGVtZW50IGluIHRoZSBsaXN0LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgdmFsdWUgb2YgYG1lbW9gIFwicmVkdWNlZFwiIGFzIHBlciBgaXRlcmF0ZWVgLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHJlZHVjZTogZnVuY3Rpb24gKGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBvID0gdGhpcy5vO1xuICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5LCBpZHgpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gKCFpZHggJiYgbWVtbyA9PT0gdW5kZWZpbmVkKSA/IG9ba2V5XSA6IGl0ZXJhdGVlKG1lbW8sIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2V4dGVuZF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2V4dGVuZCkgbWV0aG9kOiBDb3B5IGFsbCBvZiB0aGUgcHJvcGVydGllcyBpbiBlYWNoIG9mIHRoZSBgc291cmNlYCBvYmplY3QgcGFyYW1ldGVyKHMpIG92ZXIgdG8gdGhlICh3cmFwcGVkKSBkZXN0aW5hdGlvbiBvYmplY3QgKHRodXMgbXV0YXRpbmcgaXQpLiBJdCdzIGluLW9yZGVyLCBzbyB0aGUgcHJvcGVydGllcyBvZiB0aGUgbGFzdCBgc291cmNlYCBvYmplY3Qgd2lsbCBvdmVycmlkZSBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZSBpbiBwcmV2aW91cyBhcmd1bWVudHMgb3IgaW4gdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiA+IFRoaXMgbWV0aG9kIGNvcGllcyBvd24gbWVtYmVycyBhcyB3ZWxsIGFzIG1lbWJlcnMgaW5oZXJpdGVkIGZyb20gcHJvdG90eXBlIGNoYWluLlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmQ6IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBvW2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtleHRlbmRPd25dKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNleHRlbmRPd24pIG1ldGhvZDogTGlrZSB7QGxpbmsgV3JhcHBlciNleHRlbmR8ZXh0ZW5kfSwgYnV0IG9ubHkgY29waWVzIGl0cyBcIm93blwiIHByb3BlcnRpZXMgb3ZlciB0byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmRPd246IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBXcmFwcGVyKG9iamVjdCkuZWFjaChmdW5jdGlvbiAodmFsLCBrZXkpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgICAgICAgICAgICAgb1trZXldID0gdmFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH1cbn07XG5cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2ZpbmRcbmlmICghQXJyYXkucHJvdG90eXBlLmZpbmQpIHtcbiAgICBBcnJheS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1leHRlbmQtbmF0aXZlXG4gICAgICAgIGlmICh0aGlzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcnJheS5wcm90b3R5cGUuZmluZCBjYWxsZWQgb24gbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZGljYXRlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBsaXN0ID0gT2JqZWN0KHRoaXMpO1xuICAgICAgICB2YXIgbGVuZ3RoID0gbGlzdC5sZW5ndGggPj4+IDA7XG4gICAgICAgIHZhciB0aGlzQXJnID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFsdWUgPSBsaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpLCBsaXN0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gV3JhcHBlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqIEBtb2R1bGUgb3ZlcnJpZGVyICovXG5cbi8qKlxuICogTWl4ZXMgbWVtYmVycyBvZiBhbGwgYHNvdXJjZXNgIGludG8gYHRhcmdldGAsIGhhbmRsaW5nIGdldHRlcnMgYW5kIHNldHRlcnMgcHJvcGVybHkuXG4gKlxuICogQW55IG51bWJlciBvZiBgc291cmNlc2Agb2JqZWN0cyBtYXkgYmUgZ2l2ZW4gYW5kIGVhY2ggaXMgY29waWVkIGluIHR1cm4uXG4gKlxuICogQGV4YW1wbGVcbiAqIHZhciBvdmVycmlkZXIgPSByZXF1aXJlKCdvdmVycmlkZXInKTtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEgfSwgc291cmNlMSA9IHsgYjogMiB9LCBzb3VyY2UyID0geyBjOiAzIH07XG4gKiB0YXJnZXQgPT09IG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZTEsIHNvdXJjZTIpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYSwgYiwgYW5kIGM7IHNvdXJjZSBvYmplY3RzIHVudG91Y2hlZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QgLSBUaGUgdGFyZ2V0IG9iamVjdCB0byByZWNlaXZlIHNvdXJjZXMuXG4gKiBAcGFyYW0gey4uLm9iamVjdH0gW3NvdXJjZXNdIC0gT2JqZWN0KHMpIGNvbnRhaW5pbmcgbWVtYmVycyB0byBjb3B5IHRvIGB0YXJnZXRgLiAoT21pdHRpbmcgaXMgYSBuby1vcC4pXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgdGFyZ2V0IG9iamVjdCAoYHRhcmdldGApXG4gKi9cbmZ1bmN0aW9uIG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZXMpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIG1peEluLmNhbGwodGFyZ2V0LCBhcmd1bWVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogTWl4IGB0aGlzYCBtZW1iZXJzIGludG8gYHRhcmdldGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEEuIFNpbXBsZSB1c2FnZSAodXNpbmcgLmNhbGwpOlxuICogdmFyIG1peEluVG8gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJblRvO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluVG8uY2FsbChzb3VyY2UsIHRhcmdldCk7IC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSBzb3VyY2UgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW5UbyA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluVG87XG4gKiB2YXIgdGFyZ2V0ID0geyBhOiAxIH0sIHNvdXJjZSA9IHsgYjogMiwgbWl4SW5UbzogbWl4SW5UbyB9O1xuICogdGFyZ2V0ID09PSBzb3VyY2UubWl4SW5Ubyh0YXJnZXQpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYm90aCBhIGFuZCBiOyBzb3VyY2Ugb2JqZWN0IHVudG91Y2hlZFxuICpcbiAqIEB0aGlzIHtvYmplY3R9IFRhcmdldC5cbiAqIEBwYXJhbSB0YXJnZXRcbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSB0YXJnZXQgb2JqZWN0IChgdGFyZ2V0YClcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluVG8odGFyZ2V0KSB7XG4gICAgdmFyIGRlc2NyaXB0b3I7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLCBrZXkpKSkge1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIE1peCBgc291cmNlYCBtZW1iZXJzIGludG8gYHRoaXNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBBLiBTaW1wbGUgdXNhZ2UgKHVzaW5nIC5jYWxsKTpcbiAqIHZhciBtaXhJbiA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluLmNhbGwodGFyZ2V0LCBzb3VyY2UpIC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSB0YXJnZXQgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW4gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJbjtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEsIG1peEluOiBtaXhJbiB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gdGFyZ2V0Lm1peEluKHNvdXJjZSkgLy8gdHJ1ZVxuICogLy8gdGFyZ2V0IG5vdyBoYXMgYm90aCBhIGFuZCBiIChhbmQgbWl4SW4pOyBzb3VyY2UgdW50b3VjaGVkXG4gKlxuICogQHBhcmFtIHNvdXJjZVxuICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QgKGB0aGlzYClcbiAqIEBtZW1iZXJPZiBvdmVycmlkZXJcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluKHNvdXJjZSkge1xuICAgIHZhciBkZXNjcmlwdG9yO1xuICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSkpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn1cblxub3ZlcnJpZGVyLm1peEluVG8gPSBtaXhJblRvO1xub3ZlcnJpZGVyLm1peEluID0gbWl4SW47XG5cbm1vZHVsZS5leHBvcnRzID0gb3ZlcnJpZGVyO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJFR0VYUF9JTkRJUkVDVElPTiA9IC9eKFxcdyspXFwoKFxcdyspXFwpJC87ICAvLyBmaW5kcyBjb21wbGV0ZSBwYXR0ZXJuIGEoYikgd2hlcmUgYm90aCBhIGFuZCBiIGFyZSByZWdleCBcIndvcmRzXCJcblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IHZhbHVlSXRlbVxuICogWW91IHNob3VsZCBzdXBwbHkgYm90aCBgbmFtZWAgYW5kIGBhbGlhc2AgYnV0IHlvdSBjb3VsZCBvbWl0IG9uZSBvciB0aGUgb3RoZXIgYW5kIHdoaWNoZXZlciB5b3UgcHJvdmlkZSB3aWxsIGJlIHVzZWQgZm9yIGJvdGguXG4gKiA+IElmIHlvdSBvbmx5IGdpdmUgdGhlIGBuYW1lYCBwcm9wZXJ0eSwgeW91IG1pZ2h0IGFzIHdlbGwganVzdCBnaXZlIGEgc3RyaW5nIGZvciB7QGxpbmsgbWVudUl0ZW19IHJhdGhlciB0aGFuIHRoaXMgb2JqZWN0LlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtuYW1lPWFsaWFzXSAtIFZhbHVlIG9mIGB2YWx1ZWAgYXR0cmlidXRlIG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYWxpYXM9bmFtZV0gLSBUZXh0IG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZV0gT25lIG9mIHRoZSBrZXlzIG9mIGB0aGlzLmNvbnZlcnRlcnNgLiBJZiBub3Qgb25lIG9mIHRoZXNlIChpbmNsdWRpbmcgYHVuZGVmaW5lZGApLCBmaWVsZCB2YWx1ZXMgd2lsbCBiZSB0ZXN0ZWQgd2l0aCBhIHN0cmluZyBjb21wYXJpc29uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBbaGlkZGVuPWZhbHNlXVxuICovXG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fG1lbnVJdGVtW119IHN1Ym1lbnVJdGVtXG4gKiBAc3VtbWFyeSBIaWVyYXJjaGljYWwgYXJyYXkgb2Ygc2VsZWN0IGxpc3QgaXRlbXMuXG4gKiBAZGVzYyBEYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgdGhlIGxpc3Qgb2YgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBhbmQgYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMgdGhhdCBtYWtlIHVwIGEgYDxzZWxlY3Q+Li4uPC9zZWxlY3Q+YCBlbGVtZW50LlxuICpcbiAqID4gQWx0ZXJuYXRlIGZvcm06IEluc3RlYWQgb2YgYW4gb2JqZWN0IHdpdGggYSBgbWVudWAgcHJvcGVydHkgY29udGFpbmluZyBhbiBhcnJheSwgbWF5IGl0c2VsZiBiZSB0aGF0IGFycmF5LiBCb3RoIGZvcm1zIGhhdmUgdGhlIG9wdGlvbmFsIGBsYWJlbGAgcHJvcGVydHkuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2xhYmVsXSAtIERlZmF1bHRzIHRvIGEgZ2VuZXJhdGVkIHN0cmluZyBvZiB0aGUgZm9ybSBcIkdyb3VwIG5bLm1dLi4uXCIgd2hlcmUgZWFjaCBkZWNpbWFsIHBvc2l0aW9uIHJlcHJlc2VudHMgYSBsZXZlbCBvZiB0aGUgb3B0Z3JvdXAgaGllcmFyY2h5LlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBzdWJtZW51XG4gKi9cblxuLyoqIEB0eXBlZGVmIHtzdHJpbmd8dmFsdWVJdGVtfHN1Ym1lbnVJdGVtfSBtZW51SXRlbVxuICogTWF5IGJlIG9uZSBvZiB0aHJlZSBwb3NzaWJsZSB0eXBlcyB0aGF0IHNwZWNpZnkgZWl0aGVyIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgb3IgYW4gYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnQgYXMgZm9sbG93czpcbiAqICogSWYgYSBgc3RyaW5nYCwgc3BlY2lmaWVzIHRoZSB0ZXh0IG9mIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgd2l0aCBubyBgdmFsdWVgIGF0dHJpYnV0ZS4gKEluIHRoZSBhYnNlbmNlIG9mIGEgYHZhbHVlYCBhdHRyaWJ1dGUsIHRoZSBgdmFsdWVgIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50IGRlZmF1bHRzIHRvIHRoZSB0ZXh0LilcbiAqICogSWYgc2hhcGVkIGxpa2UgYSB7QGxpbmsgdmFsdWVJdGVtfSBvYmplY3QsIHNwZWNpZmllcyBib3RoIHRoZSB0ZXh0IGFuZCB2YWx1ZSBvZiBhbiBgPG9wdGlvbi4uLi48L29wdGlvbj5gIGVsZW1lbnQuXG4gKiAqIElmIHNoYXBlZCBsaWtlIGEge0BsaW5rIHN1Ym1lbnVJdGVtfSBvYmplY3QgKG9yIGl0cyBhbHRlcm5hdGUgYXJyYXkgZm9ybSksIHNwZWNpZmllcyBhbiBgPG9wdGdyb3VwPi4uLi48L29wdGdyb3VwPmAgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IEJ1aWxkcyBhIG5ldyBtZW51IHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyBhbmQgZ3JvdXBzLlxuICogQGRlc2MgVGhpcyBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IHBvcC11cCBtZW51IChhLmsuYS4gXCJkcm9wLWRvd25cIikuIFRoaXMgaXMgYSBgPHNlbGVjdD4uLi48L3NlbGVjdD5gIGVsZW1lbnQsIHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyAoYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50cykgYW5kIGdyb3VwcyAoYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMpLlxuICogPiBCb251czogVGhpcyBmdW5jdGlvbiBhbHNvIGJ1aWxkcyBgaW5wdXQgdHlwZT10ZXh0YCBlbGVtZW50cy5cbiAqID4gTk9URTogVGhpcyBmdW5jdGlvbiBnZW5lcmF0ZXMgT1BUR1JPVVAgZWxlbWVudHMgZm9yIHN1YnRyZWVzLiBIb3dldmVyLCBub3RlIHRoYXQgSFRNTDUgc3BlY2lmaWVzIHRoYXQgT1BUR1JPVVAgZWxlbW5lbnRzIG1hZGUgbm90IG5lc3QhIFRoaXMgZnVuY3Rpb24gZ2VuZXJhdGVzIHRoZSBtYXJrdXAgZm9yIHRoZW0gYnV0IHRoZXkgYXJlIG5vdCByZW5kZXJlZCBieSBtb3N0IGJyb3dzZXJzLCBvciBub3QgY29tcGxldGVseS4gVGhlcmVmb3JlLCBmb3Igbm93LCBkbyBub3Qgc3BlY2lmeSBtb3JlIHRoYW4gb25lIGxldmVsIHN1YnRyZWVzLiBGdXR1cmUgdmVyc2lvbnMgb2YgSFRNTCBtYXkgc3VwcG9ydCBpdC4gSSBhbHNvIHBsYW4gdG8gYWRkIGhlcmUgb3B0aW9ucyB0byBhdm9pZCBPUFRHUk9VUFMgZW50aXJlbHkgZWl0aGVyIGJ5IGluZGVudGluZyBvcHRpb24gdGV4dCwgb3IgYnkgY3JlYXRpbmcgYWx0ZXJuYXRlIERPTSBub2RlcyB1c2luZyBgPGxpPmAgaW5zdGVhZCBvZiBgPHNlbGVjdD5gLCBvciBib3RoLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR8c3RyaW5nfSBlbCAtIE11c3QgYmUgb25lIG9mIChjYXNlLXNlbnNpdGl2ZSk6XG4gKiAqIHRleHQgYm94IC0gYW4gYEhUTUxJbnB1dEVsZW1lbnRgIHRvIHVzZSBhbiBleGlzdGluZyBlbGVtZW50IG9yIGAnSU5QVVQnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIGRyb3AtZG93biAtIGFuIGBIVE1MU2VsZWN0RWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdTRUxFQ1QnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIHN1Ym1lbnUgLSBhbiBgSFRNTE9wdEdyb3VwRWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdPUFRHUk9VUCdgIHRvIGNyZWF0ZSBhIG5ldyBvbmUgKG1lYW50IGZvciBpbnRlcm5hbCB1c2Ugb25seSlcbiAqXG4gKiBAcGFyYW0ge21lbnVJdGVtW119IFttZW51XSAtIEhpZXJhcmNoaWNhbCBsaXN0IG9mIHN0cmluZ3MgdG8gYWRkIGFzIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgb3IgYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnRzLiBPbWl0dGluZyBjcmVhdGVzIGEgdGV4dCBib3guXG4gKlxuICogQHBhcmFtIHtudWxsfHN0cmluZ30gW29wdGlvbnMucHJvbXB0PScnXSAtIEFkZHMgYW4gaW5pdGlhbCBgPG9wdGlvbj4uLi48L29wdGlvbj5gIGVsZW1lbnQgdG8gdGhlIGRyb3AtZG93biB3aXRoIHRoaXMgdmFsdWUgaW4gcGFyZW50aGVzZXMgYXMgaXRzIGB0ZXh0YDsgYW5kIGVtcHR5IHN0cmluZyBhcyBpdHMgYHZhbHVlYC4gRGVmYXVsdCBpcyBlbXB0eSBzdHJpbmcsIHdoaWNoIGNyZWF0ZXMgYSBibGFuayBwcm9tcHQ7IGBudWxsYCBzdXBwcmVzc2VzIHByb21wdCBhbHRvZ2V0aGVyLlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc29ydF0gLSBXaGV0aGVyIHRvIGFscGhhIHNvcnQgb3Igbm90LiBJZiB0cnV0aHksIHNvcnRzIGVhY2ggb3B0Z3JvdXAgb24gaXRzIGBsYWJlbGA7IGFuZCBlYWNoIHNlbGVjdCBvcHRpb24gb24gaXRzIHRleHQgKGl0cyBgYWxpYXNgIGlmIGdpdmVuOyBvciBpdHMgYG5hbWVgIGlmIG5vdCkuXG4gKlxuICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuYmxhY2tsaXN0XSAtIE9wdGlvbmFsIGxpc3Qgb2YgbWVudSBpdGVtIG5hbWVzIHRvIGJlIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuYnJlYWRjcnVtYnNdIC0gTGlzdCBvZiBvcHRpb24gZ3JvdXAgc2VjdGlvbiBudW1iZXJzIChyb290IGlzIHNlY3Rpb24gMCkuIChGb3IgaW50ZXJuYWwgdXNlLilcbiAqXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFwcGVuZD1mYWxzZV0gLSBXaGVuIGBlbGAgaXMgYW4gZXhpc3RpbmcgYDxzZWxlY3Q+YCBFbGVtZW50LCBnaXZpbmcgdHJ1dGh5IHZhbHVlIGFkZHMgdGhlIG5ldyBjaGlsZHJlbiB3aXRob3V0IGZpcnN0IHJlbW92aW5nIGV4aXN0aW5nIGNoaWxkcmVuLlxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fSBFaXRoZXIgYSBgPHNlbGVjdD5gIG9yIGA8b3B0Z3JvdXA+YCBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBidWlsZChlbCwgbWVudSwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIHByb21wdCA9IG9wdGlvbnMucHJvbXB0LFxuICAgICAgICBibGFja2xpc3QgPSBvcHRpb25zLmJsYWNrbGlzdCxcbiAgICAgICAgc29ydCA9IG9wdGlvbnMuc29ydCxcbiAgICAgICAgYnJlYWRjcnVtYnMgPSBvcHRpb25zLmJyZWFkY3J1bWJzIHx8IFtdLFxuICAgICAgICBwYXRoID0gYnJlYWRjcnVtYnMubGVuZ3RoID8gYnJlYWRjcnVtYnMuam9pbignLicpICsgJy4nIDogJycsXG4gICAgICAgIHN1YnRyZWVOYW1lID0gcG9wTWVudS5zdWJ0cmVlLFxuICAgICAgICBncm91cEluZGV4ID0gMCxcbiAgICAgICAgdGFnTmFtZTtcblxuICAgIGlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgdGFnTmFtZSA9IGVsLnRhZ05hbWU7XG4gICAgICAgIGlmICghb3B0aW9ucy5hcHBlbmQpIHtcbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9ICcnOyAvLyByZW1vdmUgYWxsIDxvcHRpb24+IGFuZCA8b3B0Z3JvdXA+IGVsZW1lbnRzXG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0YWdOYW1lID0gZWw7XG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbiAgICB9XG5cbiAgICBpZiAobWVudSkge1xuICAgICAgICB2YXIgYWRkLCBuZXdPcHRpb247XG4gICAgICAgIGlmICh0YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgYWRkID0gZWwuYWRkO1xuICAgICAgICAgICAgaWYgKHByb21wdCkge1xuICAgICAgICAgICAgICAgIG5ld09wdGlvbiA9IG5ldyBPcHRpb24ocHJvbXB0LCAnJyk7XG4gICAgICAgICAgICAgICAgbmV3T3B0aW9uLmlubmVySFRNTCArPSAnJmhlbGxpcDsnO1xuICAgICAgICAgICAgICAgIGVsLmFkZChuZXdPcHRpb24pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9tcHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbC5hZGQobmV3IE9wdGlvbigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFkZCA9IGVsLmFwcGVuZENoaWxkO1xuICAgICAgICAgICAgZWwubGFiZWwgPSBwcm9tcHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkge1xuICAgICAgICAgICAgbWVudSA9IG1lbnUuc2xpY2UoKS5zb3J0KGl0ZW1Db21wYXJhdG9yKTsgLy8gc29ydGVkIGNsb25lXG4gICAgICAgIH1cblxuICAgICAgICBtZW51LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgLy8gaWYgaXRlbSBpcyBvZiBmb3JtIGEoYikgYW5kIHRoZXJlIGlzIGFuIGZ1bmN0aW9uIGEgaW4gb3B0aW9ucywgdGhlbiBpdGVtID0gb3B0aW9ucy5hKGIpXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kaXJlY3Rpb24gPSBpdGVtLm1hdGNoKFJFR0VYUF9JTkRJUkVDVElPTik7XG4gICAgICAgICAgICAgICAgaWYgKGluZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhID0gaW5kaXJlY3Rpb25bMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICBiID0gaW5kaXJlY3Rpb25bMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmID0gb3B0aW9uc1thXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0gZihiKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdidWlsZDogRXhwZWN0ZWQgb3B0aW9ucy4nICsgYSArICcgdG8gYmUgYSBmdW5jdGlvbi4nO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICBpZiAoc3VidHJlZSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXBPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBicmVhZGNydW1iczogYnJlYWRjcnVtYnMuY29uY2F0KCsrZ3JvdXBJbmRleCksXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogaXRlbS5sYWJlbCB8fCAnR3JvdXAgJyArIHBhdGggKyBncm91cEluZGV4LFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBzb3J0LFxuICAgICAgICAgICAgICAgICAgICBibGFja2xpc3Q6IGJsYWNrbGlzdFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB2YXIgb3B0Z3JvdXAgPSBidWlsZCgnT1BUR1JPVVAnLCBzdWJ0cmVlLCBncm91cE9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGdyb3VwLmNoaWxkRWxlbWVudENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKG9wdGdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIShibGFja2xpc3QgJiYgYmxhY2tsaXN0LmluZGV4T2YoaXRlbSkgPj0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkLmNhbGwoZWwsIG5ldyBPcHRpb24oaXRlbSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5oaWRkZW4pIHtcblxuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gaXRlbS5uYW1lIHx8IGl0ZW0uYWxpYXM7XG4gICAgICAgICAgICAgICAgaWYgKCEoYmxhY2tsaXN0ICYmIGJsYWNrbGlzdC5pbmRleE9mKG5hbWUpID49IDApKSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZC5jYWxsKGVsLCBuZXcgT3B0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5hbGlhcyB8fCBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lXG4gICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbC50eXBlID0gJ3RleHQnO1xuICAgIH1cblxuICAgIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gaXRlbUNvbXBhcmF0b3IoYSwgYikge1xuICAgIGEgPSBhLmFsaWFzIHx8IGEubmFtZSB8fCBhLmxhYmVsIHx8IGE7XG4gICAgYiA9IGIuYWxpYXMgfHwgYi5uYW1lIHx8IGIubGFiZWwgfHwgYjtcbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgUmVjdXJzaXZlbHkgc2VhcmNoZXMgdGhlIGNvbnRleHQgYXJyYXkgb2YgYG1lbnVJdGVtYHMgZm9yIGEgbmFtZWQgYGl0ZW1gLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqIEB0aGlzIEFycmF5XG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMua2V5cz1bcG9wTWVudS5kZWZhdWx0S2V5XV0gLSBQcm9wZXJ0aWVzIHRvIHNlYXJjaCBlYWNoIG1lbnVJdGVtIHdoZW4gaXQgaXMgYW4gb2JqZWN0LlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYXNlU2Vuc2l0aXZlPWZhbHNlXSAtIElnbm9yZSBjYXNlIHdoaWxlIHNlYXJjaGluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIFZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfG1lbnVJdGVtfSBUaGUgZm91bmQgaXRlbSBvciBgdW5kZWZpbmVkYCBpZiBub3QgZm91bmQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cChvcHRpb25zLCB2YWx1ZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHZhbHVlID0gb3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB2YXIgc2hhbGxvdywgZGVlcCwgaXRlbSwgcHJvcCxcbiAgICAgICAga2V5cyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlzIHx8IFtwb3BNZW51LmRlZmF1bHRLZXldLFxuICAgICAgICBjYXNlU2Vuc2l0aXZlID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhc2VTZW5zaXRpdmU7XG5cbiAgICB2YWx1ZSA9IHRvU3RyaW5nKHZhbHVlLCBjYXNlU2Vuc2l0aXZlKTtcblxuICAgIHNoYWxsb3cgPSB0aGlzLmZpbmQoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bcG9wTWVudS5zdWJ0cmVlXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmIChzdWJ0cmVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZGVlcCA9IGxvb2t1cC5jYWxsKHN1YnRyZWUsIG9wdGlvbnMsIHZhbHVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9TdHJpbmcoaXRlbSwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgcHJvcCA9IGl0ZW1ba2V5c1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKHByb3AgJiYgdG9TdHJpbmcocHJvcCwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaXRlbSA9IGRlZXAgfHwgc2hhbGxvdztcblxuICAgIHJldHVybiBpdGVtICYmIChpdGVtLm5hbWUgPyBpdGVtIDogeyBuYW1lOiBpdGVtIH0pO1xufVxuXG5mdW5jdGlvbiB0b1N0cmluZyhzLCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIGlmIChzKSB7XG4gICAgICAgIHJlc3VsdCArPSBzOyAvLyBjb252ZXJ0IHMgdG8gc3RyaW5nXG4gICAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBSZWN1cnNpdmVseSB3YWxrcyB0aGUgY29udGV4dCBhcnJheSBvZiBgbWVudUl0ZW1gcyBhbmQgY2FsbHMgYGl0ZXJhdGVlYCBvbiBlYWNoIGl0ZW0gdGhlcmVpbi5cbiAqIEBkZXNjIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGggZWFjaCBpdGVtICh0ZXJtaW5hbCBub2RlKSBpbiB0aGUgbWVudSB0cmVlIGFuZCBhIGZsYXQgMC1iYXNlZCBpbmRleC4gUmVjdXJzZXMgb24gbWVtYmVyIHdpdGggbmFtZSBvZiBgcG9wTWVudS5zdWJ0cmVlYC5cbiAqXG4gKiBUaGUgbm9kZSB3aWxsIGFsd2F5cyBiZSBhIHtAbGluayB2YWx1ZUl0ZW19IG9iamVjdDsgd2hlbiBhIGBzdHJpbmdgLCBpdCBpcyBib3hlZCBmb3IgeW91LlxuICpcbiAqIEBtZW1iZXJPZiBwb3BNZW51XG4gKlxuICogQHRoaXMgQXJyYXlcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBpdGVyYXRlZSAtIEZvciBlYWNoIGl0ZW0gaW4gdGhlIG1lbnUsIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGg6XG4gKiAqIHRoZSBgdmFsdWVJdGVtYCAoaWYgdGhlIGl0ZW0gaXMgYSBwcmltYXRpdmUgc3RyaW5nLCBpdCBpcyB3cmFwcGVkIHVwIGZvciB5b3UpXG4gKiAqIGEgMC1iYXNlZCBgb3JkaW5hbGBcbiAqXG4gKiBUaGUgYGl0ZXJhdGVlYCByZXR1cm4gdmFsdWUgY2FuIGJlIHVzZWQgdG8gcmVwbGFjZSB0aGUgaXRlbSwgYXMgZm9sbG93czpcbiAqICogYHVuZGVmaW5lZGAgLSBkbyBub3RoaW5nXG4gKiAqIGBudWxsYCAtIHNwbGljZSBvdXQgdGhlIGl0ZW07IHJlc3VsdGluZyBlbXB0eSBzdWJtZW51cyBhcmUgYWxzbyBzcGxpY2VkIG91dCAoc2VlIG5vdGUpXG4gKiAqIGFueXRoaW5nIGVsc2UgLSByZXBsYWNlIHRoZSBpdGVtIHdpdGggdGhpcyB2YWx1ZTsgaWYgdmFsdWUgaXMgYSBzdWJ0cmVlIChpLmUuLCBhbiBhcnJheSkgYGl0ZXJhdGVlYCB3aWxsIHRoZW4gYmUgY2FsbGVkIHRvIHdhbGsgaXQgYXMgd2VsbCAoc2VlIG5vdGUpXG4gKlxuICogPiBOb3RlOiBSZXR1cm5pbmcgYW55dGhpbmcgKG90aGVyIHRoYW4gYHVuZGVmaW5lZGApIGZyb20gYGl0ZXJhdGVlYCB3aWxsIChkZWVwbHkpIG11dGF0ZSB0aGUgb3JpZ2luYWwgYG1lbnVgIHNvIHlvdSBtYXkgd2FudCB0byBjb3B5IGl0IGZpcnN0IChkZWVwbHksIGluY2x1ZGluZyBhbGwgbGV2ZWxzIG9mIGFycmF5IG5lc3RpbmcgYnV0IG5vdCB0aGUgdGVybWluYWwgbm9kZSBvYmplY3RzKS5cbiAqXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBOdW1iZXIgb2YgaXRlbXMgKHRlcm1pbmFsIG5vZGVzKSBpbiB0aGUgbWVudSB0cmVlLlxuICovXG5mdW5jdGlvbiB3YWxrKGl0ZXJhdGVlKSB7XG4gICAgdmFyIG1lbnUgPSB0aGlzLFxuICAgICAgICBvcmRpbmFsID0gMCxcbiAgICAgICAgc3VidHJlZU5hbWUgPSBwb3BNZW51LnN1YnRyZWUsXG4gICAgICAgIGksIGl0ZW0sIHN1YnRyZWUsIG5ld1ZhbDtcblxuICAgIGZvciAoaSA9IG1lbnUubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgaXRlbSA9IG1lbnVbaV07XG4gICAgICAgIHN1YnRyZWUgPSBpdGVtW3N1YnRyZWVOYW1lXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXN1YnRyZWUpIHtcbiAgICAgICAgICAgIG5ld1ZhbCA9IGl0ZXJhdGVlKGl0ZW0ubmFtZSA/IGl0ZW0gOiB7IG5hbWU6IGl0ZW0gfSwgb3JkaW5hbCk7XG4gICAgICAgICAgICBvcmRpbmFsICs9IDE7XG5cbiAgICAgICAgICAgIGlmIChuZXdWYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIG9yZGluYWwgLT0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW51W2ldID0gaXRlbSA9IG5ld1ZhbDtcbiAgICAgICAgICAgICAgICAgICAgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VidHJlZSkge1xuICAgICAgICAgICAgb3JkaW5hbCArPSB3YWxrLmNhbGwoc3VidHJlZSwgaXRlcmF0ZWUpO1xuICAgICAgICAgICAgaWYgKHN1YnRyZWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgb3JkaW5hbCAtPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yZGluYWw7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgRm9ybWF0IGl0ZW0gbmFtZSB3aXRoIGl0J3MgYWxpYXMgd2hlbiBhdmFpbGFibGUuXG4gKiBAbWVtYmVyT2YgcG9wTWVudVxuICogQHBhcmFtIHtzdHJpbmd8dmFsdWVJdGVtfSBpdGVtXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIG5hbWUgYW5kIGFsaWFzLlxuICovXG5mdW5jdGlvbiBmb3JtYXRJdGVtKGl0ZW0pIHtcbiAgICB2YXIgcmVzdWx0ID0gaXRlbS5uYW1lIHx8IGl0ZW07XG4gICAgaWYgKGl0ZW0uYWxpYXMpIHtcbiAgICAgICAgcmVzdWx0ID0gJ1wiJyArIGl0ZW0uYWxpYXMgKyAnXCIgKCcgKyByZXN1bHQgKyAnKSc7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuZnVuY3Rpb24gaXNHcm91cFByb3h5KHMpIHtcbiAgICByZXR1cm4gUkVHRVhQX0lORElSRUNUSU9OLnRlc3Qocyk7XG59XG5cbi8qKlxuICogQG5hbWVzcGFjZVxuICovXG52YXIgcG9wTWVudSA9IHtcbiAgICBidWlsZDogYnVpbGQsXG4gICAgd2Fsazogd2FsayxcbiAgICBsb29rdXA6IGxvb2t1cCxcbiAgICBmb3JtYXRJdGVtOiBmb3JtYXRJdGVtLFxuICAgIGlzR3JvdXBQcm94eTogaXNHcm91cFByb3h5LFxuICAgIHN1YnRyZWU6ICdzdWJtZW51JyxcbiAgICBkZWZhdWx0S2V5OiAnbmFtZSdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcG9wTWVudTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIC8vIGEgcmVnZXggc2VhcmNoIHBhdHRlcm4gdGhhdCBtYXRjaGVzIGFsbCB0aGUgcmVzZXJ2ZWQgY2hhcnMgb2YgYSByZWdleCBzZWFyY2ggcGF0dGVyblxuICAgIHJlc2VydmVkID0gLyhbXFwuXFxcXFxcK1xcKlxcP1xcXlxcJFxcKFxcKVxce1xcfVxcPVxcIVxcPFxcPlxcfFxcOlxcW1xcXV0pL2csXG5cbiAgICAvLyByZWdleCB3aWxkY2FyZCBzZWFyY2ggcGF0dGVybnNcbiAgICBSRUdFWFBfV0lMRENBUkQgPSAnLionLFxuICAgIFJFR0VYUF9XSUxEQ0hBUiA9ICcuJyxcbiAgICBSRUdFWFBfV0lMRENBUkRfTUFUQ0hFUiA9ICcoJyArIFJFR0VYUF9XSUxEQ0FSRCArICcpJyxcblxuICAgIC8vIExJS0Ugc2VhcmNoIHBhdHRlcm5zXG4gICAgTElLRV9XSUxEQ0hBUiA9ICdfJyxcbiAgICBMSUtFX1dJTERDQVJEID0gJyUnLFxuXG4gICAgLy8gcmVnZXggc2VhcmNoIHBhdHRlcm5zIHRoYXQgbWF0Y2ggTElLRSBzZWFyY2ggcGF0dGVybnNcbiAgICBSRUdFWFBfTElLRV9QQVRURVJOX01BVENIRVIgPSBuZXcgUmVnRXhwKCcoJyArIFtcbiAgICAgICAgTElLRV9XSUxEQ0hBUixcbiAgICAgICAgTElLRV9XSUxEQ0FSRCxcbiAgICAgICAgJ1xcXFxbXFxcXF4/W14tXFxcXF1dK10nLCAvLyBtYXRjaGVzIGEgTElLRSBzZXQgKHNhbWUgc3ludGF4IGFzIGEgUmVnRXhwIHNldClcbiAgICAgICAgJ1xcXFxbXFxcXF4/W14tXFxcXF1dXFxcXC1bXlxcXFxdXV0nIC8vIG1hdGNoZXMgYSBMSUtFIHJhbmdlIChzYW1lIHN5bnRheCBhcyBhIFJlZ0V4cCByYW5nZSlcbiAgICBdLmpvaW4oJ3wnKSArICcpJywgJ2cnKTtcblxuZnVuY3Rpb24gcmVnRXhwTElLRShwYXR0ZXJuLCBpZ25vcmVDYXNlKSB7XG4gICAgdmFyIGksIHBhcnRzO1xuXG4gICAgLy8gRmluZCBhbGwgTElLRSBwYXR0ZXJuc1xuICAgIHBhcnRzID0gcGF0dGVybi5tYXRjaChSRUdFWFBfTElLRV9QQVRURVJOX01BVENIRVIpO1xuXG4gICAgaWYgKHBhcnRzKSB7XG4gICAgICAgIC8vIFRyYW5zbGF0ZSBmb3VuZCBMSUtFIHBhdHRlcm5zIHRvIHJlZ2V4IHBhdHRlcm5zLCBlc2NhcGVkIGludGVydmVuaW5nIG5vbi1wYXR0ZXJucywgYW5kIGludGVybGVhdmUgdGhlIHR3b1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgLy8gRXNjYXBlIGxlZnQgYnJhY2tldHMgKHVucGFpcmVkIHJpZ2h0IGJyYWNrZXRzIGFyZSBPSylcbiAgICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gJ1snKSB7XG4gICAgICAgICAgICAgICAgcGFydHNbaV0gPSByZWdFeHBMSUtFLnJlc2VydmUocGFydHNbaV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIGVhY2ggZm91bmQgcGF0dGVybiBtYXRjaGFibGUgYnkgZW5jbG9zaW5nIGluIHBhcmVudGhlc2VzXG4gICAgICAgICAgICBwYXJ0c1tpXSA9ICcoJyArIHBhcnRzW2ldICsgJyknO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWF0Y2ggdGhlc2UgcHJlY2lzZSBwYXR0ZXJucyBhZ2FpbiB3aXRoIHRoZWlyIGludGVydmVuaW5nIG5vbi1wYXR0ZXJucyAoaS5lLiwgdGV4dClcbiAgICAgICAgcGFydHMgPSBwYXR0ZXJuLm1hdGNoKG5ldyBSZWdFeHAoXG4gICAgICAgICAgICBSRUdFWFBfV0lMRENBUkRfTUFUQ0hFUiArXG4gICAgICAgICAgICBwYXJ0cy5qb2luKFJFR0VYUF9XSUxEQ0FSRF9NQVRDSEVSKSAgK1xuICAgICAgICAgICAgUkVHRVhQX1dJTERDQVJEX01BVENIRVJcbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gRGlzY2FyZCBmaXJzdCBtYXRjaCBvZiBub24tZ2xvYmFsIHNlYXJjaCAod2hpY2ggaXMgdGhlIHdob2xlIHN0cmluZylcbiAgICAgICAgcGFydHMuc2hpZnQoKTtcblxuICAgICAgICAvLyBGb3IgZWFjaCByZS1mb3VuZCBwYXR0ZXJuIHBhcnQsIHRyYW5zbGF0ZSAlIGFuZCBfIHRvIHJlZ2V4IGVxdWl2YWxlbnRcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IHBhcnRzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICAgICAgc3dpdGNoIChwYXJ0KSB7XG4gICAgICAgICAgICAgICAgY2FzZSBMSUtFX1dJTERDQVJEOiBwYXJ0ID0gUkVHRVhQX1dJTERDQVJEOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIExJS0VfV0lMRENIQVI6IHBhcnQgPSBSRUdFWFBfV0lMRENIQVI7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHZhciBqID0gcGFydFsxXSA9PT0gJ14nID8gMiA6IDE7XG4gICAgICAgICAgICAgICAgICAgIHBhcnQgPSAnWycgKyByZWdFeHBMSUtFLnJlc2VydmUocGFydC5zdWJzdHIoaiwgcGFydC5sZW5ndGggLSAoaiArIDEpKSkgKyAnXSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJ0c1tpXSA9IHBhcnQ7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXJ0cyA9IFtwYXR0ZXJuXTtcbiAgICB9XG5cbiAgICAvLyBGb3IgZWFjaCBzdXJyb3VuZGluZyB0ZXh0IHBhcnQsIGVzY2FwZSByZXNlcnZlZCByZWdleCBjaGFyc1xuICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBwYXJ0c1tpXSA9IHJlZ0V4cExJS0UucmVzZXJ2ZShwYXJ0c1tpXSk7XG4gICAgfVxuXG4gICAgLy8gSm9pbiBhbGwgdGhlIGludGVybGVhdmVkIHBhcnRzXG4gICAgcGFydHMgPSBwYXJ0cy5qb2luKCcnKTtcblxuICAgIC8vIE9wdGltaXplIG9yIGFuY2hvciB0aGUgcGF0dGVybiBhdCBlYWNoIGVuZCBhcyBuZWVkZWRcbiAgICBpZiAocGFydHMuc3Vic3RyKDAsIDIpID09PSBSRUdFWFBfV0lMRENBUkQpIHsgcGFydHMgPSBwYXJ0cy5zdWJzdHIoMik7IH0gZWxzZSB7IHBhcnRzID0gJ14nICsgcGFydHM7IH1cbiAgICBpZiAocGFydHMuc3Vic3RyKC0yLCAyKSA9PT0gUkVHRVhQX1dJTERDQVJEKSB7IHBhcnRzID0gcGFydHMuc3Vic3RyKDAsIHBhcnRzLmxlbmd0aCAtIDIpOyB9IGVsc2UgeyBwYXJ0cyArPSAnJCc7IH1cblxuICAgIC8vIFJldHVybiB0aGUgbmV3IHJlZ2V4XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAocGFydHMsIGlnbm9yZUNhc2UgPyAnaScgOiB1bmRlZmluZWQpO1xufVxuXG5yZWdFeHBMSUtFLnJlc2VydmUgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UocmVzZXJ2ZWQsICdcXFxcJDEnKTtcbn07XG5cbnZhciBjYWNoZSwgc2l6ZTtcblxuLyoqXG4gKiBAc3VtbWFyeSBEZWxldGUgYSBwYXR0ZXJuIGZyb20gdGhlIGNhY2hlOyBvciBjbGVhciB0aGUgd2hvbGUgY2FjaGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gW3BhdHRlcm5dIC0gVGhlIExJS0UgcGF0dGVybiB0byByZW1vdmUgZnJvbSB0aGUgY2FjaGUuIEZhaWxzIHNpbGVudGx5IGlmIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUuIElmIHBhdHRlcm4gb21pdHRlZCwgY2xlYXJzIHdob2xlIGNhY2hlLlxuICovXG4ocmVnRXhwTElLRS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKHBhdHRlcm4pIHtcbiAgICBpZiAoIXBhdHRlcm4pIHtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgc2l6ZSA9IDA7XG4gICAgfSBlbHNlIGlmIChjYWNoZVtwYXR0ZXJuXSkge1xuICAgICAgICBkZWxldGUgY2FjaGVbcGF0dGVybl07XG4gICAgICAgIHNpemUtLTtcbiAgICB9XG4gICAgcmV0dXJuIHNpemU7XG59KSgpOyAvLyBpbml0IHRoZSBjYWNoZVxuXG5yZWdFeHBMSUtFLmdldENhY2hlU2l6ZSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpemU7IH07XG5cbi8qKlxuICogQHN1bW1hcnkgQ2FjaGVkIHZlcnNpb24gb2YgYHJlZ0V4cExJS0UoKWAuXG4gKiBAZGVzYyBDYWNoZWQgZW50cmllcyBhcmUgc3ViamVjdCB0byBnYXJiYWdlIGNvbGxlY3Rpb24gaWYgYGtlZXBgIGlzIGB1bmRlZmluZWRgIG9yIGBmYWxzZWAgb24gaW5zZXJ0aW9uIG9yIGBmYWxzZWAgb24gbW9zdCByZWNlbnQgcmVmZXJlbmNlLiBHYXJiYWdlIGNvbGxlY3Rpb24gd2lsbCBvY2N1ciBpZmYgYHJlZ0V4cExJS0UuY2FjaGVNYXhgIGlzIGRlZmluZWQgYW5kIGl0IGVxdWFscyB0aGUgbnVtYmVyIG9mIGNhY2hlZCBwYXR0ZXJucy4gVGhlIGdhcmJhZ2UgY29sbGVjdG9yIHNvcnRzIHRoZSBwYXR0ZXJucyBiYXNlZCBvbiBtb3N0IHJlY2VudCByZWZlcmVuY2U7IHRoZSBvbGRlc3QgMTAlIG9mIHRoZSBlbnRyaWVzIGFyZSBkZWxldGVkLiBBbHRlcm5hdGl2ZWx5LCB5b3UgY2FuIG1hbmFnZSB0aGUgY2FjaGUgeW91cnNlbGYgdG8gYSBsaW1pdGVkIGV4dGVudCAoc2VlIHtAbGluayByZWdlRXhwTElLRS5jbGVhckNhY2hlfGNsZWFyQ2FjaGV9KS5cbiAqIEBwYXJhbSBwYXR0ZXJuIC0gdGhlIExJS0UgcGF0dGVybiAodG8gYmUpIGNvbnZlcnRlZCB0byBhIFJlZ0V4cFxuICogQHBhcmFtIFtrZWVwXSAtIElmIGdpdmVuLCBjaGFuZ2VzIHRoZSBrZWVwIHN0YXR1cyBmb3IgdGhpcyBwYXR0ZXJuIGFzIGZvbGxvd3M6XG4gKiAqIGB0cnVlYCBwZXJtYW5lbnRseSBjYWNoZXMgdGhlIHBhdHRlcm4gKG5vdCBzdWJqZWN0IHRvIGdhcmJhZ2UgY29sbGVjdGlvbikgdW50aWwgYGZhbHNlYCBpcyBnaXZlbiBvbiBhIHN1YnNlcXVlbnQgY2FsbFxuICogKiBgZmFsc2VgIGFsbG93cyBnYXJiYWdlIGNvbGxlY3Rpb24gb24gdGhlIGNhY2hlZCBwYXR0ZXJuXG4gKiAqIGB1bmRlZmluZWRgIG5vIGNoYW5nZSB0byBrZWVwIHN0YXR1c1xuICogQHJldHVybnMge1JlZ0V4cH1cbiAqL1xucmVnRXhwTElLRS5jYWNoZWQgPSBmdW5jdGlvbiAoa2VlcCwgcGF0dGVybiwgaWdub3JlQ2FzZSkge1xuICAgIGlmICh0eXBlb2Yga2VlcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWdub3JlQ2FzZSA9IHBhdHRlcm47XG4gICAgICAgIHBhdHRlcm4gPSBrZWVwO1xuICAgICAgICBrZWVwID0gZmFsc2U7XG4gICAgfVxuICAgIHZhciBwYXR0ZXJuQW5kQ2FzZSA9IHBhdHRlcm4gKyAoaWdub3JlQ2FzZSA/ICdpJyA6ICdjJyksXG4gICAgICAgIGl0ZW0gPSBjYWNoZVtwYXR0ZXJuQW5kQ2FzZV07XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgaXRlbS53aGVuID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGlmIChrZWVwICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGl0ZW0ua2VlcCA9IGtlZXA7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc2l6ZSA9PT0gcmVnRXhwTElLRS5jYWNoZU1heCkge1xuICAgICAgICAgICAgdmFyIGFnZSA9IFtdLCBhZ2VzID0gMCwga2V5LCBpO1xuICAgICAgICAgICAgZm9yIChrZXkgaW4gY2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gY2FjaGVba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW0ua2VlcCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYWdlczsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbS53aGVuIDwgYWdlW2ldLml0ZW0ud2hlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFnZS5zcGxpY2UoaSwgMCwgeyBrZXk6IGtleSwgaXRlbTogaXRlbSB9KTtcbiAgICAgICAgICAgICAgICAgICAgYWdlcysrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghYWdlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWdFeHBMSUtFKHBhdHRlcm4sIGlnbm9yZUNhc2UpOyAvLyBjYWNoZSBpcyBmdWxsIVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSA9IE1hdGguY2VpbChhZ2UubGVuZ3RoIC8gMTApOyAvLyB3aWxsIGFsd2F5cyBiZSBhdCBsZWFzdCAxXG4gICAgICAgICAgICBzaXplIC09IGk7XG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNhY2hlW2FnZVtpXS5rZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGl0ZW0gPSBjYWNoZVtwYXR0ZXJuQW5kQ2FzZV0gPSB7XG4gICAgICAgICAgICByZWdleDogcmVnRXhwTElLRShwYXR0ZXJuLCBpZ25vcmVDYXNlKSxcbiAgICAgICAgICAgIGtlZXA6IGtlZXAsXG4gICAgICAgICAgICB3aGVuOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICB9O1xuICAgICAgICBzaXplKys7XG4gICAgfVxuICAgIHJldHVybiBpdGVtLnJlZ2V4O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWdFeHBMSUtFO1xuIiwiLy8gdGVtcGxleCBub2RlIG1vZHVsZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2pvbmVpdC90ZW1wbGV4XG5cbi8qIGVzbGludC1lbnYgbm9kZSAqL1xuXG4vKipcbiAqIE1lcmdlcyB2YWx1ZXMgb2YgZXhlY3V0aW9uIGNvbnRleHQgcHJvcGVydGllcyBuYW1lZCBpbiB0ZW1wbGF0ZSBieSB7cHJvcDF9LFxuICoge3Byb3AyfSwgZXRjLiwgb3IgYW55IGphdmFzY3JpcHQgZXhwcmVzc2lvbiBpbmNvcnBvcmF0aW5nIHN1Y2ggcHJvcCBuYW1lcy5cbiAqIFRoZSBjb250ZXh0IGFsd2F5cyBpbmNsdWRlcyB0aGUgZ2xvYmFsIG9iamVjdC4gSW4gYWRkaXRpb24geW91IGNhbiBzcGVjaWZ5IGEgc2luZ2xlXG4gKiBjb250ZXh0IG9yIGFuIGFycmF5IG9mIGNvbnRleHRzIHRvIHNlYXJjaCAoaW4gdGhlIG9yZGVyIGdpdmVuKSBiZWZvcmUgZmluYWxseVxuICogc2VhcmNoaW5nIHRoZSBnbG9iYWwgY29udGV4dC5cbiAqXG4gKiBNZXJnZSBleHByZXNzaW9ucyBjb25zaXN0aW5nIG9mIHNpbXBsZSBudW1lcmljIHRlcm1zLCBzdWNoIGFzIHswfSwgezF9LCBldGMuLCBkZXJlZlxuICogdGhlIGZpcnN0IGNvbnRleHQgZ2l2ZW4sIHdoaWNoIGlzIGFzc3VtZWQgdG8gYmUgYW4gYXJyYXkuIEFzIGEgY29udmVuaWVuY2UgZmVhdHVyZSxcbiAqIGlmIGFkZGl0aW9uYWwgYXJncyBhcmUgZ2l2ZW4gYWZ0ZXIgYHRlbXBsYXRlYCwgYGFyZ3VtZW50c2AgaXMgdW5zaGlmdGVkIG9udG8gdGhlIGNvbnRleHRcbiAqIGFycmF5LCB0aHVzIG1ha2luZyBmaXJzdCBhZGRpdGlvbmFsIGFyZyBhdmFpbGFibGUgYXMgezF9LCBzZWNvbmQgYXMgezJ9LCBldGMuLCBhcyBpblxuICogYHRlbXBsZXgoJ0hlbGxvLCB7MX0hJywgJ1dvcmxkJylgLiAoezB9IGlzIHRoZSB0ZW1wbGF0ZSBzbyBjb25zaWRlciB0aGlzIHRvIGJlIDEtYmFzZWQuKVxuICpcbiAqIElmIHlvdSBwcmVmZXIgc29tZXRoaW5nIG90aGVyIHRoYW4gYnJhY2VzLCByZWRlZmluZSBgdGVtcGxleC5yZWdleHBgLlxuICpcbiAqIFNlZSB0ZXN0cyBmb3IgZXhhbXBsZXMuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlXG4gKiBAcGFyYW0gey4uLnN0cmluZ30gW2FyZ3NdXG4gKi9cbmZ1bmN0aW9uIHRlbXBsZXgodGVtcGxhdGUpIHtcbiAgICB2YXIgY29udGV4dHMgPSB0aGlzIGluc3RhbmNlb2YgQXJyYXkgPyB0aGlzIDogW3RoaXNdO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgeyBjb250ZXh0cy51bnNoaWZ0KGFyZ3VtZW50cyk7IH1cbiAgICByZXR1cm4gdGVtcGxhdGUucmVwbGFjZSh0ZW1wbGV4LnJlZ2V4cCwgdGVtcGxleC5tZXJnZXIuYmluZChjb250ZXh0cykpO1xufVxuXG50ZW1wbGV4LnJlZ2V4cCA9IC9cXHsoLio/KVxcfS9nO1xuXG50ZW1wbGV4LndpdGggPSBmdW5jdGlvbiAoaSwgcykge1xuICAgIHJldHVybiAnd2l0aCh0aGlzWycgKyBpICsgJ10peycgKyBzICsgJ30nO1xufTtcblxudGVtcGxleC5jYWNoZSA9IFtdO1xuXG50ZW1wbGV4LmRlcmVmID0gZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICghKHRoaXMubGVuZ3RoIGluIHRlbXBsZXguY2FjaGUpKSB7XG4gICAgICAgIHZhciBjb2RlID0gJ3JldHVybiBldmFsKGV4cHIpJztcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvZGUgPSB0ZW1wbGV4LndpdGgoaSwgY29kZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbGV4LmNhY2hlW3RoaXMubGVuZ3RoXSA9IGV2YWwoJyhmdW5jdGlvbihleHByKXsnICsgY29kZSArICd9KScpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV2YWxcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsZXguY2FjaGVbdGhpcy5sZW5ndGhdLmNhbGwodGhpcywga2V5KTtcbn07XG5cbnRlbXBsZXgubWVyZ2VyID0gZnVuY3Rpb24gKG1hdGNoLCBrZXkpIHtcbiAgICAvLyBBZHZhbmNlZCBmZWF0dXJlczogQ29udGV4dCBjYW4gYmUgYSBsaXN0IG9mIGNvbnRleHRzIHdoaWNoIGFyZSBzZWFyY2hlZCBpbiBvcmRlci5cbiAgICB2YXIgcmVwbGFjZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgICByZXBsYWNlbWVudCA9IGlzTmFOKGtleSkgPyB0ZW1wbGV4LmRlcmVmLmNhbGwodGhpcywga2V5KSA6IHRoaXNbMF1ba2V5XTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gJ3snICsga2V5ICsgJ30nO1xuICAgIH1cblxuICAgIHJldHVybiByZXBsYWNlbWVudDtcbn07XG5cbi8vIHRoaXMgaW50ZXJmYWNlIGNvbnNpc3RzIHNvbGVseSBvZiB0aGUgdGVtcGxleCBmdW5jdGlvbiAoYW5kIGl0J3MgcHJvcGVydGllcylcbm1vZHVsZS5leHBvcnRzID0gdGVtcGxleDtcbiIsIi8vIENyZWF0ZWQgYnkgSm9uYXRoYW4gRWl0ZW4gb24gMS83LzE2LlxuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVmVyeSBmYXN0IGFycmF5IHRlc3QuXG4gKiBGb3IgY3Jvc3MtZnJhbWUgc2NyaXB0aW5nOyB1c2UgYGNyb3NzRnJhbWVzSXNBcnJheWAgaW5zdGVhZC5cbiAqIEBwYXJhbSB7Kn0gYXJyIC0gVGhlIG9iamVjdCB0byB0ZXN0LlxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnVuc3RydW5naWZ5LmlzQXJyYXkgPSBmdW5jdGlvbihhcnIpIHsgcmV0dXJuIGFyci5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7IH07XG5cbi8qKlxuICogQHN1bW1hcnkgV2FsayBhIGhpZXJhcmNoaWNhbCBvYmplY3QgYXMgSlNPTi5zdHJpbmdpZnkgZG9lcyBidXQgd2l0aG91dCBzZXJpYWxpemluZy5cbiAqXG4gKiBAZGVzYyBVc2FnZTpcbiAqICogdmFyIG15RGlzdGlsbGVkT2JqZWN0ID0gdW5zdHJ1bmdpZnkuY2FsbChteU9iamVjdCk7XG4gKiAqIHZhciBteURpc3RpbGxlZE9iamVjdCA9IG15QXBpLmdldFN0YXRlKCk7IC8vIHdoZXJlIG15QXBpLnByb3RvdHlwZS5nZXRTdGF0ZSA9IHVuc3RydW5naWZ5XG4gKlxuICogUmVzdWx0IGVxdWl2YWxlbnQgdG8gYEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcykpYC5cbiAqXG4gKiA+IERvIG5vdCB1c2UgdGhpcyBmdW5jdGlvbiB0byBnZXQgYSBKU09OIHN0cmluZzsgdXNlIGBKU09OLnN0cmluZ2lmeSh0aGlzKWAgaW5zdGVhZC5cbiAqXG4gKiBAdGhpcyB7KnxvYmplY3R8KltdfSAtIE9iamVjdCB0byB3YWxrOyB0eXBpY2FsbHkgYW4gb2JqZWN0IG9yIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubnVsbEVsZW1lbnRzPT1mYWxzZV0gLSBQcmVzZXJ2ZSB1bmRlZmluZWQgYXJyYXkgZWxlbWVudHMgYXMgYG51bGxgcy5cbiAqIFVzZSB0aGlzIHdoZW4gcHJlY2lzZSBpbmRleCBtYXR0ZXJzIChub3QgbWVyZWx5IHRoZSBvcmRlciBvZiB0aGUgZWxlbWVudHMpLlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubnVsbFByb3BlcnRpZXM9PWZhbHNlXSAtIFByZXNlcnZlIHVuZGVmaW5lZCBvYmplY3QgcHJvcGVydGllcyBhcyBgbnVsbGBzLlxuICpcbiAqIEByZXR1cm5zIHtvYmplY3R9IC0gRGlzdGlsbGVkIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gdW5zdHJ1bmdpZnkob3B0aW9ucykge1xuICAgIHZhciBjbG9uZSwgcHJlc2VydmUsXG4gICAgICAgIG9iamVjdCA9ICh0eXBlb2YgdGhpcy50b0pTT04gPT09ICdmdW5jdGlvbicpID8gdGhpcy50b0pTT04oKSA6IHRoaXM7XG5cbiAgICBpZiAodW5zdHJ1bmdpZnkuaXNBcnJheShvYmplY3QpKSB7XG4gICAgICAgIGNsb25lID0gW107XG4gICAgICAgIHByZXNlcnZlID0gb3B0aW9ucyAmJiBvcHRpb25zLm51bGxFbGVtZW50cztcbiAgICAgICAgb2JqZWN0LmZvckVhY2goZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB1bnN0cnVuZ2lmeS5jYWxsKG9iaik7XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsb25lLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcmVzZXJ2ZSkge1xuICAgICAgICAgICAgICAgIGNsb25lLnB1c2gobnVsbCk7IC8vIHVuZGVmaW5lZCBub3QgYSB2YWxpZCBKU09OIHZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSAgaWYgKHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNsb25lID0ge307XG4gICAgICAgIHByZXNlcnZlID0gb3B0aW9ucyAmJiBvcHRpb25zLm51bGxQcm9wZXJ0aWVzO1xuICAgICAgICBPYmplY3Qua2V5cyhvYmplY3QpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB1bnN0cnVuZ2lmeS5jYWxsKG9iamVjdFtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xvbmVba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcmVzZXJ2ZSkge1xuICAgICAgICAgICAgICAgIGNsb25lW2tleV0gPSBudWxsOyAvLyB1bmRlZmluZWQgbm90IGEgdmFsaWQgSlNPTiB2YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjbG9uZSA9IG9iamVjdDtcbiAgICB9XG5cbiAgICByZXR1cm4gY2xvbmU7XG59XG5cbi8qKlxuICogVmVyeSBzbG93IGFycmF5IHRlc3QuIFN1aXRhYmxlIGZvciBjcm9zcy1mcmFtZSBzY3JpcHRpbmcuXG4gKlxuICogU3VnZ2VzdGlvbjogSWYgeW91IG5lZWQgdGhpcyBhbmQgaGF2ZSBqUXVlcnkgbG9hZGVkLCB1c2UgYGpRdWVyeS5pc0FycmF5YCBpbnN0ZWFkIHdoaWNoIGlzIHJlYXNvbmFibHkgZmFzdC5cbiAqXG4gKiBAcGFyYW0geyp9IGFyciAtIFRoZSBvYmplY3QgdG8gdGVzdC5cbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG51bnN0cnVuZ2lmeS5jcm9zc0ZyYW1lc0lzQXJyYXkgPSBmdW5jdGlvbihhcnIpIHsgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PT0gYXJyU3RyaW5nOyB9OyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsIGFyclN0cmluZyA9ICdbb2JqZWN0IEFycmF5XSc7XG5cbm1vZHVsZS5leHBvcnRzID0gdW5zdHJ1bmdpZnk7XG4iXX0=
